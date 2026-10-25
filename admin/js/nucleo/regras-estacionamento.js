/**
 * =====================================================================
 * REGRAS-ESTACIONAMENTO.JS - REGRAS DE NEGÓCIO DO ESTACIONAMENTO
 * =====================================================================
 * Funções "puras": recebem dados e devolvem resultado, sem mexer na
 * tela nem no armazenamento. Por isso podem ser testadas sozinhas:
 *     node testes/testes-regras.js
 *
 * Regras:
 *   RN01 - Valor: mínimo até 1 hora + valor por hora adicional iniciada
 *          (fração de hora conta como hora cheia; tolerância opcional)
 *   RN02 - Placa: padrão antigo (ABC-1234) ou Mercosul (ABC1D23)
 *
 * Exposto em: window.Admin.Regras (navegador) ou module.exports (Node)
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    /** Tabela de preços padrão. O Administrador pode mudar em Configurações. */
    var CONFIG_PADRAO = {
        valorMinimo: 5.0,        // R$ cobrados até 60 minutos
        valorHoraAdicional: 2.0, // R$ por hora adicional iniciada
        toleranciaMin: 0         // minutos de folga antes de cobrar a hora adicional
    };

    /** Minutos inteiros entre entrada e saída (segundos são desprezados). */
    function calcularMinutos(entrada, saida) {
        var ms = new Date(saida).getTime() - new Date(entrada).getTime();
        if (isNaN(ms)) throw new Error('Data inválida');
        return Math.max(0, Math.floor(ms / 60000));
    }

    /**
     * RN01 - Valor a pagar para uma permanência em minutos.
     *   valor = mínimo + adicional × max(0, ⌈(minutos − 60 − tolerância) / 60⌉)
     * Exemplos (tabela padrão): 60 min = R$ 5,00 · 61 min = R$ 7,00 · 121 min = R$ 9,00
     */
    function calcularValorPorMinutos(minutos, config) {
        var c = Object.assign({}, CONFIG_PADRAO, config || {});
        var excedente = minutos - 60 - Number(c.toleranciaMin || 0);
        var horasAdicionais = excedente > 0 ? Math.ceil(excedente / 60) : 0;
        var valor = Number(c.valorMinimo) + Number(c.valorHoraAdicional) * horasAdicionais;
        return Math.round(valor * 100) / 100; // evita 6.999999 por arredondamento
    }

    /** Atalho: valor direto a partir das datas de entrada e saída. */
    function calcularValor(entrada, saida, config) {
        return calcularValorPorMinutos(calcularMinutos(entrada, saida), config);
    }

    /** RN02 - Tira espaços/hífens e deixa em maiúsculas: "abc-1234" → "ABC1234". */
    function normalizarPlaca(placa) {
        return String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    /** RN02 - 3 letras + 1 número + (letra ou número) + 2 números. */
    function placaValida(placa) {
        return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizarPlaca(placa));
    }

    /** Placa para exibição: ABC-1234 (antiga) ou ABC1D23 (Mercosul). */
    function formatarPlaca(placa) {
        var p = normalizarPlaca(placa);
        return /^[A-Z]{3}[0-9]{4}$/.test(p) ? p.slice(0, 3) + '-' + p.slice(3) : p;
    }

    /** 1234.5 → "R$ 1.234,50" */
    function formatarMoeda(valor) {
        return 'R$ ' + Number(valor).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    /** 95 → "1h 35min" · 40 → "40min" */
    function formatarDuracao(minutos) {
        var h = Math.floor(minutos / 60);
        var m = minutos % 60;
        return h === 0 ? m + 'min' : h + 'h ' + String(m).padStart(2, '0') + 'min';
    }

    var Regras = {
        CONFIG_PADRAO: CONFIG_PADRAO,
        calcularMinutos: calcularMinutos,
        calcularValorPorMinutos: calcularValorPorMinutos,
        calcularValor: calcularValor,
        normalizarPlaca: normalizarPlaca,
        placaValida: placaValida,
        formatarPlaca: formatarPlaca,
        formatarMoeda: formatarMoeda,
        formatarDuracao: formatarDuracao
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Regras;
    } else {
        raiz.Admin = raiz.Admin || {};
        raiz.Admin.Regras = Regras;
    }
})(typeof window !== 'undefined' ? window : this);
