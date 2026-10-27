/**
 * =====================================================================
 * TELAS/HISTORICO.JS - SAÍDAS PAGAS
 * =====================================================================
 *   - Período: atalhos (Hoje, Ontem, 7 e 30 dias) ou datas De/Até
 *     (Operador: somente o dia de hoje)
 *   - Filtros por forma de pagamento e busca por placa/motorista
 *   - Resumo: total, quantidade, ticket médio e valor por pagamento
 *   - Reimpressão do comprovante
 *   - Administrador: exportar CSV e excluir saída lançada por engano
 *
 * Exposto em: window.Admin.Telas.historico
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var A = raiz.Admin;
    var UI = A.UI, R = A.Regras, $ = UI.$, esc = UI.esc, D = UI.Datas;

    /** Garante datas válidas e a restrição do Operador (só hoje). */
    function normalizarPeriodo() {
        var hoje = D.hoje();
        var de = $('hist-de'), ate = $('hist-ate');
        if (!A.Sessao.pode('historico.todas_datas')) {
            [de, ate].forEach(function (c) { c.value = hoje; c.min = hoje; c.max = hoje; c.disabled = true; });
            return;
        }
        [de, ate].forEach(function (c) { c.removeAttribute('min'); c.max = hoje; c.disabled = false; });
        if (!de.value) de.value = hoje;
        if (!ate.value) ate.value = hoje;
        if (de.value > ate.value) ate.value = de.value;
    }

    /** Marca o chip do período quando as datas coincidem com ele. */
    function marcarChip() {
        var hoje = D.hoje();
        document.querySelectorAll('[data-hist-periodo]').forEach(function (c) {
            var n = parseInt(c.dataset.histPeriodo, 10);
            var de = n === 1 ? D.somarDias(hoje, -1) : D.somarDias(hoje, -Math.max(0, n - 1));
            var ate = n === 1 ? de : hoje;
            c.classList.toggle('ativo', $('hist-de').value === de && $('hist-ate').value === ate);
        });
    }

    /** Saídas que passam nos filtros (mais recentes primeiro). */
    function filtradas() {
        var lista = A.Estat.noPeriodo(A.Dados.historico(), $('hist-de').value, $('hist-ate').value);
        var pgto = $('hist-pgto').value;
        if (pgto) lista = lista.filter(function (h) { return h.pagamento === pgto; });
        return A.Telas.patio.filtrar(lista, $('busca-hist').value).sort(function (a, b) { return new Date(b.saida) - new Date(a.saida); });
    }

    /** HTML de um quadradinho do resumo (Total, Saídas, Pix...). */
    function itemResumo(rotulo, valor, destaque) {
        return '<div class="resumo-item' + (destaque ? ' destaque' : '') + '"><small>' + esc(rotulo) + '</small><strong>' + esc(valor) + '</strong></div>';
    }

    /** Redesenha resumo e lista (tabela no computador, cartões no celular). */
    function renderizar() {
        normalizarPeriodo();
        marcarChip();
        var lista = filtradas();
        var r = A.Estat.resumo(lista);
        var umDia = $('hist-de').value === $('hist-ate').value;

        $('hist-resumo').innerHTML =
            itemResumo('Total', R.formatarMoeda(r.total), true) +
            itemResumo('Saídas', String(r.qtd)) +
            itemResumo('Ticket médio', r.qtd ? R.formatarMoeda(r.ticket) : '—') +
            itemResumo('Dinheiro', R.formatarMoeda(r.porPgto['Dinheiro'])) +
            itemResumo('Cartão', R.formatarMoeda(r.porPgto['Cartão'])) +
            itemResumo('Pix', R.formatarMoeda(r.porPgto['Pix']));

        if (!lista.length) {
            $('lista-historico').innerHTML = UI.vazio('ri-file-list-3-line', 'Nenhuma saída encontrada para os filtros escolhidos.');
            return;
        }

        var podeExcluir = A.Sessao.pode('historico.excluir');
        /** Botões de cada linha: comprovante (todos) e excluir (só Administrador). */
        var acoes = function (h) {
            return '<button class="btn-icone azul" data-comprovante="' + esc(h.id) + '" title="Ver comprovante" aria-label="Ver comprovante"><i class="ri-file-list-3-line"></i></button>' +
                (podeExcluir ? '<button class="btn-icone" data-excluir-hist="' + esc(h.id) + '" title="Excluir" aria-label="Excluir"><i class="ri-delete-bin-6-line"></i></button>' : '');
        };
        // Com mais de um dia no período, a coluna de saída mostra também a data
        var quando = function (iso) { return umDia ? D.hora(iso) : D.dataHora(iso); };

        var tabela = '<div class="hidden md:block tabela-envoltorio"><table class="tabela"><thead><tr>' +
            '<th>Placa</th><th>Motorista</th><th>Entrada</th><th>Saída</th><th>Tempo</th><th>Pagamento</th><th class="num">Valor</th><th class="num"><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
            lista.map(function (h) {
                return '<tr><td><span class="placa">' + esc(R.formatarPlaca(h.placa)) + '</span></td>' +
                    '<td class="font-semibold text-slate-900">' + esc(h.nome) + '</td>' +
                    '<td class="nw text-slate-600">' + esc(quando(h.entrada)) + '</td><td class="nw text-slate-600">' + esc(quando(h.saida)) + '</td>' +
                    '<td class="nw">' + R.formatarDuracao(h.minutos) + '</td><td>' + esc(h.pagamento) + '</td>' +
                    '<td class="num font-bold">' + R.formatarMoeda(h.valor) + '</td>' +
                    '<td class="num"><div class="inline-flex">' + acoes(h) + '</div></td></tr>';
            }).join('') +
            '</tbody><tfoot><tr><td colspan="6">Total (' + r.qtd + ' saída' + (r.qtd === 1 ? '' : 's') + ')</td><td class="num">' + R.formatarMoeda(r.total) + '</td><td></td></tr></tfoot></table></div>';

        var cartoes = '<div class="md:hidden space-y-3">' + lista.map(function (h) {
            return '<div class="cartao-lista verde">' +
                '<div class="flex items-start justify-between gap-3"><div class="min-w-0"><span class="placa">' + esc(R.formatarPlaca(h.placa)) + '</span>' +
                '<p class="font-semibold text-slate-900 mt-2">' + esc(h.nome) + '</p></div>' +
                '<p class="text-xl font-extrabold text-slate-900 flex-shrink-0">' + R.formatarMoeda(h.valor) + '</p></div>' +
                '<div class="flex items-center justify-between gap-2 mt-3 text-sm text-slate-600">' +
                '<span>' + esc(D.hora(h.entrada)) + ' → ' + esc(quando(h.saida)) + ' · ' + R.formatarDuracao(h.minutos) + ' · ' + esc(h.pagamento) + '</span>' +
                '<span class="flex flex-shrink-0">' + acoes(h) + '</span></div></div>';
        }).join('') + '</div>';

        $('lista-historico').innerHTML = tabela + cartoes;
    }

    /** Exporta as saídas filtradas em CSV (abre no Excel) e registra na auditoria. */
    function exportarCSV() {
        if (!A.Sessao.exigir('historico.exportar')) return;
        var lista = filtradas();
        if (!lista.length) { UI.toast('Não há registros para exportar.', 'info'); return; }
        var linhas = [['Placa', 'Motorista', 'Modelo/cor', 'Chave', 'Entrada', 'Saída', 'Permanência (min)', 'Pagamento', 'Valor (R$)', 'Recebido (R$)', 'Troco (R$)', 'Atendente']]
            .concat(lista.map(function (h) {
                /** Número com vírgula decimal ou vazio (para o CSV). */
                var n = function (v) { return v === undefined ? '' : Number(v).toFixed(2).replace('.', ','); };
                return [R.formatarPlaca(h.placa), h.nome, h.modelo, h.chave, D.dataHora(h.entrada), D.dataHora(h.saida), h.minutos, h.pagamento, n(h.valor), n(h.valorRecebido), n(h.troco), h.recebidoPor];
            }));
        var nome = 'estacionamento-' + $('hist-de').value + (($('hist-de').value !== $('hist-ate').value) ? '_a_' + $('hist-ate').value : '') + '.csv';
        UI.baixarCSV(nome, linhas);
        A.Auditoria.registrar('EXPORTACAO', { arquivo: nome, registros: lista.length });
        UI.toast('CSV exportado.');
    }

    /** Exclui uma saída lançada por engano (com confirmação e auditoria). */
    function excluir(id) {
        if (!A.Sessao.exigir('historico.excluir')) return;
        var h = A.Dados.historico().find(function (x) { return x.id === id; });
        if (!h) return;
        UI.confirmar('Excluir do histórico?', 'A saída de ' + R.formatarPlaca(h.placa) + ' (' + R.formatarMoeda(h.valor) + ') será apagada e deixará de contar no faturamento. A exclusão fica registrada na auditoria.', function () {
            if (!A.Sessao.exigir('historico.excluir')) return;
            A.Repo.excluirHistorico(id).then(function () {
                UI.toast('Registro excluído.', 'info');
                A.App.renderizar();
            }).catch(UI.erroOperacao);
        }, { rotulo: 'Excluir' });
    }

    A.Telas = A.Telas || {};
    A.Telas.historico = {
        titulo: 'Histórico',
        subtitulo: 'Saídas pagas e totais por período',
        permissao: 'historico.ver',
        renderizar: renderizar,

        /** Liga filtros, atalhos de período, exportação e botões das linhas. */
        iniciar: function () {
            ['hist-de', 'hist-ate', 'hist-pgto'].forEach(function (id) { $(id).addEventListener('change', renderizar); });
            $('busca-hist').addEventListener('input', renderizar);
            $('btn-hist-csv').addEventListener('click', exportarCSV);
            document.querySelectorAll('[data-hist-periodo]').forEach(function (c) {
                c.addEventListener('click', function () {
                    var n = parseInt(c.dataset.histPeriodo, 10), hoje = D.hoje();
                    if (n > 1 && !A.Sessao.pode('historico.todas_datas')) return;
                    $('hist-de').value = n === 1 ? D.somarDias(hoje, -1) : D.somarDias(hoje, -Math.max(0, n - 1));
                    $('hist-ate').value = n === 1 ? $('hist-de').value : hoje;
                    renderizar();
                });
            });
            document.addEventListener('click', function (e) {
                var b = e.target.closest('[data-comprovante],[data-excluir-hist]');
                if (!b) return;
                if (b.dataset.comprovante) {
                    var h = A.Dados.historico().find(function (x) { return x.id === b.dataset.comprovante; });
                    if (h) A.Telas.patio.mostrarComprovante(h);
                } else {
                    excluir(b.dataset.excluirHist);
                }
            });
        }
    };
})(window);
