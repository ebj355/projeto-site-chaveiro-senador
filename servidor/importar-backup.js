/**
 * =====================================================================
 * SERVIDOR/IMPORTAR-BACKUP.JS - LEVA OS DADOS DO NAVEGADOR PARA O BANCO
 * =====================================================================
 * Para quem já usava o painel sem servidor (dados no navegador):
 *
 *   1. No painel antigo: Configurações → Backup → "Baixar backup"
 *   2. Com o servidor DESLIGADO, rode na pasta do projeto:
 *        npm run banco:importar -- "C:\Users\voce\Downloads\backup-chaveiro-senador-2026-10-26.json"
 *   3. Ligue o servidor (npm run servidor) e entre com o mesmo usuário e senha.
 *
 * Funciona só com um banco NOVO (sem dados): os usuários, o pátio, o
 * histórico, os preços e a auditoria do navegador viram o conteúdo
 * inicial do banco. A cadeia da auditoria é conferida antes e mantida
 * (mesmos números e hashes), e a importação é registrada como mais um
 * elo da cadeia.
 *
 * Com o banco já em uso, use o painel: Configurações → Restaurar backup.
 *
 * Opções:  --banco caminho/arquivo.db   (padrão: servidor/dados/estacionamento.db)
 * =====================================================================
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Banco = require('./lib/banco.js');
const { criarRepositorio } = require('./lib/repositorio.js');

function sair(msg) { console.error('\n  ' + msg + '\n'); process.exit(1); }

const args = process.argv.slice(2);
const iBanco = args.indexOf('--banco');
const arqBanco = path.resolve(iBanco >= 0 ? args[iBanco + 1] : (process.env.BANCO || path.join(__dirname, 'dados', 'estacionamento.db')));
const arqBackup = args.filter((a, i) => a !== '--banco' && i !== iBanco + 1)[0];

if (!arqBackup) sair('Informe o arquivo do backup. Ex.: npm run banco:importar -- backup-chaveiro-senador-2026-10-26.json');
if (!fs.existsSync(arqBackup)) sair('Arquivo não encontrado: ' + arqBackup);

let backup;
try { backup = JSON.parse(fs.readFileSync(arqBackup, 'utf8')); } catch (e) { sair('O arquivo não é um JSON válido.'); }

const db = Banco.abrir(arqBanco);
try {
    const r = criarRepositorio(db).importarEmBancoVazio(backup, path.basename(arqBackup));
    console.log('');
    console.log('  Backup importado para o banco de dados: ' + arqBanco);
    console.log('  ' + r.usuarios + ' usuário(s), ' + r.patio + ' veículo(s) no pátio, ' + r.historico + ' saída(s) no histórico, ' + r.auditoria + ' registro(s) de auditoria.');
    console.log('  Agora ligue o servidor: npm run servidor');
    console.log('');
} catch (e) {
    sair(e.message);
} finally {
    db.close();
}
