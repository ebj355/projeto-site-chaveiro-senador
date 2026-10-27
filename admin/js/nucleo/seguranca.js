/**
 * =====================================================================
 * SEGURANCA.JS - FUNÇÕES DE SEGURANÇA DO PAINEL ADMINISTRATIVO
 * =====================================================================
 * Reúne tudo o que protege senhas, sessão e dados exibidos:
 *
 *   - sha256()            hash SHA-256 em JavaScript puro (funciona em
 *                         file://, http, https e no Node para testes)
 *   - hashSenha()         PBKDF2-SHA256 com sal aleatório e 120.000
 *                         iterações (Web Crypto). Se o navegador não
 *                         oferecer Web Crypto, usa SHA-256 iterado.
 *   - verificarSenha()    compara em tempo constante e aceita o formato
 *                         antigo do módulo de estacionamento (migração)
 *   - validarSenhaForte() política mínima de senha
 *   - gerarToken()        identificadores aleatórios criptográficos
 *   - esc()               escapa texto antes de colocar em HTML (anti-XSS)
 *   - celulaCSV()         neutraliza fórmulas em planilhas (anti CSV-injection)
 *   - protegerContraFrames() impede que o painel seja aberto dentro de
 *                         um <iframe> de outro site (anti-clickjacking)
 *
 * Exposto em: window.Admin.Seguranca (navegador) ou module.exports (Node)
 *
 * IMPORTANTE: no modo local tudo roda no navegador. Isso protege o uso
 * no balcão (funcionário sem senha não entra, senha não fica legível,
 * ações ficam auditadas), mas quem tem acesso ao computador e
 * conhecimento técnico pode ler/alterar o armazenamento do navegador.
 * No modo servidor este mesmo arquivo é usado pelo servidor
 * (servidor/lib/repositorio.js) para o hash das senhas, e os dados
 * ficam no banco. Ver docs/SEGURANCA.md e docs/BANCO-DE-DADOS.md.
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var ITERACOES_PBKDF2 = 120000;
    var cryptoApi = (typeof crypto !== 'undefined') ? crypto : null;

    /* -----------------------------------------------------------------
       SHA-256 (FIPS 180-4) em JavaScript puro
       ----------------------------------------------------------------- */
    var K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    /** Rotação de bits à direita (operação básica do SHA-256). */
    function rotr(n, x) { return (x >>> n) | (x << (32 - n)); }

    /** Converte texto para bytes UTF-8. */
    function utf8(texto) {
        var s = unescape(encodeURIComponent(String(texto)));
        var b = new Array(s.length);
        for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
        return b;
    }

    /** Retorna o SHA-256 do texto em hexadecimal (64 caracteres). */
    function sha256(texto) {
        var bytes = utf8(texto);
        var bitLen = bytes.length * 8;
        bytes.push(0x80);
        while (bytes.length % 64 !== 56) bytes.push(0);
        for (var j = 7; j >= 0; j--) bytes.push(j >= 4 ? 0 : (bitLen >>> (j * 8)) & 0xff);

        var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
        var W = new Array(64);
        for (var off = 0; off < bytes.length; off += 64) {
            for (var t = 0; t < 16; t++) {
                W[t] = (bytes[off + t * 4] << 24) | (bytes[off + t * 4 + 1] << 16) | (bytes[off + t * 4 + 2] << 8) | bytes[off + t * 4 + 3];
            }
            for (t = 16; t < 64; t++) {
                var s0 = rotr(7, W[t - 15]) ^ rotr(18, W[t - 15]) ^ (W[t - 15] >>> 3);
                var s1 = rotr(17, W[t - 2]) ^ rotr(19, W[t - 2]) ^ (W[t - 2] >>> 10);
                W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
            }
            var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
            for (t = 0; t < 64; t++) {
                var t1 = (h + (rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) | 0;
                var t2 = ((rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
                h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
            }
            H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
            H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
        }
        return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
    }

    /* -----------------------------------------------------------------
       ALEATORIEDADE
       ----------------------------------------------------------------- */

    /** Bytes aleatórios criptográficos em hexadecimal (16 bytes = 32 caracteres). */
    function gerarToken(bytes) {
        var n = bytes || 16;
        var arr = new Uint8Array(n);
        if (cryptoApi && cryptoApi.getRandomValues) cryptoApi.getRandomValues(arr);
        else for (var i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256); // só em ambientes muito antigos
        return Array.prototype.map.call(arr, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    }

    /* -----------------------------------------------------------------
       SENHAS
       Formato gravado: "pbkdf2$<iterações>$<sal>$<hash>"
                     ou "sha256i$<iterações>$<sal>$<hash>" (sem Web Crypto)
       ----------------------------------------------------------------- */

    function webCryptoDisponivel() {
        return !!(cryptoApi && cryptoApi.subtle && typeof TextEncoder !== 'undefined');
    }

    /** Converte bytes (ArrayBuffer) em texto hexadecimal. */
    function hexDeBuffer(buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    }

    /** Deriva o hash da senha com PBKDF2-SHA256 (Web Crypto). Promise<string hex>. */
    function pbkdf2(senha, sal, iteracoes) {
        var enc = new TextEncoder();
        return cryptoApi.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits'])
            .then(function (chave) {
                return cryptoApi.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(sal), iterations: iteracoes }, chave, 256);
            })
            .then(hexDeBuffer);
    }

    /** SHA-256 iterado (alternativa quando não há Web Crypto). */
    function sha256Iterado(senha, sal, iteracoes) {
        var h = sal + ':' + senha;
        for (var i = 0; i < iteracoes; i++) h = sha256(h + sal);
        return h;
    }

    /** Gera o registro de senha a ser gravado. Retorna uma Promise<string>. */
    function hashSenha(senha) {
        var sal = gerarToken(16);
        if (webCryptoDisponivel()) {
            return pbkdf2(senha, sal, ITERACOES_PBKDF2).then(function (h) {
                return 'pbkdf2$' + ITERACOES_PBKDF2 + '$' + sal + '$' + h;
            });
        }
        var it = 5000;
        return Promise.resolve('sha256i$' + it + '$' + sal + '$' + sha256Iterado(senha, sal, it));
    }

    /** Comparação em tempo constante (não revela em que posição a senha difere). */
    function iguais(a, b) {
        if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
        var dif = 0;
        for (var i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
        return dif === 0;
    }

    /**
     * Confere a senha digitada com o registro gravado. Promise<boolean>.
     * @param {object} usuario precisa ter .senha (formato novo) ou .hash/.sal (formato antigo)
     */
    function verificarSenha(senha, usuario) {
        if (usuario.senha) {
            var p = usuario.senha.split('$');
            var tipo = p[0], it = parseInt(p[1], 10), sal = p[2], esperado = p[3];
            if (tipo === 'pbkdf2' && webCryptoDisponivel()) {
                return pbkdf2(senha, sal, it).then(function (h) { return iguais(h, esperado); });
            }
            if (tipo === 'sha256i') return Promise.resolve(iguais(sha256Iterado(senha, sal, it), esperado));
            return Promise.resolve(false);
        }
        // Formato antigo do módulo estacionamento.html (SHA-256 x1000 com sal)
        if (usuario.hash && usuario.sal) {
            var h = usuario.sal + ':' + senha;
            for (var i = 0; i < 1000; i++) h = sha256(h + usuario.sal);
            return Promise.resolve(iguais(h, usuario.hash));
        }
        return Promise.resolve(false);
    }

    /** Registro precisa ser recalculado no formato atual? (migração automática no login) */
    function precisaAtualizarHash(usuario) {
        return !usuario.senha || (usuario.senha.indexOf('pbkdf2$') !== 0 && webCryptoDisponivel());
    }

    /**
     * Política de senha: mínimo 8 caracteres, com letra e número,
     * e diferente do nome de usuário. Retorna '' se ok ou a mensagem de erro.
     */
    function validarSenhaForte(senha, login) {
        senha = String(senha || '');
        if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
        if (!/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha)) return 'Use letras e números na senha.';
        if (login && senha.toLowerCase().indexOf(String(login).toLowerCase()) !== -1) return 'A senha não pode conter o nome de usuário.';
        if (/^(12345678|password|senha123|admin123)/i.test(senha)) return 'Essa senha é muito comum. Escolha outra.';
        return '';
    }

    /* -----------------------------------------------------------------
       SAÍDA SEGURA
       ----------------------------------------------------------------- */

    /** Escapa texto para HTML. Use SEMPRE antes de montar HTML com dados digitados. */
    function esc(texto) {
        return String(texto == null ? '' : texto)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /**
     * Célula de CSV segura: entre aspas e sem permitir que o Excel
     * interprete o conteúdo como fórmula (=, +, -, @, tab).
     */
    function celulaCSV(valor) {
        var t = String(valor == null ? '' : valor);
        if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
        return '"' + t.replace(/"/g, '""') + '"';
    }

    /** Impede que a página seja carregada dentro de um iframe de outro site. */
    function protegerContraFrames() {
        try {
            if (raiz.top && raiz.top !== raiz.self) {
                raiz.top.location = raiz.self.location;
            }
        } catch (e) {
            // Se o navegador bloquear o redirecionamento, esconde o conteúdo
            if (raiz.document) raiz.document.documentElement.style.display = 'none';
        }
    }

    var Seguranca = {
        ITERACOES_PBKDF2: ITERACOES_PBKDF2,
        sha256: sha256,
        gerarToken: gerarToken,
        hashSenha: hashSenha,
        verificarSenha: verificarSenha,
        precisaAtualizarHash: precisaAtualizarHash,
        validarSenhaForte: validarSenhaForte,
        iguais: iguais,
        esc: esc,
        celulaCSV: celulaCSV,
        protegerContraFrames: protegerContraFrames,
        webCryptoDisponivel: webCryptoDisponivel
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Seguranca;
    } else {
        raiz.Admin = raiz.Admin || {};
        raiz.Admin.Seguranca = Seguranca;
    }
})(typeof window !== 'undefined' ? window : this);
