/**
 * =====================================================================
 * SERVIDOR/LIB/BANCO.JS - ABRE O BANCO SQLITE E APLICA AS MIGRAÇÕES
 * =====================================================================
 * Usa o SQLite que já vem dentro do Node.js (módulo node:sqlite,
 * Node 22.13 ou mais novo). Não precisa instalar nenhum pacote.
 *
 *   abrir(caminho)      abre (ou cria) o arquivo .db, liga as chaves
 *                       estrangeiras e aplica as migrações pendentes
 *   transacao(db, fn)   executa fn() inteira ou nada (BEGIN/COMMIT/ROLLBACK)
 *   copiaDeSeguranca()  grava uma cópia consistente do banco (VACUUM INTO)
 *
 * MIGRAÇÕES: cada arquivo servidor/banco/NNN-descricao.sql é aplicado
 * uma única vez, em ordem. A tabela schema_migracoes guarda quais já
 * rodaram. Para mudar o banco no futuro, crie 002-....sql (nunca edite
 * um arquivo que já foi aplicado em produção).
 * =====================================================================
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// O node:sqlite ainda mostra um aviso "experimental" no Node 22/24; ele é estável para este uso.
const avisoOriginal = process.emitWarning;
process.emitWarning = function (aviso, ...resto) {
    if (String(aviso).includes('SQLite')) return;
    return avisoOriginal.call(process, aviso, ...resto);
};
let DatabaseSync;
try {
    ({ DatabaseSync } = require('node:sqlite'));
} catch (e) {
    console.error('\n  Este Node.js (' + process.version + ') não tem o SQLite embutido.');
    console.error('  Instale o Node.js 22 LTS (22.13 ou mais novo) ou o 24 LTS: https://nodejs.org\n');
    process.exit(1);
}
process.emitWarning = avisoOriginal;

const PASTA_MIGRACOES = path.join(__dirname, '..', 'banco');

/** Lista as migrações disponíveis: [{versao: 1, arquivo, descricao}] em ordem. */
function listarMigracoes() {
    return fs.readdirSync(PASTA_MIGRACOES)
        .filter((f) => /^\d{3}-.+\.sql$/.test(f))
        .sort()
        .map((f) => ({ versao: parseInt(f.slice(0, 3), 10), arquivo: path.join(PASTA_MIGRACOES, f), descricao: f.slice(4, -4) }));
}

/** Executa fn dentro de uma transação. Se fn lançar erro, desfaz tudo. */
function transacao(db, fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
        const r = fn();
        db.exec('COMMIT');
        return r;
    } catch (e) {
        db.exec('ROLLBACK');
        throw e;
    }
}

/** Aplica as migrações que ainda não rodaram. Retorna a versão final do esquema. */
function migrar(db) {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migracoes (
        versao      INTEGER PRIMARY KEY,
        descricao   TEXT NOT NULL,
        aplicada_em TEXT NOT NULL
    )`);
    const aplicadas = new Set(db.prepare('SELECT versao FROM schema_migracoes').all().map((r) => r.versao));
    for (const m of listarMigracoes()) {
        if (aplicadas.has(m.versao)) continue;
        transacao(db, () => {
            db.exec(fs.readFileSync(m.arquivo, 'utf8'));
            db.prepare('INSERT INTO schema_migracoes (versao, descricao, aplicada_em) VALUES (?, ?, ?)')
                .run(m.versao, m.descricao, new Date().toISOString());
        });
    }
    return versaoEsquema(db);
}

/** Maior migração aplicada. */
function versaoEsquema(db) {
    const r = db.prepare('SELECT MAX(versao) AS v FROM schema_migracoes').get();
    return r && r.v ? r.v : 0;
}

/**
 * Abre o banco. caminho ':memory:' cria um banco temporário (usado nos testes).
 * @returns {DatabaseSync}
 */
function abrir(caminho) {
    if (caminho !== ':memory:') fs.mkdirSync(path.dirname(caminho), { recursive: true });
    const db = new DatabaseSync(caminho);
    db.exec('PRAGMA foreign_keys = ON');      // respeita as REFERENCES
    db.exec('PRAGMA busy_timeout = 5000');    // espera em vez de falhar se outro processo estiver gravando
    if (caminho !== ':memory:') {
        db.exec('PRAGMA journal_mode = WAL');  // leituras não travam gravações
        db.exec('PRAGMA synchronous = NORMAL');
    }
    migrar(db);
    return db;
}

/**
 * Cópia de segurança consistente do banco (pode rodar com o servidor ligado).
 * Mantém só as "manter" cópias mais recentes na pasta.
 * @returns {string} caminho do arquivo criado
 */
function copiaDeSeguranca(db, pasta, manter = 30) {
    fs.mkdirSync(pasta, { recursive: true });
    const carimbo = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const destino = path.join(pasta, `estacionamento-${carimbo}.db`);
    db.prepare('VACUUM INTO ?').run(destino);
    const copias = fs.readdirSync(pasta).filter((f) => /^estacionamento-.*\.db$/.test(f)).sort();
    copias.slice(0, Math.max(0, copias.length - manter)).forEach((f) => fs.unlinkSync(path.join(pasta, f)));
    return destino;
}

module.exports = { abrir, transacao, migrar, versaoEsquema, copiaDeSeguranca, listarMigracoes };
