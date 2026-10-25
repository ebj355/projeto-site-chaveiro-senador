/**
 * =====================================================================
 * ARMAZENAMENTO.JS - ONDE O PAINEL GUARDA OS DADOS
 * =====================================================================
 * Os dados ficam no localStorage do navegador do computador do
 * estacionamento (não há servidor). Cada chave guarda um JSON:
 *
 *   adm_usuarios         usuários do painel (senha só como hash PBKDF2)
 *   adm_bloqueios        tentativas de login erradas por usuário
 *   adm_auditoria        registro de auditoria (encadeado por hash)
 *   adm_auditoria_ancora hash do último registro arquivado (ver auditoria.js)
 *   est_patio            veículos estacionados agora
 *   est_historico        saídas já pagas
 *   est_config           tabela de preços
 *
 * A sessão (quem está logado) fica no sessionStorage: some ao fechar a aba.
 *
 * Migração: se existirem dados do módulo antigo (estacionamento.html,
 * chaves "estac_*"), eles são copiados para as chaves novas uma única vez.
 *
 * Exposto em: window.Admin.Dados
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var CHAVES = {
        usuarios: 'adm_usuarios',
        bloqueios: 'adm_bloqueios',
        auditoria: 'adm_auditoria',
        ancora: 'adm_auditoria_ancora',
        patio: 'est_patio',
        historico: 'est_historico',
        config: 'est_config'
    };

    /** Lê uma chave e devolve o valor (ou "padrao" se não existir/estiver corrompida). */
    function ler(chave, padrao) {
        try {
            var v = localStorage.getItem(chave);
            return v ? JSON.parse(v) : padrao;
        } catch (e) {
            return padrao;
        }
    }

    /** Grava o valor. Retorna false se o navegador recusar (modo privado, cota cheia). */
    function salvar(chave, valor) {
        try {
            localStorage.setItem(chave, JSON.stringify(valor));
            return true;
        } catch (e) {
            if (raiz.Admin && raiz.Admin.UI) raiz.Admin.UI.toast('Não foi possível salvar os dados neste navegador.', 'erro');
            return false;
        }
    }

    /** Copia os dados do módulo antigo (estacionamento.html) na primeira vez. */
    function migrarModuloAntigo() {
        var mapa = [['estac_patio', CHAVES.patio], ['estac_historico', CHAVES.historico], ['estac_config', CHAVES.config], ['estac_usuarios', CHAVES.usuarios]];
        mapa.forEach(function (par) {
            try {
                var antigo = localStorage.getItem(par[0]);
                if (antigo && !localStorage.getItem(par[1])) localStorage.setItem(par[1], antigo);
            } catch (e) { /* navegador sem armazenamento: nada a migrar */ }
        });
    }

    /** Identificador curto e único para registros (veículos, saídas, usuários). */
    function novoId() {
        return Date.now().toString(36) + raiz.Admin.Seguranca.gerarToken(4);
    }

    raiz.Admin = raiz.Admin || {};
    raiz.Admin.Dados = {
        CHAVES: CHAVES,
        ler: ler,
        salvar: salvar,
        novoId: novoId,
        migrarModuloAntigo: migrarModuloAntigo,

        // Atalhos de leitura usados pelas telas
        usuarios: function () { return ler(CHAVES.usuarios, []); },
        patio: function () { return ler(CHAVES.patio, []); },
        historico: function () { return ler(CHAVES.historico, []); },
        /** Tabela de preços + dados do estacionamento (vagas). */
        config: function () { return Object.assign({ vagas: 30 }, raiz.Admin.Regras.CONFIG_PADRAO, ler(CHAVES.config, {})); }
    };
})(window);
