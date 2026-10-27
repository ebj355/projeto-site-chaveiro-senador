/**
 * =====================================================================
 * SESSAO.JS - LOGIN, SESSÃO E PERMISSÕES
 * =====================================================================
 * Regras de acesso ao painel:
 *
 *   - Usuário padrão: se não existir nenhum usuário, o sistema cria
 *     admin / admin (perfil Administrador). Enquanto essa senha estiver
 *     em uso o painel mostra um aviso pedindo para trocá-la.
 *   - Login com usuário + senha (senha conferida por PBKDF2, ver seguranca.js).
 *   - Bloqueio progressivo por usuário após 5 erros seguidos:
 *       1º bloqueio 5 min · 2º 15 min · 3º em diante 60 min.
 *     Vale também para usuários que não existem (não revela quem existe).
 *   - Mensagem de erro genérica: "Usuário ou senha inválidos".
 *   - Sessão no sessionStorage com token aleatório; termina:
 *       · ao fechar a aba, · ao clicar em Sair,
 *       · após 30 min sem uso, · após 8 h de qualquer forma.
 *   - O perfil é relido do cadastro a cada verificação (se o admin
 *     desativar um usuário, ele perde o acesso na hora).
 *   - Cada ação restrita passa por Sessao.exigir('permissao').
 *
 * MODO SERVIDOR (banco de dados): login, bloqueio, sessão e usuário
 *   padrão são feitos pelo servidor (servidor/lib/repositorio.js) com as
 *   mesmas regras. Aqui as funções só repassam para Admin.RepoServidor e
 *   leem o usuário logado do estado recebido. As permissões vêm de
 *   permissoes.js, o mesmo arquivo que o servidor usa.
 *
 * Perfis:
 *   admin    - dono do estacionamento: tudo
 *   operador - funcionário: pátio (entrada/saída) e histórico do dia
 *
 * Exposto em: window.Admin.Sessao
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var CHAVE_SESSAO = 'adm_sessao';
    var INATIVIDADE_MIN = 30;
    var DURACAO_MAX_HORAS = 8;
    var MAX_TENTATIVAS = 5;
    var BLOQUEIOS_MIN = [5, 15, 60];

    /** O que cada perfil pode fazer (fonte única em permissoes.js, usada também pelo servidor). */
    var PERMISSOES = raiz.Admin.Permissoes.PERMISSOES;

    /** Atalhos para os outros módulos (resolvidos na hora do uso, pois carregam depois). */
    var Dados = function () { return raiz.Admin.Dados; };
    var Seg = function () { return raiz.Admin.Seguranca; };
    var Aud = function () { return raiz.Admin.Auditoria; };
    var Srv = function () { return raiz.Admin.RepoServidor; };
    var emServidor = function () { return Dados().emServidor(); };
    var INATIVIDADE_MS = INATIVIDADE_MIN * 60000;
    var DURACAO_MS = DURACAO_MAX_HORAS * 3600000;

    /** Prazo da sessão no modo servidor (espelho do que o servidor controla). */
    function espelhoValido() {
        var e = Srv().espelho;
        return !!e && !!Srv().cache.eu && Date.now() - e.ultimoUso < INATIVIDADE_MS && Date.now() - e.inicio < DURACAO_MS;
    }

    /* ---------------- sessão ---------------- */

    function lerSessao() {
        try { return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO)); } catch (e) { return null; }
    }

    /** Grava a sessão atual no sessionStorage (some ao fechar a aba). */
    function gravarSessao(s) {
        try { sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)); } catch (e) { /* sem sessionStorage */ }
    }

    function sessaoValida(s) {
        if (!s || !s.token || !s.userId) return false;
        var agora = Date.now();
        return agora - s.ultimoUso < INATIVIDADE_MIN * 60000 && agora - s.inicio < DURACAO_MAX_HORAS * 3600000;
    }

    /* ---------------- bloqueio por tentativas ---------------- */

    function chaveBloqueio(login) { return String(login || '').trim().toLowerCase() || '(vazio)'; }

    /** Erros, nº de bloqueios e fim do bloqueio de um login. */
    function situacaoBloqueio(login) {
        var todos = Dados().ler(Dados().CHAVES.bloqueios, {});
        return todos[chaveBloqueio(login)] || { erros: 0, bloqueios: 0, ate: 0 };
    }

    /** Atualiza (ou apaga, se situacao for null) o controle de bloqueio de um login. */
    function gravarBloqueio(login, situacao) {
        var todos = Dados().ler(Dados().CHAVES.bloqueios, {});
        if (situacao) todos[chaveBloqueio(login)] = situacao; else delete todos[chaveBloqueio(login)];
        Dados().salvar(Dados().CHAVES.bloqueios, todos);
    }

    var Sessao = {
        INATIVIDADE_MIN: INATIVIDADE_MIN,
        PERMISSOES: PERMISSOES,

        LOGIN_PADRAO: 'admin',
        SENHA_PADRAO: 'admin',

        /**
         * Se ainda não existe nenhum usuário, cria o Administrador padrão
         * (admin / admin). Promise que resolve quando terminar.
         */
        garantirAdminPadrao: function () {
            if (emServidor()) return Promise.resolve(false); // o servidor cria ao iniciar
            if (Dados().usuarios().length) return Promise.resolve(false);
            return this.criarUsuario('Administrador', this.LOGIN_PADRAO, this.SENHA_PADRAO, 'admin', false).then(function (u) {
                if (Dados().usuarios().length) return false; // outra aba criou antes
                u.senhaPadrao = true; // marca para o aviso "troque a senha padrão"
                Dados().salvar(Dados().CHAVES.usuarios, [u]);
                Aud().registrar('SISTEMA_INSTALADO', { administrador: u.login, observacao: 'usuário padrão admin/admin criado' }, u);
                return true;
            });
        },

        /** Usuário logado agora, ou null. Sempre relido do cadastro. */
        usuarioAtual: function () {
            if (emServidor()) return espelhoValido() ? JSON.parse(JSON.stringify(Srv().cache.eu)) : null;
            var s = lerSessao();
            if (!sessaoValida(s)) return null;
            var u = Dados().usuarios().find(function (x) { return x.id === s.userId; });
            return u && u.ativo !== false ? u : null;
        },

        /** Sessão existia mas venceu (para avisar "sessão expirada"). */
        expirou: function () {
            if (emServidor()) return Srv().sessaoPerdida || (!!Srv().espelho && !espelhoValido());
            var s = lerSessao();
            return !!s && !sessaoValida(s);
        },

        /** Segundos até a sessão expirar por inatividade (0 se não há sessão válida). */
        segundosRestantes: function () {
            if (emServidor()) {
                if (!espelhoValido()) return 0;
                var e = Srv().espelho;
                return Math.max(0, Math.floor(Math.min(e.ultimoUso + INATIVIDADE_MS - Date.now(), e.inicio + DURACAO_MS - Date.now()) / 1000));
            }
            var s = lerSessao();
            if (!sessaoValida(s)) return 0;
            var porInatividade = s.ultimoUso + INATIVIDADE_MIN * 60000 - Date.now();
            var porDuracao = s.inicio + DURACAO_MAX_HORAS * 3600000 - Date.now();
            return Math.max(0, Math.floor(Math.min(porInatividade, porDuracao) / 1000));
        },

        /** Chamado a cada clique/tecla: empurra o prazo de inatividade. */
        renovar: function () {
            if (emServidor()) { if (espelhoValido()) Srv().marcarUso(); return; }
            var s = lerSessao();
            if (sessaoValida(s)) { s.ultimoUso = Date.now(); gravarSessao(s); }
        },

        /** O usuário logado tem esta permissão? */
        pode: function (permissao) {
            var u = this.usuarioAtual();
            return !!u && (PERMISSOES[u.perfil] || []).indexOf(permissao) !== -1;
        },

        /**
         * Garante a permissão antes de executar uma ação.
         * Se não tiver, registra ACESSO_NEGADO na auditoria e retorna false.
         */
        exigir: function (permissao) {
            if (this.pode(permissao)) return true;
            Aud().registrar('ACESSO_NEGADO', { permissao: permissao });
            if (raiz.Admin.UI) raiz.Admin.UI.toast('Você não tem permissão para esta ação.', 'erro');
            return false;
        },

        /**
         * Tenta entrar. Promise<{ok, msg, usuario, trocarSenha}>
         */
        entrar: function (login, senha) {
            if (emServidor()) return Srv().entrar(login, senha).catch(function (e) { return { ok: false, msg: e.message }; });
            var loginNorm = String(login || '').trim().toLowerCase();
            var bloq = situacaoBloqueio(loginNorm);
            var agora = Date.now();

            if (bloq.ate > agora) {
                var min = Math.ceil((bloq.ate - agora) / 60000);
                return Promise.resolve({ ok: false, msg: 'Acesso bloqueado por excesso de tentativas. Tente novamente em ' + min + ' min.' });
            }

            var usuario = Dados().usuarios().find(function (u) { return u.login === loginNorm; });
            // Mesmo sem usuário, faz o cálculo do hash para o tempo de resposta não revelar se o login existe
            var conferir = usuario
                ? Seg().verificarSenha(senha, usuario)
                : Seg().hashSenha(senha).then(function () { return false; });

            return conferir.then(function (ok) {
                if (!ok || !usuario || usuario.ativo === false) {
                    bloq.erros = (bloq.erros || 0) + 1;
                    bloq.ate = 0;
                    if (bloq.erros >= MAX_TENTATIVAS) {
                        var minutos = BLOQUEIOS_MIN[Math.min(bloq.bloqueios || 0, BLOQUEIOS_MIN.length - 1)];
                        bloq.ate = Date.now() + minutos * 60000;
                        bloq.bloqueios = (bloq.bloqueios || 0) + 1;
                        bloq.erros = 0;
                        gravarBloqueio(loginNorm, bloq);
                        Aud().registrar('LOGIN_BLOQUEADO', { login: loginNorm, minutos: minutos }, { login: loginNorm || '(vazio)', nome: '', perfil: '' });
                        return { ok: false, msg: 'Muitas tentativas incorretas. Acesso bloqueado por ' + minutos + ' minutos.' };
                    }
                    gravarBloqueio(loginNorm, bloq);
                    Aud().registrar('LOGIN_FALHA', { login: loginNorm, tentativa: bloq.erros }, { login: loginNorm || '(vazio)', nome: '', perfil: '' });
                    var restam = MAX_TENTATIVAS - bloq.erros;
                    return { ok: false, msg: 'Usuário ou senha inválidos. (' + restam + ' tentativa' + (restam === 1 ? '' : 's') + ' restante' + (restam === 1 ? '' : 's') + ')' };
                }

                // Sucesso: zera bloqueio, cria sessão e migra o hash antigo, se for o caso
                gravarBloqueio(loginNorm, null);
                var atualizar = Seg().precisaAtualizarHash(usuario) ? Seg().hashSenha(senha) : Promise.resolve(null);
                return atualizar.then(function (novoHash) {
                    var lista = Dados().usuarios();
                    var u = lista.find(function (x) { return x.id === usuario.id; });
                    if (novoHash) { u.senha = novoHash; delete u.hash; delete u.sal; }
                    u.ultimoLoginAnterior = u.ultimoLogin || null;
                    u.ultimoLogin = new Date().toISOString();
                    Dados().salvar(Dados().CHAVES.usuarios, lista);

                    gravarSessao({ token: Seg().gerarToken(24), userId: u.id, inicio: Date.now(), ultimoUso: Date.now() });
                    Aud().registrar('LOGIN_OK', {}, u);
                    return { ok: true, usuario: u, trocarSenha: !!u.trocarSenha };
                });
            });
        },

        /** Sai do painel. motivo: 'LOGOUT' (clique) ou 'SESSAO_EXPIRADA'. */
        sair: function (motivo) {
            if (emServidor()) { Srv().sair(motivo); return; }
            var s = lerSessao();
            if (s) {
                var u = Dados().usuarios().find(function (x) { return x.id === s.userId; });
                if (u) Aud().registrar(motivo || 'LOGOUT', {}, u);
            }
            try { sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* nada */ }
        },

        /** Cria um registro de usuário (sem gravar). Promise<usuario> */
        criarUsuario: function (nome, login, senha, perfil, trocarSenha) {
            return Seg().hashSenha(senha).then(function (h) {
                return {
                    id: Dados().novoId(),
                    nome: String(nome).trim(),
                    login: String(login).trim().toLowerCase(),
                    perfil: perfil === 'admin' ? 'admin' : 'operador',
                    senha: h,
                    ativo: true,
                    trocarSenha: !!trocarSenha,
                    criadoEm: new Date().toISOString(),
                    ultimoLogin: null
                };
            });
        },

        /** Valida nome/login/senha de um novo usuário. Retorna '' ou a mensagem de erro. */
        validarNovoUsuario: function (nome, login, senha, confirmacao) {
            if (String(nome || '').trim().length < 3) return 'Informe o nome (mínimo 3 letras).';
            if (!/^[a-z0-9._-]{3,30}$/i.test(String(login || '').trim())) return 'Usuário deve ter 3 a 30 caracteres (letras, números, ponto, hífen ou _).';
            var erro = Seg().validarSenhaForte(senha, login);
            if (erro) return erro;
            if (confirmacao !== undefined && senha !== confirmacao) return 'As senhas não conferem.';
            var existe = Dados().usuarios().some(function (u) { return u.login === String(login).trim().toLowerCase(); });
            return existe ? 'Já existe um usuário com esse login.' : '';
        },

        /** Minutos restantes de bloqueio para um login (0 = livre). Usado nos testes e na tela. */
        minutosBloqueado: function (login) {
            if (emServidor()) return 0; // o bloqueio fica no banco (tabela bloqueios_login)
            var b = situacaoBloqueio(login);
            return b.ate > Date.now() ? Math.ceil((b.ate - Date.now()) / 60000) : 0;
        }
    };

    raiz.Admin = raiz.Admin || {};
    raiz.Admin.Sessao = Sessao;
})(window);
