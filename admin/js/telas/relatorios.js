/**
 * =====================================================================
 * TELAS/RELATORIOS.JS - RELATÓRIOS DE GESTÃO (somente Administrador)
 * =====================================================================
 *   - Período: Hoje, 7 dias, 30 dias, Este mês, Mês anterior ou datas
 *   - Indicadores: faturamento, saídas, ticket médio, permanência média
 *   - Faturamento por dia (gráfico de barras)
 *   - Formas de pagamento (barras com percentual)
 *   - Entradas por horário do dia (com o horário de pico destacado)
 *   - Clientes frequentes (placas que mais voltaram)
 *   - Exportar o resumo em CSV (a exportação vai para a auditoria)
 *
 * Exposto em: window.Admin.Telas.relatorios
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var A = raiz.Admin;
    var UI = A.UI, R = A.Regras, $ = UI.$, esc = UI.esc, D = UI.Datas;

    /** Calcula as datas De/Até de um atalho de período. */
    function periodo(nome) {
        var hoje = D.hoje();
        var p = hoje.split('-');
        if (nome === 'hoje') return [hoje, hoje];
        if (nome === '7') return [D.somarDias(hoje, -6), hoje];
        if (nome === '30') return [D.somarDias(hoje, -29), hoje];
        if (nome === 'mes') return [p[0] + '-' + p[1] + '-01', hoje];
        if (nome === 'mes-anterior') {
            var fim = D.somarDias(p[0] + '-' + p[1] + '-01', -1);
            return [fim.slice(0, 8) + '01', fim];
        }
        return [hoje, hoje];
    }

    /** Destaca o atalho de período que corresponde às datas escolhidas. */
    function marcarChip() {
        document.querySelectorAll('[data-rel-periodo]').forEach(function (c) {
            var p = periodo(c.dataset.relPeriodo);
            c.classList.toggle('ativo', $('rel-de').value === p[0] && $('rel-ate').value === p[1]);
        });
    }

    /** HTML de um cartão de indicador. */
    function kpi(rotulo, valor, detalhe, icone, cor) {
        return '<div class="kpi"><div class="kpi-topo"><span>' + esc(rotulo) + '</span><i class="' + icone + ' kpi-icone ' + cor + '"></i></div>' +
            '<strong>' + esc(valor) + '</strong><small>' + esc(detalhe) + '</small></div>';
    }

    /** Dados do relatório para o período atual (usado na tela e no CSV). */
    function calcular() {
        var de = $('rel-de').value, ate = $('rel-ate').value;
        var hist = A.Dados.historico();
        var saidas = A.Estat.noPeriodo(hist, de, ate);
        var resumo = A.Estat.resumo(saidas);
        var dias = A.Estat.porDia(hist, de, ate);

        // Entradas por hora do dia (veículos que saíram no período + os que estão no pátio e entraram no período)
        var horas = new Array(24).fill(0);
        saidas.concat(A.Dados.patio().filter(function (v) {
            var dia = D.paraInputData(new Date(v.entrada));
            return dia >= de && dia <= ate;
        })).forEach(function (v) { horas[new Date(v.entrada).getHours()] += 1; });

        // Clientes frequentes
        var porPlaca = {};
        saidas.forEach(function (h) {
            var p = porPlaca[h.placa] || (porPlaca[h.placa] = { placa: h.placa, nome: h.nome, visitas: 0, total: 0 });
            p.visitas += 1;
            p.total += h.valor;
            p.nome = h.nome;
        });
        var frequentes = Object.keys(porPlaca).map(function (k) { return porPlaca[k]; })
            .sort(function (a, b) { return b.visitas - a.visitas || b.total - a.total; }).slice(0, 6);

        return { de: de, ate: ate, saidas: saidas, resumo: resumo, dias: dias, horas: horas, frequentes: frequentes };
    }

    /** Recalcula e redesenha indicadores, gráficos e clientes frequentes. */
    function renderizar() {
        var hoje = D.hoje();
        if (!$('rel-de').value) { var p = periodo('7'); $('rel-de').value = p[0]; $('rel-ate').value = p[1]; }
        $('rel-de').max = hoje; $('rel-ate').max = hoje;
        if ($('rel-de').value > $('rel-ate').value) $('rel-ate').value = $('rel-de').value;
        marcarChip();

        var d = calcular();
        var r = d.resumo;
        var nDias = d.dias.length;

        $('rel-kpis').innerHTML =
            kpi('Faturamento', R.formatarMoeda(r.total), 'Média por dia: ' + R.formatarMoeda(nDias ? r.total / nDias : 0), 'ri-money-dollar-circle-fill', 'verde') +
            kpi('Saídas', String(r.qtd), 'Média por dia: ' + (nDias ? (r.qtd / nDias).toFixed(1).replace('.', ',') : '0'), 'ri-logout-circle-r-fill', 'amarelo') +
            kpi('Ticket médio', r.qtd ? R.formatarMoeda(r.ticket) : '—', 'Valor médio por veículo', 'ri-bill-line', 'azul') +
            kpi('Permanência média', r.qtd ? R.formatarDuracao(r.permanencia) : '—', 'Tempo médio no pátio', 'ri-time-fill', 'escuro');

        UI.grafico.barras($('rel-graf-dias'), d.dias.map(function (x) {
            return { rotulo: D.diaMes(x.dia), valor: x.valor, classe: x.dia === hoje ? 'hoje' : '', dica: D.diaSemana(x.dia) + ' ' + D.diaMes(x.dia) + ': ' + R.formatarMoeda(x.valor) + ' em ' + x.qtd + ' saída(s)' };
        }), { formatar: function (v) { return 'R$ ' + Math.round(v); }, rotuloA11y: 'Faturamento por dia no período' });

        UI.grafico.horizontais($('rel-graf-pgto'), A.Estat.itensPagamento(r));

        var maxH = Math.max.apply(null, d.horas);
        var pico = maxH > 0 ? d.horas.indexOf(maxH) : -1;
        $('rel-pico').textContent = pico >= 0 ? 'Pico: ' + pico + 'h–' + (pico + 1) + 'h' : '';
        $('rel-pico').classList.toggle('hidden', pico < 0);
        // Mostra só o intervalo de horas com movimento (mínimo 6h às 22h)
        var primeira = Math.min(6, d.horas.findIndex(function (q) { return q > 0; }) === -1 ? 6 : d.horas.findIndex(function (q) { return q > 0; }));
        var ultima = Math.max(22, 23 - d.horas.slice().reverse().findIndex(function (q) { return q > 0; }));
        var faixa = [];
        for (var h = primeira; h <= Math.min(23, ultima); h++) faixa.push(h);
        UI.grafico.barras($('rel-graf-horas'), faixa.map(function (h) {
            return { rotulo: h + 'h', valor: d.horas[h], classe: h === pico ? 'pico' : '', dica: h + 'h às ' + (h + 1) + 'h: ' + d.horas[h] + ' entrada(s)' };
        }), { rotuloA11y: 'Entradas por horário do dia', vazio: 'Sem entradas no período.' });

        $('rel-placas').innerHTML = d.frequentes.length
            ? d.frequentes.map(function (p, i) {
                return '<div class="linha-compacta"><div class="flex items-center gap-3 min-w-0"><span class="text-slate-400 font-bold w-5">' + (i + 1) + '</span>' +
                    '<span class="placa">' + esc(R.formatarPlaca(p.placa)) + '</span><span class="truncate text-slate-700">' + esc(p.nome) + '</span></div>' +
                    '<div class="text-right flex-shrink-0"><strong class="block">' + p.visitas + ' visita' + (p.visitas === 1 ? '' : 's') + '</strong>' +
                    '<small class="text-slate-500">' + R.formatarMoeda(p.total) + '</small></div></div>';
            }).join('')
            : UI.vazio('ri-repeat-line', 'Sem clientes no período.');
    }

    /** Exporta o resumo do período (indicadores + faturamento por dia). */
    function exportarCSV() {
        if (!A.Sessao.exigir('relatorios.ver')) return;
        var d = calcular();
        var r = d.resumo;
        /** Valor com vírgula decimal (formato do Excel em português). */
        var moeda = function (v) { return Number(v).toFixed(2).replace('.', ','); };
        var br = function (dia) { return dia.split('-').reverse().join('/'); }; // aaaa-mm-dd → dd/mm/aaaa
        var linhas = [
            ['Relatório do estacionamento', br(d.de) + ' a ' + br(d.ate)],
            [],
            ['Indicador', 'Valor'],
            ['Faturamento (R$)', moeda(r.total)],
            ['Saídas', r.qtd],
            ['Ticket médio (R$)', moeda(r.ticket)],
            ['Permanência média (min)', r.permanencia],
            ['Dinheiro (R$)', moeda(r.porPgto['Dinheiro'])],
            ['Cartão (R$)', moeda(r.porPgto['Cartão'])],
            ['Pix (R$)', moeda(r.porPgto['Pix'])],
            [],
            ['Dia', 'Saídas', 'Faturamento (R$)']
        ].concat(d.dias.map(function (x) { return [br(x.dia), x.qtd, moeda(x.valor)]; }));
        var nome = 'relatorio-' + d.de + '_a_' + d.ate + '.csv';
        UI.baixarCSV(nome, linhas);
        A.Auditoria.registrar('EXPORTACAO', { arquivo: nome, registros: r.qtd });
        UI.toast('Relatório exportado.');
    }

    A.Telas = A.Telas || {};
    A.Telas.relatorios = {
        titulo: 'Relatórios',
        subtitulo: 'Faturamento e movimento por período',
        permissao: 'relatorios.ver',
        renderizar: renderizar,
        /** Liga os atalhos de período, as datas e a exportação. */
        iniciar: function () {
            document.querySelectorAll('[data-rel-periodo]').forEach(function (c) {
                c.addEventListener('click', function () {
                    var p = periodo(c.dataset.relPeriodo);
                    $('rel-de').value = p[0];
                    $('rel-ate').value = p[1];
                    renderizar();
                });
            });
            ['rel-de', 'rel-ate'].forEach(function (id) { $(id).addEventListener('change', renderizar); });
            $('btn-rel-csv').addEventListener('click', exportarCSV);
        }
    };
})(window);
