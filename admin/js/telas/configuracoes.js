/**
 * =====================================================================
 * TELAS/CONFIGURACOES.JS - CONFIGURAÇÕES (somente Administrador)
 * =====================================================================
 *   - Tabela de preços (mínimo, hora adicional, tolerância) com
 *     simulação ao vivo; grava antes/depois na auditoria
 *   - Número de vagas (ocupação mostrada no Painel)
 *   - Backup: baixa um arquivo .json com todos os dados do painel e
 *     restaura a partir dele (com confirmação). Ambos vão para a auditoria.
 *
 * Exposto em: window.Admin.Telas.config
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var A = raiz.Admin;
    var UI = A.UI, R = A.Regras, $ = UI.$, D = UI.Datas;
    var CHAVE_ULTIMO_BACKUP = 'adm_ultimo_backup';
    var VERSAO_BACKUP = 1;

    /* ---------------- preços ---------------- */

    function lerPrecos() {
        return {
            valorMinimo: parseFloat($('cfg-minimo').value),
            valorHoraAdicional: parseFloat($('cfg-adicional').value),
            toleranciaMin: parseInt($('cfg-tolerancia').value, 10)
        };
    }

    /** Retorna '' se os preços são válidos, ou a mensagem de erro. */
    function validarPrecos(c) {
        if (isNaN(c.valorMinimo) || c.valorMinimo < 0 || c.valorMinimo > 999) return 'Informe um valor até 1 hora entre R$ 0 e R$ 999.';
        if (isNaN(c.valorHoraAdicional) || c.valorHoraAdicional < 0 || c.valorHoraAdicional > 999) return 'Informe um valor de hora adicional entre R$ 0 e R$ 999.';
        if (isNaN(c.toleranciaMin) || c.toleranciaMin < 0 || c.toleranciaMin > 59) return 'A tolerância deve ficar entre 0 e 59 minutos.';
        return '';
    }

    /** Mostra quanto custariam algumas permanências com os valores digitados. */
    function simular() {
        var c = lerPrecos();
        if (validarPrecos(c)) { $('simulacao').innerHTML = '<p class="dica-campo">Preencha valores válidos para ver a simulação.</p>'; return; }
        $('simulacao').innerHTML = [60, 61, 120, 180, 480].map(function (m) {
            return '<div><small>' + (m === 61 ? '1h01' : R.formatarDuracao(m)) + '</small><strong>' + R.formatarMoeda(R.calcularValorPorMinutos(m, c)) + '</strong></div>';
        }).join('');
    }

    /** Valida e grava a tabela de preços; a auditoria guarda o antes e o depois. */
    function salvarPrecos(e) {
        e.preventDefault();
        if (!A.Sessao.exigir('config.alterar')) return;
        var nova = lerPrecos();
        var erro = validarPrecos(nova);
        UI.erroForm('cfg-erro', erro);
        if (erro) return;
        var antiga = A.Dados.config();
        A.Dados.salvar(A.Dados.CHAVES.config, Object.assign({}, antiga, nova));
        A.Auditoria.registrar('CONFIG_ALTERADA', {
            antes: R.formatarMoeda(antiga.valorMinimo) + ' + ' + R.formatarMoeda(antiga.valorHoraAdicional) + '/h, tol. ' + antiga.toleranciaMin + 'min',
            depois: R.formatarMoeda(nova.valorMinimo) + ' + ' + R.formatarMoeda(nova.valorHoraAdicional) + '/h, tol. ' + nova.toleranciaMin + 'min'
        });
        UI.toast('Tabela de preços salva. Vale para as próximas saídas.');
    }

    /* ---------------- vagas ---------------- */

    function salvarVagas(e) {
        e.preventDefault();
        if (!A.Sessao.exigir('config.alterar')) return;
        var vagas = parseInt($('cfg-vagas').value, 10);
        if (isNaN(vagas) || vagas < 1 || vagas > 999) { UI.toast('Informe um número de vagas entre 1 e 999.', 'erro'); return; }
        var cfg = A.Dados.config();
        A.Auditoria.registrar('CONFIG_ALTERADA', { antes: cfg.vagas + ' vagas', depois: vagas + ' vagas' });
        cfg.vagas = vagas;
        A.Dados.salvar(A.Dados.CHAVES.config, cfg);
        UI.toast('Número de vagas salvo.');
    }

    /* ---------------- backup ---------------- */

    function mostrarUltimoBackup() {
        var ultimo = null;
        try { ultimo = localStorage.getItem(CHAVE_ULTIMO_BACKUP); } catch (e) { /* sem armazenamento */ }
        $('backup-ultimo').textContent = ultimo ? 'Último backup baixado neste navegador: ' + D.dataHora(ultimo) + '.' : 'Nenhum backup baixado ainda neste navegador.';
    }

    /** Gera o arquivo .json com todos os dados do painel e baixa no computador. */
    function exportarBackup() {
        if (!A.Sessao.exigir('config.backup')) return;
        var K = A.Dados.CHAVES;
        var dados = {
            sistema: 'chaveiro-senador-painel',
            versao: VERSAO_BACKUP,
            geradoEm: new Date().toISOString(),
            geradoPor: A.Sessao.usuarioAtual().login,
            usuarios: A.Dados.usuarios(),
            patio: A.Dados.patio(),
            historico: A.Dados.historico(),
            config: A.Dados.ler(K.config, {}),
            auditoria: A.Auditoria.listar(),
            ancora: A.Auditoria.ancora()
        };
        A.Auditoria.registrar('BACKUP_EXPORTADO', { patio: dados.patio.length, historico: dados.historico.length });
        dados.auditoria = A.Auditoria.listar(); // inclui o registro do próprio backup
        var nome = 'backup-chaveiro-senador-' + D.hoje() + '.json';
        UI.baixarArquivo(nome, JSON.stringify(dados, null, 2), 'application/json');
        try { localStorage.setItem(CHAVE_ULTIMO_BACKUP, new Date().toISOString()); } catch (e) { /* sem armazenamento */ }
        mostrarUltimoBackup();
        UI.toast('Backup baixado: ' + nome);
    }

    /** Confere se o arquivo tem o formato esperado. Retorna '' ou o erro. */
    function validarBackup(b) {
        if (!b || b.sistema !== 'chaveiro-senador-painel') return 'Este arquivo não é um backup do painel.';
        if (b.versao > VERSAO_BACKUP) return 'Backup feito por uma versão mais nova do painel.';
        if (!Array.isArray(b.usuarios) || !Array.isArray(b.patio) || !Array.isArray(b.historico) || !Array.isArray(b.auditoria)) return 'Backup incompleto ou corrompido.';
        if (!b.usuarios.some(function (u) { return u.perfil === 'admin' && u.ativo !== false; })) return 'O backup não tem nenhum Administrador ativo.';
        return '';
    }

    /** Lê um backup .json, valida, pede confirmação e substitui os dados atuais. */
    function importarBackup(arquivo) {
        if (!arquivo || !A.Sessao.exigir('config.backup')) return;
        if (arquivo.size > 20 * 1024 * 1024) { UI.toast('Arquivo muito grande para um backup do painel.', 'erro'); return; }
        var leitor = new FileReader();
        leitor.onload = function () {
            var b;
            try { b = JSON.parse(leitor.result); } catch (e) { UI.toast('Arquivo inválido: não é um JSON.', 'erro'); return; }
            var erro = validarBackup(b);
            if (erro) { UI.toast(erro, 'erro'); return; }
            var resumo = b.historico.length + ' saídas, ' + b.patio.length + ' veículos no pátio e ' + b.usuarios.length + ' usuário(s), gerado em ' + D.dataHora(b.geradoEm) + '.';
            UI.confirmar('Restaurar backup?', 'Todos os dados atuais deste navegador serão substituídos pelo backup: ' + resumo + ' Se o seu usuário não existir no backup, você será desconectado.', function () {
                if (!A.Sessao.exigir('config.backup')) return;
                var eu = A.Sessao.usuarioAtual();
                var K = A.Dados.CHAVES;
                A.Dados.salvar(K.usuarios, b.usuarios);
                A.Dados.salvar(K.patio, b.patio);
                A.Dados.salvar(K.historico, b.historico);
                A.Dados.salvar(K.config, b.config || {});
                A.Dados.salvar(K.auditoria, b.auditoria);
                if (b.ancora) A.Dados.salvar(K.ancora, b.ancora); else { try { localStorage.removeItem(K.ancora); } catch (e) { /* nada */ } }
                A.Auditoria.registrar('BACKUP_RESTAURADO', { arquivo: arquivo.name, historico: b.historico.length, patio: b.patio.length }, eu);
                UI.toast('Backup restaurado.');
                A.App.atualizarEstado();
            }, { rotulo: 'Restaurar' });
        };
        leitor.readAsText(arquivo);
    }

    A.Telas = A.Telas || {};
    A.Telas.config = {
        titulo: 'Configurações',
        subtitulo: 'Preços, vagas e backup',
        permissao: 'config.alterar',

        /** Preenche os formulários com a configuração gravada. */
        renderizar: function () {
            var c = A.Dados.config();
            $('cfg-minimo').value = c.valorMinimo;
            $('cfg-adicional').value = c.valorHoraAdicional;
            $('cfg-tolerancia').value = c.toleranciaMin;
            $('cfg-vagas').value = c.vagas;
            UI.erroForm('cfg-erro', '');
            simular();
            mostrarUltimoBackup();
        },

        /** Liga os formulários de preços e vagas e os botões de backup. */
        iniciar: function () {
            $('form-config').addEventListener('submit', salvarPrecos);
            $('form-vagas').addEventListener('submit', salvarVagas);
            ['cfg-minimo', 'cfg-adicional', 'cfg-tolerancia'].forEach(function (id) { $(id).addEventListener('input', simular); });
            $('btn-cfg-padrao').addEventListener('click', function () {
                $('cfg-minimo').value = R.CONFIG_PADRAO.valorMinimo;
                $('cfg-adicional').value = R.CONFIG_PADRAO.valorHoraAdicional;
                $('cfg-tolerancia').value = R.CONFIG_PADRAO.toleranciaMin;
                simular();
            });
            $('btn-backup-exportar').addEventListener('click', exportarBackup);
            $('backup-arquivo').addEventListener('change', function (e) {
                importarBackup(e.target.files[0]);
                e.target.value = ''; // permite escolher o mesmo arquivo de novo
            });
        }
    };
})(window);
