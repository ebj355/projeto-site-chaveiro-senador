# Roteiro de testes: site público e navegação

Este roteiro confere se o site do Chaveiro Senador funciona e é fácil de usar: as 6 páginas, os menus, os botões de contato, o formulário de orçamento, o catálogo de serviços, a busca de chaves codificadas, o FAQ e as Dicas, no computador e no celular.

O painel administrativo (Área Restrita) tem roteiro próprio em [ROTEIRO-DE-TESTES.md](ROTEIRO-DE-TESTES.md). Aqui só se testa que o link do rodapé leva até ele.

| Parte | O que é | Quem faz | Tempo |
| --- | --- | --- | --- |
| **A. Testes funcionais e de navegação** | 91 casos que conferem se cada função faz o que deve. Executados automaticamente por `python testes/e2e-navegacao.py` (235 verificações) e também possíveis à mão | Equipe do projeto | 6 min automático; ~2 h à mão |
| **B. Conferência manual** | O que a automação não alcança: navegadores e celulares reais, aplicativos que o site abre (discador, WhatsApp, e-mail), revisão visual e de texto | Equipe do projeto | 40 a 60 min |
| **C. Teste de usabilidade com usuários reais** | Clientes e funcionários do parceiro usam o site para cumprir 7 tarefas; medimos sucesso, tempo, erros e satisfação (SUS) | Equipe + 5 participantes | 20 a 30 min por pessoa |

Resultados: **OK** (passou), **FALHA** (defeito: o site não faz o que se espera, precisa de correção) e **AVISO** (funciona, mas há melhoria recomendada; não reprova).

---

## Preparação

| | O que precisa |
| --- | --- |
| Versão | Anote o commit testado: `git log --oneline -1` |
| Parte A automática | Python 3 com Playwright: `pip install playwright` e `python -m playwright install chromium`. Opcional, para o teste de acessibilidade: `npm i axe-core` na pasta do projeto |
| Parte B | Um computador com Chrome, Edge e Firefox; um celular Android e, se possível, um iPhone; WhatsApp instalado no celular |
| Parte C | 5 participantes (ver C1), um celular com o site aberto, cronômetro, as fichas de registro impressas e o termo de consentimento |
| Endereço | Para a Parte A o script sobe um servidor local sozinho. Para B e C use o site publicado ou rode `npm run servidor` e abra `http://localhost:8080/` |

**Rodar a Parte A** (na pasta do projeto):

```powershell
python testes/e2e-navegacao.py
```

Ao final o terminal mostra `N OK, 0 falharam, M avisos`. O detalhe de cada verificação fica em `testes/capturas/resultado-navegacao.json`, junto com capturas de tela de todas as páginas a 375 px (celular) e 1280 px (computador).

---

## Parte A: testes funcionais e de navegação

Cada caso tem um código (NAV-01, FRM-03...) que aparece igual na saída do script. Para testar à mão, siga a coluna "Como testar" e marque ✔ ou ✘.

### A1. Navegação entre páginas (NAV)

| Nº | Como testar | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| NAV-01 | Abra `index.html` (é o que abre quando se digita só o domínio) | Vai direto para a página Início (`chaveiro-em-santo-andre.html`) | |
| NAV-02 | Em cada uma das 6 páginas, clique em cada item do menu do topo (computador) | Abre a página certa, com o título (H1) dela | |
| NAV-02b | Olhe o menu do topo | Tem as 6 páginas: Início, Quem Somos, Nossos Serviços, Contato, FAQ e Dicas | |
| NAV-03 | Em cada página, clique no logo/nome "Chaveiro Senador" | Volta para o Início | |
| NAV-04 | No celular (ou janela com 375 px), abra o menu ☰ e toque em cada item, em cada página | O menu abre, a página por trás não rola, e cada item leva à página certa | |
| NAV-05 | Em cada página, clique nos 6 "Links Rápidos" do rodapé | Cada um abre a página certa | |
| NAV-06 | Em cada página, olhe o menu | O item da página aberta aparece destacado (amarelo e sublinhado) | |
| NAV-07 | A partir do Início, conte os cliques até cada página | Todas em até 2 cliques | |
| NAV-08 | Clique em todos os links internos (inclusive "Saiba mais" e "serviços" no texto) | Nenhum leva a página inexistente ou a ponto inexistente da página | |
| NAV-09 | Vá do Início para Serviços e aperte Voltar no navegador | Volta ao Início | |
| NAV-10 | No Início, clique em "Saiba mais" de cada um dos 6 serviços do carrossel | Abre Nossos Serviços já no cartão daquele serviço, com "Ver detalhes" aberto e destacado | |
| NAV-13 | Role cada página até o fim | O topo com o menu continua visível | |
| NAV-14 | Confira os links que abrem nova aba (WhatsApp, mapa) | Abrem em nova aba sem dar acesso à página de origem (`rel="noopener"`) | |

### A2. Contato (CTT)

| Nº | Como testar | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| CTT-01 | Passe o mouse sobre todos os botões "Ligar" | Todos usam o mesmo número da loja, (11) 4994-2568 | |
| CTT-02 | Passe o mouse sobre todos os botões de WhatsApp | Todos usam (11) 99977-6208 e abrem em nova aba | |
| CTT-02b | Clique nos botões de WhatsApp com mensagem pronta | A mensagem aparece legível, com acentos ("Olá! Vim pelo site...") | |
| CTT-03 | Abra cada página | O botão redondo do WhatsApp fica no canto da tela e acompanha a rolagem | |
| CTT-04 | Leia o rodapé de cada página | Endereço Rua Senador Flaquer, 561 e CEP 09010-060 iguais em todas | |
| CTT-05 | Compare o horário no Início e no Contato | Igual nas duas (Seg a Sex 8h às 22h; Sáb 8h às 16h) | |
| CTT-06 | Contato → mapa | Mostra a loja na Rua Senador Flaquer, 561 | |
| CTT-07 | Compare o e-mail do botão "Iniciar Parceria" (Início) com o que o formulário usa | É o mesmo e-mail (AVISO se forem diferentes) | |
| CTT-08 | Contato → role até o mapa | O mapa do Google carrega | |

### A3. Formulário de orçamento (FRM), página Contato

| Nº | Como testar | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| FRM-01 | Clique no texto de cada rótulo (Nome, E-mail...) | O cursor vai para o campo correspondente | |
| FRM-02 | Clique em "Enviar Mensagem" com tudo vazio | Não envia; o navegador aponta o campo Nome | |
| FRM-03 | Nome `Jo`, resto válido | Aviso "Informe seu nome completo." | |
| FRM-04 | E-mails `joao@`, `joao.email.com`, `joao@email` | Recusados | |
| FRM-05 | Telefone `1199977` | Aviso "Informe um telefone com DDD." | |
| FRM-06 | Digite `11999776208` e depois `1149942568` | Vira (11) 99977-6208 e (11) 4994-2568 | |
| FRM-07 | Digite `11abc9999-77620899` no telefone | Letras somem; para em 11 dígitos: (11) 99997-7620 | |
| FRM-08 | Não escolha o serviço | Não envia; aponta o campo Serviço | |
| FRM-09 | Mensagem `oi` | Aviso "Escreva uma mensagem." | |
| FRM-10 | Cole um texto com mais de 500 letras na mensagem | Para em 500; o contador mostra 500 em vermelho | |
| FRM-11 | Preencha tudo certo e envie | Abre o programa de e-mail endereçado à loja, com nome, telefone, e-mail, serviço e mensagem | |
| FRM-12 | Depois de enviar | Aparece um aviso e o formulário fica limpo (contador 0) | |
| FRM-12b | Espere | O aviso some sozinho em 5 segundos | |
| FRM-13 | No nome, digite `<img src=x onerror="alert(1)">Ana` e envie | Nada é executado; o texto aparece como texto | |
| FRM-14 | Leia o aviso depois do envio | Diz que o e-mail foi aberto com a mensagem pronta (não que "foi enviado", pois o envio depende do visitante) | |
| FRM-15 | No e-mail aberto, leia a linha do serviço | Mostra o nome como na lista ("Manutenção"), não um código ("manutencao") | |

### A4. Serviços, carrosséis e perguntas (SRV, FAQ)

| Nº | Como testar | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| SRV-01 | Nossos Serviços → catálogo | 15 serviços, cada um com foto, nome e "Ver detalhes" | |
| SRV-02 | Clique duas vezes em "Ver detalhes" | Abre e fecha a descrição | |
| SRV-03 | Busca de chave codificada: `onix`, `MÉGANE`, `fiat`, `hb20` | Mostra Chevrolet, Renault, Fiat, Hyundai, com o modelo destacado (sem ligar para acento ou maiúscula) | |
| SRV-04 | Busque `xyzw` | Aviso "Não encontramos esse modelo..." e o cartão do WhatsApp continua | |
| SRV-05 | Com o cursor na busca, aperte Esc | Busca limpa; as 19 marcas voltam | |
| SRV-06 | Carrossel de montadoras: setas e bolinhas | Trocam o grupo de marcas | |
| SRV-07 | Espere 6 segundos sem mexer | O carrossel de montadoras avança sozinho | |
| SRV-08 | Deixe o mouse sobre o carrossel | Ele para de avançar | |
| SRV-09 | Início → carrossel de serviços: clique na seta → até o fim, depois ← até o início | Passa por todas as páginas, inclusive a última ("ver todos"), e volta | |
| SRV-10 | Clique no carrossel e use as setas do teclado | Avança e volta | |
| FAQ-01 | FAQ e Dicas: clique em cada pergunta | Abre a resposta; só uma aberta por vez | |
| FAQ-02 | Clique de novo na pergunta aberta | Fecha | |
| FAQ-03 | Use Tab até uma pergunta e aperte Enter | Abre | |

### A5. Celular e tamanhos de tela (RSP)

| Nº | Como testar | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| RSP-01 | Abra as 6 páginas em 320, 360, 375, 414, 768, 1024, 1280 e 1920 px (no Chrome: F12 → ícone de celular) | Nenhuma página rola para o lado | |
| RSP-02 | Nas mesmas larguras | Até 1023 px aparece o menu ☰; a partir de 1024 px, o menu completo | |
| RSP-03 | No celular, tente tocar em todos os botões | Todos com pelo menos 24×24 px (AVISO se menores) | |
| RSP-04 | No celular, leia todos os textos | Nenhum menor que 12 px | |
| RSP-05 | Abra o menu ☰ e toque fora dele | Fecha | |
| RSP-06 | Em 1024, 1280 e 1920 px, olhe o menu do topo | Os 6 itens cabem inteiros, sem cortar nem encostar no logo | |
| RSP-07 | Abra o Início no celular | O botão do WhatsApp aparece sem rolar | |
| RSP-08 | Abra o Início no celular | Um botão "Ligar" aparece sem rolar (AVISO se só aparecer depois) | |

### A6. Acessibilidade (ACE)

| Nº | Como testar | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| ACE-01 | Rode o axe (extensão "axe DevTools" no Chrome) em cada página | Nenhuma violação grave ou crítica da WCAG 2.1 AA (ex.: contraste de cor) | |
| ACE-02 | Código da página | `lang="pt-BR"` | |
| ACE-03 | Cada página | Um único título principal (H1) | |
| ACE-04 | Cada imagem | Tem texto alternativo (`alt`) | |
| ACE-05 | Use só o teclado (Tab) | O foco chega aos links do topo e aparece um contorno visível | |
| ACE-06 | Botões só com ícone (☰, WhatsApp, setas) | Têm nome para leitor de tela (`aria-label`) | |
| ACE-07 | Ligue "Reduzir movimento" no aparelho (Windows: Configurações → Acessibilidade → Efeitos visuais → Animação desligada) | Os carrosséis não avançam sozinhos | |
| ACE-08 | Ordem dos títulos | Não pula nível (H1 → H3) | |

### A7. Busca no Google (SEO)

| Nº | Como testar | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| SEO-01 | Título de cada aba | Entre 30 e 70 caracteres (mais que isso o Google corta) | |
| SEO-02 | `meta description` de cada página | Entre 70 e 160 caracteres | |
| SEO-03 | `link rel="canonical"` | Aponta para a própria página no domínio oficial | |
| SEO-04 | Compartilhe o link de cada página no WhatsApp | Aparece cartão com título, descrição e imagem (Open Graph) | |
| SEO-05 | Início no [Teste de pesquisa aprimorada do Google](https://search.google.com/test/rich-results) | Dados estruturados de empresa local válidos | |
| SEO-06 | Compare títulos e descrições | Diferentes em cada página | |
| SEO-07 | Aba do navegador | Mostra o ícone do site | |
| SEO-08 | Abra `/robots.txt` e `/sitemap.xml` | Existem; o robots bloqueia `/admin/` e indica o sitemap | |
| SEO-09 | Código de `admin/index.html` | `noindex` (painel fora do Google) | |
| SEO-10 | Abra as imagens citadas nos metadados (og:image, logo do JSON-LD) | Todas existem | |

### A8. Desempenho e erros (DES, ERR)

| Nº | Como testar | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| DES-01 | F12 → Rede → recarregue e role até o fim | Até 3 MB de arquivos do site por página | |
| DES-02 | Pasta `imagens/` | Nenhuma imagem com mais de 400 KB | |
| DES-03 | Código das páginas | Imagens fora da primeira tela com `loading="lazy"` | |
| DES-04 | Tempo de carregamento | Menos de 3 s (depois de publicar, confira no [PageSpeed Insights](https://pagespeed.web.dev/)) | |
| DES-05 | Código das páginas | Estilos sem o Tailwind via CDN (AVISO: o próprio Tailwind avisa que a CDN não é para produção) | |
| ERR-01 | F12 → Console, em cada página | Nenhum erro de JavaScript | |
| ERR-02 | Idem | Nenhuma mensagem vermelha | |
| ERR-03 | F12 → Rede | Nenhum arquivo do site com erro 404 | |

### A9. Rodapé e Área Restrita (ROD, ADM)

| Nº | Como testar | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| ROD-01 | Leia o copyright | Mostra o ano atual | |
| ADM-01 | Clique em "Área Restrita" no rodapé | Abre a tela de login do painel | |

### A10. Percurso das tarefas (TAR), ensaio da Parte C

Antes de chamar os participantes, confirme que cada tarefa da Parte C é possível pelo menu do celular:

| Nº | Tarefa | Caminho esperado (celular) | ✔/✘ |
| --- | --- | --- | --- |
| TAR-02 | Descobrir se fazem chave do Onix | ☰ → Nossos Serviços → busca "onix" | |
| TAR-03 | Achar endereço e horário de sábado | ☰ → Contato | |
| TAR-04 | Pedir orçamento pelo formulário | ☰ → Contato → formulário | |
| TAR-05 | Abrir o FAQ | ☰ → FAQ | |

---

## Parte B: conferência manual

O que só uma pessoa, com aparelhos reais, consegue confirmar.

| Nº | Passo | Resultado esperado | ✔/✘ |
| --- | --- | --- | --- |
| MAN-01 | Navegue pelas 6 páginas no **Chrome, Edge e Firefox** do computador | Tudo igual nos três: menus, carrosséis, FAQ, busca, formulário | |
| MAN-02 | Navegue pelas 6 páginas num **celular Android** (Chrome) | Nada corta, nada rola para o lado, menu ☰ funciona | |
| MAN-03 | Idem num **iPhone** (Safari), se houver | Idem | |
| MAN-04 | No celular, toque em "Ligar agora" | Abre o discador com (11) 4994-2568 | |
| MAN-05 | No celular, toque no botão do WhatsApp | Abre o WhatsApp na conversa com (11) 99977-6208, com a mensagem pronta quando houver | |
| MAN-06 | No computador, toque no WhatsApp | Abre o WhatsApp Web / aplicativo | |
| MAN-07 | Envie o formulário de verdade (com o seu e-mail) | O programa de e-mail abre com tudo preenchido; ao enviar, a loja recebe | |
| MAN-08 | No celular, toque no mapa e em "Ampliar" | Abre o Google Maps com rota até a loja | |
| MAN-09 | Gire o celular (deitado) em cada página | O layout se ajusta, sem cortes | |
| MAN-10 | Leia todos os textos | Sem erros de português, informações atuais (anos de mercado, horários, serviços) | |
| MAN-11 | Olhe todas as fotos | Fotos do próprio Chaveiro Senador ou de banco de imagens livre; **nenhuma marca de outra empresa** | |
| MAN-12 | Abra o site no 4G (Wi-Fi desligado) | A página Início fica utilizável em poucos segundos | |
| MAN-13 | Aumente o zoom do navegador para 200% | O texto continua legível e nada fica sobreposto | |
| MAN-14 | Use o leitor de tela do celular (TalkBack/VoiceOver) no Início | Os botões são lidos com nome ("Abrir menu", "Fale conosco pelo WhatsApp") | |

---

## Parte C: teste de usabilidade com usuários reais

### C1. Participantes

Cinco pessoas costumam revelar a maior parte dos problemas de uso. Combine com o parceiro:

| Perfil | Quantos | Exemplo |
| --- | --- | --- |
| Cliente que já usou o chaveiro | 2 | Morador do bairro, cliente de carimbo ou cópia de chave |
| Possível cliente que nunca usou | 2 | Motorista que perdeu a chave do carro |
| Funcionário da loja | 1 | Atendente que recebe os pedidos |

Prefira variar idade e familiaridade com celular. Use o celular do próprio participante quando possível.

### C2. Antes de começar (para o facilitador)

1. Leia o termo de consentimento (C6) e peça a assinatura. Nada é gravado sem permissão.
2. Diga: *"Estamos testando o site, não você. Não existe resposta errada. Pense em voz alta: diga o que está procurando e o que está achando."*
3. Abra o site no Início e entregue o celular.
4. Leia uma tarefa por vez, em voz alta, exatamente como está abaixo. Não mostre o caminho.
5. Marque o tempo do momento em que terminou de ler até a pessoa dizer "achei" ou desistir (limite: 3 minutos).
6. Se a pessoa travar, espere. Só ajude depois de 3 minutos ou se ela pedir para desistir; então marque a tarefa como **não concluída**.

### C3. Tarefas

| Nº | O que ler para o participante | Concluída quando |
| --- | --- | --- |
| T1 | "Você está trancado do lado de fora de casa. Ligue para o chaveiro." | Toca em um botão "Ligar" (o discador abre) |
| T2 | "Você tem um Chevrolet Onix e perdeu a chave. Descubra se o Chaveiro Senador faz essa chave." | Chega à lista de chaves codificadas e encontra o Onix |
| T3 | "Você quer ir até a loja num sábado. Descubra o endereço e até que horas abre." | Diz o endereço e "16h" |
| T4 | "Peça um orçamento de troca de fechadura pelo site, sem ligar." | Preenche o formulário e o e-mail abre pronto (ou escolhe o WhatsApp com mensagem) |
| T5 | "Descubra se eles atendem no domingo." | Encontra a informação (FAQ ou horário no Contato) |
| T6 | "Mande uma mensagem de WhatsApp para a loja." | Abre o WhatsApp da loja |
| T7 | "Encontre uma dica de como cuidar da fechadura da sua casa." | Abre a página Dicas e lê uma dica |

Depois de **cada** tarefa pergunte: *"De 1 (muito difícil) a 7 (muito fácil), quão fácil foi?"* (escala SEQ).

### C4. Ao final: questionário SUS

Leia cada frase e peça uma nota de **1 (discordo totalmente) a 5 (concordo totalmente)**:

| Nº | Frase | Nota (1 a 5) |
| --- | --- | --- |
| 1 | Eu usaria este site com frequência quando precisasse de um chaveiro. | |
| 2 | Achei o site desnecessariamente complicado. | |
| 3 | Achei o site fácil de usar. | |
| 4 | Eu precisaria de ajuda de outra pessoa para usar este site. | |
| 5 | As partes do site (menu, serviços, contato) funcionam bem juntas. | |
| 6 | Achei o site confuso, com coisas fora do lugar. | |
| 7 | A maioria das pessoas aprenderia a usar este site rapidamente. | |
| 8 | Achei o site trabalhoso de usar. | |
| 9 | Eu me senti seguro(a) usando o site. | |
| 10 | Precisei aprender muitas coisas antes de conseguir usar o site. | |

**Cálculo:** nas frases ímpares (1, 3, 5, 7, 9) faça *nota − 1*; nas pares (2, 4, 6, 8, 10) faça *5 − nota*. Some tudo e multiplique por 2,5. O resultado vai de 0 a 100. **Acima de 68** é acima da média; **80 ou mais** é muito bom.

Perguntas abertas: *"O que foi mais fácil?"*, *"O que foi mais difícil ou irritante?"*, *"O que faltou no site?"*, *"Você confiaria neste chaveiro pelo site? Por quê?"*

### C5. Ficha de registro (uma por participante)

| | |
| --- | --- |
| Participante | P__ (não anote o nome) |
| Perfil | ☐ cliente ☐ possível cliente ☐ funcionário |
| Idade (faixa) | ☐ até 25 ☐ 26–45 ☐ 46–60 ☐ mais de 60 |
| Aparelho | ☐ Android ☐ iPhone ☐ computador |
| Data e facilitador | |

| Tarefa | Concluiu? (S / N / com ajuda) | Tempo (s) | Erros (caminhos errados) | Nota SEQ (1–7) | O que a pessoa disse / onde travou |
| --- | --- | --- | --- | --- | --- |
| T1 | | | | | |
| T2 | | | | | |
| T3 | | | | | |
| T4 | | | | | |
| T5 | | | | | |
| T6 | | | | | |
| T7 | | | | | |

SUS (notas 1 a 10): ___ ___ ___ ___ ___ ___ ___ ___ ___ ___ → pontuação: _____

### C6. Termo de consentimento (modelo)

> Fui convidado(a) a testar o site do Chaveiro Senador, como parte de um projeto acadêmico. Vou usar o site para realizar algumas tarefas enquanto um observador anota o que acontece. Sei que estão testando o site, e não a mim; que posso parar a qualquer momento; que meu nome não aparecerá nos resultados; e que nenhuma gravação será feita sem minha autorização.
>
> ☐ Autorizo gravação da tela (sem áudio/rosto) ☐ Não autorizo
>
> Assinatura: ______________________ Data: ___/___/______

### C7. Consolidação

| Indicador | Como calcular | Meta |
| --- | --- | --- |
| Taxa de sucesso por tarefa | Concluídas sem ajuda ÷ participantes | ≥ 80% |
| Tempo médio por tarefa | Média dos tempos das concluídas | T1 e T6 em até 30 s |
| Erros por tarefa | Média de caminhos errados | ≤ 1 |
| SEQ médio | Média das notas | ≥ 5,5 |
| SUS | Média das pontuações | ≥ 68 (meta do projeto: 80) |

Cada problema observado vira uma linha no relatório: **o que aconteceu**, **quantos participantes** passaram por isso, **gravidade** (alta: impediu a tarefa; média: atrasou; baixa: incomodou) e **o que mudar**. Problemas de gravidade alta entram como requisito refinado antes da próxima versão.

---

## Registro da execução

| | |
| --- | --- |
| Data | |
| Quem testou | |
| Versão (commit) | |
| Endereço testado | local / publicado |
| Parte A | ___ OK, ___ falhas, ___ avisos |
| Parte B | ___ de 14 passaram |
| Parte C | ___ participantes; sucesso médio ___%; SUS médio ___ |

**Falhas encontradas:**

| Nº do caso | O que aconteceu | Gravidade | Correção | Retestado? |
| --- | --- | --- | --- | --- |
| | | | | |

A execução de 28/10/2026 (Partes A e ensaio da C) está registrada em [RELATORIO-TESTES-SITE.md](RELATORIO-TESTES-SITE.md).
