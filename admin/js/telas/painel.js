/**
 * =====================================================================
 * TELAS/PAINEL.JS - VISÃO GERAL DO DIA
 * =====================================================================
 *   - Saudação com o nome do usuário e a data
 *   - Indicadores: veículos no pátio (com ocupação das vagas),
 *     faturamento e saídas de hoje (comparados com ontem), ticket
 *     médio e permanência média
 *   - Gráfico do faturamento dos últimos 7 dias
 *   - Formas de pagamento de hoje
 *   - Veículos há mais tempo no pátio e atividades recentes
 *     (Operador vê apenas as próprias atividades)
 *
 * Também expõe Admin.Estat (cálculos reaproveitados em Relatórios).
 *
 * Exposto em: window.Admin.Telas.painel e window.Admin.Estat
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var A = raiz.Admin;
    var UI = A.UI, R = A.Regras, $ = UI.$, esc = UI.esc, D = UI.Datas;

    /* -----------------------------------------------------------------
       ESTATÍSTICAS (funções puras sobre a lista de saídas)
       ----------------------------------------------------------------- */
    var Estat = {
        /** Saídas cujo dia de saída está entre 'de' e 'ate' (aaaa-mm-dd). */
        noPeriodo: function (historico, de, ate) {
            return historico.filter(function (h) {
                var dia = D.paraInputData(new Date(h.saida));
                return dia >= de && dia <= ate;
            });
        },
        /** Totais de uma lista de saídas. */
        resumo: function (saidas) {
            var total = saidas.reduce(function (s, h) { return s + h.valor; }, 0);
            var minutos = saidas.reduce(function (s, h) { return s + h.minutos; }, 0);
            var porPgto = { 'Dinheiro': 0, 'Cartão': 0, 'Pix': 0 };
            var qtdPgto = { 'Dinheiro': 0, 'Cartão': 0, 'Pix': 0 };
            saidas.forEach(function (h) {
                porPgto[h.pagamento] = (porPgto[h.pagamento] || 0) + h.valor;
                qtdPgto[h.pagamento] = (qtdPgto[h.pagamento] || 0) + 1;
            });
            return {
                qtd: saidas.length,
                total: Math.round(total * 100) / 100,
                ticket: saidas.length ? total / saidas.length : 0,
                permanencia: saidas.length ? Math.round(minutos / saidas.length) : 0,
                porPgto: porPgto,
                qtdPgto: qtdPgto
            };
        },
        /** Faturamento por dia: [{dia, valor, qtd}] para cada dia do intervalo. */
        porDia: function (historico, de, ate) {
            var mapa = {};
            historico.forEach(function (h) {
                var dia = D.paraInputData(new Date(h.saida));
                if (dia < de || dia > ate) return;
                mapa[dia] = mapa[dia] || { valor: 0, qtd: 0 };
                mapa[dia].valor += h.valor;
                mapa[dia].qtd += 1;
            });
            return D.intervalo(de, ate).map(function (dia) {
                return { dia: dia, valor: mapa[dia] ? Math.round(mapa[dia].valor * 100) / 100 : 0, qtd: mapa[dia] ? mapa[dia].qtd : 0 };
            });
        },
        /** Itens para o gráfico de barras horizontais de formas de pagamento. */
        itensPagamento: function (resumo) {
            return [
                { rotulo: 'Dinheiro', valor: resumo.porPgto['Dinheiro'], texto: R.formatarMoeda(resumo.porPgto['Dinheiro']), classe: 'pg-dinheiro', icone: 'ri-money-dollar-box-line' },
                { rotulo: 'Cartão', valor: resumo.porPgto['Cartão'], texto: R.formatarMoeda(resumo.porPgto['Cartão']), classe: 'pg-cartao', icone: 'ri-bank-card-line' },
                { rotulo: 'Pix', valor: resumo.porPgto['Pix'], texto: R.formatarMoeda(resumo.porPgto['Pix']), classe: 'pg-pix', icone: 'ri-qr-code-line' }
            ];
        },
        /** Texto de variação: "▲ 12% vs ontem". Retorna {texto, classe}. */
        variacao: function (atual, anterior, rotulo) {
            if (!anterior) return { texto: atual ? 'Sem movimento ' + rotulo : 'Sem movimento ainda', classe: '' };
            var pct = Math.round(((atual - anterior) / anterior) * 100);
            if (pct === 0) return { texto: 'Igual a ' + rotulo, classe: '' };
            return { texto: (pct > 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '% vs ' + rotulo, classe: pct > 0 ? 'sobe' : 'desce' };
        }
    };

    /** "Bom dia" / "Boa tarde" / "Boa noite" conforme a hora. */
    function saudacao() {
        var h = new Date().getHours();
        return h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite');
    }

    /** Atualiza os contadores de veículos no pátio (menu lateral e barra inferior do celular). */
    function atualizarContador() {
        var qtd = A.Dados.patio().length;
        var el = $('menu-contador-patio');
        if (el) el.textContent = qtd;
        var nav = $('nav-contador-patio');
        if (nav) { nav.textContent = qtd > 99 ? '99+' : qtd; nav.classList.toggle('hidden', !qtd); }
    }

    /** Redesenha todos os blocos do painel com os dados atuais. */
    function renderizar() {
        var eu = A.Sessao.usuarioAtual();
        var cfg = A.Dados.config();
        var hist = A.Dados.historico();
        var hoje = D.hoje(), ontem = D.somarDias(hoje, -1);
        var rHoje = Estat.resumo(Estat.noPeriodo(hist, hoje, hoje));
        var rOntem = Estat.resumo(Estat.noPeriodo(hist, ontem, ontem));
        var patio = A.Dados.patio();

        // Saudação
        $('painel-saudacao').textContent = saudacao() + ', ' + eu.nome.split(' ')[0] + '!';
        $('painel-data').textContent = D.extenso(new Date()).replace(/^./, function (c) { return c.toUpperCase(); });

        // Indicadores
        var ocupacao = cfg.vagas ? Math.round((patio.length / cfg.vagas) * 100) : 0;
        $('kpi-patio').textContent = patio.length;
        $('kpi-ocupacao').textContent = ocupacao + '% de ' + cfg.vagas + ' vagas ocupadas';
        var barra = $('kpi-ocupacao-barra');
        barra.style.width = Math.min(100, ocupacao) + '%';
        barra.className = ocupacao >= 90 ? 'cheia' : (ocupacao >= 70 ? 'media' : '');

        $('kpi-faturamento').textContent = R.formatarMoeda(rHoje.total);
        var vF = Estat.variacao(rHoje.total, rOntem.total, 'ontem');
        $('kpi-faturamento-var').textContent = vF.texto;
        $('kpi-faturamento-var').className = 'variacao ' + vF.classe;

        $('kpi-saidas').textContent = rHoje.qtd;
        var vS = Estat.variacao(rHoje.qtd, rOntem.qtd, 'ontem');
        $('kpi-saidas-var').textContent = vS.texto;
        $('kpi-saidas-var').className = 'variacao ' + vS.classe;

        $('kpi-ticket').textContent = rHoje.qtd ? R.formatarMoeda(rHoje.ticket) : '—';
        $('kpi-permanencia').textContent = 'Permanência média: ' + (rHoje.qtd ? R.formatarDuracao(rHoje.permanencia) : '—');

        // Gráfico dos últimos 7 dias
        var dias = Estat.porDia(hist, D.somarDias(hoje, -6), hoje);
        var total7 = dias.reduce(function (s, d) { return s + d.valor; }, 0);
        $('painel-7dias-total').textContent = 'Total: ' + R.formatarMoeda(total7);
        UI.grafico.barras($('graf-7dias'), dias.map(function (d) {
            return {
                rotulo: (d.dia === hoje ? 'hoje' : D.diaSemana(d.dia)) + ' ' + D.diaMes(d.dia),
                valor: d.valor,
                classe: d.dia === hoje ? 'hoje' : '',
                dica: D.diaMes(d.dia) + ': ' + R.formatarMoeda(d.valor) + ' em ' + d.qtd + ' saída(s)'
            };
        }), { formatar: function (v) { return 'R$ ' + Math.round(v); }, rotuloA11y: 'Faturamento dos últimos 7 dias', vazio: 'Ainda não há saídas nos últimos 7 dias.' });

        // Pagamentos de hoje
        UI.grafico.horizontais($('graf-pgto-hoje'), Estat.itensPagamento(rHoje), 'Nenhum pagamento hoje ainda.');

        // Há mais tempo no pátio (até 6)
        var agora = new Date();
        var maisAntigos = patio.slice().sort(function (a, b) { return new Date(a.entrada) - new Date(b.entrada); }).slice(0, 6);
        $('painel-patio').innerHTML = maisAntigos.length
            ? maisAntigos.map(function (v) {
                var min = R.calcularMinutos(v.entrada, agora);
                return '<div class="linha-compacta"><div class="flex items-center gap-3 min-w-0"><span class="placa">' + esc(R.formatarPlaca(v.placa)) + '</span>' +
                    '<span class="truncate text-slate-700">' + esc(v.nome) + '</span></div>' +
                    '<div class="flex items-center gap-3 flex-shrink-0"><span class="tempo tempo-' + UI.classeTempo(min) + '">' + R.formatarDuracao(min) + '</span>' +
                    '<strong class="text-slate-900 tabular-nums">' + R.formatarMoeda(R.calcularValorPorMinutos(min, cfg)) + '</strong></div></div>';
            }).join('')
            : UI.vazio('ri-parking-box-line', 'Nenhum veículo no pátio agora.');

        // Atividades recentes (operador vê só as próprias)
        var regs = A.Auditoria.listar();
        if (!A.Sessao.pode('auditoria.ver')) regs = regs.filter(function (r) { return r.usuario === eu.login; });
        regs = regs.slice(-7).reverse();
        $('painel-atividades').innerHTML = regs.length
            ? regs.map(function (r) {
                var info = A.Auditoria.ACOES[r.acao] || { rotulo: r.acao, gravidade: 'info' };
                return '<div class="atividade"><span class="gravidade gravidade-' + info.gravidade + '">' + esc(D.hora(r.data)) + '</span>' +
                    '<div class="min-w-0"><p class="font-semibold text-slate-800">' + esc(info.rotulo) + '</p>' +
                    '<p class="text-xs text-slate-500 break-words">' + esc(r.nome || r.usuario) + resumoDetalhes(r.detalhes) + '</p></div></div>';
            }).join('')
            : UI.vazio('ri-pulse-line', 'Sem atividades ainda.');

        atualizarContador();
    }

    /** Texto curto com os detalhes mais úteis de um registro de auditoria. */
    function resumoDetalhes(d) {
        if (!d) return '';
        var partes = [];
        if (d.placa) partes.push(R.formatarPlaca(d.placa));
        if (d.valor !== undefined) partes.push(R.formatarMoeda(d.valor));
        if (d.alvo) partes.push('@' + d.alvo);
        return partes.length ? ' · ' + esc(partes.join(' · ')) : '';
    }

    A.Estat = Estat;
    A.Telas = A.Telas || {};
    A.Telas.painel = {
        titulo: 'Painel',
        subtitulo: 'Resumo do dia',
        permissao: 'painel',
        renderizar: renderizar,
        atualizarContador: atualizarContador
    };
    A.Telas.resumoDetalhes = resumoDetalhes;
})(window);
