/**
 * =====================================================================
 * SERVIDOR/LIB/AUDITORIA.JS - AUDITORIA GRAVADA NO BANCO
 * =====================================================================
 * Reaproveita as funções puras do painel (admin/js/nucleo/auditoria.js):
 * montarRegistro() e verificarCadeia(). Assim o navegador e o servidor
 * calculam o hash exatamente do mesmo jeito, e uma auditoria trazida de
 * um backup do navegador continua verificável no banco.
 *
 *   registrar(db, acao, detalhes, quem, ip)   grava 1 registro no fim da cadeia
 *   listar(db, limite)                         últimos registros (mais antigo primeiro)
 *   verificar(db)                              confere a cadeia inteira
 *
 * Deve ser chamado DENTRO da mesma transação da ação auditada: se a
 * ação falhar, o registro também não é gravado (e vice-versa).
 * =====================================================================
 */
'use strict';

const crypto = require('node:crypto');
const AudPainel = require('../../admin/js/nucleo/auditoria.js');

/** SHA-256 em hexadecimal (mesmo resultado do sha256() do painel). */
function sha256(texto) {
    return crypto.createHash('sha256').update(String(texto), 'utf8').digest('hex');
}

/** Linha do banco → registro no formato do painel. */
function deLinha(r) {
    return {
        seq: r.seq, data: r.data, usuario: r.usuario, nome: r.nome, perfil: r.perfil,
        acao: r.acao, descricao: r.descricao, detalhes: JSON.parse(r.detalhes), anterior: r.anterior, hash: r.hash
    };
}

/** Hash de partida da cadeia (âncora de backup importado) ou null. */
function ancora(db) {
    const r = db.prepare('SELECT hash FROM auditoria_ancora WHERE id = 1').get();
    return r ? r.hash : null;
}

/**
 * Acrescenta um registro.
 * @param {object} quem  {login, nome, perfil} ou null para 'sistema'
 */
function registrar(db, acao, detalhes, quem, ip) {
    const ultimo = db.prepare('SELECT seq, hash FROM auditoria ORDER BY seq DESC LIMIT 1').get();
    const reg = AudPainel.montarRegistro(ultimo || null, {
        acao,
        usuario: quem ? quem.login : 'sistema',
        nome: quem ? quem.nome || '' : '',
        perfil: quem ? quem.perfil || '' : '',
        detalhes: detalhes || {},
        ancora: ancora(db)
    }, sha256);
    db.prepare(`INSERT INTO auditoria (seq, data, usuario, nome, perfil, acao, descricao, detalhes, ip, anterior, hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(reg.seq, reg.data, reg.usuario, reg.nome, reg.perfil, reg.acao, reg.descricao,
            JSON.stringify(reg.detalhes), ip || null, reg.anterior, reg.hash);
    return reg;
}

/**
 * Últimos "limite" registros e o hash anterior ao primeiro deles
 * (o painel usa esse hash como âncora para verificar o trecho recebido).
 */
function listar(db, limite = AudPainel.LIMITE) {
    const linhas = db.prepare('SELECT * FROM auditoria ORDER BY seq DESC LIMIT ?').all(limite).reverse();
    const registros = linhas.map(deLinha);
    const inicio = registros.length ? registros[0].anterior : ancora(db);
    return { registros, ancora: inicio };
}

/** Confere todos os registros do banco, do primeiro ao último. */
function verificar(db) {
    const registros = db.prepare('SELECT * FROM auditoria ORDER BY seq').all().map(deLinha);
    return AudPainel.verificarCadeia(registros, ancora(db), sha256);
}

/** Número do último registro: muda a cada ação, serve de "versão" dos dados. */
function ultimaSeq(db) {
    const r = db.prepare('SELECT MAX(seq) AS s FROM auditoria').get();
    return r && r.s ? r.s : 0;
}

module.exports = { ACOES: AudPainel.ACOES, sha256, registrar, listar, verificar, ultimaSeq, ancora, deLinha, verificarCadeia: AudPainel.verificarCadeia };
