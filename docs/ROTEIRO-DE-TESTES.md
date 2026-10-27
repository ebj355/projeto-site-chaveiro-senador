# Roteiro de testes: banco de dados + módulo de estacionamento

Este roteiro serve para conferir, do começo ao fim, se o painel do estacionamento está funcionando bem **com o banco de dados**. Tem duas partes:

- **Parte A, testes automáticos:** comandos que testam tudo sozinhos em poucos minutos. Rode sempre que o código mudar.
- **Parte B, teste manual:** uma pessoa usa o sistema como no dia a dia e marca cada item. Faça antes de colocar em uso e depois de cada mudança importante.

Tempo estimado: Parte A em 5 minutos; Parte B entre 60 e 90 minutos.

---

## Preparação

| | O que precisa |
| --- | --- |
| Computador | Node.js 22 LTS (22.13+) ou 24 LTS ([nodejs.org](https://nodejs.org)). Confira com `node --version`. |
| Celular | Na mesma rede Wi-Fi do computador (para os testes de vários aparelhos) |
| Programa opcional | [DB Browser for SQLite](https://sqlitebrowser.org), para olhar dentro do banco |
| Banco de teste | Use um banco separado para não misturar com dados reais (abaixo) |

**Ligar o servidor com um banco de teste** (no PowerShell, na pasta do projeto):

```powershell
$env:BANCO="servidor\dados\teste.db"; npm run servidor
```

Ao terminar, apague `servidor\dados\teste.db`. Para usar o banco real, ligue só com `npm run servidor`.

---

## Parte A: testes automáticos

Na pasta do projeto:

| Comando | O que testa | Resultado esperado |
| --- | --- | --- |
| `npm test` | Regras de cobrança, segurança e auditoria (40), **banco de dados e API** (96) | `40 passaram, 0 falharam` e `96 passaram, 0 falharam` |
| `npm run test:e2e` | Painel no navegador, **modo local** (sem servidor) | `68 passaram, 0 falharam` |
| `npm run test:e2e-servidor` | Painel no navegador, **modo servidor**, com dois aparelhos ao mesmo tempo e conferência dentro do banco | `33 passaram, 0 falharam` |

Os testes no navegador precisam, uma vez: `pip install playwright` e `python -m playwright install chromium`. Eles usam bancos temporários e nunca mexem no banco real.

**O que os 96 testes do banco cobrem:**

| Grupo | Exemplos |
| --- | --- |
| BD: estrutura | Tabelas, visões e gatilhos criados; migração não roda duas vezes; o banco recusa placa inválida, placa repetida no pátio, forma de pagamento desconhecida e troco negativo |
| RN: cobrança | A visão `vw_patio` calcula **no SQL** o mesmo valor do painel em 13 durações, com e sem tolerância |
| API: operações | Login, mensagem genérica, bloqueio após 5 erros, entrada, saída com troco, preço congelado na saída, usuários, troca obrigatória de senha, desativar derruba a sessão, sessão expira em 30 min |
| AUD: auditoria | O banco bloqueia UPDATE e DELETE; o painel não consegue forjar registros; edição direta no arquivo do banco é detectada |
| BKP: backup | Backup do banco, migração do navegador para o banco com o hash antigo de senha, auditoria adulterada recusada, restauração mantém a auditoria oficial |
| HTTP: segurança | Cookie HttpOnly e SameSite; CSRF bloqueado; operador recebe 403; banco e código do servidor nunca são servidos |

---

## Parte B: teste manual

Marque **✔** (passou) ou **✘** (falhou) e anote o que aconteceu. Cada bloco depende do anterior; siga a ordem.

### B1. Ligar e primeiro acesso

| Nº | Passo | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| M01 | Rode `npm run servidor` | O terminal mostra "servidor ligado", o caminho do banco, os endereços "Neste computador" e "Na rede (celular)" e "Primeiro acesso: admin / admin" | |
| M02 | Confira a pasta `servidor\dados\` | Existem `estacionamento.db` (ou `teste.db`) e a pasta `copias\` com uma cópia do dia | |
| M03 | Abra `http://localhost:8080/admin/` | Aparece a tela "Área Restrita" | |
| M04 | Entre com **admin / admin** | Abre o Painel com a faixa amarela "Você está usando a senha padrão" | |
| M05 | Olhe o rodapé do menu lateral | Selo verde **"Dados no banco de dados (servidor)"** | |
| M06 | Clique em **Trocar senha** e defina uma senha forte | A faixa amarela some | |
| M07 | Saia e entre de novo com a senha **antiga** | "Usuário ou senha inválidos" | |
| M08 | Entre com a senha nova | Entra normalmente | |

### B2. Entrada de veículos

| Nº | Passo | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| M09 | Pátio → placa `ABC1D23`, nome `Maria Souza`, hora de 2h05 atrás, chave `7` → Registrar | Aparece na lista com o tempo em âmbar (entre 1 h e 3 h) e "Chave 7" | |
| M10 | Tente registrar `ABC1D23` de novo | "Este veículo já está no pátio." | |
| M11 | Placa `AB123` | "Placa inválida. Use ABC-1234 ou ABC1D23." | |
| M12 | Placa `DEF1234` com hora daqui a 1 hora | "A hora de entrada não pode estar no futuro." | |
| M13 | Placa `DEF1234`, nome `Jo` | "O nome deve ter pelo menos 3 letras." | |
| M14 | Registre `DEF1234`, `Carlos Lima`, hora de 30 min atrás | Aparece na lista; o contador do pátio mostra 2 | |
| M15 | Dê dois cliques rápidos em Registrar numa entrada nova | Só **uma** entrada é criada | |

### B3. Saída e cobrança

Tabela padrão: R$ 5,00 até 1 hora + R$ 2,00 por hora adicional iniciada.

| Nº | Passo | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| M16 | Saída de `ABC1D23` (2h05) | Modal: permanência 2h 05min, **R$ 9,00** | |
| M17 | Dinheiro, recebido `5` → Confirmar | Recusa: valor recebido menor que o total | |
| M18 | Recebido `20` → Confirmar | Comprovante com Recebido R$ 20,00, **Troco R$ 11,00**, Total R$ 9,00 | |
| M19 | Imprimir o comprovante | Só o comprovante sai na impressão | |
| M20 | Saída de `DEF1234` (30 min) com **Pix** | R$ 5,00, sem campo de troco | |
| M21 | Conferir os valores: entradas com 59 min, 61 min, 3h01 e 10h | R$ 5,00 · R$ 7,00 · R$ 11,00 · R$ 23,00 | |

### B4. Vários aparelhos ao mesmo tempo

| Nº | Passo | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| M22 | No celular, abra o endereço "Na rede (celular)" do terminal (ex.: `http://192.168.0.15:8080/admin/`) e entre | Abre o painel com o mesmo selo verde e o mesmo histórico do computador | |
| M23 | No celular, registre a entrada `GHI2J34` | No computador, o carro aparece **sozinho em até 15 segundos**, sem apertar F5 | |
| M24 | Abra a saída de `GHI2J34` no computador **e** no celular; confirme primeiro no computador e depois no celular | O celular mostra "Este veículo já saiu do pátio." (não cobra duas vezes) | |
| M25 | No computador, aperte F5 | Continua logado, com os mesmos dados | |
| M26 | Abra o painel em **outro navegador** do mesmo computador (ex.: Edge) e entre | Vê os mesmos dados (no modo antigo cada navegador tinha os seus) | |

Se o celular não abrir a página: confira se está no mesmo Wi-Fi e permita o Node.js no Firewall do Windows (redes privadas).

### B5. Histórico e relatórios

| Nº | Passo | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| M27 | Histórico → Hoje | Saídas de M18, M20 e M24 com totais corretos | |
| M28 | Filtre por Pix | Só a saída de M20 | |
| M29 | Exportar CSV e abrir no Excel | Colunas corretas, valores com vírgula | |
| M30 | Comprovante (ícone na linha) | Reabre o comprovante da saída | |
| M31 | Exclua uma saída (confirmando) | Some da lista e do total | |
| M32 | Relatórios → Hoje | Faturamento, ticket médio e gráfico batem com o histórico | |

### B6. Usuários e perfis

| Nº | Passo | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| M33 | Usuários → cadastre `Joana Operadora`, login `joana`, senha `Provisoria1`, perfil Operador, "trocar no 1º login" marcado | Aparece com o selo "Troca de senha pendente" | |
| M34 | No celular, saia e entre como `joana` | Pede uma senha nova antes de liberar | |
| M35 | Defina uma senha que contenha "joana" | Recusa: não pode conter o nome de usuário | |
| M36 | Defina uma senha válida | Entra; o menu **não** mostra Relatórios, Usuários, Auditoria nem Configurações | |
| M37 | Como joana, digite `#usuarios` no fim do endereço | Volta ao Painel com "Você não tem permissão" | |
| M38 | Como joana, registre uma entrada e uma saída | Funciona; o comprovante mostra "Atendente: Joana Operadora" | |
| M39 | No computador (admin), **desative** joana | Em até 15 s o celular de joana volta para o login | |
| M40 | Tente entrar como joana | "Usuário ou senha inválidos" | |
| M41 | Tente desativar ou remover o **próprio** admin | Não há botão / é recusado | |

### B7. Segurança

| Nº | Passo | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| M42 | Erre a senha do admin 5 vezes | Na 5ª: "Acesso bloqueado por 5 minutos" | |
| M43 | Digite a senha certa durante o bloqueio | Continua bloqueado | |
| M44 | Login com um usuário que não existe | Mesma mensagem genérica (não revela se o usuário existe) | |
| M45 | Fique 28 min sem mexer no painel | Aparece o aviso "Sua sessão vai expirar" com contagem | |
| M46 | Clique em "Continuar conectado" | O aviso some | |
| M47 | Fique mais de 30 min parado | Volta para o login: "Sessão expirada" | |
| M48 | Feche **todas** as janelas do navegador e abra o painel de novo | Pede login (se o navegador estiver em "continuar de onde parou", a sessão pode seguir até vencer por inatividade) | |
| M49 | Abra `http://localhost:8080/servidor/dados/estacionamento.db` | "Não encontrado" (o banco nunca é baixável) | |
| M50 | Abra `http://localhost:8080/servidor/servidor.js` | "Não encontrado" | |

### B8. Auditoria

| Nº | Passo | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| M51 | Auditoria | Faixa verde "Integridade OK" e os registros de tudo o que foi feito: logins, entradas, saídas, exclusão, usuários, bloqueio, acesso negado | |
| M52 | Filtre pelo usuário `joana` | Só as ações dela | |
| M53 | Clique em **Verificar integridade** | "Integridade confirmada" e um novo registro "Integridade verificada" | |
| M54 | *(Opcional, técnico)* Abra uma **cópia** do banco no DB Browser e tente apagar uma linha da tabela `auditoria` | Erro: "A auditoria não pode ser apagada." | |
| M55 | *(Opcional)* Na mesma cópia, tente mudar o valor de uma saída paga em `estadias` | Erro: "Saída já paga não pode ser alterada" | |

### B9. Configurações

| Nº | Passo | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| M56 | Configurações → hora adicional R$ 3,00 | A simulação ao lado muda na hora (1h01 = R$ 8,00) | |
| M57 | Salvar e dar saída num carro com 2h05 | Cobra R$ 11,00 | |
| M58 | Histórico: abra o comprovante de M18 | Continua R$ 9,00 (saída antiga não muda com o preço novo) | |
| M59 | Volte para R$ 2,00 e mude as vagas para 40 | Painel mostra a ocupação sobre 40 vagas | |
| M60 | Abra o painel no celular | O preço e as vagas novos já valem lá | |

### B10. Backup e recuperação

| Nº | Passo | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| M61 | Configurações → **Baixar backup** | Baixa `backup-chaveiro-senador-AAAA-MM-DD.json` | |
| M62 | `npm run banco:copia` | "Cópia criada: ...\copias\estacionamento-....db" | |
| M63 | Desligue o servidor (Ctrl + C), reinicie o computador e ligue de novo | Tudo continua: pátio, histórico, usuários, auditoria | |
| M64 | Desligue, troque `estacionamento.db` pela cópia de M62 e ligue | Os dados voltam ao momento da cópia | |
| M65 | **Migração do navegador:** num navegador que ainda tem dados do modo antigo, abra `admin/index.html` direto do arquivo, baixe o backup, desligue o servidor e rode `npm run banco:importar -- caminho\do\backup.json` com `BANCO` apontando para um banco novo | "Backup importado"; ao ligar e entrar, os dados antigos aparecem e a auditoria está íntegra | |
| M66 | Rode o mesmo `banco:importar` de novo | Recusa: "O banco já tem dados" | |

### B11. Falhas e recuperação

| Nº | Passo | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| M67 | Com o painel aberto, desligue o servidor e tente registrar uma entrada | Aviso "Sem conexão com o servidor do banco de dados"; nada é gravado só no navegador | |
| M68 | Ligue o servidor de novo e repita | Funciona (pode pedir login de novo) | |
| M69 | Abra `admin/index.html` direto do arquivo, sem servidor | Selo âmbar "Dados só neste navegador" (modo local continua funcionando) | |

### B12. Celular

| Nº | Passo | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| M70 | Navegue por todas as telas no celular | Nada corta nem rola para o lado; barra inferior com Painel, Pátio, Entrada, Histórico e Mais | |
| M71 | Pátio no celular | Cartões no lugar da tabela; botões fáceis de tocar | |
| M72 | Comprovante no celular | Legível; o botão Imprimir funciona | |

---

## Registro do teste

| | |
| --- | --- |
| Data | |
| Quem testou | |
| Versão (commit) | |
| Banco usado | teste.db / estacionamento.db |
| Parte A | ☐ todos os automáticos passaram |
| Parte B | ___ de 72 passaram |

**Falhas encontradas:**

| Nº do passo | O que aconteceu | Print/observação |
| --- | --- | --- |
| | | |

---

Mapa dos testes automáticos de navegador (modo servidor, `testes/e2e-servidor.py`): S01–S02 primeiro acesso · S03–S06 entrada, saída e histórico · S07–S08 dois aparelhos e F5 · S09–S10 preços e backup · S11–S13 operador e permissões · S14–S15 auditoria · S16 sessão vencida no servidor · S17 celular · S18 sair · S19 servidor desligado · S20 sem erros de JavaScript ou CSP.
