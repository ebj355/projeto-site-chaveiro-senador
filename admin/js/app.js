/**
 * =====================================================================
 * APP.JS - INICIALIZAÇÃO, NAVEGAÇÃO E SESSÃO DO PAINEL
 * =====================================================================
 *   1. Proteções iniciais (anti-iframe), migração de dados antigos e
 *      criação do usuário padrão admin / admin (se não houver usuários)
 *   2. Estado da tela: deslogado (tela de acesso) ou logado (plataforma)
 *   3. Navegação: menu lateral (gaveta no celular) e endereço #tela
 *      - Itens sem permissão ficam escondidos
 *      - Abrir uma tela sem permissão (ex.: digitando #usuarios) é
 *        bloqueado e registrado na auditoria
 *   4. Barra superior: título, relógio e botão "Nova entrada"
 *   5. Atalhos de teclado: N = nova entrada · / = buscar · Esc = fechar
 *   6. Sessão: renova com o uso, avisa 2 min antes de expirar e
 *      encerra após 30 min parado
 *   7. Atualização automática a cada 30 s e entre abas do navegador
 *   8. Modo dos dados: ao abrir, descobre se a página veio do servidor
 *      do banco de dados (modo servidor) ou não (modo local, navegador).
 *      No modo servidor, a cada 15 s confere se outro aparelho gravou algo.
 *
 * Exposto em: window.Admin.App
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var A = raiz.Admin;
    var UI = A.UI, $ = UI.$;

    var TELAS = ['painel', 'patio', 'historico', 'relatorios', 'usuarios', 'auditoria', 'config'];
    var AVISO_SESSAO_SEG = 120; // mostra o aviso quando faltam 2 minutos
    var telaAtual = 'painel';
    var marcarPronto;
    /** Resolve quando o modo dos dados (servidor/local) já foi definido. */
    var pronto = new Promise(function (ok) { marcarPronto = ok; });

    /* ---------------- menu lateral (gaveta no celular) ---------------- */

    function abrirMenuMobile() {
        document.body.classList.add('menu-aberto');
        $('btn-menu-mobile').setAttribute('aria-expanded', 'true');
        $('btn-menu-inferior').setAttribute('aria-expanded', 'true');
    }

    /** Fecha a gaveta do menu (celular). Também chamada ao navegar e ao abrir modais. */
    function fecharMenuMobile() {
        document.body.classList.remove('menu-aberto');
        $('btn-menu-mobile').setAttribute('aria-expanded', 'false');
        $('btn-menu-inferior').setAttribute('aria-expanded', 'false');
    }

    /* ---------------- estado logado / deslogado ---------------- */

    /** Usuário que pode usar o painel agora (logado e sem troca de senha pendente). */
    function usuarioLiberado() {
        var u = A.Sessao.usuarioAtual();
        return u && !u.trocarSenha ? u : null;
    }

    /** Iniciais para o avatar: "Eduardo Benedito" → "EB". */
    function iniciais(nome) {
        var p = String(nome || '?').trim().split(/\s+/);
        return ((p[0] || '')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
    }

    /** Mostra a tela de acesso ou a plataforma, conforme a sessão. */
    function atualizarEstado(tela) {
        var u = usuarioLiberado();
        document.body.classList.toggle('logado', !!u);
        document.body.classList.toggle('perfil-admin', !!u && u.perfil === 'admin');
        fecharMenuMobile();

        if (!u) {
            UI.fecharModais();
            $('aviso-sessao').classList.add('hidden');
            A.Telas.acesso.exibir();
            return;
        }

        $('usuario-nome').textContent = u.nome;
        $('usuario-perfil').textContent = u.perfil === 'admin' ? 'Administrador' : 'Operador';
        $('usuario-iniciais').textContent = iniciais(u.nome);
        $('aviso-senha-padrao').classList.toggle('hidden', !u.senhaPadrao);

        // Esconde itens que o perfil não pode usar
        document.querySelectorAll('[data-perm]').forEach(function (el) {
            el.classList.toggle('sem-permissao', !A.Sessao.pode(el.dataset.perm));
        });

        irPara(tela || telaDoEndereco() || telaAtual, true);
    }

    /* ---------------- navegação ---------------- */

    function telaDoEndereco() {
        var t = (raiz.location.hash || '').replace('#', '');
        return TELAS.indexOf(t) >= 0 ? t : null;
    }

    /**
     * Abre uma tela.
     * @param {string} tela        nome da tela (ver TELAS)
     * @param {boolean} silencioso true = não registra acesso negado (ex.: troca de usuário)
     */
    function irPara(tela, silencioso) {
        var def = A.Telas[tela];
        if (!def || TELAS.indexOf(tela) < 0) { tela = 'painel'; def = A.Telas.painel; }
        if (!A.Sessao.pode(def.permissao)) {
            if (!silencioso) A.Sessao.exigir(def.permissao); // registra ACESSO_NEGADO
            tela = 'painel'; def = A.Telas.painel;
        }
        var mudou = telaAtual !== tela;
        telaAtual = tela;
        TELAS.forEach(function (t) { $('tela-' + t).classList.toggle('hidden', t !== tela); });
        // Marca a tela atual no menu lateral e na barra inferior do celular
        document.querySelectorAll('.menu-item[data-tela], .nav-inferior-item[data-ir]').forEach(function (b) {
            var ativa = (b.dataset.tela || b.dataset.ir) === tela;
            b.classList.toggle('ativa', ativa);
            if (ativa) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
        });
        $('titulo-tela').textContent = def.titulo;
        $('subtitulo-tela').textContent = def.subtitulo || '';
        document.title = def.titulo + ' | Painel · Chaveiro Senador';
        if (raiz.location.hash !== '#' + tela) history.replaceState(null, '', '#' + tela);
        fecharMenuMobile();
        if (mudou) raiz.scrollTo(0, 0);
        renderizar();
    }

    /** Redesenha a tela atual (chamado após qualquer alteração de dados). */
    function renderizar() {
        if (!usuarioLiberado()) return;
        var def = A.Telas[telaAtual];
        if (def && def.renderizar) def.renderizar();
        A.Telas.painel.atualizarContador();
    }

    /** Encerra a sessão, registra na auditoria e volta para a tela de login. */
    function sair(motivo) {
        A.Sessao.sair(motivo);
        UI.fecharModais();
        telaAtual = 'painel';
        $('form-login').reset();
        UI.erroForm('login-erro', '');
        atualizarEstado();
        UI.toast(motivo === 'SESSAO_EXPIRADA' ? 'Sessão expirada por inatividade. Entre novamente.' : 'Sessão encerrada.', 'info');
    }

    /** O servidor avisou que a sessão acabou (expirou lá ou o usuário foi desativado). */
    function sessaoEncerradaNoServidor() {
        if (document.body.classList.contains('logado')) sair('SESSAO_EXPIRADA');
    }

    /** Selo no menu: onde os dados estão sendo gravados. */
    function mostrarModo() {
        var el = $('modo-dados');
        if (!el) return;
        var servidor = A.Dados.emServidor();
        el.className = 'modo-dados ' + (servidor ? 'servidor' : 'local');
        el.innerHTML = servidor
            ? '<i class="ri-database-2-fill" aria-hidden="true"></i><span>Dados no banco de dados (servidor)</span>'
            : '<i class="ri-computer-line" aria-hidden="true"></i><span>Dados só neste navegador</span>';
        el.title = servidor ? 'Todos os aparelhos conectados ao servidor veem os mesmos dados.' : 'Sem servidor: os dados ficam no armazenamento deste navegador. Faça backup.';
    }

    /* ---------------- relógio e aviso de sessão ---------------- */

    function atualizarRelogio() {
        var d = new Date();
        $('relogio').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    /** Mostra a contagem regressiva quando faltam menos de 2 min para expirar. */
    function verificarSessao() {
        if (!document.body.classList.contains('logado')) return;
        if (!usuarioLiberado()) { sair(A.Sessao.expirou() ? 'SESSAO_EXPIRADA' : 'LOGOUT'); return; }
        var seg = A.Sessao.segundosRestantes();
        var aviso = $('aviso-sessao');
        if (seg <= AVISO_SESSAO_SEG) {
            $('aviso-sessao-tempo').textContent = Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0');
            aviso.classList.remove('hidden');
        } else {
            aviso.classList.add('hidden');
        }
    }

    /* ---------------- atalhos de teclado ---------------- */

    function digitandoEmCampo(e) {
        var t = e.target;
        return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    }

    /** Atalhos de teclado: Esc fecha modal/menu; N = nova entrada; / = foca a busca da tela. */
    function atalhos(e) {
        if (e.key === 'Escape') {
            if (document.querySelector('.modal:not(.hidden)')) { A.Telas.patio.cancelarSaida(); UI.fecharModais(); }
            else fecharMenuMobile();
            return;
        }
        if (!usuarioLiberado() || digitandoEmCampo(e) || e.ctrlKey || e.metaKey || e.altKey) return;
        if (document.querySelector('.modal:not(.hidden)')) return;
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); A.Telas.patio.focarNovaEntrada(); }
        if (e.key === '/') {
            var busca = { patio: 'busca-patio', historico: 'busca-hist' }[telaAtual];
            if (busca) { e.preventDefault(); $(busca).focus(); }
        }
    }

    /* ---------------- início ---------------- */

    function iniciar() {
        A.Seguranca.protegerContraFrames();

        // Cada tela liga os próprios eventos
        ['acesso', 'patio', 'historico', 'relatorios', 'auditoria', 'usuarios', 'config'].forEach(function (t) {
            if (A.Telas[t] && A.Telas[t].iniciar) A.Telas[t].iniciar();
        });

        // Menu e atalhos de navegação
        document.querySelectorAll('.menu-item[data-tela], .menu-marca, [data-ir]').forEach(function (b) {
            b.addEventListener('click', function (e) {
                e.preventDefault();
                irPara(b.dataset.tela || b.dataset.ir);
            });
        });
        document.querySelectorAll('[data-acao="nova-entrada"], #btn-topo-entrada').forEach(function (b) {
            b.addEventListener('click', function () { A.Telas.patio.focarNovaEntrada(); });
        });
        $('btn-menu-mobile').addEventListener('click', function () {
            document.body.classList.contains('menu-aberto') ? fecharMenuMobile() : abrirMenuMobile();
        });
        // "Mais" da barra inferior do celular abre/fecha o mesmo menu lateral
        $('btn-menu-inferior').addEventListener('click', function () {
            document.body.classList.contains('menu-aberto') ? fecharMenuMobile() : abrirMenuMobile();
        });
        $('menu-fundo').addEventListener('click', fecharMenuMobile);
        raiz.addEventListener('resize', function () { if (raiz.innerWidth >= 1024) fecharMenuMobile(); });
        $('btn-sair').addEventListener('click', function () { sair('LOGOUT'); });
        raiz.addEventListener('hashchange', function () { if (usuarioLiberado()) irPara(telaDoEndereco() || 'painel'); });

        // Modais: botão fechar e clique no fundo
        var fechar = function () { A.Telas.patio.cancelarSaida(); UI.fecharModais(); };
        document.querySelectorAll('.fechar-modal').forEach(function (b) { b.addEventListener('click', fechar); });
        document.querySelectorAll('.modal').forEach(function (m) { m.addEventListener('mousedown', function (e) { if (e.target === m) fechar(); }); });
        document.addEventListener('keydown', atalhos);

        // Sessão: qualquer uso renova o prazo de inatividade
        ['click', 'keydown', 'touchstart'].forEach(function (ev) {
            document.addEventListener(ev, function () { A.Sessao.renovar(); }, { passive: true });
        });
        $('btn-continuar-sessao').addEventListener('click', function () {
            A.Sessao.renovar();
            $('aviso-sessao').classList.add('hidden');
            UI.toast('Sessão renovada.', 'info');
        });

        // Relógio (15 s), sessão (5 s) e atualização dos tempos do pátio (30 s)
        atualizarRelogio();
        setInterval(atualizarRelogio, 15000);
        setInterval(verificarSessao, 5000);
        setInterval(function () {
            if ((telaAtual === 'patio' || telaAtual === 'painel') && !document.querySelector('.modal:not(.hidden)')) renderizar();
        }, 30000);

        // Alterações feitas em outra aba/janela do mesmo navegador (modo local)
        raiz.addEventListener('storage', function (e) {
            if (A.Dados.emServidor()) return;
            if (!e.key || /^(adm_|est_)/.test(e.key)) {
                if (!usuarioLiberado()) atualizarEstado(); else renderizar();
            }
        });

        // Voltar pelo botão do navegador depois de sair não mostra dados
        raiz.addEventListener('pageshow', function () { pronto.then(function () { atualizarEstado(); }); });

        // Descobre onde ficam os dados e só então mostra o login ou o painel
        A.Dados.detectarModo().then(function (modo) {
            mostrarModo();
            if (modo === 'servidor') {
                // Outro aparelho gravou algo: recarrega e redesenha (sem atrapalhar um modal aberto)
                A.RepoServidor.acompanhar(function () {
                    if (!usuarioLiberado()) { atualizarEstado(); return; }
                    if (!document.querySelector('.modal:not(.hidden)')) renderizar();
                    if (A.Telas.patio.atualizarSugestoesNomes) A.Telas.patio.atualizarSugestoesNomes();
                });
                return A.RepoServidor.restaurarSessao();
            }
            A.Dados.migrarModuloAntigo();
            // Sessão encontrada vencida ao abrir a página
            if (A.Sessao.expirou()) A.Sessao.sair('SESSAO_EXPIRADA');
            // Sem nenhum usuário: cria admin / admin e só então mostra o login
            return A.Sessao.garantirAdminPadrao();
        }).then(function () {
            marcarPronto();
            atualizarEstado();
            if (A.Dados.emServidor()) A.Telas.patio.atualizarSugestoesNomes();
        });
    }

    A.App = {
        pronto: pronto,
        sessaoEncerradaNoServidor: sessaoEncerradaNoServidor,
        atualizarEstado: atualizarEstado,
        irPara: irPara,
        renderizar: renderizar,
        fecharMenuMobile: fecharMenuMobile
    };

    document.addEventListener('DOMContentLoaded', iniciar);
})(window);
