-- =====================================================================
-- CONSULTAS-UTEIS.SQL - PERGUNTAS COMUNS FEITAS DIRETO AO BANCO
-- =====================================================================
-- Para abrir o banco: DB Browser for SQLite (https://sqlitebrowser.org)
-- → Abrir banco de dados → servidor/dados/estacionamento.db → aba "Executar SQL".
-- Abra uma CÓPIA (servidor/dados/copias/) se o servidor estiver ligado,
-- e nunca edite tabelas à mão: a auditoria detecta e recusa alterações.
-- Valores estão em centavos: divida por 100.0 para ter reais.
-- =====================================================================

-- 1) Pátio agora: tempo e valor que seria cobrado neste momento
SELECT placa, motorista, chave, entrada_em, minutos,
       printf('R$ %.2f', valor_atual_centavos / 100.0) AS valor_agora
FROM vw_patio
ORDER BY entrada_em;

-- 2) Faturamento por dia (últimos 30 dias)
SELECT dia, SUM(saidas) AS saidas, printf('R$ %.2f', SUM(total_centavos) / 100.0) AS total
FROM vw_faturamento_diario
WHERE dia >= date('now', 'localtime', '-30 days')
GROUP BY dia
ORDER BY dia DESC;

-- 3) Faturamento do mês por forma de pagamento
SELECT forma_pagamento, SUM(saidas) AS saidas, printf('R$ %.2f', SUM(total_centavos) / 100.0) AS total
FROM vw_faturamento_diario
WHERE dia >= date('now', 'localtime', 'start of month')
GROUP BY forma_pagamento;

-- 4) Clientes mais frequentes
SELECT placa, motorista, visitas, printf('R$ %.2f', total_gasto_centavos / 100.0) AS total_gasto, ultima_saida
FROM vw_clientes
ORDER BY visitas DESC, total_gasto_centavos DESC
LIMIT 20;

-- 5) Saídas recebidas por atendente no mês
SELECT recebido_por_nome AS atendente, COUNT(*) AS saidas, printf('R$ %.2f', SUM(valor_centavos) / 100.0) AS total
FROM estadias
WHERE situacao = 'finalizada' AND date(saida_em, 'localtime') >= date('now', 'localtime', 'start of month')
GROUP BY recebido_por_nome
ORDER BY SUM(valor_centavos) DESC;

-- 6) Lançamentos excluídos (quem, quando e de onde)
SELECT e.placa, e.motorista, e.excluida_de, e.excluida_em, u.login AS excluido_por,
       printf('R$ %.2f', e.valor_centavos / 100.0) AS valor
FROM estadias e
LEFT JOIN usuarios u ON u.id = e.excluida_por_id
WHERE e.situacao = 'excluida'
ORDER BY e.excluida_em DESC;

-- 7) Tentativas de login com erro e bloqueios nos últimos 7 dias
SELECT data, acao, json_extract(detalhes, '$.login') AS login, ip
FROM auditoria
WHERE acao IN ('LOGIN_FALHA', 'LOGIN_BLOQUEADO', 'ACESSO_NEGADO')
  AND data >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')
ORDER BY seq DESC;

-- 8) Quem está logado agora (sessões abertas e usadas nos últimos 30 min)
SELECT u.login, u.nome, s.criada_em, s.ultimo_uso, s.ip
FROM sessoes s
JOIN usuarios u ON u.id = s.usuario_id
WHERE s.encerrada_em IS NULL
  AND s.ultimo_uso >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 minutes');

-- 9) Histórico de um carro pela placa
SELECT entrada_em, saida_em, minutos, printf('R$ %.2f', valor_centavos / 100.0) AS valor, forma_pagamento, situacao
FROM estadias
WHERE placa = 'ABC1D23'
ORDER BY entrada_em DESC;
