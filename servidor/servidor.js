/**
 * =====================================================================
 * SERVIDOR/SERVIDOR.JS - SERVIDOR DO PAINEL + API DO BANCO DE DADOS
 * =====================================================================
 * Liga o site, o painel administrativo e a API que grava no banco SQL.
 *
 *   Iniciar:  npm run servidor        (ou: node servidor/servidor.js)
 *   Abrir:    http://localhost:8080/admin/
 *
 * Variáveis de ambiente (todas opcionais):
 *   PORTA=8080                     porta HTTP
 *   HOST=0.0.0.0                   0.0.0.0 = aceita celulares/PCs da rede; 127.0.0.1 = só este PC
 *   BANCO=servidor/dados/estacionamento.db   arquivo do banco
 *   COPIAS=servidor/dados/copias   pasta das cópias automáticas diárias do banco
 *   COOKIE_SEGURO=1                use quando o acesso for por HTTPS
 *   CONFIAR_PROXY=1                atrás de um proxy (nginx etc.): usa X-Forwarded-For/Proto
 *
 * Proteções da API
 *   - Sessão por cookie HttpOnly + SameSite=Strict (token só existe no cookie;
 *     no banco fica apenas o hash). Expira com 30 min sem uso ou 8 h.
 *   - Toda requisição que altera dados exige o cabeçalho X-Painel: 1 e
 *     origem igual ao próprio servidor (anti-CSRF).
 *   - Permissões conferidas no servidor (admin/js/nucleo/permissoes.js).
 *   - Bloqueio progressivo por login + limite de tentativas por IP.
 *   - Consultas SQL sempre parametrizadas (sem concatenar texto do usuário).
 *   - Somente as pastas públicas do site são servidas; o banco nunca.
 * =====================================================================
 */
'use strict';

const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const Banco = require('./lib/banco.js');
const { criarRepositorio, ErroNegocio, usuarioPublico } = require('./lib/repositorio.js');
const { perfilPode } = require('../admin/js/nucleo/permissoes.js');
const H = require('./lib/http.js');

const RAIZ_SITE = path.join(__dirname, '..');
const VERSAO_API = '1.0.0';

/* ---------------- limite de tentativas de login por IP ---------------- */
const JANELA_IP_MS = 10 * 60 * 1000;
const MAX_LOGIN_POR_IP = 30;
const tentativasPorIp = new Map();
function excedeuLimiteIp(ip) {
    const agora = Date.now();
    const lista = (tentativasPorIp.get(ip) || []).filter((t) => agora - t < JANELA_IP_MS);
    lista.push(agora);
    tentativasPorIp.set(ip, lista);
    return lista.length > MAX_LOGIN_POR_IP;
}
// Limpa da memória os IPs sem tentativas recentes
setInterval(() => {
    const agora = Date.now();
    for (const [ip, lista] of tentativasPorIp) if (!lista.some((t) => agora - t < JANELA_IP_MS)) tentativasPorIp.delete(ip);
}, JANELA_IP_MS).unref();

/**
 * Tabela de rotas da API.
 *   permissao   permissão exigida (null = só precisa estar logado)
 *   publica     não exige login
 *   renova      false = não conta como "uso" (consultas automáticas a cada 15 s)
 *   comTroca    liberada mesmo com troca de senha pendente
 *   limite      tamanho máximo do corpo (bytes)
 */
function rotas(repo) {
    return [
        { m: 'GET', p: /^\/api\/saude$/, publica: true, f: () => ({ sistema: 'chaveiro-senador-api', versao: VERSAO_API, banco: 'sqlite', esquema: repo.esquema }) },

        /* sessão */
        { m: 'POST', p: /^\/api\/sessao$/, publica: true, f: async (c) => {
            if (excedeuLimiteIp(c.ip)) throw new ErroNegocio(429, 'Muitas tentativas a partir deste aparelho. Aguarde alguns minutos.');
            const r = await repo.entrar(c.corpo.login, c.corpo.senha, { ip: c.ip, navegador: c.req.headers['user-agent'] });
            if (r.ok) c.res.setHeader('Set-Cookie', H.cookieSessao(r.token, c.cookieSeguro));
            delete r.token;
            return r;
        } },
        { m: 'GET', p: /^\/api\/sessao$/, renova: false, comTroca: true, f: (c) => ({ usuario: usuarioPublico(c.sessao.usuario), segundosRestantes: repo.segundosRestantes(c.sessao.sessao.id) }) },
        { m: 'POST', p: /^\/api\/sessao\/renovar$/, comTroca: true, f: (c) => ({ segundosRestantes: repo.segundosRestantes(c.sessao.sessao.id) }) },
        { m: 'DELETE', p: /^\/api\/sessao$/, renova: false, comTroca: true, f: (c) => {
            repo.sair(c.sessao, c.corpo.motivo, c.ip);
            c.res.setHeader('Set-Cookie', H.cookieSessao(null, c.cookieSeguro));
            return { ok: true };
        } },

        /* leitura */
        { m: 'GET', p: /^\/api\/estado$/, renova: false, comTroca: true, f: (c) => repo.estado(c.sessao.usuario) },
        { m: 'GET', p: /^\/api\/versao$/, renova: false, comTroca: true, f: () => ({ versao: repo.versao() }) },

        /* pátio */
        { m: 'POST', p: /^\/api\/patio$/, permissao: 'patio.entrada', f: (c) => repo.registrarEntrada(c.sessao.usuario, c.corpo, c.ip) },
        { m: 'POST', p: /^\/api\/patio\/([\w-]{1,60})\/saida$/, permissao: 'patio.saida', f: (c) => repo.registrarSaida(c.sessao.usuario, c.params[0], c.corpo, c.ip) },
        { m: 'DELETE', p: /^\/api\/patio\/([\w-]{1,60})$/, permissao: 'patio.excluir', f: (c) => repo.excluirVeiculo(c.sessao.usuario, c.params[0], c.ip) },
        { m: 'DELETE', p: /^\/api\/historico\/([\w-]{1,60})$/, permissao: 'historico.excluir', f: (c) => repo.excluirHistorico(c.sessao.usuario, c.params[0], c.ip) },

        /* configurações */
        { m: 'PUT', p: /^\/api\/config\/precos$/, permissao: 'config.alterar', f: (c) => repo.salvarPrecos(c.sessao.usuario, c.corpo, c.ip) },
        { m: 'PUT', p: /^\/api\/config\/vagas$/, permissao: 'config.alterar', f: (c) => repo.salvarVagas(c.sessao.usuario, c.corpo.vagas, c.ip) },

        /* usuários */
        { m: 'POST', p: /^\/api\/usuarios$/, permissao: 'usuarios.gerenciar', f: (c) => repo.criarUsuario(c.sessao.usuario, c.corpo, c.ip) },
        { m: 'PUT', p: /^\/api\/usuarios\/([\w-]{1,60})\/ativo$/, permissao: 'usuarios.gerenciar', f: (c) => repo.alterarAtivo(c.sessao.usuario, c.params[0], !!c.corpo.ativo, c.ip) },
        { m: 'PUT', p: /^\/api\/usuarios\/([\w-]{1,60})\/senha$/, permissao: 'usuarios.gerenciar', f: (c) => repo.redefinirSenha(c.sessao.usuario, c.params[0], c.corpo.senha, c.ip) },
        { m: 'DELETE', p: /^\/api\/usuarios\/([\w-]{1,60})$/, permissao: 'usuarios.gerenciar', f: (c) => repo.removerUsuario(c.sessao.usuario, c.params[0], c.ip) },
        { m: 'PUT', p: /^\/api\/minha-senha$/, permissao: 'senha.propria', comTroca: true, f: (c) => repo.trocarMinhaSenha(c.sessao, c.corpo.atual, c.corpo.nova, c.ip) },

        /* auditoria */
        { m: 'POST', p: /^\/api\/auditoria\/eventos$/, permissao: null, f: (c) => repo.registrarEvento(c.sessao.usuario, c.corpo.acao, c.corpo.detalhes, c.ip) },
        { m: 'POST', p: /^\/api\/auditoria\/verificar$/, permissao: 'auditoria.ver', f: (c) => repo.verificarAuditoria(c.sessao.usuario, c.ip) },

        /* backup */
        { m: 'GET', p: /^\/api\/backup$/, permissao: 'config.backup', f: (c) => repo.exportarBackup(c.sessao.usuario, c.ip) },
        { m: 'POST', p: /^\/api\/backup\/restaurar$/, permissao: 'config.backup', limite: 25 * 1024 * 1024, f: (c) => {
            const r = repo.restaurarBackup(c.sessao, c.corpo.backup, c.corpo.arquivo, c.ip);
            if (r.desconectar) c.res.setHeader('Set-Cookie', H.cookieSessao(null, c.cookieSeguro));
            return r;
        } }
    ];
}

/**
 * Cria o servidor (sem começar a escutar). Usado também pelos testes.
 * @param {{db, raiz?, confiarProxy?, cookieSeguro?}} opcoes
 */
function criarServidor(opcoes) {
    const repo = criarRepositorio(opcoes.db);
    repo.esquema = Banco.versaoEsquema(opcoes.db);
    const tabela = rotas(repo);
    const raiz = opcoes.raiz || RAIZ_SITE;

    async function tratarApi(req, res, caminho) {
        const ip = opcoes.confiarProxy && req.headers['x-forwarded-for']
            ? String(req.headers['x-forwarded-for']).split(',')[0].trim()
            : (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
        const cookieSeguro = !!(opcoes.cookieSeguro || req.socket.encrypted || (opcoes.confiarProxy && req.headers['x-forwarded-proto'] === 'https'));

        const candidatas = tabela.filter((r) => r.p.test(caminho));
        if (!candidatas.length) return H.responderJSON(res, 404, { erro: 'Endereço da API não encontrado.' });
        const rota = candidatas.find((r) => r.m === req.method);
        if (!rota) return H.responderJSON(res, 405, { erro: 'Método não permitido.' });

        // Anti-CSRF: quem altera dados precisa mandar o cabeçalho do painel e vir do mesmo endereço
        if (req.method !== 'GET') {
            if (req.headers['x-painel'] !== '1') return H.responderJSON(res, 403, { erro: 'Requisição recusada (origem não confirmada).' });
            const origem = req.headers.origin;
            if (origem && origem !== 'null') {
                let host = '';
                try { host = new URL(origem).host; } catch (e) { /* origem inválida */ }
                if (host !== req.headers.host) return H.responderJSON(res, 403, { erro: 'Requisição recusada (outro site).' });
            }
        }

        const c = { req, res, ip, cookieSeguro, params: caminho.match(rota.p).slice(1), corpo: {} };
        if (req.method !== 'GET') c.corpo = await H.lerJSON(req, rota.limite);

        if (!rota.publica) {
            c.sessao = repo.validarSessao(H.lerCookies(req)[H.NOME_COOKIE], rota.renova !== false, ip);
            if (!c.sessao) return H.responderJSON(res, 401, { erro: 'Sessão expirada. Entre novamente.', sessao: false });
            const u = c.sessao.usuario;
            if (u.trocar_senha === 1 && !rota.comTroca) return H.responderJSON(res, 403, { erro: 'Troque a sua senha antes de continuar.', trocarSenha: true });
            if (rota.permissao && !perfilPode(u.perfil, rota.permissao)) {
                repo.acessoNegado(u, rota.permissao, ip);
                return H.responderJSON(res, 403, { erro: 'Você não tem permissão para esta ação.' });
            }
        }
        const resultado = await rota.f(c);
        H.responderJSON(res, 200, resultado === undefined ? { ok: true } : resultado);
    }

    const servidor = http.createServer(async (req, res) => {
        const caminho = (req.url || '/').split('?')[0];
        try {
            if (caminho.startsWith('/api/')) return await tratarApi(req, res, caminho);
            if ((req.method === 'GET' || req.method === 'HEAD') && H.servirArquivo(req, res, raiz)) return;
            res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, H.CABECALHOS_SEGURANCA));
            res.end('Não encontrado.');
        } catch (e) {
            // Regra do banco (CHECK, UNIQUE...) que escapou da validação: dado inválido, não erro do servidor
            const doBanco = !e.status && /constraint|CHECK|UNIQUE/i.test(String(e.message));
            const status = e.status || (doBanco ? 400 : 500);
            if (status === 500) console.error('[erro]', e);
            const msg = doBanco ? 'Dados recusados pelo banco: ' + e.message : (status === 500 ? 'Erro interno do servidor.' : e.message);
            if (!res.headersSent) H.responderJSON(res, status, { erro: msg });
            else res.end();
        }
    });
    servidor.repo = repo;
    return servidor;
}

/** Endereços desta máquina na rede local (para abrir no celular). */
function enderecosNaRede(porta) {
    return Object.values(os.networkInterfaces()).flat()
        .filter((i) => i && i.family === 'IPv4' && !i.internal)
        .map((i) => 'http://' + i.address + ':' + porta + '/admin/');
}

/* ---------------- execução direta: node servidor/servidor.js ---------------- */
if (require.main === module) {
    const PORTA = Number(process.env.PORTA || 8080);
    const HOST = process.env.HOST || '0.0.0.0';
    const ARQ_BANCO = path.resolve(process.env.BANCO || path.join(__dirname, 'dados', 'estacionamento.db'));
    const PASTA_COPIAS = path.resolve(process.env.COPIAS || path.join(__dirname, 'dados', 'copias'));

    const db = Banco.abrir(ARQ_BANCO);
    const servidor = criarServidor({ db, confiarProxy: process.env.CONFIAR_PROXY === '1', cookieSeguro: process.env.COOKIE_SEGURO === '1' });

    // Cópia automática do banco ao iniciar e a cada 24 h (mantém as 30 mais recentes)
    const copiar = () => {
        try { console.log('Cópia de segurança do banco: ' + Banco.copiaDeSeguranca(db, PASTA_COPIAS)); } catch (e) { console.error('Falha na cópia de segurança:', e.message); }
    };

    servidor.repo.garantirAdminPadrao().then((criado) => {
        servidor.listen(PORTA, HOST, () => {
            console.log('');
            console.log('  Painel do estacionamento - servidor ligado');
            console.log('  Banco de dados: ' + ARQ_BANCO);
            console.log('  Neste computador:  http://localhost:' + PORTA + '/admin/');
            if (HOST === '0.0.0.0') enderecosNaRede(PORTA).forEach((e) => console.log('  Na rede (celular): ' + e));
            if (criado) console.log('  Primeiro acesso: usuário admin / senha admin (troque logo após entrar).');
            console.log('  Para desligar: Ctrl + C');
            console.log('');
            copiar();
            setInterval(copiar, 24 * 3600 * 1000).unref();
        });
    });

    const desligar = () => { servidor.close(); db.close(); process.exit(0); };
    process.on('SIGINT', desligar);
    process.on('SIGTERM', desligar);
}

module.exports = { criarServidor };
