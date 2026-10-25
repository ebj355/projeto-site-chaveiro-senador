/**
 * =====================================================================
 * TELAS/PATIO.JS - ENTRADA E SAÍDA DE VEÍCULOS
 * =====================================================================
 *   ENTRADA
 *     - Começa pela placa (padrão antigo ou Mercosul). Se o carro já
 *       veio antes, mostra quantas vezes e preenche o nome e o modelo.
 *     - Nome do motorista com sugestões (clientes anteriores).
 *     - Hora de entrada preenchida com a hora atual.
 *     - Não aceita placa que já está no pátio nem hora no futuro.
 *   LISTA
 *     - Tempo colorido: verde até 1h, âmbar até 3h, vermelho acima.
 *     - Busca por placa/nome e ordenação.
 *     - Tabela no computador, cartões no celular.
 *   SAÍDA
 *     - Permanência, valor, forma de pagamento e cálculo do troco
 *       (pagamento em dinheiro), com atalhos de notas.
 *     - Move para o histórico e abre o comprovante.
 *   EXCLUSÃO (só Administrador) para lançamentos feitos por engano.
 *
 * Toda entrada, saída e exclusão vai para a auditoria.
 *
 * Exposto em: window.Admin.Telas.patio
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var A = raiz.Admin;
    var UI = A.UI, R = A.Regras, $ = UI.$, esc = UI.esc, D = UI.Datas;

    var saidaPendente = null; // dados calculados ao abrir o modal de saída

    /* ---------------- utilidades ---------------- */

    /** Filtro de busca por nome ou placa (compartilhado com o histórico). */
    function filtrar(lista, termo) {
        termo = String(termo || '').trim().toLowerCase();
        if (!termo) return lista;
        var termoPlaca = R.normalizarPlaca(termo);
        return lista.filter(function (v) {
            return v.nome.toLowerCase().indexOf(termo) >= 0 || (termoPlaca && v.placa.indexOf(termoPlaca) >= 0);
        });
    }

    /** Texto "modelo · Chave nº" (ou vazio) mostrado abaixo do nome. */
    function extras(v) {
        return [v.modelo, v.chave ? 'Chave ' + v.chave : ''].filter(Boolean).join(' · ');
    }

    /** Funções de ordenação da lista do pátio (select "Ordenar"). */
    var ORDENS = {
        antigo: function (a, b) { return new Date(a.entrada) - new Date(b.entrada); },
        recente: function (a, b) { return new Date(b.entrada) - new Date(a.entrada); },
        // placa e nome em ordem alfabética
        placa: function (a, b) { return a.placa.localeCompare(b.placa); },
        nome: function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }
    };

    /** Últimas visitas de uma placa no histórico (mais recente primeiro). */
    function visitasDaPlaca(placa) {
        return A.Dados.historico().filter(function (h) { return h.placa === placa; })
            .sort(function (a, b) { return new Date(b.saida) - new Date(a.saida); });
    }

    /** Sugestões de nomes para o campo do motorista (clientes anteriores). */
    function atualizarSugestoesNomes() {
        var nomes = {};
        A.Dados.historico().forEach(function (h) { nomes[h.nome] = true; });
        $('lista-motoristas').innerHTML = Object.keys(nomes).sort().slice(0, 300)
            .map(function (n) { return '<option value="' + esc(n) + '"></option>'; }).join('');
    }

    /* ---------------- entrada ---------------- */

    /** Ao digitar a placa: formata, avisa se já está no pátio e reconhece cliente antigo. */
    function aoDigitarPlaca() {
        var campo = $('ent-placa');
        var pos = campo.selectionStart;
        campo.value = campo.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
        try { campo.setSelectionRange(pos, pos); } catch (e) { /* alguns teclados móveis */ }
        UI.erroCampo('ent-placa', '');

        var placa = R.normalizarPlaca(campo.value);
        var info = $('ent-placa-info');
        info.textContent = '';
        if (!R.placaValida(placa)) return;

        if (A.Dados.patio().some(function (v) { return v.placa === placa; })) {
            UI.erroCampo('ent-placa', 'Este veículo já está no pátio.');
            return;
        }
        var visitas = visitasDaPlaca(placa);
        if (visitas.length) {
            var ultima = visitas[0];
            info.innerHTML = '<i class="ri-repeat-line"></i> Cliente conhecido: ' + visitas.length + ' visita(s), a última em ' + esc(D.dataHora(ultima.saida)) + '.';
            if (!$('ent-nome').value.trim()) $('ent-nome').value = ultima.nome;
            if (!$('ent-modelo').value.trim() && ultima.modelo) $('ent-modelo').value = ultima.modelo;
        }
    }

    /** Valida o formulário e grava a entrada do veículo (com auditoria). */
    function registrarEntrada(e) {
        e.preventDefault();
        if (!A.Sessao.exigir('patio.entrada')) return;

        var nome = $('ent-nome').value.trim().replace(/\s+/g, ' ');
        var placa = R.normalizarPlaca($('ent-placa').value);
        var horaStr = $('ent-hora').value;
        var ok = true;
        ['ent-nome', 'ent-placa', 'ent-hora'].forEach(function (id) { UI.erroCampo(id, ''); });

        if (!placa) { UI.erroCampo('ent-placa', 'Informe a placa.'); ok = false; }
        else if (!R.placaValida(placa)) { UI.erroCampo('ent-placa', 'Placa inválida. Use ABC-1234 ou ABC1D23.'); ok = false; }
        else if (A.Dados.patio().some(function (v) { return v.placa === placa; })) { UI.erroCampo('ent-placa', 'Este veículo já está no pátio.'); ok = false; }

        if (!nome) { UI.erroCampo('ent-nome', 'Informe o nome do motorista.'); ok = false; }
        else if (nome.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 3) { UI.erroCampo('ent-nome', 'O nome deve ter pelo menos 3 letras.'); ok = false; }

        var entrada = horaStr ? new Date(horaStr) : null;
        if (!entrada || isNaN(entrada.getTime())) { UI.erroCampo('ent-hora', 'Informe a hora de entrada.'); ok = false; }
        else if (entrada.getTime() > Date.now() + 60000) { UI.erroCampo('ent-hora', 'A hora de entrada não pode estar no futuro.'); ok = false; }

        if (!ok) {
            var primeiro = document.querySelector('#form-entrada .invalido');
            if (primeiro) primeiro.focus();
            return;
        }

        var u = A.Sessao.usuarioAtual();
        var veiculo = {
            id: A.Dados.novoId(),
            nome: nome,
            placa: placa,
            entrada: entrada.toISOString(),
            modelo: $('ent-modelo').value.trim(),
            chave: $('ent-chave').value.trim(),
            registradoPor: u.nome
        };
        var patio = A.Dados.patio();
        patio.push(veiculo);
        if (!A.Dados.salvar(A.Dados.CHAVES.patio, patio)) return;
        A.Auditoria.registrar('VEICULO_ENTRADA', { placa: placa, motorista: nome, entrada: veiculo.entrada });

        e.target.reset();
        $('ent-placa-info').textContent = '';
        $('ent-hora').value = D.paraInputDataHora(new Date());
        UI.toast('Entrada registrada: ' + R.formatarPlaca(placa));
        A.App.renderizar();
        $('ent-placa').focus(); // pronto para o próximo carro
    }

    /* ---------------- lista ---------------- */

    function renderizar() {
        A.Telas.painel.atualizarContador();
        var cfg = A.Dados.config();
        var agora = new Date();
        var todos = A.Dados.patio();
        var lista = filtrar(todos, $('busca-patio').value).sort(ORDENS[$('ordem-patio').value] || ORDENS.antigo);
        var podeExcluir = A.Sessao.pode('patio.excluir');
        $('patio-qtd').textContent = todos.length + (cfg.vagas ? ' / ' + cfg.vagas : '');

        if (!lista.length) {
            $('lista-patio').innerHTML = UI.vazio('ri-parking-box-line', todos.length ? 'Nenhum veículo encontrado para a busca.' : 'Nenhum veículo no pátio. Registre uma entrada ao lado.');
            return;
        }

        var linhas = lista.map(function (v) {
            var min = R.calcularMinutos(v.entrada, agora);
            return { v: v, min: min, cor: UI.classeTempo(min), tempo: R.formatarDuracao(min), valor: R.formatarMoeda(R.calcularValorPorMinutos(min, cfg)) };
        });
        /** Botão de excluir lançamento (só aparece para o Administrador). */
        var botaoExcluir = function (id) {
            return podeExcluir ? '<button class="btn-icone" data-excluir-patio="' + esc(id) + '" title="Excluir lançamento" aria-label="Excluir lançamento"><i class="ri-delete-bin-6-line"></i></button>' : '';
        };

        var tabela = '<div class="hidden md:block tabela-envoltorio"><table class="tabela"><thead><tr>' +
            '<th>Placa</th><th>Motorista</th><th>Entrada</th><th>Tempo</th><th class="num">Valor atual</th><th class="num"><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
            linhas.map(function (l) {
                var ex = extras(l.v);
                return '<tr><td><span class="placa">' + esc(R.formatarPlaca(l.v.placa)) + '</span></td>' +
                    '<td><div class="font-semibold text-slate-900">' + esc(l.v.nome) + '</div>' + (ex ? '<div class="text-xs text-slate-500">' + esc(ex) + '</div>' : '') + '</td>' +
                    '<td class="nw text-slate-600">' + esc(D.hora(l.v.entrada)) + ' <span class="text-xs text-slate-400">' + esc(D.diaMes(D.paraInputData(new Date(l.v.entrada)))) + '</span></td>' +
                    '<td><span class="tempo tempo-' + l.cor + '">' + l.tempo + '</span></td>' +
                    '<td class="num font-bold text-slate-900">' + l.valor + '</td>' +
                    '<td class="num"><div class="inline-flex items-center gap-1"><button class="btn-saida" data-saida="' + esc(l.v.id) + '"><i class="ri-logout-circle-r-line"></i> Saída</button>' + botaoExcluir(l.v.id) + '</div></td></tr>';
            }).join('') + '</tbody></table></div>';

        var cartoes = '<div class="md:hidden space-y-3">' + linhas.map(function (l) {
            var ex = extras(l.v);
            return '<div class="cartao-lista ' + l.cor + '">' +
                '<div class="flex items-start justify-between gap-3"><div class="min-w-0"><span class="placa">' + esc(R.formatarPlaca(l.v.placa)) + '</span>' +
                '<p class="font-semibold text-slate-900 mt-2">' + esc(l.v.nome) + '</p>' + (ex ? '<p class="text-xs text-slate-500">' + esc(ex) + '</p>' : '') + '</div>' +
                '<div class="text-right flex-shrink-0"><p class="text-xs text-slate-500">Valor atual</p><p class="text-xl font-extrabold text-slate-900">' + l.valor + '</p></div></div>' +
                '<div class="flex items-center justify-between gap-2 mt-3">' +
                '<span class="tempo tempo-' + l.cor + '"><i class="ri-time-line"></i> ' + esc(D.hora(l.v.entrada)) + ' · ' + l.tempo + '</span>' +
                '<span class="flex items-center gap-1">' + botaoExcluir(l.v.id) + '<button class="btn-saida" data-saida="' + esc(l.v.id) + '"><i class="ri-logout-circle-r-line"></i> Saída</button></span></div></div>';
        }).join('') + '</div>';

        $('lista-patio').innerHTML = tabela + cartoes;
    }

    /* ---------------- saída e troco ---------------- */

    function formaPagamento() {
        return document.querySelector('input[name="pgto"]:checked').value;
    }

    /** Mostra/oculta a área de troco e recalcula. */
    function atualizarTroco() {
        if (!saidaPendente) return;
        var dinheiro = formaPagamento() === 'Dinheiro';
        $('saida-troco-area').classList.toggle('hidden', !dinheiro);
        var recebido = parseFloat($('saida-recebido').value);
        var el = $('saida-troco');
        if (!dinheiro || isNaN(recebido)) { el.textContent = '—'; el.className = ''; return; }
        var troco = Math.round((recebido - saidaPendente.valor) * 100) / 100;
        if (troco < 0) { el.textContent = 'Faltam ' + R.formatarMoeda(-troco); el.className = 'falta'; }
        else { el.textContent = R.formatarMoeda(troco); el.className = ''; }
    }

    /** Botões de valor rápido: exato e notas que cobrem o total. */
    function desenharNotas(valor) {
        var notas = [valor].concat([10, 20, 50, 100, 200].filter(function (n) { return n > valor; }).slice(0, 3));
        $('saida-notas').innerHTML = notas.map(function (n, i) {
            return '<button type="button" data-recebido="' + n + '">' + (i === 0 ? 'Valor exato' : R.formatarMoeda(n)) + '</button>';
        }).join('');
    }

    /** Calcula permanência e valor e abre o modal de saída. */
    function abrirSaida(id) {
        if (!A.Sessao.exigir('patio.saida')) return;
        var v = A.Dados.patio().find(function (x) { return x.id === id; });
        if (!v) { UI.toast('Veículo não encontrado no pátio.', 'erro'); A.App.renderizar(); return; }

        var cfg = A.Dados.config();
        var saida = new Date();
        var min = R.calcularMinutos(v.entrada, saida);
        saidaPendente = { veiculo: v, saida: saida.toISOString(), minutos: min, valor: R.calcularValorPorMinutos(min, cfg), config: cfg };

        var ex = extras(v);
        $('saida-detalhes').innerHTML =
            '<div class="flex flex-wrap items-center gap-3 mb-3"><span class="placa text-lg">' + esc(R.formatarPlaca(v.placa)) + '</span><span class="font-semibold text-slate-900">' + esc(v.nome) + '</span></div>' +
            (ex ? '<div class="linha-detalhe"><span>Veículo / chave</span><span>' + esc(ex) + '</span></div>' : '') +
            '<div class="linha-detalhe"><span>Entrada</span><span>' + esc(D.dataHora(v.entrada)) + '</span></div>' +
            '<div class="linha-detalhe"><span>Saída</span><span>' + esc(D.dataHora(saidaPendente.saida)) + '</span></div>' +
            '<div class="linha-detalhe"><span>Permanência</span><span>' + R.formatarDuracao(min) + '</span></div>' +
            '<div class="linha-detalhe"><span>Tabela</span><span>' + R.formatarMoeda(cfg.valorMinimo) + ' até 1h + ' + R.formatarMoeda(cfg.valorHoraAdicional) + '/h</span></div>' +
            '<div class="valor-total"><span>Valor a pagar</span><strong>' + R.formatarMoeda(saidaPendente.valor) + '</strong></div>';

        document.querySelector('input[name="pgto"][value="Dinheiro"]').checked = true;
        $('saida-recebido').value = '';
        desenharNotas(saidaPendente.valor);
        atualizarTroco();
        UI.abrirModal('modal-saida');
    }

    /** Grava a saída paga no histórico, tira do pátio e abre o comprovante. */
    function confirmarSaida() {
        if (!saidaPendente || !A.Sessao.exigir('patio.saida')) return;
        var u = A.Sessao.usuarioAtual();
        var p = saidaPendente;
        var pagamento = formaPagamento();
        var recebido = parseFloat($('saida-recebido').value);
        if (pagamento === 'Dinheiro' && !isNaN(recebido) && recebido < p.valor) {
            UI.toast('O valor recebido é menor que o total.', 'erro');
            $('saida-recebido').focus();
            return;
        }

        var patio = A.Dados.patio();
        var idx = patio.findIndex(function (x) { return x.id === p.veiculo.id; });
        if (idx < 0) { UI.toast('Este veículo já saiu do pátio.', 'erro'); UI.fecharModais(); A.App.renderizar(); return; }

        var registro = Object.assign({}, p.veiculo, {
            saida: p.saida,
            minutos: p.minutos,
            valor: p.valor,
            pagamento: pagamento,
            tabela: { valorMinimo: p.config.valorMinimo, valorHoraAdicional: p.config.valorHoraAdicional, toleranciaMin: p.config.toleranciaMin },
            recebidoPor: u.nome
        });
        if (pagamento === 'Dinheiro' && !isNaN(recebido)) {
            registro.valorRecebido = recebido;
            registro.troco = Math.round((recebido - p.valor) * 100) / 100;
        }

        var hist = A.Dados.historico();
        hist.push(registro);
        if (!A.Dados.salvar(A.Dados.CHAVES.historico, hist)) return;
        patio.splice(idx, 1);
        A.Dados.salvar(A.Dados.CHAVES.patio, patio);
        A.Auditoria.registrar('VEICULO_SAIDA', { placa: registro.placa, valor: registro.valor, minutos: registro.minutos, pagamento: registro.pagamento });

        saidaPendente = null;
        $('modal-saida').classList.add('hidden');
        UI.toast('Saída registrada: ' + R.formatarMoeda(registro.valor) + ' (' + registro.pagamento + ')');
        A.App.renderizar();
        atualizarSugestoesNomes();
        mostrarComprovante(registro);
    }

    /** Monta o comprovante (único conteúdo impresso) e abre o modal. */
    function mostrarComprovante(r) {
        $('comprovante').innerHTML =
            '<div class="cab"><img src="../imagens/logo-site/chaveiro-e-carimbos-em-santo-andre-logo-901x1264.webp" alt="" class="h-14 mx-auto mb-2">' +
            '<p id="comp-titulo" class="text-lg font-extrabold text-slate-900">Comprovante de Estacionamento</p>' +
            '<p class="text-xs text-slate-500">Chaveiro Senador · Rua Senador Flaquer, 561 - Santo André/SP</p></div>' +
            '<div class="linha-detalhe"><span>Placa</span><span>' + esc(R.formatarPlaca(r.placa)) + '</span></div>' +
            '<div class="linha-detalhe"><span>Motorista</span><span>' + esc(r.nome) + '</span></div>' +
            '<div class="linha-detalhe"><span>Entrada</span><span>' + esc(D.dataHora(r.entrada)) + '</span></div>' +
            '<div class="linha-detalhe"><span>Saída</span><span>' + esc(D.dataHora(r.saida)) + '</span></div>' +
            '<div class="linha-detalhe"><span>Permanência</span><span>' + R.formatarDuracao(r.minutos) + '</span></div>' +
            '<div class="linha-detalhe"><span>Pagamento</span><span>' + esc(r.pagamento) + '</span></div>' +
            (r.valorRecebido !== undefined ? '<div class="linha-detalhe"><span>Recebido</span><span>' + R.formatarMoeda(r.valorRecebido) + '</span></div>' +
                '<div class="linha-detalhe"><span>Troco</span><span>' + R.formatarMoeda(r.troco) + '</span></div>' : '') +
            '<div class="valor-total"><span>Total pago</span><strong>' + R.formatarMoeda(r.valor) + '</strong></div>' +
            '<p class="text-xs text-slate-500 text-center mt-4">Atendente: ' + esc(r.recebidoPor) + ' · Nº ' + esc(String(r.id).toUpperCase()) + '</p>';
        UI.abrirModal('modal-comprovante');
    }

    /** Remove do pátio um lançamento feito por engano (com confirmação e auditoria). */
    function excluir(id) {
        if (!A.Sessao.exigir('patio.excluir')) return;
        var v = A.Dados.patio().find(function (x) { return x.id === id; });
        if (!v) return;
        UI.confirmar('Excluir lançamento?', 'O veículo ' + R.formatarPlaca(v.placa) + ' será removido do pátio sem cobrança. Use apenas para lançamentos feitos por engano. A exclusão fica na auditoria.', function () {
            if (!A.Sessao.exigir('patio.excluir')) return;
            A.Dados.salvar(A.Dados.CHAVES.patio, A.Dados.patio().filter(function (x) { return x.id !== id; }));
            A.Auditoria.registrar('VEICULO_EXCLUIDO', { placa: v.placa, motorista: v.nome, entrada: v.entrada });
            UI.toast('Lançamento excluído.', 'info');
            A.App.renderizar();
        }, { rotulo: 'Excluir' });
    }

    /** Leva ao pátio com o cursor no campo da placa (botão "Nova entrada" e atalho N). */
    function focarNovaEntrada() {
        if (!A.Sessao.pode('patio.entrada')) return;
        A.App.irPara('patio');
        setTimeout(function () {
            $('cartao-entrada').scrollIntoView({ behavior: 'smooth', block: 'start' });
            $('ent-placa').focus();
        }, 60);
    }

    A.Telas = A.Telas || {};
    A.Telas.patio = {
        titulo: 'Pátio',
        subtitulo: 'Entradas, saídas e cobrança',
        permissao: 'patio.ver',
        renderizar: renderizar,
        filtrar: filtrar,
        mostrarComprovante: mostrarComprovante,
        focarNovaEntrada: focarNovaEntrada,
        /** Descarta a saída em andamento (ao fechar o modal). */
        cancelarSaida: function () { saidaPendente = null; },

        iniciar: function () {
            $('ent-hora').value = D.paraInputDataHora(new Date());
            $('btn-agora').addEventListener('click', function () { $('ent-hora').value = D.paraInputDataHora(new Date()); UI.erroCampo('ent-hora', ''); });
            $('form-entrada').addEventListener('submit', registrarEntrada);
            $('ent-placa').addEventListener('input', aoDigitarPlaca);
            $('ent-nome').addEventListener('input', function () { UI.erroCampo('ent-nome', ''); });
            $('busca-patio').addEventListener('input', renderizar);
            $('ordem-patio').addEventListener('change', renderizar);
            $('btn-confirmar-saida').addEventListener('click', confirmarSaida);
            $('btn-imprimir').addEventListener('click', function () { raiz.print(); });

            // Troco
            document.querySelectorAll('input[name="pgto"]').forEach(function (r) { r.addEventListener('change', atualizarTroco); });
            $('saida-recebido').addEventListener('input', atualizarTroco);
            $('saida-recebido').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); confirmarSaida(); } });
            $('saida-notas').addEventListener('click', function (e) {
                var b = e.target.closest('[data-recebido]');
                if (!b) return;
                $('saida-recebido').value = b.dataset.recebido;
                atualizarTroco();
            });

            // Botões das listas (delegação: funcionam mesmo após redesenhar)
            document.addEventListener('click', function (e) {
                var b = e.target.closest('[data-saida],[data-excluir-patio]');
                if (!b) return;
                if (b.dataset.saida) abrirSaida(b.dataset.saida);
                else excluir(b.dataset.excluirPatio);
            });

            atualizarSugestoesNomes();
        }
    };
})(window);
