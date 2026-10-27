/**
 * =====================================================================
 * REPOSITORIO-SERVIDOR.JS - O PAINEL CONVERSANDO COM O BANCO DE DADOS
 * =====================================================================
 * Usado quando o painel é aberto pelo servidor (npm run servidor).
 * Cada operação chama a API (servidor/servidor.js), que valida, grava
 * no banco SQL e registra a auditoria. Depois de cada operação o painel
 * recarrega o "estado" (pátio, histórico, configuração...) e redesenha.
 *
 *   cache           último estado recebido do servidor (as telas leem daqui
 *                   pelos atalhos de Admin.Dados)
 *   recarregar()    busca o estado de novo
 *   acompanhar()    a cada 15 s confere se outro aparelho mudou algo
 *                   (compara o número da última ação da auditoria)
 *
 * Sessão: o servidor guarda a sessão num cookie HttpOnly (o JavaScript
 * não tem acesso ao token). Aqui fica só um espelho do prazo, para o
 * aviso "sua sessão vai expirar" funcionar igual ao modo local.
 *
 * Exposto em: window.Admin.RepoServidor
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var A = raiz.Admin;
    var BASE = '../api';
    var INTERVALO_ACOMPANHAR_MS = 15000;
    var INTERVALO_RENOVAR_MS = 60000;   // avisa o servidor que o usuário está ativo, no máximo 1x/min

    var ultimaRenovacao = 0;
    var timerAcompanhar = null;

    /**
     * Requisição à API. Rejeita com Error(mensagem do servidor).
     * Em 401 (sessão vencida no servidor) avisa o app para voltar ao login.
     */
    function chamar(metodo, caminho, corpo) {
        var opcoes = {
            method: metodo,
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { 'X-Painel': '1' } // exigido pelo servidor em toda alteração (anti-CSRF)
        };
        if (corpo !== undefined) {
            opcoes.headers['Content-Type'] = 'application/json';
            opcoes.body = JSON.stringify(corpo);
        }
        return fetch(BASE + caminho, opcoes).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
                if (r.ok) return j;
                if (r.status === 401 && RepoServidor.cache.eu) {
                    RepoServidor.sessaoPerdida = true;
                    limpar();
                    if (A.App) setTimeout(function () { A.App.sessaoEncerradaNoServidor(); }, 0);
                }
                var erro = new Error(j.erro || 'O servidor recusou a operação (' + r.status + ').');
                erro.status = r.status;
                throw erro;
            });
        }, function () {
            throw new Error('Sem conexão com o servidor do banco de dados. Verifique se ele está ligado.');
        });
    }

    /**
     * Esquece os dados e a sessão (após sair ou expirar). O acompanhamento
     * continua ligado: sem usuário logado ele simplesmente não consulta nada,
     * e volta a funcionar sozinho no próximo login.
     */
    function limpar() {
        RepoServidor.cache = {};
        RepoServidor.espelho = null;
    }

    /** Executa a operação e, se der certo, recarrega o estado antes de responder. */
    function alterar(metodo, caminho, corpo) {
        return chamar(metodo, caminho, corpo).then(function (resultado) {
            RepoServidor.marcarUso();
            return RepoServidor.recarregar().then(function () { return resultado; });
        });
    }

    var RepoServidor = {
        cache: {},
        espelho: null,          // { inicio, ultimoUso } da sessão no servidor
        sessaoPerdida: false,   // true quando o servidor respondeu 401 (sessão expirou lá)

        /* ---------------- estado e sincronização ---------------- */

        recarregar: function () {
            return chamar('GET', '/estado').then(function (estado) {
                RepoServidor.cache = estado;
                return estado;
            });
        },

        /** A cada 15 s pergunta a versão; se mudou (outro aparelho gravou), recarrega e redesenha. */
        acompanhar: function (aoMudar) {
            if (timerAcompanhar) clearInterval(timerAcompanhar);
            timerAcompanhar = setInterval(function () {
                if (!RepoServidor.cache.eu) return;
                chamar('GET', '/versao').then(function (r) {
                    if (r.versao !== RepoServidor.cache.versao) return RepoServidor.recarregar().then(aoMudar);
                }).catch(function () { /* sem conexão agora: tenta de novo no próximo ciclo */ });
            }, INTERVALO_ACOMPANHAR_MS);
        },

        /** Registra uso local (para o aviso de expiração) e avisa o servidor no máximo 1x por minuto. */
        marcarUso: function () {
            if (!RepoServidor.espelho) return;
            RepoServidor.espelho.ultimoUso = Date.now();
            if (Date.now() - ultimaRenovacao > INTERVALO_RENOVAR_MS) {
                ultimaRenovacao = Date.now();
                chamar('POST', '/sessao/renovar', {}).catch(function () { /* 401 já tratado em chamar() */ });
            }
        },

        /* ---------------- sessão ---------------- */

        /** Ao abrir a página: há sessão válida no servidor (cookie)? Promise<boolean> */
        restaurarSessao: function () {
            return fetch(BASE + '/sessao', { credentials: 'same-origin', cache: 'no-store' })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (s) {
                    if (!s) return false;
                    var agora = Date.now();
                    // Reconstrói o espelho a partir do tempo que o servidor diz que resta
                    RepoServidor.espelho = { inicio: agora - 60000, ultimoUso: agora - Math.max(0, 30 * 60 - s.segundosRestantes) * 1000 };
                    return RepoServidor.recarregar().then(function () { return true; });
                })
                .catch(function () { return false; });
        },

        entrar: function (login, senha) {
            return chamar('POST', '/sessao', { login: login, senha: senha }).then(function (r) {
                if (!r.ok) return r;
                RepoServidor.sessaoPerdida = false;
                RepoServidor.espelho = { inicio: Date.now(), ultimoUso: Date.now() };
                ultimaRenovacao = Date.now();
                return RepoServidor.recarregar().then(function () { return r; });
            });
        },

        sair: function (motivo) {
            var tinhaSessao = !!RepoServidor.cache.eu;
            limpar();
            if (!tinhaSessao) return Promise.resolve();
            return chamar('DELETE', '/sessao', { motivo: motivo || 'LOGOUT' }).catch(function () { /* já encerrada */ });
        },

        /* ---------------- operações (mesmas de RepoLocal) ---------------- */

        registrarEntrada: function (d) { return alterar('POST', '/patio', d); },
        registrarSaida: function (id, d) { return alterar('POST', '/patio/' + encodeURIComponent(id) + '/saida', d); },
        excluirVeiculo: function (id) { return alterar('DELETE', '/patio/' + encodeURIComponent(id)); },
        excluirHistorico: function (id) { return alterar('DELETE', '/historico/' + encodeURIComponent(id)); },
        salvarPrecos: function (d) { return alterar('PUT', '/config/precos', d); },
        salvarVagas: function (vagas) { return alterar('PUT', '/config/vagas', { vagas: vagas }); },
        criarUsuario: function (d) { return alterar('POST', '/usuarios', d); },
        alterarAtivo: function (id, ativo) { return alterar('PUT', '/usuarios/' + encodeURIComponent(id) + '/ativo', { ativo: !!ativo }); },
        removerUsuario: function (id) { return alterar('DELETE', '/usuarios/' + encodeURIComponent(id)); },
        redefinirSenha: function (id, senha) { return alterar('PUT', '/usuarios/' + encodeURIComponent(id) + '/senha', { senha: senha }); },
        trocarMinhaSenha: function (atual, nova) { return alterar('PUT', '/minha-senha', { atual: atual, nova: nova }); },
        verificarAuditoria: function () { return alterar('POST', '/auditoria/verificar', {}); },
        exportarBackup: function () { return alterar('GET', '/backup'); },

        restaurarBackup: function (b, nomeArquivo) {
            return chamar('POST', '/backup/restaurar', { backup: b, arquivo: nomeArquivo }).then(function (r) {
                if (r.desconectar) { limpar(); return r; }
                return RepoServidor.recarregar().then(function () { return r; });
            });
        },

        /** Ações que o próprio painel registra (exportações, acesso negado a uma tela). */
        registrarEvento: function (acao, detalhes) {
            return chamar('POST', '/auditoria/eventos', { acao: acao, detalhes: detalhes || {} })
                .then(function () { return RepoServidor.recarregar(); })
                .catch(function () { /* auditoria do navegador é complementar; o servidor registra o essencial */ });
        }
    };

    A.RepoServidor = RepoServidor;
})(window);
