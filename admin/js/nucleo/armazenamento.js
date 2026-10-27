/**
 * =====================================================================
 * ARMAZENAMENTO.JS - ONDE O PAINEL GUARDA OS DADOS
 * =====================================================================
 * O painel funciona de dois jeitos, escolhidos sozinhos ao abrir:
 *
 *   MODO SERVIDOR  (página aberta pelo servidor: npm run servidor)
 *     Os dados ficam no BANCO DE DADOS SQL (servidor/dados/estacionamento.db).
 *     Todos os computadores e celulares veem o mesmo pátio. Quem grava,
 *     calcula o valor e registra a auditoria é o servidor
 *     (ver nucleo/repositorio-servidor.js e servidor/lib/repositorio.js).
 *
 *   MODO LOCAL  (arquivo aberto direto, sem servidor)
 *     Os dados ficam no localStorage deste navegador, como antes
 *     (ver nucleo/repositorio-local.js). Chaves usadas:
 *       adm_usuarios, adm_bloqueios, adm_auditoria, adm_auditoria_ancora,
 *       est_patio, est_historico, est_config
 *
 * As telas não precisam saber qual é o modo:
 *   - LEEM pelos atalhos síncronos abaixo (Dados.patio(), Dados.config()...)
 *   - GRAVAM pelas operações de Admin.Repo (sempre devolvem uma Promise)
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

    /** Lê uma chave do localStorage (ou "padrao" se não existir/estiver corrompida). */
    function ler(chave, padrao) {
        try {
            var v = localStorage.getItem(chave);
            return v ? JSON.parse(v) : padrao;
        } catch (e) {
            return padrao;
        }
    }

    /** Grava no localStorage. Retorna false se o navegador recusar (modo privado, cota cheia). */
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

    /** Cópia profunda (as telas podem mexer no que recebem sem estragar o cache). */
    function copia(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }

    /** Cache do modo servidor (preenchido por repositorio-servidor.js). */
    function cache() { return raiz.Admin.RepoServidor.cache; }

    var Dados = {
        CHAVES: CHAVES,
        ler: ler,
        salvar: salvar,
        novoId: novoId,
        migrarModuloAntigo: migrarModuloAntigo,

        /** 'local' ou 'servidor' (definido por detectarModo ao abrir o painel). */
        modo: 'local',

        /**
         * Descobre se a página foi aberta pelo servidor do banco de dados
         * e escolhe Admin.Repo. Promise<'servidor'|'local'>.
         */
        detectarModo: function () {
            var definir = function (modo) {
                Dados.modo = modo;
                raiz.Admin.Repo = modo === 'servidor' ? raiz.Admin.RepoServidor : raiz.Admin.RepoLocal;
                return modo;
            };
            if (!/^https?:$/.test(raiz.location.protocol) || !raiz.fetch) return Promise.resolve(definir('local'));
            var limite = new Promise(function (ok) { setTimeout(function () { ok(null); }, 3000); });
            var consulta = fetch('../api/saude', { cache: 'no-store', credentials: 'same-origin' })
                .then(function (r) { return r.ok ? r.json() : null; })
                .catch(function () { return null; });
            return Promise.race([consulta, limite]).then(function (j) {
                return definir(j && j.sistema === 'chaveiro-senador-api' ? 'servidor' : 'local');
            });
        },

        emServidor: function () { return Dados.modo === 'servidor'; },

        /* ---------- leituras síncronas usadas pelas telas ---------- */

        usuarios: function () { return Dados.emServidor() ? copia(cache().usuarios || []) : ler(CHAVES.usuarios, []); },
        patio: function () { return Dados.emServidor() ? copia(cache().patio || []) : ler(CHAVES.patio, []); },
        historico: function () { return Dados.emServidor() ? copia(cache().historico || []) : ler(CHAVES.historico, []); },

        /** Tabela de preços + vagas. */
        config: function () {
            var gravada = Dados.emServidor() ? (cache().config || {}) : ler(CHAVES.config, {});
            return Object.assign({ vagas: 30 }, raiz.Admin.Regras.CONFIG_PADRAO, gravada);
        },

        /**
         * Clientes conhecidos (para preencher a entrada): placa, nº de visitas,
         * última saída, último nome e modelo. No servidor vem pronto da
         * visão vw_clientes do banco; no modo local é calculado do histórico.
         */
        clientes: function () {
            if (Dados.emServidor()) return copia(cache().clientes || []);
            var porPlaca = {};
            Dados.historico().forEach(function (h) {
                var c = porPlaca[h.placa] || (porPlaca[h.placa] = { placa: h.placa, visitas: 0, ultimaSaida: '', nome: '', modelo: '' });
                c.visitas++;
                if (h.saida > c.ultimaSaida) { c.ultimaSaida = h.saida; c.nome = h.nome; c.modelo = h.modelo || ''; }
            });
            return Object.keys(porPlaca).map(function (p) { return porPlaca[p]; });
        },

        /** Cliente de uma placa (ou null). */
        cliente: function (placa) {
            return Dados.clientes().find(function (c) { return c.placa === placa; }) || null;
        }
    };

    raiz.Admin = raiz.Admin || {};
    raiz.Admin.Dados = Dados;
})(window);
