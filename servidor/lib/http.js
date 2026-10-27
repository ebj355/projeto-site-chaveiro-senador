/**
 * =====================================================================
 * SERVIDOR/LIB/HTTP.JS - UTILIDADES HTTP (sem framework)
 * =====================================================================
 *   lerJSON()        lê o corpo da requisição com limite de tamanho
 *   responderJSON()  responde com JSON e cabeçalhos de segurança
 *   lerCookies()     cookies da requisição
 *   cookieSessao()   monta o cookie da sessão (HttpOnly, SameSite=Strict)
 *   servirArquivo()  entrega arquivos do site, só das pastas permitidas
 * =====================================================================
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const NOME_COOKIE = 'painel_sessao';

/** Cabeçalhos de segurança enviados em todas as respostas. */
const CABECALHOS_SEGURANCA = {
    'X-Content-Type-Options': 'nosniff',           // navegador não "adivinha" o tipo do arquivo
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin'
};

const TIPOS = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
    '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject'
};

/** Pastas do projeto que podem ser entregues ao navegador. Todo o resto (servidor/, banco, .git, testes) fica inacessível. */
const PASTAS_PUBLICAS = ['admin/', 'assets/', 'imagens/'];
const ARQUIVO_RAIZ_PUBLICO = /^[a-z0-9._-]+\.(html|xml|txt|ico|webp|png)$/i;

/** Erro de requisição (status HTTP + mensagem). */
class ErroHttp extends Error {
    constructor(status, mensagem) { super(mensagem); this.status = status; }
}

/** Lê e interpreta o corpo JSON. limite em bytes. */
function lerJSON(req, limite = 64 * 1024) {
    return new Promise((resolve, reject) => {
        let tamanho = 0;
        let excedeu = false;
        const partes = [];
        req.on('data', (p) => {
            tamanho += p.length;
            if (excedeu) {
                // Continua lendo (descartando) para a resposta 413 chegar ao navegador; corta se for abusivo
                if (tamanho > limite * 4) req.destroy();
                return;
            }
            if (tamanho > limite) { excedeu = true; partes.length = 0; reject(new ErroHttp(413, 'Dados grandes demais.')); return; }
            partes.push(p);
        });
        req.on('end', () => {
            if (excedeu) return;
            if (!partes.length) return resolve({});
            try { resolve(JSON.parse(Buffer.concat(partes).toString('utf8'))); } catch (e) { reject(new ErroHttp(400, 'JSON inválido.')); }
        });
        req.on('error', reject);
    });
}

function responderJSON(res, status, corpo, extras = {}) {
    const dados = JSON.stringify(corpo);
    res.writeHead(status, Object.assign({
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(dados),
        'Cache-Control': 'no-store',               // dados do painel nunca ficam em cache
        'X-Frame-Options': 'DENY'
    }, CABECALHOS_SEGURANCA, extras));
    res.end(dados);
}

function lerCookies(req) {
    const r = {};
    String(req.headers.cookie || '').split(';').forEach((par) => {
        const i = par.indexOf('=');
        if (i > 0) r[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
    });
    return r;
}

/**
 * Cookie da sessão. HttpOnly: JavaScript não lê (protege contra XSS).
 * SameSite=Strict: outros sites não conseguem usá-lo (protege contra CSRF).
 * Secure: só via HTTPS (ligado quando o servidor está atrás de HTTPS).
 */
function cookieSessao(token, seguro) {
    const base = NOME_COOKIE + '=' + (token || '') + '; Path=/api; HttpOnly; SameSite=Strict' + (seguro ? '; Secure' : '');
    return token ? base : base + '; Max-Age=0';
}

/** Entrega um arquivo do site, ou retorna false se não for permitido/existente. */
function servirArquivo(req, res, raiz) {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, ''); } catch (e) { return false; }
    if (rel === '' ) rel = 'index.html';
    if (rel === 'admin') { res.writeHead(301, { Location: '/admin/' }); res.end(); return true; }
    if (rel.endsWith('/')) rel += 'index.html';

    // Bloqueia "..", arquivos ocultos e qualquer caminho fora das pastas públicas
    const segmentos = rel.split('/');
    if (segmentos.some((s) => s === '' || s === '..' || s.startsWith('.')) || rel.includes('\\') || rel.includes('\0')) return false;
    const publico = PASTAS_PUBLICAS.some((p) => rel.startsWith(p)) || (segmentos.length === 1 && ARQUIVO_RAIZ_PUBLICO.test(rel));
    if (!publico) return false;

    const arquivo = path.resolve(raiz, rel);
    if (!arquivo.startsWith(path.resolve(raiz) + path.sep)) return false;
    let info;
    try { info = fs.statSync(arquivo); } catch (e) { return false; }
    if (!info.isFile()) return false;

    const painel = rel.startsWith('admin/');
    res.writeHead(200, Object.assign({
        'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': painel ? 'no-cache' : 'public, max-age=3600'
    }, CABECALHOS_SEGURANCA, painel ? {
        'X-Frame-Options': 'DENY',                         // painel nunca dentro de iframe (anti-clickjacking)
        'Content-Security-Policy': "frame-ancestors 'none'",
        'X-Robots-Tag': 'noindex, nofollow'                // painel fora do Google
    } : {}));
    if (req.method === 'HEAD') { res.end(); return true; }
    fs.createReadStream(arquivo).pipe(res);
    return true;
}

module.exports = { NOME_COOKIE, ErroHttp, lerJSON, responderJSON, lerCookies, cookieSessao, servirArquivo, CABECALHOS_SEGURANCA };
