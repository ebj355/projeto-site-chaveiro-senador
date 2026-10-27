-- =====================================================================
-- 001-ESQUEMA-INICIAL.SQL - BANCO DE DADOS DO MÓDULO DE ESTACIONAMENTO
-- =====================================================================
-- Banco: SQLite 3 (arquivo único, sem instalar nada; o Node.js 22+ já
-- traz o SQLite embutido). O servidor (servidor/servidor.js) aplica
-- este arquivo sozinho na primeira vez que roda.
--
-- Tabelas
--   usuarios          quem acessa o painel (senha só como hash PBKDF2)
--   sessoes           logins ativos (o token fica só no cookie; aqui só o hash)
--   bloqueios_login   tentativas erradas e bloqueio progressivo por login
--   configuracao      tabela de preços e número de vagas (1 linha só)
--   estadias          cada carro que entrou: pátio + histórico na mesma tabela
--   auditoria         registro somente-inclusão, encadeado por hash
--   auditoria_ancora  ponto de partida da cadeia (quando veio de um backup)
--   auditoria_importada  auditorias de backups restaurados depois (referência)
--
-- Visões (relatórios prontos)
--   vw_patio, vw_historico, vw_faturamento_diario, vw_clientes
--
-- Convenções
--   - Datas em texto ISO 8601 UTC, igual ao JavaScript: 2026-10-26T21:30:00.000Z
--     (ordenam corretamente como texto e o SQLite entende com julianday()).
--   - Dinheiro em CENTAVOS (INTEGER): R$ 5,00 = 500. Evita erro de
--     arredondamento de número com vírgula.
--   - Nada é apagado de verdade: estadias excluídas ficam marcadas
--     (situacao = 'excluida') e usuários removidos ganham removido_em.
--     Assim o histórico e a auditoria continuam completos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- USUÁRIOS DO PAINEL
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id                    TEXT PRIMARY KEY,                 -- mesmo formato de id do painel (compatível com backup)
    login                 TEXT NOT NULL COLLATE NOCASE
                          CHECK (length(login) BETWEEN 3 AND 30),
    nome                  TEXT NOT NULL CHECK (length(trim(nome)) >= 3),
    perfil                TEXT NOT NULL CHECK (perfil IN ('admin', 'operador')),
    senha_hash            TEXT NOT NULL,                    -- "pbkdf2$<iterações>$<sal>$<hash>"
    ativo                 INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    trocar_senha          INTEGER NOT NULL DEFAULT 0 CHECK (trocar_senha IN (0, 1)),  -- troca obrigatória no próximo login
    senha_padrao          INTEGER NOT NULL DEFAULT 0 CHECK (senha_padrao IN (0, 1)),  -- ainda usa admin/admin
    criado_em             TEXT NOT NULL,
    senha_alterada_em     TEXT,
    ultimo_login          TEXT,
    ultimo_login_anterior TEXT,
    removido_em           TEXT                              -- preenchido = usuário removido (não aparece mais)
);
-- Login único só entre usuários não removidos (um login removido pode ser reaproveitado)
CREATE UNIQUE INDEX ux_usuarios_login ON usuarios (login) WHERE removido_em IS NULL;

-- ---------------------------------------------------------------------
-- SESSÕES (quem está logado)
-- ---------------------------------------------------------------------
CREATE TABLE sessoes (
    id                  INTEGER PRIMARY KEY,
    token_hash          TEXT NOT NULL UNIQUE,              -- SHA-256 do token do cookie
    usuario_id          TEXT NOT NULL REFERENCES usuarios (id),
    criada_em           TEXT NOT NULL,
    ultimo_uso          TEXT NOT NULL,                     -- renovado a cada requisição
    expira_em           TEXT NOT NULL,                     -- limite absoluto (8 horas)
    ip                  TEXT,
    navegador           TEXT,
    encerrada_em        TEXT,
    motivo_encerramento TEXT CHECK (motivo_encerramento IN ('LOGOUT', 'SESSAO_EXPIRADA', 'USUARIO_DESATIVADO', 'SENHA_ALTERADA', 'BACKUP_RESTAURADO'))
);
CREATE INDEX ix_sessoes_usuario ON sessoes (usuario_id) WHERE encerrada_em IS NULL;

-- ---------------------------------------------------------------------
-- BLOQUEIO POR TENTATIVAS (5 erros → 5, 15 e depois 60 minutos)
-- Vale também para logins que não existem (não revela quem existe).
-- ---------------------------------------------------------------------
CREATE TABLE bloqueios_login (
    login          TEXT PRIMARY KEY COLLATE NOCASE,
    erros          INTEGER NOT NULL DEFAULT 0 CHECK (erros >= 0),
    bloqueios      INTEGER NOT NULL DEFAULT 0 CHECK (bloqueios >= 0),
    bloqueado_ate  TEXT,
    atualizado_em  TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- CONFIGURAÇÃO (uma linha só: id = 1)
-- RN01 padrão: R$ 5,00 até 1 hora + R$ 2,00 por hora adicional iniciada
-- ---------------------------------------------------------------------
CREATE TABLE configuracao (
    id                            INTEGER PRIMARY KEY CHECK (id = 1),
    valor_minimo_centavos         INTEGER NOT NULL DEFAULT 500 CHECK (valor_minimo_centavos BETWEEN 0 AND 99900),
    valor_hora_adicional_centavos INTEGER NOT NULL DEFAULT 200 CHECK (valor_hora_adicional_centavos BETWEEN 0 AND 99900),
    tolerancia_min                INTEGER NOT NULL DEFAULT 0   CHECK (tolerancia_min BETWEEN 0 AND 59),
    vagas                         INTEGER NOT NULL DEFAULT 30  CHECK (vagas BETWEEN 1 AND 999),
    atualizado_em                 TEXT,
    atualizado_por                TEXT REFERENCES usuarios (id)
);
INSERT INTO configuracao (id) VALUES (1);

-- ---------------------------------------------------------------------
-- ESTADIAS: cada entrada de veículo
--   situacao = 'no_patio'   carro estacionado agora (chave guardada)
--              'finalizada' saiu e pagou (histórico / faturamento)
--              'excluida'   lançamento apagado por engano (fica guardado)
-- A tabela de preços usada na saída é copiada para a própria linha
-- (tarifa_*): mudar o preço depois não altera saídas antigas.
-- ---------------------------------------------------------------------
CREATE TABLE estadias (
    id                              TEXT PRIMARY KEY,
    placa                           TEXT NOT NULL
                                    CHECK (placa GLOB '[A-Z][A-Z][A-Z][0-9][A-Z0-9][0-9][0-9]'),  -- RN02 (ABC1234 ou ABC1D23)
    motorista                       TEXT NOT NULL CHECK (length(trim(motorista)) >= 3),
    modelo                          TEXT NOT NULL DEFAULT '',   -- modelo/cor
    chave                           TEXT NOT NULL DEFAULT '',   -- nº/gancho da chave guardada no balcão
    entrada_em                      TEXT NOT NULL,
    registrado_por_id               TEXT REFERENCES usuarios (id),
    registrado_por_nome             TEXT NOT NULL DEFAULT '',   -- nome na época (o usuário pode mudar/ser removido)

    situacao                        TEXT NOT NULL DEFAULT 'no_patio'
                                    CHECK (situacao IN ('no_patio', 'finalizada', 'excluida')),

    -- Saída e pagamento
    saida_em                        TEXT,
    minutos                         INTEGER CHECK (minutos >= 0),
    valor_centavos                  INTEGER CHECK (valor_centavos >= 0),
    forma_pagamento                 TEXT CHECK (forma_pagamento IN ('Dinheiro', 'Cartão', 'Pix')),
    valor_recebido_centavos         INTEGER CHECK (valor_recebido_centavos >= 0),
    troco_centavos                  INTEGER CHECK (troco_centavos >= 0),
    tarifa_minimo_centavos          INTEGER,
    tarifa_hora_adicional_centavos  INTEGER,
    tarifa_tolerancia_min           INTEGER,
    recebido_por_id                 TEXT REFERENCES usuarios (id),
    recebido_por_nome               TEXT,

    -- Exclusão (lançamento feito por engano)
    excluida_em                     TEXT,
    excluida_por_id                 TEXT REFERENCES usuarios (id),
    excluida_de                     TEXT CHECK (excluida_de IN ('patio', 'historico')),

    -- Coerência entre os campos
    CHECK (saida_em IS NULL OR saida_em >= entrada_em),
    CHECK (situacao <> 'no_patio' OR saida_em IS NULL),
    CHECK (situacao <> 'finalizada' OR (saida_em IS NOT NULL AND minutos IS NOT NULL
                                        AND valor_centavos IS NOT NULL AND forma_pagamento IS NOT NULL)),
    CHECK (situacao <> 'excluida' OR (excluida_em IS NOT NULL AND excluida_de IS NOT NULL)),
    CHECK (valor_recebido_centavos IS NULL OR valor_recebido_centavos >= valor_centavos)
);
-- Uma placa só pode estar no pátio uma vez
CREATE UNIQUE INDEX ux_estadias_placa_no_patio ON estadias (placa) WHERE situacao = 'no_patio';
CREATE INDEX ix_estadias_saida ON estadias (saida_em) WHERE situacao = 'finalizada';
CREATE INDEX ix_estadias_placa ON estadias (placa, saida_em);

-- Saída já paga não pode ter valores mexidos: só pode ser marcada como excluída
CREATE TRIGGER tg_estadias_protege_pagamento
BEFORE UPDATE ON estadias
WHEN OLD.situacao = 'finalizada' AND (
       NEW.situacao NOT IN ('finalizada', 'excluida')
    OR NEW.saida_em IS NOT OLD.saida_em
    OR NEW.minutos IS NOT OLD.minutos
    OR NEW.valor_centavos IS NOT OLD.valor_centavos
    OR NEW.forma_pagamento IS NOT OLD.forma_pagamento
    OR NEW.placa IS NOT OLD.placa
    OR NEW.entrada_em IS NOT OLD.entrada_em)
BEGIN
    SELECT RAISE(ABORT, 'Saída já paga não pode ser alterada (apenas excluída).');
END;

-- Lançamento excluído não volta
CREATE TRIGGER tg_estadias_excluida_definitiva
BEFORE UPDATE ON estadias
WHEN OLD.situacao = 'excluida'
BEGIN
    SELECT RAISE(ABORT, 'Lançamento excluído não pode ser alterado.');
END;

-- ---------------------------------------------------------------------
-- AUDITORIA (somente inclusão, encadeada por hash)
--   hash(n) = SHA-256( JSON [seq, data, usuario, acao, descricao, detalhes, anterior] )
-- O mesmo cálculo do painel (admin/js/nucleo/auditoria.js), então uma
-- auditoria vinda de um backup do navegador continua verificável aqui.
-- Os gatilhos abaixo impedem UPDATE e DELETE, inclusive pelo próprio servidor.
-- ---------------------------------------------------------------------
CREATE TABLE auditoria (
    seq        INTEGER PRIMARY KEY,
    data       TEXT NOT NULL,
    usuario    TEXT NOT NULL,                 -- login de quem fez (ou 'sistema')
    nome       TEXT NOT NULL DEFAULT '',
    perfil     TEXT NOT NULL DEFAULT '',
    acao       TEXT NOT NULL,                 -- código: VEICULO_ENTRADA, LOGIN_FALHA...
    descricao  TEXT NOT NULL,
    detalhes   TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detalhes)),
    ip         TEXT,                          -- endereço de origem (informativo, fora do hash)
    anterior   TEXT NOT NULL CHECK (length(anterior) = 64),
    hash       TEXT NOT NULL UNIQUE CHECK (length(hash) = 64)
);
CREATE INDEX ix_auditoria_data ON auditoria (data);
CREATE INDEX ix_auditoria_usuario ON auditoria (usuario, data);
CREATE INDEX ix_auditoria_acao ON auditoria (acao, data);

CREATE TRIGGER tg_auditoria_sem_alteracao
BEFORE UPDATE ON auditoria
BEGIN
    SELECT RAISE(ABORT, 'A auditoria não pode ser alterada.');
END;

CREATE TRIGGER tg_auditoria_sem_exclusao
BEFORE DELETE ON auditoria
BEGIN
    SELECT RAISE(ABORT, 'A auditoria não pode ser apagada.');
END;

-- Hash anterior ao primeiro registro, quando a auditoria veio de um
-- backup que já tinha descartado registros antigos (limite do navegador).
CREATE TABLE auditoria_ancora (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    hash  TEXT NOT NULL CHECK (length(hash) = 64)
);

-- Auditorias contidas em backups restaurados com o banco já em uso:
-- guardadas como referência, sem misturar com a cadeia oficial.
CREATE TABLE auditoria_importada (
    id         INTEGER PRIMARY KEY,
    lote       TEXT NOT NULL,                 -- identifica a restauração (data + arquivo)
    seq        INTEGER NOT NULL,
    data       TEXT NOT NULL,
    usuario    TEXT NOT NULL,
    nome       TEXT NOT NULL DEFAULT '',
    perfil     TEXT NOT NULL DEFAULT '',
    acao       TEXT NOT NULL,
    descricao  TEXT NOT NULL,
    detalhes   TEXT NOT NULL DEFAULT '{}',
    anterior   TEXT NOT NULL,
    hash       TEXT NOT NULL
);
CREATE INDEX ix_auditoria_importada_lote ON auditoria_importada (lote, seq);

-- =====================================================================
-- VISÕES (consultas prontas para relatórios)
-- =====================================================================

-- Pátio agora: tempo e valor atual calculados pelo próprio banco (RN01)
--   valor = mínimo + adicional × max(0, ⌈(minutos − 60 − tolerância) / 60⌉)
--   (minutos inteiros: segundos desprezados, igual ao painel)
CREATE VIEW vw_patio AS
SELECT p.*,
       c.valor_minimo_centavos
         + c.valor_hora_adicional_centavos
           * (CASE WHEN p.minutos - 60 - c.tolerancia_min > 0
                   THEN (p.minutos - 60 - c.tolerancia_min + 59) / 60   -- divisão inteira arredondando para cima
                   ELSE 0 END) AS valor_atual_centavos
FROM (SELECT id, placa, motorista, modelo, chave, entrada_em, registrado_por_nome,
             MAX(0, CAST(ROUND((julianday('now') - julianday(entrada_em)) * 86400) AS INTEGER) / 60) AS minutos
      FROM estadias
      WHERE situacao = 'no_patio') AS p
CROSS JOIN configuracao c;

-- Histórico: saídas pagas (as excluídas não entram)
CREATE VIEW vw_historico AS
SELECT id, placa, motorista, modelo, chave, entrada_em, saida_em, minutos,
       valor_centavos, forma_pagamento, valor_recebido_centavos, troco_centavos,
       registrado_por_nome, recebido_por_nome
FROM estadias
WHERE situacao = 'finalizada';

-- Faturamento por dia (horário local do servidor) e forma de pagamento
CREATE VIEW vw_faturamento_diario AS
SELECT date(saida_em, 'localtime') AS dia,
       forma_pagamento,
       COUNT(*)                    AS saidas,
       SUM(valor_centavos)         AS total_centavos,
       ROUND(AVG(minutos))         AS media_minutos
FROM estadias
WHERE situacao = 'finalizada'
GROUP BY dia, forma_pagamento;

-- Clientes conhecidos por placa: visitas, último nome e modelo usados
CREATE VIEW vw_clientes AS
SELECT placa,
       COUNT(*)      AS visitas,
       MAX(saida_em) AS ultima_saida,
       (SELECT motorista FROM estadias u WHERE u.placa = e.placa AND u.situacao = 'finalizada'
         ORDER BY u.saida_em DESC LIMIT 1) AS motorista,
       (SELECT modelo FROM estadias u WHERE u.placa = e.placa AND u.situacao = 'finalizada'
         ORDER BY u.saida_em DESC LIMIT 1) AS modelo,
       SUM(valor_centavos) AS total_gasto_centavos
FROM estadias e
WHERE situacao = 'finalizada'
GROUP BY placa;
