/**
 * =====================================================================
 * PERMISSOES.JS - O QUE CADA PERFIL PODE FAZER
 * =====================================================================
 * Fonte única das permissões, usada em dois lugares:
 *   - no navegador (sessao.js esconde menus e bloqueia ações)
 *   - no servidor (servidor/lib/rotas.js recusa a requisição)
 * O navegador só melhora a experiência; quem decide de verdade, quando
 * há servidor, é o servidor.
 *
 * Perfis:
 *   admin    - dono do estacionamento: tudo
 *   operador - funcionário: pátio (entrada/saída) e histórico do dia
 *
 * Exposto em: window.Admin.Permissoes (navegador) ou module.exports (Node)
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var PERMISSOES = {
        admin: ['painel', 'patio.ver', 'patio.entrada', 'patio.saida', 'patio.excluir',
                'historico.ver', 'historico.todas_datas', 'historico.excluir', 'historico.exportar',
                'usuarios.gerenciar', 'config.alterar', 'config.backup', 'auditoria.ver', 'auditoria.exportar',
                'relatorios.ver', 'senha.propria'],
        operador: ['painel', 'patio.ver', 'patio.entrada', 'patio.saida', 'historico.ver', 'senha.propria']
    };

    /** O perfil tem esta permissão? */
    function perfilPode(perfil, permissao) {
        return (PERMISSOES[perfil] || []).indexOf(permissao) !== -1;
    }

    var Permissoes = { PERMISSOES: PERMISSOES, perfilPode: perfilPode };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Permissoes;
    } else {
        raiz.Admin = raiz.Admin || {};
        raiz.Admin.Permissoes = Permissoes;
    }
})(typeof window !== 'undefined' ? window : this);
