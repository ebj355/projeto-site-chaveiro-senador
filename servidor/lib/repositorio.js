/**
 * =====================================================================
 * SERVIDOR/LIB/REPOSITORIO.JS - TODAS AS OPERAÇÕES NO BANCO
 * =====================================================================
 * É aqui que o módulo de estacionamento "conversa" com o banco SQL.
 * Cada função é uma ação do painel (entrada, saída, criar usuário...):
 *
 *   1. valida os dados recebidos (o servidor nunca confia no navegador)
 *   2. confere as regras de negócio (placa já no pátio, último admin...)
 *   3. grava no banco E registra na auditoria, na MESMA transação
 *   4. devolve o resultado no mesmo formato que o painel já usava
 *
 * As regras de cálculo (RN01/RN02), as permissões, o hash de senha e a
 * cadeia da auditoria vêm dos mesmos arquivos do painel (admin/js/nucleo),
 * então navegador e servidor nunca discordam.
 *
 * Erros de negócio são lançados como ErroNegocio(status HTTP, mensagem);
 * a mensagem é mostrada ao usuário no painel.
 * =====================================================================
 */
'use strict';

const crypto = require('node:crypto');
const { transacao } = require('./banco.js');
const Aud = require('./auditoria.js');
const Regras = require('../../admin/js/nucleo/regras-estacionamento.js');
const Seg = require('../../admin/js/nucleo/seguranca.js');
const { perfilPode } = require('../../admin/js/nucleo/permissoes.js');

/* ---------------- constantes (iguais às do painel) ---------------- */
const INATIVIDADE_MIN = 30;           // sessão cai após 30 min sem uso
const DURACAO_MAX_HORAS = 8;          // e após 8 h de qualquer forma
const MAX_TENTATIVAS = 5;             // erros seguidos antes do bloqueio
const BLOQUEIOS_MIN = [5, 15, 60];    // duração de cada bloqueio
const FORMAS_PAGAMENTO = ['Dinheiro', 'Cartão', 'Pix'];
const TOLERANCIA_RELOGIO_MS = 60 * 1000;      // relógio do celular adiantado até 1 min
const SAIDA_MAX_ATRASO_MS = 15 * 60 * 1000;   // hora de saída mostrada ao cliente vale por 15 min
const EVENTOS_DO_NAVEGADOR = ['EXPORTACAO', 'ACESSO_NEGADO']; // únicas ações que o painel pode registrar sozinho
const VERSAO_BACKUP = 1;

/** Erro com status HTTP e mensagem para o usuário. */
class ErroNegocio extends Error {
    constructor(status, mensagem) { super(mensagem); this.status = status; }
}

/* ---------------- conversões ---------------- */
const agoraISO = () => new Date().toISOString();
const paraCentavos = (reais) => Math.round(Number(reais) * 100);
const paraReais = (centavos) => (centavos == null ? undefined : centavos / 100);
const sim = (v) => (v ? 1 : 0);
/** Texto limpo: sem espaços repetidos, cortado no tamanho máximo. */
const texto = (v, max) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, max);
const novoId = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
const isoValido = (v) => typeof v === 'string' && !isNaN(new Date(v).getTime());

/** Usuário como o painel vê (NUNCA inclui o hash da senha). */
function usuarioPublico(u) {
    return {
        id: u.id, nome: u.nome, login: u.login, perfil: u.perfil,
        ativo: u.ativo === 1, trocarSenha: u.trocar_senha === 1, senhaPadrao: u.senha_padrao === 1,
        criadoEm: u.criado_em, ultimoLogin: u.ultimo_login, ultimoLoginAnterior: u.ultimo_login_anterior,
        senhaAlteradaEm: u.senha_alterada_em || undefined
    };
}

/** Linha de estadias → veículo do pátio (formato do painel). */
function veiculoDoPatio(e) {
    return { id: e.id, nome: e.motorista, placa: e.placa, entrada: e.entrada_em, modelo: e.modelo, chave: e.chave, registradoPor: e.registrado_por_nome };
}

/** Linha de estadias → saída do histórico (formato do painel). */
function saidaDoHistorico(e) {
    const h = Object.assign(veiculoDoPatio(e), {
        saida: e.saida_em, minutos: e.minutos, valor: paraReais(e.valor_centavos), pagamento: e.forma_pagamento,
        tabela: { valorMinimo: paraReais(e.tarifa_minimo_centavos), valorHoraAdicional: paraReais(e.tarifa_hora_adicional_centavos), toleranciaMin: e.tarifa_tolerancia_min },
        recebidoPor: e.recebido_por_nome
    });
    if (e.valor_recebido_centavos != null) { h.valorRecebido = paraReais(e.valor_recebido_centavos); h.troco = paraReais(e.troco_centavos); }
    return h;
}

/** Senha gravada → objeto que o verificarSenha() do painel entende. */
function registroSenha(u) {
    if (u.senha_hash.indexOf('legado$') === 0) { // formato do módulo antigo: legado$<sal>$<hash>
        const p = u.senha_hash.split('$');
        return { hash: p[2], sal: p[1] };
    }
    return { senha: u.senha_hash };
}

/** Quem fez a ação, para a auditoria. */
const autor = (u) => (u ? { login: u.login, nome: u.nome, perfil: u.perfil } : null);
const hashToken = (token) => Aud.sha256('sessao:' + token);

/* =================================================================== */

function criarRepositorio(db) {
    const umaLinha = (sql, ...p) => db.prepare(sql).get(...p);
    const linhas = (sql, ...p) => db.prepare(sql).all(...p);
    const executar = (sql, ...p) => db.prepare(sql).run(...p);
    const auditar = (acao, detalhes, quem, ip) => Aud.registrar(db, acao, detalhes, quem, ip);

    const usuarioPorId = (id) => umaLinha('SELECT * FROM usuarios WHERE id = ? AND removido_em IS NULL', id);
    const usuarioPorLogin = (login) => umaLinha('SELECT * FROM usuarios WHERE login = ? AND removido_em IS NULL', login);
    const adminsAtivos = () => umaLinha("SELECT COUNT(*) AS n FROM usuarios WHERE perfil = 'admin' AND ativo = 1 AND removido_em IS NULL").n;

    /** Tabela de preços em reais (formato do painel). */
    function config() {
        const c = umaLinha('SELECT * FROM configuracao WHERE id = 1');
        return { valorMinimo: c.valor_minimo_centavos / 100, valorHoraAdicional: c.valor_hora_adicional_centavos / 100, toleranciaMin: c.tolerancia_min, vagas: c.vagas };
    }

    /** Encerra todas as sessões abertas de um usuário (ex.: ao desativá-lo). */
    function encerrarSessoesDe(usuarioId, motivo, excetoSessaoId) {
        executar('UPDATE sessoes SET encerrada_em = ?, motivo_encerramento = ? WHERE usuario_id = ? AND encerrada_em IS NULL AND id IS NOT ?',
            agoraISO(), motivo, usuarioId, excetoSessaoId == null ? null : excetoSessaoId);
    }

    /* ======================= INSTALAÇÃO ======================= */

    /** Sem nenhum usuário: cria admin / admin (o painel pede para trocar). */
    async function garantirAdminPadrao() {
        if (umaLinha('SELECT COUNT(*) AS n FROM usuarios').n > 0) return false;
        const hash = await Seg.hashSenha('admin');
        return transacao(db, () => {
            if (umaLinha('SELECT COUNT(*) AS n FROM usuarios').n > 0) return false;
            const u = { id: novoId(), login: 'admin', nome: 'Administrador', perfil: 'admin' };
            executar(`INSERT INTO usuarios (id, login, nome, perfil, senha_hash, ativo, trocar_senha, senha_padrao, criado_em)
                      VALUES (?, ?, ?, ?, ?, 1, 0, 1, ?)`, u.id, u.login, u.nome, u.perfil, hash, agoraISO());
            auditar('SISTEMA_INSTALADO', { administrador: 'admin', observacao: 'usuário padrão admin/admin criado (banco de dados)' }, u, null);
            return true;
        });
    }

    /* ======================= LOGIN E SESSÃO ======================= */

    /**
     * Confere usuário e senha, com bloqueio progressivo.
     * @returns {Promise<{ok, msg?, token?, usuario?, trocarSenha?}>}
     */
    async function entrar(login, senha, ctx = {}) {
        const loginNorm = texto(login, 30).toLowerCase();
        const chave = loginNorm || '(vazio)';
        senha = String(senha == null ? '' : senha).slice(0, 128);
        const quemTentou = { login: chave, nome: '', perfil: '' };

        const bloq = umaLinha('SELECT * FROM bloqueios_login WHERE login = ?', chave);
        if (bloq && bloq.bloqueado_ate && bloq.bloqueado_ate > agoraISO()) {
            const min = Math.ceil((new Date(bloq.bloqueado_ate) - Date.now()) / 60000);
            return { ok: false, msg: 'Acesso bloqueado por excesso de tentativas. Tente novamente em ' + min + ' min.' };
        }

        const usuario = usuarioPorLogin(loginNorm);
        // Sem usuário, calcula um hash mesmo assim: o tempo de resposta não revela se o login existe
        const confere = usuario ? await Seg.verificarSenha(senha, registroSenha(usuario)) : (await Seg.hashSenha(senha), false);
        const novoHash = confere && Seg.precisaAtualizarHash(registroSenha(usuario)) ? await Seg.hashSenha(senha) : null;

        return transacao(db, () => {
            const b = umaLinha('SELECT * FROM bloqueios_login WHERE login = ?', chave) || { erros: 0, bloqueios: 0 };
            if (!confere || !usuario || usuario.ativo !== 1) {
                let erros = b.erros + 1, bloqueios = b.bloqueios, ate = null;
                if (erros >= MAX_TENTATIVAS) {
                    const minutos = BLOQUEIOS_MIN[Math.min(bloqueios, BLOQUEIOS_MIN.length - 1)];
                    ate = new Date(Date.now() + minutos * 60000).toISOString();
                    bloqueios += 1; erros = 0;
                    gravarBloqueio(chave, erros, bloqueios, ate);
                    auditar('LOGIN_BLOQUEADO', { login: chave, minutos }, quemTentou, ctx.ip);
                    return { ok: false, msg: 'Muitas tentativas incorretas. Acesso bloqueado por ' + minutos + ' minutos.' };
                }
                gravarBloqueio(chave, erros, bloqueios, ate);
                auditar('LOGIN_FALHA', { login: chave, tentativa: erros }, quemTentou, ctx.ip);
                const restam = MAX_TENTATIVAS - erros;
                return { ok: false, msg: 'Usuário ou senha inválidos. (' + restam + ' tentativa' + (restam === 1 ? '' : 's') + ' restante' + (restam === 1 ? '' : 's') + ')' };
            }

            // Sucesso: zera o bloqueio, atualiza o hash antigo, cria a sessão
            executar('DELETE FROM bloqueios_login WHERE login = ?', chave);
            const agora = agoraISO();
            executar(`UPDATE usuarios SET ultimo_login_anterior = ultimo_login, ultimo_login = ?,
                      senha_hash = COALESCE(?, senha_hash) WHERE id = ?`, agora, novoHash, usuario.id);
            const token = crypto.randomBytes(32).toString('hex');
            executar(`INSERT INTO sessoes (token_hash, usuario_id, criada_em, ultimo_uso, expira_em, ip, navegador)
                      VALUES (?, ?, ?, ?, ?, ?, ?)`, hashToken(token), usuario.id, agora, agora,
                new Date(Date.now() + DURACAO_MAX_HORAS * 3600000).toISOString(), ctx.ip || null, texto(ctx.navegador, 200) || null);
            auditar('LOGIN_OK', {}, autor(usuario), ctx.ip);
            const atualizado = usuarioPorId(usuario.id);
            return { ok: true, token, usuario: usuarioPublico(atualizado), trocarSenha: atualizado.trocar_senha === 1 };
        });
    }

    function gravarBloqueio(login, erros, bloqueios, ate) {
        executar(`INSERT INTO bloqueios_login (login, erros, bloqueios, bloqueado_ate, atualizado_em) VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT (login) DO UPDATE SET erros = excluded.erros, bloqueios = excluded.bloqueios,
                  bloqueado_ate = excluded.bloqueado_ate, atualizado_em = excluded.atualizado_em`, login, erros, bloqueios, ate, agoraISO());
    }

    /**
     * Confere o token do cookie. renovar=true empurra o prazo de inatividade.
     * Sessão vencida é encerrada (e registrada) aqui mesmo.
     * @returns {{sessao, usuario}|null}
     */
    function validarSessao(token, renovar, ip) {
        if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
        const s = umaLinha('SELECT * FROM sessoes WHERE token_hash = ? AND encerrada_em IS NULL', hashToken(token));
        if (!s) return null;
        const u = usuarioPorId(s.usuario_id);
        const agora = Date.now();
        const venceu = agora - new Date(s.ultimo_uso).getTime() > INATIVIDADE_MIN * 60000 || agora > new Date(s.expira_em).getTime();
        if (!u || u.ativo !== 1 || venceu) {
            transacao(db, () => {
                executar('UPDATE sessoes SET encerrada_em = ?, motivo_encerramento = ? WHERE id = ?', agoraISO(), venceu ? 'SESSAO_EXPIRADA' : 'USUARIO_DESATIVADO', s.id);
                if (u && venceu) auditar('SESSAO_EXPIRADA', {}, autor(u), ip);
            });
            return null;
        }
        if (renovar) executar('UPDATE sessoes SET ultimo_uso = ? WHERE id = ?', agoraISO(), s.id);
        return { sessao: s, usuario: u };
    }

    /** Segundos até a sessão vencer (por inatividade ou pelo limite de 8 h). */
    function segundosRestantes(sessaoId) {
        const s = umaLinha('SELECT ultimo_uso, expira_em FROM sessoes WHERE id = ?', sessaoId);
        if (!s) return 0;
        const porInatividade = new Date(s.ultimo_uso).getTime() + INATIVIDADE_MIN * 60000 - Date.now();
        const porLimite = new Date(s.expira_em).getTime() - Date.now();
        return Math.max(0, Math.floor(Math.min(porInatividade, porLimite) / 1000));
    }

    /** Sai do painel (motivo LOGOUT ou SESSAO_EXPIRADA). */
    function sair(ctxSessao, motivo, ip) {
        if (!ctxSessao) return;
        motivo = motivo === 'SESSAO_EXPIRADA' ? 'SESSAO_EXPIRADA' : 'LOGOUT';
        transacao(db, () => {
            executar('UPDATE sessoes SET encerrada_em = ?, motivo_encerramento = ? WHERE id = ?', agoraISO(), motivo, ctxSessao.sessao.id);
            auditar(motivo, {}, autor(ctxSessao.usuario), ip);
        });
    }

    /* ======================= LEITURA ======================= */

    /**
     * Tudo o que o painel precisa para desenhar as telas, filtrado pelo
     * perfil: o operador não recebe usuários, auditoria nem histórico antigo.
     */
    function estado(u) {
        const admin = u.perfil === 'admin';
        let historico;
        if (perfilPode(u.perfil, 'historico.todas_datas')) {
            historico = linhas("SELECT * FROM estadias WHERE situacao = 'finalizada' ORDER BY saida_em");
        } else {
            const ontem = new Date(); ontem.setHours(0, 0, 0, 0); ontem.setDate(ontem.getDate() - 1);
            historico = linhas("SELECT * FROM estadias WHERE situacao = 'finalizada' AND saida_em >= ? ORDER BY saida_em", ontem.toISOString());
        }
        const aud = admin ? Aud.listar(db) : { registros: [], ancora: null };
        return {
            versao: Aud.ultimaSeq(db),
            eu: usuarioPublico(u),
            usuarios: admin ? linhas('SELECT * FROM usuarios WHERE removido_em IS NULL ORDER BY criado_em').map(usuarioPublico) : [usuarioPublico(u)],
            patio: linhas("SELECT * FROM estadias WHERE situacao = 'no_patio' ORDER BY entrada_em").map(veiculoDoPatio),
            historico: historico.map(saidaDoHistorico),
            config: config(),
            clientes: linhas('SELECT placa, visitas, ultima_saida, motorista, modelo FROM vw_clientes')
                .map((c) => ({ placa: c.placa, visitas: c.visitas, ultimaSaida: c.ultima_saida, nome: c.motorista, modelo: c.modelo })),
            auditoria: aud.registros,
            ancora: aud.ancora
        };
    }

    const versao = () => Aud.ultimaSeq(db);

    /* ======================= PÁTIO ======================= */

    /** Entrada de veículo. dados: {nome, placa, entrada, modelo, chave} */
    function registrarEntrada(u, dados, ip) {
        const placa = Regras.normalizarPlaca(dados.placa);
        const nome = texto(dados.nome, 80);
        if (!Regras.placaValida(placa)) throw new ErroNegocio(400, 'Placa inválida. Use ABC-1234 ou ABC1D23.');
        if (nome.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 3) throw new ErroNegocio(400, 'O nome deve ter pelo menos 3 letras.');
        if (!isoValido(dados.entrada)) throw new ErroNegocio(400, 'Informe a hora de entrada.');
        const entrada = new Date(dados.entrada).toISOString();
        if (new Date(entrada).getTime() > Date.now() + TOLERANCIA_RELOGIO_MS) throw new ErroNegocio(400, 'A hora de entrada não pode estar no futuro.');

        return transacao(db, () => {
            if (umaLinha("SELECT 1 FROM estadias WHERE placa = ? AND situacao = 'no_patio'", placa)) throw new ErroNegocio(409, 'Este veículo já está no pátio.');
            const v = { id: novoId(), nome, placa, entrada, modelo: texto(dados.modelo, 40), chave: texto(dados.chave, 10), registradoPor: u.nome };
            executar(`INSERT INTO estadias (id, placa, motorista, modelo, chave, entrada_em, registrado_por_id, registrado_por_nome)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, v.id, v.placa, v.nome, v.modelo, v.chave, v.entrada, u.id, u.nome);
            auditar('VEICULO_ENTRADA', { placa, motorista: nome, entrada }, autor(u), ip);
            return v;
        });
    }

    /**
     * Saída e pagamento. O valor é SEMPRE recalculado aqui com a tabela
     * de preços do banco. dados: {saida?, pagamento, valorRecebido?}
     *   saida: hora mostrada ao cliente no modal (aceita se tiver até 15 min).
     */
    function registrarSaida(u, id, dados, ip) {
        const pagamento = dados.pagamento;
        if (FORMAS_PAGAMENTO.indexOf(pagamento) < 0) throw new ErroNegocio(400, 'Forma de pagamento inválida.');

        return transacao(db, () => {
            const e = umaLinha("SELECT * FROM estadias WHERE id = ? AND situacao = 'no_patio'", String(id));
            if (!e) throw new ErroNegocio(404, 'Este veículo já saiu do pátio.');

            const agora = Date.now();
            let saida = new Date(agora).toISOString();
            if (isoValido(dados.saida)) {
                const t = new Date(dados.saida).getTime();
                if (t <= agora + TOLERANCIA_RELOGIO_MS && agora - t <= SAIDA_MAX_ATRASO_MS && t >= new Date(e.entrada_em).getTime()) saida = new Date(t).toISOString();
            }
            if (saida < e.entrada_em) saida = e.entrada_em; // entrada registrada com o relógio adiantado

            const cfg = config();
            const minutos = Regras.calcularMinutos(e.entrada_em, saida);
            const valor = Regras.calcularValorPorMinutos(minutos, cfg);
            const centavos = paraCentavos(valor);

            let recebido = null, troco = null;
            if (pagamento === 'Dinheiro' && dados.valorRecebido !== undefined && dados.valorRecebido !== null && dados.valorRecebido !== '') {
                recebido = paraCentavos(dados.valorRecebido);
                if (!Number.isFinite(recebido) || recebido < 0 || recebido > 10000000) throw new ErroNegocio(400, 'Valor recebido inválido.');
                if (recebido < centavos) throw new ErroNegocio(400, 'O valor recebido é menor que o total (' + Regras.formatarMoeda(valor) + ').');
                troco = recebido - centavos;
            }

            executar(`UPDATE estadias SET situacao = 'finalizada', saida_em = ?, minutos = ?, valor_centavos = ?, forma_pagamento = ?,
                      valor_recebido_centavos = ?, troco_centavos = ?, tarifa_minimo_centavos = ?, tarifa_hora_adicional_centavos = ?,
                      tarifa_tolerancia_min = ?, recebido_por_id = ?, recebido_por_nome = ? WHERE id = ?`,
            saida, minutos, centavos, pagamento, recebido, troco, paraCentavos(cfg.valorMinimo), paraCentavos(cfg.valorHoraAdicional),
            cfg.toleranciaMin, u.id, u.nome, e.id);
            auditar('VEICULO_SAIDA', { placa: e.placa, valor, minutos, pagamento }, autor(u), ip);
            return saidaDoHistorico(umaLinha('SELECT * FROM estadias WHERE id = ?', e.id));
        });
    }

    /** Remove do pátio um lançamento feito por engano (fica marcado, não some). */
    function excluirVeiculo(u, id, ip) {
        return transacao(db, () => {
            const e = umaLinha("SELECT * FROM estadias WHERE id = ? AND situacao = 'no_patio'", String(id));
            if (!e) throw new ErroNegocio(404, 'Veículo não encontrado no pátio.');
            executar("UPDATE estadias SET situacao = 'excluida', excluida_em = ?, excluida_por_id = ?, excluida_de = 'patio' WHERE id = ?", agoraISO(), u.id, e.id);
            auditar('VEICULO_EXCLUIDO', { placa: e.placa, motorista: e.motorista, entrada: e.entrada_em }, autor(u), ip);
            return { ok: true };
        });
    }

    /** Tira uma saída do histórico/faturamento (fica marcada como excluída). */
    function excluirHistorico(u, id, ip) {
        return transacao(db, () => {
            const e = umaLinha("SELECT * FROM estadias WHERE id = ? AND situacao = 'finalizada'", String(id));
            if (!e) throw new ErroNegocio(404, 'Registro não encontrado no histórico.');
            executar("UPDATE estadias SET situacao = 'excluida', excluida_em = ?, excluida_por_id = ?, excluida_de = 'historico' WHERE id = ?", agoraISO(), u.id, e.id);
            auditar('HISTORICO_EXCLUIDO', { placa: e.placa, valor: paraReais(e.valor_centavos), saida: e.saida_em, pagamento: e.forma_pagamento }, autor(u), ip);
            return { ok: true };
        });
    }

    /* ======================= CONFIGURAÇÃO ======================= */

    /** Tabela de preços. dados: {valorMinimo, valorHoraAdicional, toleranciaMin} em reais/minutos. */
    function salvarPrecos(u, dados, ip) {
        const nova = { valorMinimo: Number(dados.valorMinimo), valorHoraAdicional: Number(dados.valorHoraAdicional), toleranciaMin: Number(dados.toleranciaMin) };
        if (!Number.isFinite(nova.valorMinimo) || nova.valorMinimo < 0 || nova.valorMinimo > 999) throw new ErroNegocio(400, 'Informe um valor até 1 hora entre R$ 0 e R$ 999.');
        if (!Number.isFinite(nova.valorHoraAdicional) || nova.valorHoraAdicional < 0 || nova.valorHoraAdicional > 999) throw new ErroNegocio(400, 'Informe um valor de hora adicional entre R$ 0 e R$ 999.');
        if (!Number.isInteger(nova.toleranciaMin) || nova.toleranciaMin < 0 || nova.toleranciaMin > 59) throw new ErroNegocio(400, 'A tolerância deve ficar entre 0 e 59 minutos.');
        return transacao(db, () => {
            const antiga = config();
            executar(`UPDATE configuracao SET valor_minimo_centavos = ?, valor_hora_adicional_centavos = ?, tolerancia_min = ?,
                      atualizado_em = ?, atualizado_por = ? WHERE id = 1`,
            paraCentavos(nova.valorMinimo), paraCentavos(nova.valorHoraAdicional), nova.toleranciaMin, agoraISO(), u.id);
            const f = Regras.formatarMoeda;
            auditar('CONFIG_ALTERADA', {
                antes: f(antiga.valorMinimo) + ' + ' + f(antiga.valorHoraAdicional) + '/h, tol. ' + antiga.toleranciaMin + 'min',
                depois: f(nova.valorMinimo) + ' + ' + f(nova.valorHoraAdicional) + '/h, tol. ' + nova.toleranciaMin + 'min'
            }, autor(u), ip);
            return config();
        });
    }

    /** Número de vagas do pátio (1 a 999). */
    function salvarVagas(u, vagas, ip) {
        vagas = Number(vagas);
        if (!Number.isInteger(vagas) || vagas < 1 || vagas > 999) throw new ErroNegocio(400, 'Informe um número de vagas entre 1 e 999.');
        return transacao(db, () => {
            const antes = config().vagas;
            executar('UPDATE configuracao SET vagas = ?, atualizado_em = ?, atualizado_por = ? WHERE id = 1', vagas, agoraISO(), u.id);
            auditar('CONFIG_ALTERADA', { antes: antes + ' vagas', depois: vagas + ' vagas' }, autor(u), ip);
            return config();
        });
    }

    /* ======================= USUÁRIOS ======================= */

    /** Cadastro. dados: {nome, login, senha, perfil, trocarSenha} */
    async function criarUsuario(u, dados, ip) {
        const nome = texto(dados.nome, 60);
        const login = texto(dados.login, 30).toLowerCase();
        const senha = String(dados.senha == null ? '' : dados.senha);
        if (nome.length < 3) throw new ErroNegocio(400, 'Informe o nome (mínimo 3 letras).');
        if (!/^[a-z0-9._-]{3,30}$/.test(login)) throw new ErroNegocio(400, 'Usuário deve ter 3 a 30 caracteres (letras, números, ponto, hífen ou _).');
        if (senha.length > 128) throw new ErroNegocio(400, 'Senha muito longa.');
        const erro = Seg.validarSenhaForte(senha, login);
        if (erro) throw new ErroNegocio(400, erro);
        if (usuarioPorLogin(login)) throw new ErroNegocio(409, 'Já existe um usuário com esse login.');
        const hash = await Seg.hashSenha(senha);
        return transacao(db, () => {
            if (usuarioPorLogin(login)) throw new ErroNegocio(409, 'Já existe um usuário com esse login.');
            const perfil = dados.perfil === 'admin' ? 'admin' : 'operador';
            const id = novoId();
            executar(`INSERT INTO usuarios (id, login, nome, perfil, senha_hash, ativo, trocar_senha, senha_padrao, criado_em)
                      VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?)`, id, login, nome, perfil, hash, sim(dados.trocarSenha), agoraISO());
            auditar('USUARIO_CRIADO', { alvo: login, perfil }, autor(u), ip);
            return usuarioPublico(usuarioPorId(id));
        });
    }

    /** Desativa ou reativa (não pode a si mesmo nem o último admin ativo). */
    function alterarAtivo(u, id, ativo, ip) {
        return transacao(db, () => {
            const alvo = usuarioPorId(String(id));
            if (!alvo) throw new ErroNegocio(404, 'Usuário não encontrado.');
            if (alvo.id === u.id) throw new ErroNegocio(400, 'Você não pode desativar o próprio usuário.');
            const desativar = !ativo;
            if (desativar && alvo.perfil === 'admin' && alvo.ativo === 1 && adminsAtivos() <= 1) throw new ErroNegocio(400, 'É preciso manter ao menos um Administrador ativo.');
            executar('UPDATE usuarios SET ativo = ? WHERE id = ?', sim(!desativar), alvo.id);
            if (desativar) encerrarSessoesDe(alvo.id, 'USUARIO_DESATIVADO');
            auditar(desativar ? 'USUARIO_DESATIVADO' : 'USUARIO_ATIVADO', { alvo: alvo.login }, autor(u), ip);
            return usuarioPublico(usuarioPorId(alvo.id));
        });
    }

    /** Remove (marca removido_em; o histórico e a auditoria dele continuam). */
    function removerUsuario(u, id, ip) {
        return transacao(db, () => {
            const alvo = usuarioPorId(String(id));
            if (!alvo) throw new ErroNegocio(404, 'Usuário não encontrado.');
            if (alvo.id === u.id) throw new ErroNegocio(400, 'Você não pode remover o próprio usuário.');
            if (alvo.perfil === 'admin' && alvo.ativo === 1 && adminsAtivos() <= 1) throw new ErroNegocio(400, 'É preciso manter ao menos um Administrador ativo.');
            executar('UPDATE usuarios SET removido_em = ?, ativo = 0 WHERE id = ?', agoraISO(), alvo.id);
            encerrarSessoesDe(alvo.id, 'USUARIO_DESATIVADO');
            auditar('USUARIO_REMOVIDO', { alvo: alvo.login, perfil: alvo.perfil }, autor(u), ip);
            return { ok: true };
        });
    }

    /** Admin define senha provisória; o usuário troca no próximo login (exceto a própria). */
    async function redefinirSenha(u, id, senha, ip) {
        const alvo = usuarioPorId(String(id));
        if (!alvo) throw new ErroNegocio(404, 'Usuário não encontrado.');
        senha = String(senha == null ? '' : senha);
        const erro = senha.length > 128 ? 'Senha muito longa.' : Seg.validarSenhaForte(senha, alvo.login);
        if (erro) throw new ErroNegocio(400, erro);
        const hash = await Seg.hashSenha(senha);
        return transacao(db, () => {
            const proprio = alvo.id === u.id;
            executar('UPDATE usuarios SET senha_hash = ?, senha_padrao = 0, trocar_senha = ?, senha_alterada_em = ? WHERE id = ?', hash, sim(!proprio), agoraISO(), alvo.id);
            if (!proprio) encerrarSessoesDe(alvo.id, 'SENHA_ALTERADA');
            auditar('SENHA_REDEFINIDA', { alvo: alvo.login }, autor(u), ip);
            return usuarioPublico(usuarioPorId(alvo.id));
        });
    }

    /**
     * Troca da própria senha. A senha atual é exigida, exceto na troca
     * obrigatória logo após o login (trocar_senha = 1).
     */
    async function trocarMinhaSenha(ctxSessao, atual, nova, ip) {
        const u = ctxSessao.usuario;
        nova = String(nova == null ? '' : nova);
        const erro = nova.length > 128 ? 'Senha muito longa.' : Seg.validarSenhaForte(nova, u.login);
        if (erro) throw new ErroNegocio(400, erro);
        if (u.trocar_senha !== 1) {
            if (!(await Seg.verificarSenha(String(atual == null ? '' : atual), registroSenha(u)))) throw new ErroNegocio(400, 'Senha atual incorreta.');
            if (nova === atual) throw new ErroNegocio(400, 'A nova senha deve ser diferente da atual.');
        }
        const hash = await Seg.hashSenha(nova);
        return transacao(db, () => {
            executar('UPDATE usuarios SET senha_hash = ?, trocar_senha = 0, senha_padrao = 0, senha_alterada_em = ? WHERE id = ?', hash, agoraISO(), u.id);
            encerrarSessoesDe(u.id, 'SENHA_ALTERADA', ctxSessao.sessao.id); // derruba os outros aparelhos
            auditar('SENHA_ALTERADA', { alvo: u.login }, autor(u), ip);
            return usuarioPublico(usuarioPorId(u.id));
        });
    }

    /* ======================= AUDITORIA ======================= */

    /** Ações registradas pelo próprio painel (só as da lista permitida). */
    function registrarEvento(u, acao, detalhes, ip) {
        if (EVENTOS_DO_NAVEGADOR.indexOf(acao) < 0) throw new ErroNegocio(400, 'Ação de auditoria não permitida.');
        const limpos = {};
        Object.keys(detalhes && typeof detalhes === 'object' ? detalhes : {}).slice(0, 10).forEach((k) => {
            const v = detalhes[k];
            limpos[texto(k, 40)] = typeof v === 'number' && Number.isFinite(v) ? v : texto(v, 200);
        });
        return transacao(db, () => auditar(acao, limpos, autor(u), ip));
    }

    /** Tentativa de usar algo sem permissão (registrada pelo servidor). */
    function acessoNegado(u, permissao, ip) {
        transacao(db, () => auditar('ACESSO_NEGADO', { permissao }, autor(u), ip));
    }

    /** Confere a cadeia inteira no banco e registra a verificação. */
    function verificarAuditoria(u, ip) {
        const res = Aud.verificar(db);
        transacao(db, () => auditar('AUDITORIA_VERIFICADA', { resultado: res.ok ? 'ok' : 'falha', registros: res.total }, autor(u), ip));
        return res;
    }

    /* ======================= BACKUP ======================= */

    /** Backup no mesmo formato do painel (abre e restaura em qualquer modo). */
    function exportarBackup(u, ip) {
        return transacao(db, () => {
            const patio = linhas("SELECT * FROM estadias WHERE situacao = 'no_patio' ORDER BY entrada_em").map(veiculoDoPatio);
            const historico = linhas("SELECT * FROM estadias WHERE situacao = 'finalizada' ORDER BY saida_em").map(saidaDoHistorico);
            auditar('BACKUP_EXPORTADO', { patio: patio.length, historico: historico.length }, autor(u), ip);
            const usuarios = linhas('SELECT * FROM usuarios WHERE removido_em IS NULL ORDER BY criado_em').map((x) => {
                const p = usuarioPublico(x);
                const s = registroSenha(x);
                if (s.senha) p.senha = s.senha; else { p.hash = s.hash; p.sal = s.sal; }
                return p;
            });
            const cfg = config();
            const aud = Aud.listar(db, Number.MAX_SAFE_INTEGER);
            return {
                sistema: 'chaveiro-senador-painel', versao: VERSAO_BACKUP, origem: 'banco-de-dados',
                geradoEm: agoraISO(), geradoPor: u.login, usuarios, patio, historico,
                config: { valorMinimo: cfg.valorMinimo, valorHoraAdicional: cfg.valorHoraAdicional, toleranciaMin: cfg.toleranciaMin, vagas: cfg.vagas },
                auditoria: aud.registros, ancora: aud.ancora
            };
        });
    }

    /** Confere o formato do backup. Retorna '' ou a mensagem de erro. */
    function validarBackup(b) {
        if (!b || b.sistema !== 'chaveiro-senador-painel') return 'Este arquivo não é um backup do painel.';
        if (b.versao > VERSAO_BACKUP) return 'Backup feito por uma versão mais nova do painel.';
        if (!Array.isArray(b.usuarios) || !Array.isArray(b.patio) || !Array.isArray(b.historico) || !Array.isArray(b.auditoria)) return 'Backup incompleto ou corrompido.';
        if (!b.usuarios.some((x) => x && x.perfil === 'admin' && x.ativo !== false)) return 'O backup não tem nenhum Administrador ativo.';
        const logins = b.usuarios.map((x) => String(x && x.login || '').toLowerCase());
        if (new Set(logins).size !== logins.length) return 'O backup tem logins repetidos.';
        return '';
    }

    /** Grava usuários, pátio, histórico e configuração do backup (dentro de uma transação já aberta). */
    function gravarDadosDoBackup(b) {
        const agora = agoraISO();
        const ids = new Set();
        b.usuarios.forEach((x) => {
            const id = texto(x.id, 40) || novoId();
            ids.add(id);
            const senha = x.senha ? String(x.senha) : (x.hash && x.sal ? 'legado$' + x.sal + '$' + x.hash : null);
            if (!senha) throw new ErroNegocio(400, 'Usuário ' + x.login + ' sem senha no backup.');
            executar(`INSERT INTO usuarios (id, login, nome, perfil, senha_hash, ativo, trocar_senha, senha_padrao, criado_em,
                      senha_alterada_em, ultimo_login, ultimo_login_anterior, removido_em)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                      ON CONFLICT (id) DO UPDATE SET login = excluded.login, nome = excluded.nome, perfil = excluded.perfil,
                      senha_hash = excluded.senha_hash, ativo = excluded.ativo, trocar_senha = excluded.trocar_senha,
                      senha_padrao = excluded.senha_padrao, criado_em = excluded.criado_em, senha_alterada_em = excluded.senha_alterada_em,
                      ultimo_login = excluded.ultimo_login, ultimo_login_anterior = excluded.ultimo_login_anterior, removido_em = NULL`,
            id, texto(x.login, 30).toLowerCase(), texto(x.nome, 60), x.perfil === 'admin' ? 'admin' : 'operador', senha,
            sim(x.ativo !== false), sim(x.trocarSenha), sim(x.senhaPadrao), isoValido(x.criadoEm) ? x.criadoEm : agora,
            x.senhaAlteradaEm || null, x.ultimoLogin || null, x.ultimoLoginAnterior || null);
        });

        const inserir = db.prepare(`INSERT INTO estadias (id, placa, motorista, modelo, chave, entrada_em, registrado_por_nome, situacao,
            saida_em, minutos, valor_centavos, forma_pagamento, valor_recebido_centavos, troco_centavos,
            tarifa_minimo_centavos, tarifa_hora_adicional_centavos, tarifa_tolerancia_min, recebido_por_nome)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const usados = new Set();
        const idUnico = (id) => { let i = texto(id, 40) || novoId(); while (usados.has(i)) i = novoId(); usados.add(i); return i; };
        b.patio.forEach((v) => {
            inserir.run(idUnico(v.id), Regras.normalizarPlaca(v.placa), texto(v.nome, 80), texto(v.modelo, 40), texto(v.chave, 10), v.entrada,
                texto(v.registradoPor, 60), 'no_patio', null, null, null, null, null, null, null, null, null, null);
        });
        b.historico.forEach((h) => {
            const t = h.tabela || {};
            const pg = FORMAS_PAGAMENTO.indexOf(h.pagamento) >= 0 ? h.pagamento : 'Dinheiro';
            inserir.run(idUnico(h.id), Regras.normalizarPlaca(h.placa), texto(h.nome, 80), texto(h.modelo, 40), texto(h.chave, 10), h.entrada,
                texto(h.registradoPor, 60), 'finalizada', h.saida, h.minutos, paraCentavos(h.valor), pg,
                h.valorRecebido !== undefined ? paraCentavos(h.valorRecebido) : null, h.troco !== undefined ? paraCentavos(h.troco) : null,
                t.valorMinimo !== undefined ? paraCentavos(t.valorMinimo) : null, t.valorHoraAdicional !== undefined ? paraCentavos(t.valorHoraAdicional) : null,
                t.toleranciaMin !== undefined ? t.toleranciaMin : null, texto(h.recebidoPor, 60));
        });

        const c = Object.assign({}, Regras.CONFIG_PADRAO, { vagas: 30 }, b.config || {});
        executar(`UPDATE configuracao SET valor_minimo_centavos = ?, valor_hora_adicional_centavos = ?, tolerancia_min = ?, vagas = ?,
                  atualizado_em = ?, atualizado_por = NULL WHERE id = 1`,
        paraCentavos(c.valorMinimo), paraCentavos(c.valorHoraAdicional), Number(c.toleranciaMin) || 0, Number(c.vagas) || 30, agora);
        return ids;
    }

    /**
     * Restaura um backup com o banco em uso: troca usuários, pátio,
     * histórico e configuração. A auditoria oficial NÃO é apagada; a
     * auditoria do arquivo vai para auditoria_importada, como referência.
     * @returns {{ok, desconectar}} desconectar=true se o seu usuário não existe no backup
     */
    function restaurarBackup(ctxSessao, b, arquivo, ip) {
        const erro = validarBackup(b);
        if (erro) throw new ErroNegocio(400, erro);
        const u = ctxSessao.usuario;
        return transacao(db, () => {
            const agora = agoraISO();
            executar('UPDATE usuarios SET removido_em = ?, ativo = 0 WHERE removido_em IS NULL', agora);
            executar('DELETE FROM estadias');
            const ids = gravarDadosDoBackup(b);

            const lote = agora + ' ' + texto(arquivo, 120);
            const ins = db.prepare(`INSERT INTO auditoria_importada (lote, seq, data, usuario, nome, perfil, acao, descricao, detalhes, anterior, hash)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            b.auditoria.forEach((r) => ins.run(lote, Number(r.seq) || 0, String(r.data || ''), String(r.usuario || ''), String(r.nome || ''),
                String(r.perfil || ''), String(r.acao || ''), String(r.descricao || ''), JSON.stringify(r.detalhes || {}), String(r.anterior || ''), String(r.hash || '')));
            const cadeia = Aud.verificarCadeia(b.auditoria, b.ancora || null, Aud.sha256);

            const continuo = ids.has(u.id) && umaLinha('SELECT ativo FROM usuarios WHERE id = ?', u.id).ativo === 1;
            executar("UPDATE sessoes SET encerrada_em = ?, motivo_encerramento = 'BACKUP_RESTAURADO' WHERE encerrada_em IS NULL AND id IS NOT ?",
                agora, continuo ? ctxSessao.sessao.id : null);
            auditar('BACKUP_RESTAURADO', {
                arquivo: texto(arquivo, 120), historico: b.historico.length, patio: b.patio.length,
                auditoriaDoArquivo: b.auditoria.length + ' registro(s), cadeia ' + (cadeia.ok ? 'íntegra' : 'com falha')
            }, autor(u), ip);
            return { ok: true, desconectar: !continuo };
        });
    }

    /**
     * Banco NOVO a partir de um backup do navegador (migração inicial).
     * Aqui a auditoria do arquivo vira a cadeia oficial, preservando
     * números e hashes, e a migração é registrada como continuação dela.
     */
    function importarEmBancoVazio(b, arquivo) {
        const erro = validarBackup(b);
        if (erro) throw new ErroNegocio(400, erro);
        const vazio = umaLinha('SELECT (SELECT COUNT(*) FROM usuarios) + (SELECT COUNT(*) FROM estadias) + (SELECT COUNT(*) FROM auditoria) AS n').n === 0;
        if (!vazio) throw new ErroNegocio(409, 'O banco já tem dados. Use a restauração pelo painel ou um arquivo de banco novo.');
        const cadeia = Aud.verificarCadeia(b.auditoria, b.ancora || null, Aud.sha256);
        if (!cadeia.ok) throw new ErroNegocio(400, 'A auditoria do backup está adulterada: ' + cadeia.motivo);
        return transacao(db, () => {
            gravarDadosDoBackup(b);
            if (b.ancora) executar('INSERT INTO auditoria_ancora (id, hash) VALUES (1, ?)', b.ancora);
            const ins = db.prepare(`INSERT INTO auditoria (seq, data, usuario, nome, perfil, acao, descricao, detalhes, ip, anterior, hash)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`);
            b.auditoria.forEach((r) => ins.run(r.seq, r.data, r.usuario, r.nome || '', r.perfil || '', r.acao, r.descricao, JSON.stringify(r.detalhes || {}), r.anterior, r.hash));
            auditar('BACKUP_RESTAURADO', { arquivo: texto(arquivo, 120), historico: b.historico.length, patio: b.patio.length, observacao: 'migração do navegador para o banco de dados' }, null, null);
            return { usuarios: b.usuarios.length, patio: b.patio.length, historico: b.historico.length, auditoria: b.auditoria.length };
        });
    }

    return {
        garantirAdminPadrao, entrar, validarSessao, segundosRestantes, sair,
        estado, versao, config,
        registrarEntrada, registrarSaida, excluirVeiculo, excluirHistorico,
        salvarPrecos, salvarVagas,
        criarUsuario, alterarAtivo, removerUsuario, redefinirSenha, trocarMinhaSenha,
        registrarEvento, acessoNegado, verificarAuditoria,
        exportarBackup, restaurarBackup, importarEmBancoVazio, validarBackup
    };
}

module.exports = { criarRepositorio, ErroNegocio, usuarioPublico, INATIVIDADE_MIN, DURACAO_MAX_HORAS, FORMAS_PAGAMENTO };
