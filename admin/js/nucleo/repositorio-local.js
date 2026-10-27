/**
 * =====================================================================
 * REPOSITORIO-LOCAL.JS - OPERAÇÕES QUANDO NÃO HÁ SERVIDOR
 * =====================================================================
 * Mesmas operações de repositorio-servidor.js, mas gravando no
 * localStorage deste navegador e registrando a auditoria aqui mesmo.
 * Usado ao abrir o painel direto do arquivo (file://) ou em qualquer
 * endereço sem a API do banco (ex.: GitHub Pages, demonstração).
 *
 * Todas devolvem Promise, igual ao modo servidor, para as telas
 * tratarem os dois modos do mesmo jeito. A validação dos formulários
 * fica nas telas; aqui ficam a gravação e a auditoria.
 *
 * Exposto em: window.Admin.RepoLocal
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var A = raiz.Admin;
    var D = function () { return A.Dados; };
    var K = function () { return A.Dados.CHAVES; };
    var VERSAO_BACKUP = 1;

    /** Executa fn e devolve Promise (erro lançado vira Promise rejeitada). */
    function promessa(fn) {
        return new Promise(function (ok) { ok(fn()); });
    }
    function falha(msg) { throw new Error(msg); }
    function gravar(chave, valor) { if (!D().salvar(chave, valor)) falha('Não foi possível salvar os dados neste navegador.'); }
    function eu() { return A.Sessao.usuarioAtual(); }

    var RepoLocal = {
        /* ---------------- pátio ---------------- */

        /** dados: {nome, placa, entrada (ISO), modelo, chave} → veículo gravado */
        registrarEntrada: function (dados) {
            return promessa(function () {
                var patio = D().patio();
                if (patio.some(function (v) { return v.placa === dados.placa; })) falha('Este veículo já está no pátio.');
                var veiculo = {
                    id: D().novoId(), nome: dados.nome, placa: dados.placa, entrada: dados.entrada,
                    modelo: dados.modelo || '', chave: dados.chave || '', registradoPor: eu().nome
                };
                patio.push(veiculo);
                gravar(K().patio, patio);
                A.Auditoria.registrar('VEICULO_ENTRADA', { placa: veiculo.placa, motorista: veiculo.nome, entrada: veiculo.entrada });
                return veiculo;
            });
        },

        /** Saída paga. dados: {saida (ISO), pagamento, valorRecebido?} → registro do histórico */
        registrarSaida: function (id, dados) {
            return promessa(function () {
                var patio = D().patio();
                var idx = patio.findIndex(function (x) { return x.id === id; });
                if (idx < 0) falha('Este veículo já saiu do pátio.');
                var v = patio[idx];
                var cfg = D().config();
                var minutos = A.Regras.calcularMinutos(v.entrada, dados.saida);
                var valor = A.Regras.calcularValorPorMinutos(minutos, cfg);
                var registro = Object.assign({}, v, {
                    saida: dados.saida, minutos: minutos, valor: valor, pagamento: dados.pagamento,
                    tabela: { valorMinimo: cfg.valorMinimo, valorHoraAdicional: cfg.valorHoraAdicional, toleranciaMin: cfg.toleranciaMin },
                    recebidoPor: eu().nome
                });
                if (dados.pagamento === 'Dinheiro' && typeof dados.valorRecebido === 'number' && !isNaN(dados.valorRecebido)) {
                    if (dados.valorRecebido < valor) falha('O valor recebido é menor que o total.');
                    registro.valorRecebido = dados.valorRecebido;
                    registro.troco = Math.round((dados.valorRecebido - valor) * 100) / 100;
                }
                var hist = D().historico();
                hist.push(registro);
                gravar(K().historico, hist);
                patio.splice(idx, 1);
                gravar(K().patio, patio);
                A.Auditoria.registrar('VEICULO_SAIDA', { placa: registro.placa, valor: registro.valor, minutos: registro.minutos, pagamento: registro.pagamento });
                return registro;
            });
        },

        excluirVeiculo: function (id) {
            return promessa(function () {
                var v = D().patio().find(function (x) { return x.id === id; });
                if (!v) falha('Veículo não encontrado no pátio.');
                gravar(K().patio, D().patio().filter(function (x) { return x.id !== id; }));
                A.Auditoria.registrar('VEICULO_EXCLUIDO', { placa: v.placa, motorista: v.nome, entrada: v.entrada });
                return { ok: true };
            });
        },

        excluirHistorico: function (id) {
            return promessa(function () {
                var h = D().historico().find(function (x) { return x.id === id; });
                if (!h) falha('Registro não encontrado no histórico.');
                gravar(K().historico, D().historico().filter(function (x) { return x.id !== id; }));
                A.Auditoria.registrar('HISTORICO_EXCLUIDO', { placa: h.placa, valor: h.valor, saida: h.saida, pagamento: h.pagamento });
                return { ok: true };
            });
        },

        /* ---------------- configurações ---------------- */

        salvarPrecos: function (nova) {
            return promessa(function () {
                var antiga = D().config();
                var f = A.Regras.formatarMoeda;
                gravar(K().config, Object.assign({}, D().ler(K().config, {}), nova));
                A.Auditoria.registrar('CONFIG_ALTERADA', {
                    antes: f(antiga.valorMinimo) + ' + ' + f(antiga.valorHoraAdicional) + '/h, tol. ' + antiga.toleranciaMin + 'min',
                    depois: f(nova.valorMinimo) + ' + ' + f(nova.valorHoraAdicional) + '/h, tol. ' + nova.toleranciaMin + 'min'
                });
                return D().config();
            });
        },

        salvarVagas: function (vagas) {
            return promessa(function () {
                var cfg = D().config();
                A.Auditoria.registrar('CONFIG_ALTERADA', { antes: cfg.vagas + ' vagas', depois: vagas + ' vagas' });
                gravar(K().config, Object.assign({}, D().ler(K().config, {}), { vagas: vagas }));
                return D().config();
            });
        },

        /* ---------------- usuários ---------------- */

        /** dados: {nome, login, senha, perfil, trocarSenha} */
        criarUsuario: function (dados) {
            return A.Sessao.criarUsuario(dados.nome, dados.login, dados.senha, dados.perfil, dados.trocarSenha).then(function (u) {
                var lista = D().usuarios();
                if (lista.some(function (x) { return x.login === u.login; })) falha('Já existe um usuário com esse login.');
                lista.push(u);
                gravar(K().usuarios, lista);
                A.Auditoria.registrar('USUARIO_CRIADO', { alvo: u.login, perfil: u.perfil });
                return u;
            });
        },

        alterarAtivo: function (id, ativo) {
            return promessa(function () {
                var lista = D().usuarios();
                var alvo = lista.find(function (u) { return u.id === id; });
                if (!alvo) falha('Usuário não encontrado.');
                alvo.ativo = !!ativo;
                gravar(K().usuarios, lista);
                A.Auditoria.registrar(ativo ? 'USUARIO_ATIVADO' : 'USUARIO_DESATIVADO', { alvo: alvo.login });
                return alvo;
            });
        },

        removerUsuario: function (id) {
            return promessa(function () {
                var alvo = D().usuarios().find(function (u) { return u.id === id; });
                if (!alvo) falha('Usuário não encontrado.');
                gravar(K().usuarios, D().usuarios().filter(function (u) { return u.id !== id; }));
                A.Auditoria.registrar('USUARIO_REMOVIDO', { alvo: alvo.login, perfil: alvo.perfil });
                return { ok: true };
            });
        },

        /** Admin define senha provisória (troca obrigatória, exceto a própria). */
        redefinirSenha: function (id, senha) {
            return A.Seguranca.hashSenha(senha).then(function (h) {
                var lista = D().usuarios();
                var u = lista.find(function (x) { return x.id === id; });
                if (!u) falha('Usuário não encontrado.');
                u.senha = h;
                delete u.hash; delete u.sal;
                u.senhaPadrao = false;
                u.trocarSenha = u.id !== eu().id;
                gravar(K().usuarios, lista);
                A.Auditoria.registrar('SENHA_REDEFINIDA', { alvo: u.login });
                return u;
            });
        },

        /**
         * Troca a própria senha. atual = null na troca obrigatória logo após
         * o login (o usuário acabou de digitar a senha provisória).
         */
        trocarMinhaSenha: function (atual, nova) {
            var usuario = eu();
            if (!usuario) return Promise.reject(new Error('Sessão expirada. Entre novamente.'));
            var conferir = atual === null && usuario.trocarSenha ? Promise.resolve(true) : A.Seguranca.verificarSenha(String(atual || ''), usuario);
            return conferir.then(function (ok) {
                if (!ok) falha('Senha atual incorreta.');
                return A.Seguranca.hashSenha(nova);
            }).then(function (h) {
                var lista = D().usuarios();
                var u = lista.find(function (x) { return x.id === usuario.id; });
                u.senha = h;
                delete u.hash; delete u.sal;
                u.trocarSenha = false;
                u.senhaPadrao = false;
                u.senhaAlteradaEm = new Date().toISOString();
                gravar(K().usuarios, lista);
                A.Auditoria.registrar('SENHA_ALTERADA', { alvo: u.login });
                return u;
            });
        },

        /* ---------------- auditoria ---------------- */

        /** Confere a cadeia guardada neste navegador e registra a verificação. */
        verificarAuditoria: function () {
            return promessa(function () {
                var res = A.Auditoria.verificar();
                A.Auditoria.registrar('AUDITORIA_VERIFICADA', { resultado: res.ok ? 'ok' : 'falha', registros: res.total });
                return res;
            });
        },

        /* ---------------- backup ---------------- */

        /** Monta o backup (.json) com todos os dados deste navegador. */
        exportarBackup: function () {
            return promessa(function () {
                var dados = {
                    sistema: 'chaveiro-senador-painel', versao: VERSAO_BACKUP, origem: 'navegador',
                    geradoEm: new Date().toISOString(), geradoPor: eu().login,
                    usuarios: D().usuarios(), patio: D().patio(), historico: D().historico(),
                    config: D().ler(K().config, {}), auditoria: [], ancora: A.Auditoria.ancora()
                };
                A.Auditoria.registrar('BACKUP_EXPORTADO', { patio: dados.patio.length, historico: dados.historico.length });
                dados.auditoria = A.Auditoria.listar(); // inclui o registro do próprio backup
                return dados;
            });
        },

        /** Substitui todos os dados deste navegador pelos do backup (já validado na tela). */
        restaurarBackup: function (b, nomeArquivo) {
            return promessa(function () {
                var quem = eu();
                gravar(K().usuarios, b.usuarios);
                gravar(K().patio, b.patio);
                gravar(K().historico, b.historico);
                gravar(K().config, b.config || {});
                gravar(K().auditoria, b.auditoria);
                if (b.ancora) gravar(K().ancora, b.ancora); else { try { localStorage.removeItem(K().ancora); } catch (e) { /* nada */ } }
                A.Auditoria.registrar('BACKUP_RESTAURADO', { arquivo: nomeArquivo, historico: b.historico.length, patio: b.patio.length }, quem);
                return { ok: true, desconectar: !A.Sessao.usuarioAtual() };
            });
        },

        /** No modo local nada precisa ser recarregado (as telas leem direto do navegador). */
        recarregar: function () { return Promise.resolve(); }
    };

    A.RepoLocal = RepoLocal;
})(window);
