/**
 * =====================================================================
 * TELAS/AUDITORIA.JS - CONSULTA DA AUDITORIA (somente Administrador)
 * =====================================================================
 *   - Filtros: período, usuário e ação
 *   - Lista paginada (50 por vez), mais recentes primeiro
 *   - Selo de gravidade (info / alerta / crítico) e hash de cada registro
 *   - "Verificar integridade": recalcula a cadeia de hashes e aponta o
 *     primeiro registro alterado ou removido
 *   - Exportar CSV (a exportação também é auditada)
 *   Não existe opção de apagar ou editar registros.
 *
 * Exposto em: window.Admin.Telas.auditoria
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var A = raiz.Admin;
    var UI = A.UI, $ = UI.$, esc = UI.esc, D = UI.Datas;
    var POR_PAGINA = 50;
    var mostrando = POR_PAGINA;

    /** Preenche os selects de usuário e ação com o que existe nos registros. */
    function preencherFiltros(regs) {
        var selU = $('aud-usuario'), selA = $('aud-acao');
        var uAtual = selU.value, aAtual = selA.value;
        var usuarios = Array.from(new Set(regs.map(function (r) { return r.usuario; }))).sort();
        selU.innerHTML = '<option value="">Todos</option>' + usuarios.map(function (u) { return '<option value="' + esc(u) + '">' + esc(u) + '</option>'; }).join('');
        selA.innerHTML = '<option value="">Todas</option>' +
            '<option value="@critico">Somente críticas</option><option value="@alerta">Alertas e críticas</option>' +
            Object.keys(A.Auditoria.ACOES).map(function (k) { return '<option value="' + k + '">' + esc(A.Auditoria.ACOES[k].rotulo) + '</option>'; }).join('');
        selU.value = usuarios.indexOf(uAtual) >= 0 ? uAtual : '';
        selA.value = aAtual;
    }

    /** Aplica os filtros da tela (período, usuário, ação/gravidade). Mais recentes primeiro. */
    function filtrados(regs) {
        var de = $('aud-de').value, ate = $('aud-ate').value, usu = $('aud-usuario').value, acao = $('aud-acao').value;
        return regs.filter(function (r) {
            var dia = D.paraInputData(new Date(r.data));
            if (de && dia < de) return false;
            if (ate && dia > ate) return false;
            if (usu && r.usuario !== usu) return false;
            var g = (A.Auditoria.ACOES[r.acao] || {}).gravidade;
            if (acao === '@critico' && g !== 'critico') return false;
            if (acao === '@alerta' && g === 'info') return false;
            if (acao && acao[0] !== '@' && r.acao !== acao) return false;
            return true;
        }).reverse();
    }

    /** Nomes amigáveis e formatação dos campos mais comuns dos detalhes. */
    var CAMPOS = {
        placa: ['Placa', function (v) { return A.Regras.formatarPlaca(v); }],
        valor: ['Valor', function (v) { return A.Regras.formatarMoeda(v); }],
        minutos: ['Permanência', function (v) { return A.Regras.formatarDuracao(v); }],
        entrada: ['Entrada', function (v) { return D.dataHora(v); }],
        saida: ['Saída', function (v) { return D.dataHora(v); }],
        motorista: ['Motorista'], pagamento: ['Pagamento'], alvo: ['Usuário afetado'], perfil: ['Perfil'],
        login: ['Login digitado'], tentativa: ['Tentativa'], minutos_bloqueio: ['Bloqueio (min)'],
        antes: ['Antes'], depois: ['Depois'], arquivo: ['Arquivo'], registros: ['Registros'],
        permissao: ['Permissão'], resultado: ['Resultado'], administrador: ['Administrador']
    };

    /** Detalhes do registro em texto legível ("Placa: ABC-1234 · Valor: R$ 7,00"). */
    function detalhesTexto(d) {
        return Object.keys(d || {}).map(function (k) {
            var c = CAMPOS[k];
            var valor = c && c[1] ? c[1](d[k]) : d[k];
            return (c ? c[0] : k) + ': ' + valor;
        }).join(' · ');
    }

    /** Faixa verde (íntegra) ou vermelha (adulterada) no topo da tela. */
    function mostrarIntegridade(res, manual) {
        $('aud-integridade').innerHTML = res.ok
            ? '<div class="integridade ok"><i class="ri-shield-check-fill"></i><div><strong>Integridade OK.</strong> ' + res.total + ' registro(s) conferido(s); nenhum foi alterado ou removido' + (manual ? ' (verificado agora).' : '.') + '</div></div>'
            : '<div class="integridade falha"><i class="ri-alarm-warning-fill"></i><div><strong>Atenção: a auditoria foi adulterada.</strong> ' + esc(res.motivo) + ' Exporte o CSV e verifique quem teve acesso a este computador.</div></div>';
    }

    /** Redesenha filtros, faixa de integridade e a lista paginada. */
    function renderizar() {
        var regs = A.Auditoria.listar();
        preencherFiltros(regs);
        mostrarIntegridade(A.Auditoria.verificar(), false);

        var lista = filtrados(regs);
        var pagina = lista.slice(0, mostrando);
        $('aud-qtd').textContent = lista.length + ' registro(s) no filtro · ' + regs.length + ' guardado(s) (limite ' + A.Auditoria.LIMITE + ')';
        $('btn-aud-mais').classList.toggle('hidden', lista.length <= mostrando);

        if (!pagina.length) { $('lista-auditoria').innerHTML = UI.vazio('ri-file-shield-2-line', 'Nenhum registro no filtro.'); return; }

        /** Selo colorido com o nome da ação e sua gravidade. */
        var selo = function (r) {
            var info = A.Auditoria.ACOES[r.acao] || { rotulo: r.acao, gravidade: 'info' };
            return '<span class="gravidade gravidade-' + info.gravidade + '">' + esc(info.rotulo) + '</span>';
        };

        var tabela = '<div class="hidden md:block tabela-envoltorio"><table class="tabela"><thead><tr>' +
            '<th>Nº</th><th>Data/hora</th><th>Usuário</th><th>Ação</th><th>Detalhes</th><th>Hash</th></tr></thead><tbody>' +
            pagina.map(function (r) {
                return '<tr><td class="nw text-gray-500">' + r.seq + '</td>' +
                    '<td class="nw">' + esc(D.dataHora(r.data)) + '</td>' +
                    '<td><div class="font-semibold">' + esc(r.usuario) + '</div><div class="text-xs text-gray-500">' + esc(r.nome) + '</div></td>' +
                    '<td>' + selo(r) + '</td>' +
                    '<td class="text-sm text-gray-700 break-words" style="max-width:280px">' + esc(detalhesTexto(r.detalhes)) + '</td>' +
                    '<td class="hash" title="' + esc(r.hash) + '">' + esc(r.hash.slice(0, 10)) + '…</td></tr>';
            }).join('') + '</tbody></table></div>';

        var cartoes = '<div class="md:hidden space-y-3">' + pagina.map(function (r) {
            return '<div class="cartao-lista"><div class="flex items-start justify-between gap-2">' + selo(r) +
                '<span class="text-xs text-gray-500 nw">nº ' + r.seq + ' · ' + esc(D.dataHora(r.data)) + '</span></div>' +
                '<p class="font-semibold text-gray-900 mt-2">' + esc(r.usuario) + (r.nome ? ' <span class="font-normal text-gray-500">· ' + esc(r.nome) + '</span>' : '') + '</p>' +
                '<p class="text-sm text-gray-700 break-words">' + esc(detalhesTexto(r.detalhes)) + '</p>' +
                '<p class="hash mt-1">' + esc(r.hash.slice(0, 16)) + '…</p></div>';
        }).join('') + '</div>';

        $('lista-auditoria').innerHTML = tabela + cartoes;
    }

    /** Exporta os registros filtrados (com os hashes) e registra a exportação. */
    function exportarCSV() {
        if (!A.Sessao.exigir('auditoria.exportar')) return;
        var lista = filtrados(A.Auditoria.listar());
        if (!lista.length) { UI.toast('Não há registros para exportar.', 'info'); return; }
        var linhas = [['Nº', 'Data/hora', 'Usuário', 'Nome', 'Perfil', 'Ação', 'Gravidade', 'Detalhes', 'Hash anterior', 'Hash']]
            .concat(lista.map(function (r) {
                var info = A.Auditoria.ACOES[r.acao] || { rotulo: r.acao, gravidade: '' };
                return [r.seq, D.dataHora(r.data), r.usuario, r.nome, r.perfil, info.rotulo, info.gravidade, detalhesTexto(r.detalhes), r.anterior, r.hash];
            }));
        var nome = 'auditoria-' + D.hoje() + '.csv';
        UI.baixarCSV(nome, linhas);
        A.Auditoria.registrar('EXPORTACAO', { arquivo: nome, registros: lista.length });
        UI.toast('Auditoria exportada.');
        renderizar();
    }

    A.Telas = A.Telas || {};
    A.Telas.auditoria = {
        titulo: 'Auditoria',
        subtitulo: 'Quem fez o quê e quando',
        permissao: 'auditoria.ver',
        renderizar: renderizar,
        /** Liga filtros, paginação, verificação de integridade e exportação. */
        iniciar: function () {
            ['aud-de', 'aud-ate', 'aud-usuario', 'aud-acao'].forEach(function (id) {
                $(id).addEventListener('change', function () { mostrando = POR_PAGINA; renderizar(); });
            });
            $('btn-aud-mais').addEventListener('click', function () { mostrando += POR_PAGINA; renderizar(); });
            $('btn-aud-csv').addEventListener('click', exportarCSV);
            $('btn-aud-verificar').addEventListener('click', function () {
                if (!A.Sessao.exigir('auditoria.ver')) return;
                // No modo servidor a verificação percorre TODA a tabela do banco
                A.Repo.verificarAuditoria().then(function (res) {
                    renderizar();
                    mostrarIntegridade(A.Dados.emServidor() ? res : A.Auditoria.verificar(), true);
                    UI.toast(res.ok ? 'Integridade confirmada.' : 'Foram encontradas alterações na auditoria!', res.ok ? 'sucesso' : 'erro');
                }).catch(UI.erroOperacao);
            });
        }
    };
})(window);
