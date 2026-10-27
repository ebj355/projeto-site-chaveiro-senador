/**
 * =====================================================================
 * TESTES DO BANCO DE DADOS E DA API (sem navegador)
 * =====================================================================
 * Executar na pasta do projeto:   node testes/testes-banco.js
 *                       ou:        npm run test:banco
 *
 * Usa bancos temporários (em memória ou numa pasta temporária); o banco
 * de verdade (servidor/dados/estacionamento.db) nunca é tocado.
 *
 * Cobre (códigos do roteiro docs/ROTEIRO-DE-TESTES.md):
 *   BD  - esquema, migrações, restrições, gatilhos e visões do SQL
 *   RN  - regras de cobrança calculadas pelo banco = regras do painel
 *   API - login, bloqueio, sessão, pátio, saída, usuários, configuração
 *   AUD - auditoria no banco: somente inclusão e cadeia de hashes
 *   BKP - backup, migração do navegador para o banco e restauração
 *   HTTP- segurança da API (CSRF, permissões, cookie, arquivos protegidos)
 * =====================================================================
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Banco = require('../servidor/lib/banco.js');
const Aud = require('../servidor/lib/auditoria.js');
const { criarRepositorio } = require('../servidor/lib/repositorio.js');
const { criarServidor } = require('../servidor/servidor.js');
const R = require('../admin/js/nucleo/regras-estacionamento.js');
const S = require('../admin/js/nucleo/seguranca.js');
const AudPainel = require('../admin/js/nucleo/auditoria.js');

let ok = 0, falhas = 0;
function verificar(id, descricao, obtido, esperado) {
    const passou = JSON.stringify(obtido) === JSON.stringify(esperado);
    passou ? ok++ : falhas++;
    console.log(`${passou ? 'OK   ' : 'FALHA'} ${id.padEnd(7)} ${descricao}${passou ? '' : ` -> obtido: ${JSON.stringify(obtido)} | esperado: ${JSON.stringify(esperado)}`}`);
}
/** Executa fn e devolve a mensagem do erro lançado ('' se não lançou). */
function erroDe(fn) { try { fn(); return ''; } catch (e) { return e.message; } }
async function erroDeAsync(fn) { try { await fn(); return ''; } catch (e) { return e.message; } }
const minutosAtras = (m) => new Date(Date.now() - m * 60000).toISOString();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-banco-'));

(async () => {
    /* =============================== BD =============================== */
    const db = Banco.abrir(':memory:');
    const nomes = db.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
    verificar('BD01', 'tabelas criadas', ['usuarios', 'sessoes', 'bloqueios_login', 'configuracao', 'estadias', 'auditoria', 'auditoria_ancora', 'auditoria_importada'].every((t) => nomes.includes(t)), true);
    verificar('BD02', 'visões criadas', ['vw_patio', 'vw_historico', 'vw_faturamento_diario', 'vw_clientes'].every((t) => nomes.includes(t)), true);
    verificar('BD03', 'configuração padrão R$ 5,00 + R$ 2,00/h, 30 vagas', db.prepare('SELECT valor_minimo_centavos m, valor_hora_adicional_centavos a, tolerancia_min t, vagas v FROM configuracao').get(), { m: 500, a: 200, t: 0, v: 30 });
    verificar('BD04', 'chaves estrangeiras ligadas', db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);

    const arq = path.join(TMP, 'migra.db');
    Banco.abrir(arq).close();
    const db2 = Banco.abrir(arq);
    verificar('BD05', 'migração não roda duas vezes', db2.prepare('SELECT COUNT(*) n FROM schema_migracoes').get().n, 1);
    db2.close();

    const ins = (id, placa, extra = '') => db.prepare(`INSERT INTO estadias (id, placa, motorista, entrada_em${extra ? ', ' + extra.split('=')[0] : ''}) VALUES (?, ?, 'Fulano de Tal', ?${extra ? ', ?' : ''})`);
    verificar('BD06', 'placa fora do padrão é recusada pelo banco', /CHECK/.test(erroDe(() => ins('x1', 'ABC12').run('x1', 'ABC12', minutosAtras(5)))), true);
    ins('x2', 'ABC1234').run('x2', 'ABC1234', minutosAtras(5));
    verificar('BD07', 'mesma placa duas vezes no pátio é recusada', /UNIQUE/.test(erroDe(() => ins('x3', 'ABC1234').run('x3', 'ABC1234', minutosAtras(1)))), true);
    verificar('BD08', 'saída finalizada sem valor é recusada', /CHECK/.test(erroDe(() => db.prepare("UPDATE estadias SET situacao='finalizada', saida_em=? WHERE id='x2'").run(new Date().toISOString()))), true);
    db.prepare("UPDATE estadias SET situacao='finalizada', saida_em=?, minutos=5, valor_centavos=500, forma_pagamento='Pix' WHERE id='x2'").run(new Date().toISOString());
    verificar('BD09', 'valor de saída paga não pode ser alterado (gatilho)', erroDe(() => db.prepare("UPDATE estadias SET valor_centavos=100 WHERE id='x2'").run()), 'Saída já paga não pode ser alterada (apenas excluída).');
    db.prepare("UPDATE estadias SET situacao='excluida', excluida_em=?, excluida_de='historico' WHERE id='x2'").run(new Date().toISOString());
    verificar('BD10', 'lançamento excluído não volta (gatilho)', erroDe(() => db.prepare("UPDATE estadias SET situacao='finalizada' WHERE id='x2'").run()), 'Lançamento excluído não pode ser alterado.');
    verificar('BD11', 'troco negativo (recebido < valor) é recusado', /CHECK/.test(erroDe(() => db.prepare("INSERT INTO estadias (id, placa, motorista, entrada_em, situacao, saida_em, minutos, valor_centavos, forma_pagamento, valor_recebido_centavos) VALUES ('x4','DEF1G23','Fulano de Tal',?, 'finalizada', ?, 10, 700, 'Dinheiro', 500)").run(minutosAtras(10), new Date().toISOString()))), true);
    verificar('BD12', 'forma de pagamento desconhecida é recusada', /CHECK/.test(erroDe(() => db.prepare("INSERT INTO estadias (id, placa, motorista, entrada_em, situacao, saida_em, minutos, valor_centavos, forma_pagamento) VALUES ('x5','DEF1G24','Fulano de Tal',?, 'finalizada', ?, 10, 500, 'Cheque')").run(minutosAtras(10), new Date().toISOString()))), true);

    /* =============================== RN =============================== */
    // A visão vw_patio calcula o valor no SQL; tem que bater com a função do painel
    const casos = [0, 1, 59, 60, 61, 90, 120, 121, 179, 180, 181, 600, 1439];
    db.exec("DELETE FROM estadias");
    casos.forEach((m, i) => db.prepare("INSERT INTO estadias (id, placa, motorista, entrada_em) VALUES (?, ?, 'Fulano de Tal', ?)").run('rn' + i, 'RNA' + String(1000 + i), new Date(Date.now() - m * 60000 - 20000).toISOString()));
    const vw = db.prepare('SELECT minutos, valor_atual_centavos v FROM vw_patio ORDER BY minutos').all();
    verificar('RN01', 'vw_patio: minutos = função do painel', vw.map((r) => r.minutos), casos);
    verificar('RN02', 'vw_patio: valor = calcularValorPorMinutos (13 casos)', vw.map((r) => r.v), casos.map((m) => Math.round(R.calcularValorPorMinutos(m) * 100)));
    db.exec('UPDATE configuracao SET tolerancia_min = 10, valor_hora_adicional_centavos = 300');
    verificar('RN03', 'vw_patio com tolerância 10 min e R$ 3/h', db.prepare('SELECT valor_atual_centavos v FROM vw_patio ORDER BY minutos').all().map((r) => r.v),
        casos.map((m) => Math.round(R.calcularValorPorMinutos(m, { toleranciaMin: 10, valorHoraAdicional: 3 }) * 100)));
    db.exec("DELETE FROM estadias; UPDATE configuracao SET tolerancia_min = 0, valor_hora_adicional_centavos = 200");

    /* =============================== API (repositório) =============================== */
    const repo = criarRepositorio(db);
    verificar('API01', 'cria admin/admin no banco vazio', await repo.garantirAdminPadrao(), true);
    verificar('API02', 'não cria de novo', await repo.garantirAdminPadrao(), false);
    const adminRow = db.prepare("SELECT * FROM usuarios WHERE login='admin'").get();
    verificar('API03', 'senha guardada só como hash PBKDF2', /^pbkdf2\$120000\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(adminRow.senha_hash), true);

    let r = await repo.entrar('admin', 'errada', { ip: '1.1.1.1' });
    verificar('API04', 'senha errada: mensagem genérica', r.msg, 'Usuário ou senha inválidos. (4 tentativas restantes)');
    r = await repo.entrar('ninguem', 'x', {});
    verificar('API05', 'usuário inexistente: mesma mensagem', r.msg.indexOf('Usuário ou senha inválidos') === 0, true);
    for (let i = 0; i < 4; i++) r = await repo.entrar('admin', 'errada', {});
    verificar('API06', '5º erro bloqueia por 5 min', r.msg, 'Muitas tentativas incorretas. Acesso bloqueado por 5 minutos.');
    r = await repo.entrar('admin', 'admin', {});
    verificar('API07', 'bloqueado mesmo com a senha certa', r.ok, false);
    db.exec("UPDATE bloqueios_login SET bloqueado_ate = '2000-01-01T00:00:00.000Z'");
    r = await repo.entrar('ADMIN', 'admin', { ip: '127.0.0.1', navegador: 'teste' });
    verificar('API08', 'após o bloqueio, entra (login sem diferenciar maiúsculas)', [r.ok, r.usuario.senhaPadrao, /^[0-9a-f]{64}$/.test(r.token)], [true, true, true]);
    verificar('API09', 'token não é guardado no banco (só o hash)', db.prepare('SELECT COUNT(*) n FROM sessoes WHERE token_hash = ?').get(r.token).n, 0);
    const sessAdmin = repo.validarSessao(r.token, true, '127.0.0.1');
    verificar('API10', 'sessão válida reconhecida', sessAdmin.usuario.login, 'admin');
    const admin = sessAdmin.usuario;

    const v1 = repo.registrarEntrada(admin, { nome: '  Maria   Souza ', placa: 'abc-1d23', entrada: minutosAtras(125), modelo: 'Onix branco', chave: '7' }, '127.0.0.1');
    verificar('API11', 'entrada grava placa normalizada e nome limpo', [v1.placa, v1.nome, v1.registradoPor], ['ABC1D23', 'Maria Souza', 'Administrador']);
    verificar('API12', 'placa repetida no pátio é recusada', erroDe(() => repo.registrarEntrada(admin, { nome: 'Outra Pessoa', placa: 'ABC1D23', entrada: minutosAtras(1) })), 'Este veículo já está no pátio.');
    verificar('API13', 'entrada no futuro é recusada', erroDe(() => repo.registrarEntrada(admin, { nome: 'Outra Pessoa', placa: 'XYZ9876', entrada: new Date(Date.now() + 10 * 60000).toISOString() })), 'A hora de entrada não pode estar no futuro.');
    verificar('API14', 'placa inválida é recusada', erroDe(() => repo.registrarEntrada(admin, { nome: 'Outra Pessoa', placa: '12ABC', entrada: minutosAtras(1) })), 'Placa inválida. Use ABC-1234 ou ABC1D23.');
    verificar('API15', 'nome curto é recusado', erroDe(() => repo.registrarEntrada(admin, { nome: 'Jo', placa: 'XYZ9876', entrada: minutosAtras(1) })), 'O nome deve ter pelo menos 3 letras.');
    verificar('API16', 'recebido menor que o total é recusado', erroDe(() => repo.registrarSaida(admin, v1.id, { pagamento: 'Dinheiro', valorRecebido: 5 })), 'O valor recebido é menor que o total (R$ 9,00).');
    verificar('API17', 'forma de pagamento inválida', erroDe(() => repo.registrarSaida(admin, v1.id, { pagamento: 'Fiado' })), 'Forma de pagamento inválida.');
    const s1 = repo.registrarSaida(admin, v1.id, { pagamento: 'Dinheiro', valorRecebido: 20, saida: minutosAtras(60) }, '127.0.0.1');
    verificar('API18', 'saída: 2h05 = R$ 9,00, troco R$ 11,00 (hora antiga demais é ignorada)', [s1.minutos, s1.valor, s1.valorRecebido, s1.troco], [125, 9, 20, 11]);
    verificar('API19', 'tabela de preços congelada na saída', s1.tabela, { valorMinimo: 5, valorHoraAdicional: 2, toleranciaMin: 0 });
    verificar('API20', 'não sai duas vezes', erroDe(() => repo.registrarSaida(admin, v1.id, { pagamento: 'Pix' })), 'Este veículo já saiu do pátio.');
    const v2 = repo.registrarEntrada(admin, { nome: 'Carlos Lima', placa: 'DEF4567', entrada: minutosAtras(70) });
    const s2 = repo.registrarSaida(admin, v2.id, { pagamento: 'Pix', saida: minutosAtras(10) });
    verificar('API21', 'hora de saída mostrada ao cliente (até 15 min) é respeitada: 60 min = R$ 5,00', [s2.minutos, s2.valor], [60, 5]);
    const v3 = repo.registrarEntrada(admin, { nome: 'Engano Teste', placa: 'GHI1J23', entrada: minutosAtras(3) });
    repo.excluirVeiculo(admin, v3.id);
    verificar('API22', 'exclusão do pátio só marca a linha (não apaga)', db.prepare('SELECT situacao, excluida_de FROM estadias WHERE id = ?').get(v3.id), { situacao: 'excluida', excluida_de: 'patio' });
    verificar('API23', 'vw_clientes reconhece cliente antigo', db.prepare("SELECT visitas, motorista, modelo FROM vw_clientes WHERE placa='ABC1D23'").get(), { visitas: 1, motorista: 'Maria Souza', modelo: 'Onix branco' });
    verificar('API24', 'vw_faturamento_diario soma o dia', db.prepare('SELECT SUM(total_centavos) t, SUM(saidas) n FROM vw_faturamento_diario').get(), { t: 1400, n: 2 });

    verificar('API25', 'preço inválido é recusado', erroDe(() => repo.salvarPrecos(admin, { valorMinimo: -1, valorHoraAdicional: 2, toleranciaMin: 0 })), 'Informe um valor até 1 hora entre R$ 0 e R$ 999.');
    repo.salvarPrecos(admin, { valorMinimo: 6, valorHoraAdicional: 2.5, toleranciaMin: 5 });
    repo.salvarVagas(admin, 40);
    verificar('API26', 'configuração gravada em centavos', db.prepare('SELECT valor_minimo_centavos m, valor_hora_adicional_centavos a, tolerancia_min t, vagas v FROM configuracao').get(), { m: 600, a: 250, t: 5, v: 40 });
    verificar('API27', 'saída antiga não muda com o preço novo', repo.estado(admin).historico.find((h) => h.id === v1.id).valor, 9);
    repo.salvarPrecos(admin, { valorMinimo: 5, valorHoraAdicional: 2, toleranciaMin: 0 });

    verificar('API28', 'senha fraca recusada no cadastro', await erroDeAsync(() => repo.criarUsuario(admin, { nome: 'Carlos Operador', login: 'carlos', senha: '123', perfil: 'operador' })), 'A senha precisa ter pelo menos 8 caracteres.');
    const carlos = await repo.criarUsuario(admin, { nome: 'Carlos Operador', login: 'Carlos', senha: 'Balcao2026', perfil: 'operador', trocarSenha: true });
    verificar('API29', 'usuário criado com troca obrigatória', [carlos.login, carlos.perfil, carlos.trocarSenha], ['carlos', 'operador', true]);
    verificar('API30', 'login repetido recusado', await erroDeAsync(() => repo.criarUsuario(admin, { nome: 'Outro Carlos', login: 'carlos', senha: 'Balcao2026x', perfil: 'operador' })), 'Já existe um usuário com esse login.');
    verificar('API31', 'admin não remove a si mesmo', erroDe(() => repo.removerUsuario(admin, admin.id)), 'Você não pode remover o próprio usuário.');
    r = await repo.entrar('carlos', 'Balcao2026', {});
    const sessCarlos = repo.validarSessao(r.token, true);
    verificar('API32', 'operador entra com troca pendente', [r.ok, r.trocarSenha], [true, true]);
    verificar('API33', 'troca obrigatória dispensa a senha atual', (await repo.trocarMinhaSenha(sessCarlos, null, 'NovaSenha99')).trocarSenha, false);
    const sessCarlos2 = repo.validarSessao(r.token, true);
    verificar('API34', 'troca normal exige a senha atual', await erroDeAsync(() => repo.trocarMinhaSenha(sessCarlos2, 'errada', 'OutraSenha77')), 'Senha atual incorreta.');
    const est = repo.estado(sessCarlos2.usuario);
    verificar('API35', 'operador recebe só o próprio usuário e nenhuma auditoria', [est.usuarios.length, est.auditoria.length, est.usuarios[0].login], [1, 0, 'carlos']);
    verificar('API36', 'estado nunca inclui hash de senha', JSON.stringify(repo.estado(admin)).includes('pbkdf2'), false);
    repo.alterarAtivo(admin, carlos.id, false);
    verificar('API37', 'desativar derruba a sessão do usuário na hora', repo.validarSessao(r.token, true), null);
    verificar('API38', 'desativado não consegue entrar', (await repo.entrar('carlos', 'NovaSenha99', {})).ok, false);

    const tokAdmin = (await repo.entrar('admin', 'admin', {})).token;
    db.prepare('UPDATE sessoes SET ultimo_uso = ? WHERE token_hash = ?').run(minutosAtras(31), Aud.sha256('sessao:' + tokAdmin));
    verificar('API39', 'sessão parada há 31 min expira', repo.validarSessao(tokAdmin, true), null);
    verificar('API40', 'expiração vai para a auditoria', db.prepare("SELECT acao FROM auditoria ORDER BY seq DESC LIMIT 1").get().acao, 'SESSAO_EXPIRADA');

    /* =============================== AUD =============================== */
    verificar('AUD01', 'cadeia do banco íntegra', repo.verificarAuditoria(admin).ok, true);
    verificar('AUD02', 'UPDATE na auditoria é bloqueado pelo banco', erroDe(() => db.exec("UPDATE auditoria SET usuario = 'outro' WHERE seq = 2")), 'A auditoria não pode ser alterada.');
    verificar('AUD03', 'DELETE na auditoria é bloqueado pelo banco', erroDe(() => db.exec('DELETE FROM auditoria WHERE seq = 2')), 'A auditoria não pode ser apagada.');
    const acoes = db.prepare('SELECT acao FROM auditoria').all().map((x) => x.acao);
    verificar('AUD04', 'ações registradas pelo servidor', ['SISTEMA_INSTALADO', 'LOGIN_FALHA', 'LOGIN_BLOQUEADO', 'LOGIN_OK', 'VEICULO_ENTRADA', 'VEICULO_SAIDA', 'VEICULO_EXCLUIDO', 'CONFIG_ALTERADA', 'USUARIO_CRIADO', 'SENHA_ALTERADA', 'USUARIO_DESATIVADO', 'SESSAO_EXPIRADA', 'AUDITORIA_VERIFICADA'].filter((a) => !acoes.includes(a)), []);
    verificar('AUD05', 'painel não pode forjar ação de auditoria', erroDe(() => repo.registrarEvento(admin, 'VEICULO_SAIDA', {})), 'Ação de auditoria não permitida.');
    repo.registrarEvento(admin, 'EXPORTACAO', { arquivo: 'teste.csv', registros: 2, extra: '<script>' });
    verificar('AUD06', 'exportação registrada pelo painel é aceita', db.prepare("SELECT detalhes FROM auditoria ORDER BY seq DESC LIMIT 1").get().detalhes, '{"arquivo":"teste.csv","registros":2,"extra":"<script>"}');
    // Simula alguém com acesso ao arquivo do banco desligando o gatilho e editando um registro
    const arqAdult = path.join(TMP, 'adulterado.db');
    db.exec(`VACUUM INTO '${arqAdult}'`);
    const dbA = Banco.abrir(arqAdult);
    dbA.exec("DROP TRIGGER tg_auditoria_sem_alteracao; UPDATE auditoria SET detalhes = '{\"placa\":\"ZZZ9999\"}' WHERE acao = 'VEICULO_ENTRADA'");
    const resA = Aud.verificar(dbA);
    verificar('AUD07', 'edição direta no arquivo do banco é detectada', [resA.ok, /foi alterado/.test(resA.motivo)], [false, true]);
    dbA.close();
    const lista = Aud.listar(db, 5);
    verificar('AUD08', 'trecho final + âncora confere no painel', AudPainel.verificarCadeia(lista.registros, lista.ancora, S.sha256).ok, true);

    /* =============================== BKP =============================== */
    const backup = repo.exportarBackup(admin, '127.0.0.1');
    verificar('BKP01', 'backup no formato do painel', [backup.sistema, backup.origem, backup.patio.length, backup.historico.length, backup.usuarios.length], ['chaveiro-senador-painel', 'banco-de-dados', 0, 2, 2]);
    verificar('BKP02', 'backup traz a auditoria completa e íntegra', AudPainel.verificarCadeia(backup.auditoria, backup.ancora, S.sha256).ok, true);

    // Migração: banco novo a partir do backup -> mesma cadeia, continua verificável
    const dbNovo = Banco.abrir(path.join(TMP, 'novo.db'));
    const repoNovo = criarRepositorio(dbNovo);
    const imp = repoNovo.importarEmBancoVazio(backup, 'backup.json');
    verificar('BKP03', 'importação em banco vazio', [imp.historico, imp.usuarios], [2, 2]);
    verificar('BKP04', 'cadeia importada + registro da migração continua íntegra', Aud.verificar(dbNovo).ok, true);
    verificar('BKP05', 'hashes preservados (mesmo nº 1)', dbNovo.prepare('SELECT hash FROM auditoria WHERE seq = 1').get().hash, backup.auditoria[0].hash);
    verificar('BKP06', 'senha continua valendo após a migração', (await repoNovo.entrar('admin', 'admin', {})).ok, true);
    verificar('BKP07', 'importar de novo é recusado (banco já tem dados)', erroDe(() => repoNovo.importarEmBancoVazio(backup, 'x')), 'O banco já tem dados. Use a restauração pelo painel ou um arquivo de banco novo.');
    dbNovo.close();

    // Backup feito no NAVEGADOR (modo local), com usuário do módulo antigo (hash/sal)
    const sal = 'abc123';
    let h = sal + ':' + 'senhaAntiga1';
    for (let i = 0; i < 1000; i++) h = S.sha256(h + sal);
    const audLocal = [];
    let ant = null;
    ['SISTEMA_INSTALADO', 'VEICULO_ENTRADA'].forEach((a) => { ant = AudPainel.montarRegistro(ant, { acao: a, usuario: 'dono', detalhes: { placa: 'KLM1234' } }, S.sha256); audLocal.push(ant); });
    const backupLocal = {
        sistema: 'chaveiro-senador-painel', versao: 1, geradoEm: new Date().toISOString(),
        usuarios: [{ id: 'u1', nome: 'Dono Antigo', login: 'dono', perfil: 'admin', hash: h, sal, ativo: true }],
        patio: [{ id: 'p1', nome: 'Cliente Pátio', placa: 'KLM1234', entrada: minutosAtras(30), modelo: '', chave: '3', registradoPor: 'Dono Antigo' }],
        historico: [], config: { valorMinimo: 6, valorHoraAdicional: 3, toleranciaMin: 0, vagas: 25 }, auditoria: audLocal, ancora: null
    };
    const dbLocal = Banco.abrir(':memory:');
    const repoLocal = criarRepositorio(dbLocal);
    repoLocal.importarEmBancoVazio(backupLocal, 'backup-navegador.json');
    r = await repoLocal.entrar('dono', 'senhaAntiga1', {});
    verificar('BKP08', 'backup do navegador: usuário com hash antigo entra', r.ok, true);
    verificar('BKP09', 'hash antigo é convertido para PBKDF2 no 1º login', dbLocal.prepare("SELECT senha_hash FROM usuarios WHERE login='dono'").get().senha_hash.indexOf('pbkdf2$'), 0);
    verificar('BKP10', 'pátio e preços do navegador foram para o banco', [repoLocal.estado(repoLocal.validarSessao(r.token).usuario).patio.length, repoLocal.config().valorMinimo, repoLocal.config().vagas], [1, 6, 25]);
    verificar('BKP11', 'cadeia do navegador verificada no banco', Aud.verificar(dbLocal).ok, true);
    const adulterado = JSON.parse(JSON.stringify(backupLocal));
    adulterado.auditoria[1].detalhes.placa = 'ZZZ0000';
    verificar('BKP12', 'backup com auditoria adulterada é recusado na migração', /adulterada/.test(erroDe(() => criarRepositorio(Banco.abrir(':memory:')).importarEmBancoVazio(adulterado, 'x'))), true);

    // Restauração com o banco em uso: dados trocados, auditoria oficial mantida
    const seqAntes = Aud.ultimaSeq(db);
    const sessParaRestaurar = repo.validarSessao((await repo.entrar('admin', 'admin', {})).token, true);
    const res = repo.restaurarBackup(sessParaRestaurar, backupLocal, 'backup-navegador.json', '127.0.0.1');
    verificar('BKP13', 'restaurar sem o seu usuário no backup desconecta', res.desconectar, true);
    verificar('BKP14', 'auditoria oficial não foi apagada', [Aud.ultimaSeq(db) > seqAntes, Aud.verificar(db).ok], [true, true]);
    verificar('BKP15', 'auditoria do arquivo guardada como referência', db.prepare('SELECT COUNT(*) n FROM auditoria_importada').get().n, 2);
    verificar('BKP16', 'usuários antigos marcados como removidos (não apagados)', db.prepare("SELECT login FROM usuarios WHERE removido_em IS NULL").all().map((x) => x.login), ['dono']);

    /* =============================== HTTP =============================== */
    const dbHttp = Banco.abrir(':memory:');
    const srv = criarServidor({ db: dbHttp });
    await srv.repo.garantirAdminPadrao();
    await new Promise((ok2) => srv.listen(0, '127.0.0.1', ok2));
    const base = 'http://127.0.0.1:' + srv.address().port;
    const req = (metodo, caminho, corpo, cab = {}) => fetch(base + caminho, {
        method: metodo, headers: Object.assign({ 'Content-Type': 'application/json', 'X-Painel': '1' }, cab), body: corpo ? JSON.stringify(corpo) : undefined
    });

    verificar('HTTP01', '/api/saude responde', (await (await fetch(base + '/api/saude')).json()).sistema, 'chaveiro-senador-api');
    verificar('HTTP02', 'sem login: 401', (await req('GET', '/api/estado')).status, 401);
    let resp = await req('POST', '/api/sessao', { login: 'admin', senha: 'admin' });
    const cookie = resp.headers.get('set-cookie');
    verificar('HTTP03', 'cookie de sessão HttpOnly + SameSite=Strict, só em /api', [/HttpOnly/.test(cookie), /SameSite=Strict/.test(cookie), /Path=\/api/.test(cookie)], [true, true, true]);
    const ck = { Cookie: cookie.split(';')[0] };
    verificar('HTTP04', 'com login: estado 200 e sem cache', [(await req('GET', '/api/estado', null, ck)).status, (await req('GET', '/api/estado', null, ck)).headers.get('cache-control')], [200, 'no-store']);
    resp = await fetch(base + '/api/patio', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, ck), body: '{}' });
    verificar('HTTP05', 'alteração sem cabeçalho X-Painel é recusada (CSRF)', resp.status, 403);
    resp = await req('POST', '/api/patio', { nome: 'Teste Http', placa: 'HTT1234', entrada: minutosAtras(1) }, Object.assign({ Origin: 'https://site-malicioso.com' }, ck));
    verificar('HTTP06', 'alteração vinda de outro site é recusada (CSRF)', resp.status, 403);
    resp = await req('POST', '/api/patio', { nome: 'Teste Http', placa: 'HTT1234', entrada: minutosAtras(1) }, Object.assign({ Origin: base }, ck));
    verificar('HTTP07', 'entrada pela API', [resp.status, (await resp.json()).placa], [200, 'HTT1234']);
    resp = await req('POST', '/api/patio', { nome: 'Teste Http', placa: 'HTT1234', entrada: minutosAtras(1) }, ck);
    verificar('HTTP08', 'erro de negócio volta com mensagem e 409', [resp.status, (await resp.json()).erro], [409, 'Este veículo já está no pátio.']);
    await req('POST', '/api/usuarios', { nome: 'Op Teste', login: 'op1', senha: 'Operador123', perfil: 'operador' }, ck);
    const ckOp = { Cookie: (await req('POST', '/api/sessao', { login: 'op1', senha: 'Operador123' })).headers.get('set-cookie').split(';')[0] };
    resp = await req('POST', '/api/usuarios', { nome: 'Invasor', login: 'inv', senha: 'Invasor123', perfil: 'admin' }, ckOp);
    verificar('HTTP09', 'operador criando usuário: 403', resp.status, 403);
    verificar('HTTP10', 'tentativa negada registrada como ACESSO_NEGADO', dbHttp.prepare("SELECT usuario, detalhes FROM auditoria WHERE acao='ACESSO_NEGADO'").get(), { usuario: 'op1', detalhes: '{"permissao":"usuarios.gerenciar"}' });
    verificar('HTTP11', 'operador não baixa backup', (await req('GET', '/api/backup', null, ckOp)).status, 403);
    verificar('HTTP12', 'painel servido', (await fetch(base + '/admin/')).status, 200);
    const cabAdmin = (await fetch(base + '/admin/')).headers;
    verificar('HTTP13', 'cabeçalhos de segurança no painel', [cabAdmin.get('x-frame-options'), cabAdmin.get('x-content-type-options')], ['DENY', 'nosniff']);
    const bloqueados = ['/servidor/servidor.js', '/servidor/dados/estacionamento.db', '/admin/../servidor/lib/banco.js', '/%2e%2e/servidor/servidor.js', '/.git/config', '/testes/testes-banco.js', '/package.json'];
    const status = [];
    for (const c of bloqueados) status.push((await fetch(base + c)).status);
    verificar('HTTP14', 'código do servidor, banco e .git nunca são servidos', status, bloqueados.map(() => 404));
    resp = await req('POST', '/api/sessao', null, {});
    verificar('HTTP15', 'corpo vazio no login não derruba o servidor', resp.status, 200);
    resp = await fetch(base + '/api/patio', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'X-Painel': '1' }, ck), body: '{quebrado' });
    verificar('HTTP16', 'JSON inválido: 400', resp.status, 400);
    resp = await fetch(base + '/api/sessao', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Painel': '1' }, body: JSON.stringify({ login: 'x'.repeat(100), senha: 'y'.repeat(70000) }) });
    verificar('HTTP17', 'corpo grande demais: 413', resp.status, 413);
    srv.close();

    fs.rmSync(TMP, { recursive: true, force: true });
    console.log(`\n${ok} passaram, ${falhas} falharam`);
    process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
