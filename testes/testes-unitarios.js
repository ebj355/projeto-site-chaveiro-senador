/**
 * =====================================================================
 * TESTES UNITÁRIOS DO PAINEL ADMIN (sem navegador)
 * =====================================================================
 * Executar na pasta do projeto:   node testes/testes-unitarios.js
 *
 * Cobre:
 *   - Regras do estacionamento (CT01–CT08, CT16–CT18, CT29 do roteiro)
 *   - Segurança: SHA-256, PBKDF2, comparação, política de senha,
 *     escape HTML, CSV seguro, migração do hash antigo
 *   - Auditoria: cadeia de hashes detecta alteração, remoção e
 *     renumeração; âncora após descarte dos registros antigos
 * =====================================================================
 */
'use strict';

const R = require('../admin/js/nucleo/regras-estacionamento.js');
const S = require('../admin/js/nucleo/seguranca.js');
const Aud = require('../admin/js/nucleo/auditoria.js');

let ok = 0, falhas = 0;
function verificar(id, descricao, obtido, esperado) {
    const passou = JSON.stringify(obtido) === JSON.stringify(esperado);
    passou ? ok++ : falhas++;
    console.log(`${passou ? 'OK   ' : 'FALHA'} ${id.padEnd(6)} ${descricao}${passou ? '' : ` -> obtido: ${JSON.stringify(obtido)} | esperado: ${JSON.stringify(esperado)}`}`);
}
const d = (s) => new Date(s);
const valor = (e, s, c) => R.formatarMoeda(R.calcularValor(d(e), d(s), c));

(async () => {
    /* ---------- RN01: cálculo do valor ---------- */
    verificar('CT01', '08:00 → 08:00 = R$ 5,00', valor('2026-10-22T08:00', '2026-10-22T08:00'), 'R$ 5,00');
    verificar('CT02', '08:00 → 08:59 = R$ 5,00', valor('2026-10-22T08:00', '2026-10-22T08:59'), 'R$ 5,00');
    verificar('CT03', '08:00 → 09:00 = R$ 5,00', valor('2026-10-22T08:00', '2026-10-22T09:00'), 'R$ 5,00');
    verificar('CT04', '08:00 → 09:01 = R$ 7,00', valor('2026-10-22T08:00', '2026-10-22T09:01'), 'R$ 7,00');
    verificar('CT05', '08:00 → 10:00 = R$ 7,00', valor('2026-10-22T08:00', '2026-10-22T10:00'), 'R$ 7,00');
    verificar('CT06', '08:00 → 10:01 = R$ 9,00', valor('2026-10-22T08:00', '2026-10-22T10:01'), 'R$ 9,00');
    verificar('CT07', '22:00 → 07:30 do dia seguinte = R$ 23,00', valor('2026-10-22T22:00', '2026-10-23T07:30'), 'R$ 23,00');
    verificar('CT08', 'tolerância 10 min, 08:00 → 09:08 = R$ 5,00', valor('2026-10-22T08:00', '2026-10-22T09:08', { toleranciaMin: 10 }), 'R$ 5,00');
    verificar('CT29', 'hora adicional R$ 3, 2h30 = R$ 11,00', R.formatarMoeda(R.calcularValorPorMinutos(150, { valorHoraAdicional: 3 })), 'R$ 11,00');
    verificar('RN01', '60min59s conta como 60 min', R.calcularValor(d('2026-10-22T08:00:00'), d('2026-10-22T09:00:59')), 5);

    /* ---------- RN02: placas ---------- */
    verificar('CT16', 'Mercosul ABC1D23 válida', R.placaValida('ABC1D23'), true);
    verificar('CT17', 'AB12 inválida', R.placaValida('AB12'), false);
    verificar('CT18', 'abc-1234 normalizada para ABC1234', R.normalizarPlaca('abc-1234'), 'ABC1234');
    verificar('RN02', 'ABCD123 inválida', R.placaValida('ABCD123'), false);
    verificar('RN02', 'exibição ABC-1234', R.formatarPlaca('abc1234'), 'ABC-1234');

    /* ---------- Segurança ---------- */
    verificar('SEG01', 'SHA-256("abc") confere com o padrão FIPS', S.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    verificar('SEG02', 'SHA-256 com acentos (UTF-8)', S.sha256('ção'), require('crypto').createHash('sha256').update('ção').digest('hex'));

    const h1 = await S.hashSenha('Senha123');
    const h2 = await S.hashSenha('Senha123');
    verificar('SEG03', 'hash usa PBKDF2 com 120.000 iterações', h1.split('$').slice(0, 2), ['pbkdf2', '120000']);
    verificar('SEG04', 'mesma senha gera hashes diferentes (sal aleatório)', h1 !== h2, true);
    verificar('SEG05', 'senha não aparece no hash', h1.includes('Senha123'), false);
    verificar('SEG06', 'senha correta confere', await S.verificarSenha('Senha123', { senha: h1 }), true);
    verificar('SEG07', 'senha errada não confere', await S.verificarSenha('Senha124', { senha: h1 }), false);

    // PBKDF2 confere com a implementação do Node
    const [, it, sal, hash] = h1.split('$');
    const ref = require('crypto').pbkdf2Sync('Senha123', sal, Number(it), 32, 'sha256').toString('hex');
    verificar('SEG08', 'PBKDF2 igual ao do Node (crypto.pbkdf2Sync)', hash, ref);

    // Hash do módulo antigo (SHA-256 x1000) continua aceito para migração
    let antigo = 'sal1:abc123'; for (let i = 0; i < 1000; i++) antigo = S.sha256(antigo + 'sal1');
    verificar('SEG09', 'aceita hash do módulo antigo', await S.verificarSenha('abc123', { hash: antigo, sal: 'sal1' }), true);
    verificar('SEG10', 'hash antigo é marcado para atualização', S.precisaAtualizarHash({ hash: antigo, sal: 'sal1' }), true);

    verificar('SEG11', 'senha curta recusada', S.validarSenhaForte('abc12', 'joao') !== '', true);
    verificar('SEG12', 'senha só com letras recusada', S.validarSenhaForte('abcdefgh', 'joao') !== '', true);
    verificar('SEG13', 'senha com o login recusada', S.validarSenhaForte('joao2026x', 'joao') !== '', true);
    verificar('SEG14', 'senha forte aceita', S.validarSenhaForte('Estac2026!', 'joao'), '');
    verificar('SEG15', 'comparação em tempo constante', [S.iguais('abc', 'abc'), S.iguais('abc', 'abd'), S.iguais('abc', 'abcd')], [true, false, false]);
    verificar('SEG16', 'escape HTML (anti-XSS)', S.esc('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    verificar('SEG17', 'CSV neutraliza fórmula', S.celulaCSV('=HYPERLINK("http://x")'), '"\'=HYPERLINK(""http://x"")"');
    verificar('SEG18', 'CSV mantém texto normal', S.celulaCSV('Maria Souza'), '"Maria Souza"');
    verificar('SEG19', 'token aleatório com 32 caracteres hex', /^[0-9a-f]{32}$/.test(S.gerarToken(16)), true);

    /* ---------- Auditoria: cadeia de hashes ---------- */
    const cadeia = [];
    ['LOGIN_OK', 'VEICULO_ENTRADA', 'VEICULO_SAIDA', 'LOGOUT'].forEach((acao, i) => {
        cadeia.push(Aud.montarRegistro(cadeia[i - 1] || null, { acao, usuario: 'admin', detalhes: { n: i } }, S.sha256));
    });
    verificar('AUD01', 'cadeia íntegra é aprovada', Aud.verificarCadeia(cadeia, null, S.sha256).ok, true);

    const alterada = JSON.parse(JSON.stringify(cadeia)); alterada[2].detalhes.n = 99;
    verificar('AUD02', 'alterar um detalhe é detectado no registro certo', Aud.verificarCadeia(alterada, null, S.sha256).quebraEm, 3);

    const removida = cadeia.filter((_, i) => i !== 1);
    verificar('AUD03', 'remover um registro é detectado', Aud.verificarCadeia(removida, null, S.sha256).ok, false);

    const trocaUsuario = JSON.parse(JSON.stringify(cadeia)); trocaUsuario[0].usuario = 'outro';
    verificar('AUD04', 'trocar o autor é detectado', Aud.verificarCadeia(trocaUsuario, null, S.sha256).quebraEm, 1);

    const aposDescarte = cadeia.slice(2);
    verificar('AUD05', 'após descartar antigos, a âncora mantém a verificação', Aud.verificarCadeia(aposDescarte, cadeia[1].hash, S.sha256).ok, true);
    verificar('AUD06', 'âncora errada é detectada', Aud.verificarCadeia(aposDescarte, '0'.repeat(64), S.sha256).ok, false);

    console.log(`\n${ok} passaram, ${falhas} falharam`);
    process.exit(falhas ? 1 : 0);
})();
