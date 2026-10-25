# Segurança do Painel Administrativo — Chaveiro Senador

Este documento lista **todas** as medidas de segurança aplicadas no código do painel (`admin/`) e no site público, onde cada uma está no código, como testar, e o que ainda **não** é protegido.

> **Resumo honesto:** o painel roda 100% no navegador, sem servidor. Ele impede que um funcionário sem senha use o sistema, não guarda senhas legíveis, registra quem fez o quê e detecta adulteração da auditoria. Ele **não** impede que alguém com acesso ao computador e conhecimento técnico (DevTools) leia ou apague os dados do navegador. Para isso é preciso um back-end (seção 6).

---

## 1. Acesso e senhas

| Medida | Como funciona | Onde no código |
| --- | --- | --- |
| Usuário padrão **admin / admin** | Criado automaticamente quando não existe nenhum usuário (pedido do dono). Enquanto a senha padrão estiver em uso, um aviso amarelo aparece em todas as telas com o botão **Trocar senha**. **Risco:** qualquer pessoa que conheça o padrão entra até a senha ser trocada — troque no primeiro uso. | `sessao.js` → `garantirAdminPadrao`, `app.js` |
| Hash de senha forte | **PBKDF2-SHA256, 120.000 iterações, sal aleatório de 16 bytes** por usuário (Web Crypto). Formato gravado: `pbkdf2$120000$<sal>$<hash>`. A senha nunca é gravada. | `nucleo/seguranca.js` → `hashSenha` |
| Comparação em tempo constante | A conferência do hash não "sai mais cedo" no primeiro caractere diferente. | `seguranca.js` → `iguais` |
| Migração automática | Contas criadas no módulo antigo (SHA-256 x1000) são aceitas e convertidas para PBKDF2 no próximo login. | `seguranca.js` → `verificarSenha`, `sessao.js` → `entrar` |
| Política de senha | Mínimo 8 caracteres, letras **e** números, não pode conter o login, recusa senhas comuns (`12345678`, `senha123`…). | `seguranca.js` → `validarSenhaForte` |
| Troca obrigatória | Senha criada ou redefinida pelo Administrador obriga o funcionário a criar a própria senha no próximo login. | `telas/acesso.js` → `form-troca` |
| Trocar a própria senha | Exige a senha atual; a nova deve ser diferente. Mostra a data do login anterior (ajuda a perceber uso indevido). | `telas/acesso.js` → `form-conta` |

## 2. Proteção contra tentativa e erro

| Medida | Como funciona | Onde |
| --- | --- | --- |
| Bloqueio progressivo | 5 erros seguidos bloqueiam **aquele login**: 1º bloqueio 5 min, 2º 15 min, 3º em diante 60 min. A senha certa não entra durante o bloqueio. | `sessao.js` → `entrar` |
| Mensagem genérica | Sempre "Usuário ou senha inválidos" — não diz se o usuário existe. | `sessao.js` |
| Tempo de resposta igual | Para usuário inexistente o sistema calcula um hash do mesmo jeito, para o tempo não denunciar quais logins existem. | `sessao.js` |
| Tudo auditado | Cada falha (`LOGIN_FALHA`) e cada bloqueio (`LOGIN_BLOQUEADO`, gravidade crítica) vai para a auditoria com o login digitado. | `sessao.js` |

## 3. Sessão e permissões

| Medida | Como funciona | Onde |
| --- | --- | --- |
| Sessão curta | Token aleatório de 24 bytes no `sessionStorage` (some ao fechar a aba). Expira após **30 min sem uso** e após **8 h** de qualquer forma. Um aviso com contagem regressiva aparece 2 min antes, com o botão "Continuar conectado". | `sessao.js`, `app.js` |
| Perfil relido a cada ação | O perfil não vem da sessão: é lido do cadastro toda vez. Desativar ou remover um usuário corta o acesso na hora. | `sessao.js` → `usuarioAtual` |
| Permissão por ação | Toda ação restrita chama `Sessao.exigir('permissao')` antes de executar — esconder o botão não é a única barreira. | todas as `telas/*.js` |
| Acesso negado auditado | Tentar abrir uma tela sem permissão (ex.: digitar `#usuarios` no endereço) é bloqueado e gera `ACESSO_NEGADO` (crítico). | `app.js` → `irPara` |
| Proteções de cadastro | Não é possível remover/desativar a si mesmo nem o último Administrador ativo. | `telas/usuarios.js` |
| Desativar em vez de apagar | Usuário desativado não entra, mas o histórico e a auditoria dele continuam. | `telas/usuarios.js` |
| Botão Voltar após sair | Ao voltar pelo histórico do navegador a página reavalia a sessão e mostra o login. | `app.js` (`pageshow`) |

**Perfis:** `admin` (tudo) e `operador` (pátio e histórico do dia). A tabela completa está em `sessao.js` → `PERMISSOES`.

## 4. Auditoria

Cada ação relevante gera um registro com **nº sequencial, data/hora, usuário, nome, perfil, ação, detalhes** e dois hashes.

**Encadeamento à prova de adulteração:**

```
hash(n) = SHA-256( nº, data, usuário, ação, descrição, detalhes, hash(n-1) )
```

- Alterar qualquer campo de um registro antigo muda o hash dele e quebra a ligação com o seguinte.
- Apagar um registro quebra a ligação `hash anterior`.
- O botão **Verificar integridade** recalcula a cadeia e aponta o primeiro registro adulterado. A tela de Auditoria também verifica ao abrir.
- Não há botão para editar ou apagar registros.
- Guarda os últimos 5.000 registros; ao passar disso, o hash do último descartado vira a **âncora** e a verificação continua válida. Exporte o CSV periodicamente para guardar tudo.

**Ações registradas** (`nucleo/auditoria.js` → `ACOES`):

| Gravidade | Ações |
| --- | --- |
| Crítico | login bloqueado, acesso negado, usuário removido, veículo excluído do pátio, saída excluída do histórico, backup restaurado |
| Alerta | login com falha, senha alterada/redefinida, usuário criado/ativado/desativado, configurações alteradas (antes e depois), dados exportados, backup exportado |
| Info | sistema instalado, login, logout, sessão expirada, entrada de veículo, saída e pagamento, integridade verificada |

## 5. Dados exibidos e arquivos

| Ameaça | Medida | Onde |
| --- | --- | --- |
| XSS (nome do motorista com `<script>`, `<img onerror>`) | Todo texto digitado passa por `esc()` antes de virar HTML. No site público, avisos usam `textContent`. | `seguranca.js` → `esc`, `assets/js/site.js` |
| Injeção de fórmula no Excel (CSV injection) | Células que começam com `=`, `+`, `-`, `@` recebem um apóstrofo; aspas são duplicadas. | `seguranca.js` → `celulaCSV` |
| Scripts de terceiros | CSP no `<head>`: só scripts do próprio site e do Tailwind; bloqueia plugins (`object-src 'none'`), `<base>` e envio de formulários para fora. Nenhum script inline no painel. | `admin/index.html` |
| Clickjacking | Se o painel for aberto dentro de um `<iframe>` de outro site, ele sai do iframe (ou se esconde). | `seguranca.js` → `protegerContraFrames` |
| Vazamento de endereço | `referrer: no-referrer` — o endereço do painel não é enviado a outros sites. | `admin/index.html` |
| Indexação | `noindex, nofollow, noarchive` no painel; link do rodapé com `rel="nofollow"`. | `admin/index.html`, rodapés |
| Entradas inválidas | Placa (antiga/Mercosul), hora no futuro, nome curto, valores de preço fora de 0–999, tolerância 0–59, limites de tamanho (`maxlength`). | `telas/patio.js`, `telas/configuracoes.js` |

## 6. O que NÃO está protegido (e como resolver)

| Limitação | Por quê | Solução recomendada |
| --- | --- | --- |
| Quem abre o DevTools pode ler/apagar o `localStorage` | Não há servidor; os dados ficam no navegador | Back-end (Node.js + PostgreSQL/SQLite) com os dados no servidor |
| A cadeia da auditoria pode ser **recalculada** por alguém técnico | O hash não usa uma chave secreta | No servidor: registros só de inclusão (append-only) e HMAC com chave secreta, ou envio para um serviço externo de logs |
| Dados não são compartilhados entre computadores | Cada navegador tem seu próprio armazenamento | Back-end com API |
| Sem backup automático | Limpar os dados do navegador apaga tudo | Em **Configurações → Backup** baixe o arquivo .json toda semana (contém clientes e hashes de senha: guarde em local seguro). A restauração pede confirmação e é registrada como ação crítica na auditoria. |
| Cabeçalhos de segurança completos | `X-Frame-Options`, `HSTS` e CSP `frame-ancestors` só funcionam enviados pelo servidor | Configurar na hospedagem (ver abaixo) |

**Ao publicar em hospedagem**, configure estes cabeçalhos para a pasta `/admin/`:

```
Content-Security-Policy: frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Robots-Tag: noindex, nofollow
```

E use **sempre HTTPS**.

## 7. Como testar

```bash
node testes/testes-unitarios.js   # 40 testes: PBKDF2 conferido com o Node, política de senha,
                                  # escape, CSV, cadeia de auditoria (alterar/remover/trocar autor)
python testes/e2e-admin.py        # 65 verificações no navegador: bloqueio após 5 erros,
                                  # operador sem acesso a telas de admin, #usuarios pelo endereço
                                  # bloqueado e auditado, XSS não executa, adulteração detectada,
                                  # sessão vencida, nenhuma violação de CSP
```

## 8. Comparação com o site de estética

O painel admin do site de estética (`Documentos\GitHub\site-estetica`) não pôde ser lido nesta sessão: a versão publicada no GitHub tem só a página pública, e o acesso à pasta local não foi liberado. As medidas acima foram implementadas segundo boas práticas (OWASP). Quando os arquivos do admin da estética forem disponibilizados, esta seção será completada com a comparação item a item.
