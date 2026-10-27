/**
 * =====================================================================
 * SERVIDOR/COPIAR-BANCO.JS - CÓPIA DE SEGURANÇA DO BANCO NA HORA
 * =====================================================================
 *   npm run banco:copia
 *
 * Grava uma cópia consistente do banco em servidor/dados/copias/
 * (pode rodar com o servidor ligado). O servidor já faz isso sozinho ao
 * iniciar e a cada 24 h; use este comando antes de mexer em algo
 * importante. Guarde cópias também fora do computador (pen drive, nuvem).
 * =====================================================================
 */
'use strict';

const path = require('node:path');
const Banco = require('./lib/banco.js');

const arqBanco = path.resolve(process.env.BANCO || path.join(__dirname, 'dados', 'estacionamento.db'));
const pasta = path.resolve(process.env.COPIAS || path.join(__dirname, 'dados', 'copias'));
const db = Banco.abrir(arqBanco);
console.log('Cópia criada: ' + Banco.copiaDeSeguranca(db, pasta));
db.close();
