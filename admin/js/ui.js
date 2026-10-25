/**
 * =====================================================================
 * UI.JS - FUNÇÕES DE TELA COMPARTILHADAS PELO PAINEL
 * =====================================================================
 *   $()            atalho para document.getElementById
 *   esc()          escapa texto para HTML (vem de Seguranca.esc)
 *   toast()        aviso flutuante no canto da tela
 *   erroCampo()    mensagem de erro embaixo de um campo
 *   erroForm()     mensagem de erro no topo/fim de um formulário
 *   abrirModal() / fecharModais() / confirmar()
 *   datas          formatação dd/mm/aaaa hh:mm e valores para inputs
 *   baixarCSV()    gera e baixa um arquivo CSV (abre certo no Excel)
 *   baixarArquivo() baixa qualquer texto como arquivo (ex.: backup JSON)
 *   grafico.barras()      gráfico de barras verticais em SVG
 *   grafico.horizontais() barras horizontais com percentual
 *   classeTempo()  cor da etiqueta conforme o tempo no pátio
 *
 * Exposto em: window.Admin.UI
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var Seg = raiz.Admin.Seguranca;
    var $ = function (id) { return document.getElementById(id); };
    var esc = Seg.esc;

    /** Completa com zero à esquerda: 5 → "05". */
    function pad(n) { return String(n).padStart(2, '0'); }

    /* ---------------- avisos ---------------- */

    var ICONES = { sucesso: 'ri-checkbox-circle-fill', erro: 'ri-error-warning-fill', info: 'ri-information-fill' };

    /** Mostra um aviso por ~4 segundos. tipo: sucesso | erro | info */
    function toast(msg, tipo) {
        tipo = ICONES[tipo] ? tipo : 'sucesso';
        var area = $('toasts');
        if (!area) return;
        var el = document.createElement('div');
        el.className = 'toast toast-' + tipo;
        el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
        el.innerHTML = '<i class="' + ICONES[tipo] + ' text-xl" aria-hidden="true"></i><span>' + esc(msg) + '</span>';
        area.appendChild(el);
        setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 3800);
        setTimeout(function () { el.remove(); }, 4200);
    }

    /* ---------------- erros de formulário ---------------- */

    function erroCampo(id, msg) {
        var campo = $(id);
        var p = document.querySelector('[data-erro="' + id + '"]');
        if (campo) {
            campo.classList.toggle('invalido', !!msg);
            campo.setAttribute('aria-invalid', msg ? 'true' : 'false');
        }
        if (p) p.textContent = msg || '';
    }

    /** Mostra (ou esconde, se msg vazia) a mensagem de erro de um formulário. */
    function erroForm(id, msg) {
        var p = $(id);
        if (!p) return;
        p.textContent = msg || '';
        p.classList.toggle('hidden', !msg);
    }

    /* ---------------- modais ---------------- */

    var ultimoFoco = null;

    /** Abre um modal, trava a rolagem do fundo e põe o foco no primeiro campo. */
    function abrirModal(id) {
        ultimoFoco = document.activeElement;
        $(id).classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        var foco = $(id).querySelector('input, select, button:not(.fechar-modal)') || $(id).querySelector('button');
        if (!foco) return;
        foco.focus();
        // Segunda tentativa só se o foco não ficou dentro do modal; nunca tira
        // o foco de um campo que a pessoa já esteja usando no próprio modal.
        setTimeout(function () { if (!$(id).contains(document.activeElement)) foco.focus(); }, 50);
    }

    /** Fecha todos os modais e devolve o foco ao elemento que os abriu. */
    function fecharModais() {
        document.querySelectorAll('.modal').forEach(function (m) { m.classList.add('hidden'); });
        document.body.style.overflow = '';
        if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    }

    /**
     * Pede confirmação antes de uma ação que não se desfaz.
     * aoConfirmar() pode retornar false (ou Promise<false>) para manter o modal aberto.
     * opcoes: { rotulo, htmlExtra (já escapado!), estilo: 'perigo' | 'normal' }
     */
    function confirmar(titulo, texto, aoConfirmar, opcoes) {
        opcoes = opcoes || {};
        $('conf-titulo').textContent = titulo;
        $('conf-texto').textContent = texto;
        $('conf-extra').innerHTML = opcoes.htmlExtra || '';
        var ok = $('conf-ok');
        ok.textContent = opcoes.rotulo || 'Confirmar';
        ok.className = opcoes.estilo === 'normal' ? 'btn btn-primario' : 'btn btn-perigo';
        ok.onclick = function () {
            ok.disabled = true;
            Promise.resolve(aoConfirmar()).then(function (r) {
                ok.disabled = false;
                if (r !== false) fecharModais();
            });
        };
        abrirModal('modal-confirmar');
    }

    /* ---------------- datas ---------------- */

    var Datas = {
        /** Date → "2026-10-24T14:05" (input datetime-local, hora local) */
        paraInputDataHora: function (d) {
            return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
        },
        /** Date → "2026-10-24" (input date) */
        paraInputData: function (d) {
            return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        },
        /** ISO → "24/10/2026 14:05" */
        dataHora: function (iso) {
            var d = new Date(iso);
            return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
        },
        /** ISO → "14:05" */
        hora: function (iso) {
            var d = new Date(iso);
            return pad(d.getHours()) + ':' + pad(d.getMinutes());
        },
        /** O instante ISO cai no dia "aaaa-mm-dd"? */
        mesmoDia: function (iso, dia) {
            return Datas.paraInputData(new Date(iso)) === dia;
        },
        /** Data de hoje no formato aaaa-mm-dd. */
        hoje: function () { return Datas.paraInputData(new Date()); },
        /** "aaaa-mm-dd" deslocado em n dias (n negativo = passado). */
        somarDias: function (dia, n) {
            var p = dia.split('-');
            var d = new Date(+p[0], +p[1] - 1, +p[2] + n);
            return Datas.paraInputData(d);
        },
        /** Lista de dias "aaaa-mm-dd" de 'de' até 'ate' (inclusive). */
        intervalo: function (de, ate) {
            var dias = [], d = de, limite = 400;
            while (d <= ate && limite--) { dias.push(d); d = Datas.somarDias(d, 1); }
            return dias;
        },
        /** "2026-10-24" → "24/10" */
        diaMes: function (dia) { var p = dia.split('-'); return p[2] + '/' + p[1]; },
        /** "2026-10-24" → "sáb" */
        diaSemana: function (dia) {
            var p = dia.split('-');
            return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(+p[0], +p[1] - 1, +p[2]).getDay()];
        },
        /** Data por extenso: "sábado, 24 de outubro de 2026" */
        extenso: function (d) {
            return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
    };

    /* ---------------- arquivos ---------------- */

    /**
     * Gera e baixa um CSV separado por ";" com BOM UTF-8 (acentos corretos no Excel).
     * Cada célula passa por Seguranca.celulaCSV (anti CSV-injection).
     */
    function baixarCSV(nomeArquivo, linhas) {
        var csv = '﻿' + linhas.map(function (l) { return l.map(Seg.celulaCSV).join(';'); }).join('\r\n');
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    /** Baixa um texto qualquer como arquivo. */
    function baixarArquivo(nomeArquivo, conteudo, tipo) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo || 'application/octet-stream' }));
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    /** Cor da etiqueta de tempo: verde até 1h, âmbar até 3h, vermelho acima. */
    function classeTempo(minutos) {
        return minutos <= 60 ? 'verde' : (minutos <= 180 ? 'ambar' : 'vermelho');
    }

    /* ---------------- gráficos (SVG simples, sem biblioteca) ---------------- */
    var grafico = {
        /**
         * Barras verticais.
         * @param {HTMLElement} el     onde desenhar
         * @param {Array} dados        [{rotulo, valor, dica, classe}]
         * @param {object} opcoes      {formatar(valor) → texto, altura, rotuloA11y}
         */
        barras: function (el, dados, opcoes) {
            opcoes = opcoes || {};
            var formatar = opcoes.formatar || function (v) { return String(v); };
            var L = 640, A = opcoes.altura || 220, topo = 22, base = 26, esq = 4, dir = 4;
            var max = Math.max.apply(null, dados.map(function (d) { return d.valor; }).concat([0]));
            if (!dados.length || max <= 0) {
                el.innerHTML = vazio('ri-bar-chart-box-line', opcoes.vazio || 'Sem dados no período.');
                return;
            }
            var n = dados.length;
            var largura = (L - esq - dir) / n;
            var barra = Math.max(4, Math.min(56, largura * 0.62));
            var util = A - topo - base;
            var passoRotulo = Math.ceil(n / 16);        // evita rótulos encavalados
            var mostrarValor = n <= 14;
            var partes = [];
            // linhas de grade (50% e 100%)
            [0.5, 1].forEach(function (f) {
                var y = topo + util - util * f;
                partes.push('<line class="linha-grade" x1="0" x2="' + L + '" y1="' + y + '" y2="' + y + '"/>');
            });
            dados.forEach(function (d, i) {
                var h = Math.max(d.valor > 0 ? 2 : 0, (d.valor / max) * util);
                var x = esq + i * largura + (largura - barra) / 2;
                var y = topo + util - h;
                partes.push('<rect class="barra-graf ' + (d.classe || '') + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barra.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="5"><title>' + esc(d.dica || (d.rotulo + ': ' + formatar(d.valor))) + '</title></rect>');
                if (mostrarValor && d.valor > 0) {
                    partes.push('<text class="valor-graf" x="' + (x + barra / 2).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" text-anchor="middle">' + esc(formatar(d.valor)) + '</text>');
                }
                if (i % passoRotulo === 0) {
                    partes.push('<text class="eixo" x="' + (x + barra / 2).toFixed(1) + '" y="' + (A - 8) + '" text-anchor="middle">' + esc(d.rotulo) + '</text>');
                }
            });
            var resumo = opcoes.rotuloA11y || 'Gráfico de barras';
            el.innerHTML = '<svg viewBox="0 0 ' + L + ' ' + A + '" role="img" aria-label="' + esc(resumo) + '" preserveAspectRatio="xMidYMid meet">' + partes.join('') + '</svg>';
        },

        /**
         * Barras horizontais com percentual do total.
         * @param {Array} itens [{rotulo, valor, texto, classe, icone}]
         */
        horizontais: function (el, itens, textoVazio) {
            var total = itens.reduce(function (s, i) { return s + i.valor; }, 0);
            if (!total) { el.innerHTML = vazio('ri-wallet-3-line', textoVazio || 'Nenhum pagamento no período.'); return; }
            el.innerHTML = '<div class="barras-h">' + itens.map(function (i) {
                var pct = Math.round((i.valor / total) * 100);
                return '<div class="barras-h-item"><div class="barras-h-topo"><span><i class="' + i.icone + '"></i>' + esc(i.rotulo) + '</span>' +
                    '<strong>' + esc(i.texto) + '<small>' + pct + '%</small></strong></div>' +
                    '<div class="barra"><span class="' + (i.classe || '') + '" style="width:' + pct + '%"></span></div></div>';
            }).join('') + '</div>';
        }
    };

    /** HTML de lista vazia padronizada. */
    function vazio(icone, texto) {
        return '<div class="vazio"><i class="' + icone + '" aria-hidden="true"></i>' + esc(texto) + '</div>';
    }

    raiz.Admin.UI = {
        $: $,
        esc: esc,
        toast: toast,
        erroCampo: erroCampo,
        erroForm: erroForm,
        abrirModal: abrirModal,
        fecharModais: fecharModais,
        confirmar: confirmar,
        Datas: Datas,
        baixarCSV: baixarCSV,
        baixarArquivo: baixarArquivo,
        classeTempo: classeTempo,
        grafico: grafico,
        vazio: vazio
    };
})(window);
