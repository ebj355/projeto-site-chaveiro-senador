/**
 * =====================================================================
 * AUDITORIA.JS - REGISTRO DE AUDITORIA DO PAINEL
 * =====================================================================
 * Toda ação relevante gera um registro: quem fez, quando, o quê e os
 * detalhes (ex.: placa e valor de uma saída). Só o Administrador vê.
 *
 * À PROVA DE ADULTERAÇÃO (cadeia de hashes):
 *   Cada registro guarda o hash do registro anterior e o seu próprio
 *   hash, calculado sobre todo o conteúdo:
 *
 *       hash(n) = SHA-256( seq, data, usuário, ação, descrição, detalhes, hash(n-1) )
 *
 *   Se alguém editar ou apagar um registro antigo direto no navegador,
 *   a cadeia quebra e o botão "Verificar integridade" mostra onde.
 *
 * LIMITE: guarda os últimos 5.000 registros. Quando passa disso, os mais
 *   antigos são descartados e o hash do último descartado vira a
 *   "âncora" (ponto de partida da verificação). Exporte o CSV
 *   periodicamente para guardar o histórico completo.
 *
 * Nenhuma tela permite apagar ou editar registros de auditoria.
 *
 * MODO SERVIDOR: os registros ficam na tabela "auditoria" do banco, que
 *   tem gatilhos impedindo UPDATE e DELETE, e o próprio servidor registra
 *   cada ação (o navegador não consegue forjar registros). listar() mostra
 *   os últimos 5.000 recebidos do servidor; registrar() só repassa as
 *   poucas ações que nascem no navegador (exportações, acesso negado).
 *
 * Exposto em: window.Admin.Auditoria (navegador) ou module.exports (Node)
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var LIMITE = 5000;
    var GENESE = '0'.repeat(64); // "hash anterior" do primeiro registro

    /**
     * Catálogo de ações: código → rótulo e gravidade.
     * gravidade: info (rotina) · alerta (merece atenção) · critico (segurança)
     */
    var ACOES = {
        SISTEMA_INSTALADO:   { rotulo: 'Sistema instalado',          gravidade: 'info' },
        LOGIN_OK:            { rotulo: 'Login realizado',            gravidade: 'info' },
        LOGIN_FALHA:         { rotulo: 'Tentativa de login falhou',  gravidade: 'alerta' },
        LOGIN_BLOQUEADO:     { rotulo: 'Login bloqueado',            gravidade: 'critico' },
        LOGOUT:              { rotulo: 'Saiu do painel',             gravidade: 'info' },
        SESSAO_EXPIRADA:     { rotulo: 'Sessão expirada',            gravidade: 'info' },
        ACESSO_NEGADO:       { rotulo: 'Acesso negado',              gravidade: 'critico' },
        SENHA_ALTERADA:      { rotulo: 'Senha alterada',             gravidade: 'alerta' },
        SENHA_REDEFINIDA:    { rotulo: 'Senha redefinida pelo admin', gravidade: 'alerta' },
        USUARIO_CRIADO:      { rotulo: 'Usuário criado',             gravidade: 'alerta' },
        USUARIO_REMOVIDO:    { rotulo: 'Usuário removido',           gravidade: 'critico' },
        USUARIO_ATIVADO:     { rotulo: 'Usuário reativado',          gravidade: 'alerta' },
        USUARIO_DESATIVADO:  { rotulo: 'Usuário desativado',         gravidade: 'alerta' },
        VEICULO_ENTRADA:     { rotulo: 'Entrada de veículo',         gravidade: 'info' },
        VEICULO_SAIDA:       { rotulo: 'Saída e pagamento',          gravidade: 'info' },
        VEICULO_EXCLUIDO:    { rotulo: 'Veículo excluído do pátio',  gravidade: 'critico' },
        HISTORICO_EXCLUIDO:  { rotulo: 'Saída excluída do histórico', gravidade: 'critico' },
        CONFIG_ALTERADA:     { rotulo: 'Configurações alteradas',    gravidade: 'alerta' },
        BACKUP_EXPORTADO:    { rotulo: 'Backup exportado',           gravidade: 'alerta' },
        BACKUP_RESTAURADO:   { rotulo: 'Backup restaurado',          gravidade: 'critico' },
        EXPORTACAO:          { rotulo: 'Dados exportados',           gravidade: 'alerta' },
        AUDITORIA_VERIFICADA:{ rotulo: 'Integridade verificada',     gravidade: 'info' }
    };

    /** Texto canônico usado no cálculo do hash (ordem fixa dos campos). */
    function conteudoParaHash(r) {
        return JSON.stringify([r.seq, r.data, r.usuario, r.acao, r.descricao, r.detalhes || {}, r.anterior]);
    }

    /** Cria um registro novo ligado ao anterior. Função pura (testável). */
    function montarRegistro(anterior, dados, sha256) {
        var r = {
            seq: anterior ? anterior.seq + 1 : 1,
            data: dados.data || new Date().toISOString(),
            usuario: dados.usuario || 'sistema',
            nome: dados.nome || '',
            perfil: dados.perfil || '',
            acao: dados.acao,
            descricao: dados.descricao || (ACOES[dados.acao] ? ACOES[dados.acao].rotulo : dados.acao),
            detalhes: dados.detalhes || {},
            anterior: anterior ? anterior.hash : (dados.ancora || GENESE)
        };
        r.hash = sha256(conteudoParaHash(r));
        return r;
    }

    /**
     * Confere a cadeia inteira. Função pura (testável).
     * @returns {{ok: boolean, total: number, quebraEm: number|null, motivo: string}}
     */
    function verificarCadeia(registros, ancora, sha256) {
        var esperadoAnterior = ancora || GENESE;
        for (var i = 0; i < registros.length; i++) {
            var r = registros[i];
            if (r.anterior !== esperadoAnterior) {
                return { ok: false, total: registros.length, quebraEm: r.seq, motivo: 'Registro anterior ao nº ' + r.seq + ' foi removido ou alterado.' };
            }
            if (sha256(conteudoParaHash(r)) !== r.hash) {
                return { ok: false, total: registros.length, quebraEm: r.seq, motivo: 'O conteúdo do registro nº ' + r.seq + ' foi alterado.' };
            }
            if (i > 0 && r.seq !== registros[i - 1].seq + 1) {
                return { ok: false, total: registros.length, quebraEm: r.seq, motivo: 'Numeração interrompida antes do registro nº ' + r.seq + '.' };
            }
            esperadoAnterior = r.hash;
        }
        return { ok: true, total: registros.length, quebraEm: null, motivo: '' };
    }

    /* -----------------------------------------------------------------
       Parte que usa o navegador (localStorage + usuário logado)
       ----------------------------------------------------------------- */
    var Auditoria = {
        ACOES: ACOES,
        LIMITE: LIMITE,
        montarRegistro: montarRegistro,
        verificarCadeia: verificarCadeia,

        /** Todos os registros guardados (mais antigo primeiro). */
        listar: function () {
            if (raiz.Admin.Dados.emServidor()) return (raiz.Admin.RepoServidor.cache.auditoria || []).slice();
            return raiz.Admin.Dados.ler(raiz.Admin.Dados.CHAVES.auditoria, []);
        },

        /** Hash do último registro descartado (ponto de partida da verificação), ou null. */
        ancora: function () {
            if (raiz.Admin.Dados.emServidor()) return raiz.Admin.RepoServidor.cache.ancora || null;
            return raiz.Admin.Dados.ler(raiz.Admin.Dados.CHAVES.ancora, null);
        },

        /**
         * Registra uma ação.
         * @param {string} acao código do catálogo ACOES
         * @param {object} [detalhes] dados extras (placa, valor, alvo...)
         * @param {object} [quem] usuário responsável (padrão: usuário logado)
         */
        registrar: function (acao, detalhes, quem) {
            var Dados = raiz.Admin.Dados;
            if (Dados.emServidor()) {
                // O servidor registra sozinho entradas, saídas, logins etc.; daqui só vão estas
                if (acao === 'EXPORTACAO' || acao === 'ACESSO_NEGADO') raiz.Admin.RepoServidor.registrarEvento(acao, detalhes);
                return null;
            }
            var u = quem || (raiz.Admin.Sessao ? raiz.Admin.Sessao.usuarioAtual() : null);
            var lista = this.listar();
            var reg = montarRegistro(lista[lista.length - 1] || null, {
                acao: acao,
                usuario: u ? u.login : 'sistema',
                nome: u ? u.nome : '',
                perfil: u ? u.perfil : '',
                detalhes: detalhes || {},
                ancora: this.ancora()
            }, raiz.Admin.Seguranca.sha256);
            lista.push(reg);

            // Mantém só os últimos LIMITE registros; o hash do último descartado vira âncora
            if (lista.length > LIMITE) {
                var descartados = lista.splice(0, lista.length - LIMITE);
                Dados.salvar(Dados.CHAVES.ancora, descartados[descartados.length - 1].hash);
            }
            Dados.salvar(Dados.CHAVES.auditoria, lista);
            return reg;
        },

        /** Verifica a integridade dos registros guardados. */
        verificar: function () {
            return verificarCadeia(this.listar(), this.ancora(), raiz.Admin.Seguranca.sha256);
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Auditoria;
    } else {
        raiz.Admin = raiz.Admin || {};
        raiz.Admin.Auditoria = Auditoria;
    }
})(typeof window !== 'undefined' ? window : this);
