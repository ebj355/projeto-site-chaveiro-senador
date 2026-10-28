# Relatório de testes e validação: site público

Execução do [roteiro de testes do site](ROTEIRO-TESTES-SITE.md) em 28/10/2026, com correção dos defeitos encontrados e reteste.

> **Situação atual (28/10/2026, 3ª rodada): todos os pontos encontrados foram ajustados.** As 235 verificações passam sem nenhuma falha e sem nenhum aviso. Os 6 pontos que dependiam de decisão do parceiro (seção 6) foram resolvidos depois que ele confirmou o e-mail oficial `chaveirosenadorltda@outlook.com` e pediu os demais ajustes. Ficam para aplicar apenas as Partes B e C do roteiro, com aparelhos e pessoas reais (seção 7).

## 1. Identificação

| | |
| --- | --- |
| Sistema | Site institucional do Chaveiro Senador (6 páginas públicas + link para a Área Restrita) |
| Versão testada | commit `fb7bcfd` (antes) e a mesma versão com as correções deste relatório (2ª rodada) e com os ajustes pedidos pelo parceiro (3ª rodada) |
| Ambiente | Chromium (Playwright) em Linux, servido por servidor HTTP local, como numa hospedagem estática |
| Telas | 320, 360, 375, 414, 768, 1024, 1280 e 1920 px; celular simulado com toque |
| Ferramentas | `testes/e2e-navegacao.py` (Parte A do roteiro, 235 verificações) · axe-core 4.10.2 (acessibilidade WCAG 2.1 AA) · inspeção visual de capturas de tela |
| Partes executadas | **A** (completa, automática) e o ensaio das tarefas da Parte C (TAR). **B** (aparelhos reais) e **C** (usuários reais) ficam para a equipe aplicar com o parceiro: ver seção 7 |

## 2. Resumo

| Rodada | Verificações | OK | Falhas | Avisos |
| --- | --- | --- | --- | --- |
| 1ª: site como estava | 235 | 192 | **14** | 29 |
| 2ª: depois das correções | 235 | 225 | **0** | 10 |
| 3ª: depois dos ajustes pedidos pelo parceiro (seção 6) | 235 | **235** | **0** | **0** |

Os testes que já existiam no projeto foram rodados de novo depois das correções e dos ajustes (inclusive o painel, porque o Tailwind dele também deixou de vir da CDN), para garantir que nada quebrou:

| Teste | Resultado |
| --- | --- |
| `testes/e2e-site.py` (site em 320/360/1280 px) | 189 de 189 |
| `testes/testes-unitarios.js` (regras, segurança, auditoria) | 40 de 40 |
| `testes/testes-banco.js` (banco de dados e API) | 96 de 96 |
| `testes/e2e-admin.py` (painel, modo local) | 68 de 68 |
| `testes/e2e-servidor.py` (painel + servidor + banco) | 33 de 33 |

## 3. Resultado por grupo

| Grupo | Verificações | 1ª rodada (OK / falha / aviso) | 2ª rodada (OK / falha / aviso) |
| --- | --- | --- | --- |
| NAV: navegação entre páginas | 43 | 36 / 7 / 0 | 43 / 0 / 0 |
| CTT: contato | 9 | 8 / 0 / 1 | 8 / 0 / 1 |
| FRM: formulário de orçamento | 18 | 16 / 0 / 2 | 18 / 0 / 0 |
| SRV: serviços e carrosséis | 13 | 11 / 2 / 0 | 13 / 0 / 0 |
| FAQ: FAQ e Dicas | 6 | 6 / 0 / 0 | 6 / 0 / 0 |
| RSP: celular e tamanhos de tela | 24 | 19 / 2 / 3 | 22 / 0 / 2 |
| ACE: acessibilidade | 43 | 38 / 0 / 5 | 43 / 0 / 0 |
| SEO: busca no Google | 35 | 22 / 1 / 12 | 29 / 0 / 6 |
| DES: desempenho | 20 | 14 / 0 / 6 | 19 / 0 / 1 |
| ERR: erros no navegador | 18 | 18 / 0 / 0 | 18 / 0 / 0 |
| ROD, ADM: rodapé e Área Restrita | 2 | 1 / 1 / 0 | 2 / 0 / 0 |
| TAR: percurso das tarefas de usabilidade | 4 | 3 / 1 / 0 | 4 / 0 / 0 |

O que funcionou desde a 1ª rodada: todos os links internos e âncoras, botões de ligar e de WhatsApp (mesmo número em 18 links), endereço e horário iguais em todas as páginas, mapa, todas as validações do formulário (inclusive proteção contra código malicioso), busca de chaves codificadas (ignora acentos), FAQ e Dicas (28 perguntas, também pelo teclado), nenhum erro de JavaScript e nenhum arquivo faltando.

## 4. Defeitos encontrados e corrigidos

| Nº | Caso | Defeito | Gravidade | Correção | Onde |
| --- | --- | --- | --- | --- | --- |
| D1 | NAV-02b, TAR-05 | FAQ e Dicas não estavam no menu do topo nem no menu do celular; só eram achados no rodapé, no fim da página | Alta: o visitante do celular dificilmente encontra o FAQ | Menu do topo e do celular com as 6 páginas | 6 páginas HTML |
| D2 | NAV-06 | O menu não mostrava em qual página o visitante estava (havia `aria-current` em 4 páginas, sem nenhum efeito visual; FAQ e Dicas nem tinham) | Média | Página atual em amarelo e sublinhada no computador e com fundo destacado no celular; `aria-current` nas 6 | HTML + `site.css` seção 16 |
| D3 | SRV-09, SRV-10 | Carrossel de serviços do Início: a seta "próximo" pulava a última página (cartão "ver todos os serviços") e a seta "anterior" travava no meio | Média: parte do carrossel ficava inalcançável pelas setas | Página atual calculada pela posição dos cartões; última página sempre alcançável | `assets/js/site.js` (Carrosseis) |
| D4 | RSP-01 | Em tablets de 768 px o Início e Nossos Serviços rolavam 8 px para o lado: as setas do carrossel de montadoras saíam da moldura | Média | Setas só saem da moldura a partir de 1024 px | Início e Nossos Serviços |
| D5 | RSP-06 | Em telas de 1024 px o último item do menu ("Contato") ficava cortado, já com 4 itens | Média | Espaçamento próprio para o menu do topo; os 6 itens cabem de 1024 a 1920 px | `site.css` |
| D6 | SEO-10 | Metadados apontavam para imagens inexistentes (`og-image.jpg` e `logo.jpg`): o link compartilhado no WhatsApp ou Facebook saía sem imagem | Média | Apontam para o banner e o logo que existem no site | Início |
| D7 | ROD-01 | Copyright com o ano 2025 | Baixa | O ano é preenchido sozinho com o ano atual | 6 páginas + `site.js` (AnoAtual) |

## 5. Melhorias aplicadas (avisos resolvidos)

| Caso | Antes | Depois |
| --- | --- | --- |
| FRM-14 | Após o envio, o aviso dizia "Formulário enviado com sucesso!", mas o site só abre o programa de e-mail do visitante; se ele não tocar em Enviar, nada chega à loja | "Abrimos o seu e-mail com a mensagem pronta: é só tocar em Enviar. Se preferir, chame no WhatsApp." |
| FRM-15 | O e-mail chegava com o código do serviço ("manutencao", "chaves-automotivas") | Chega com o nome da lista ("Manutenção", "Chaves Automotivas") |
| ACE-01 | 8 textos com contraste insuficiente (amarelo sobre fundo claro, com contraste de 1,4 a 1,6 para 4,5 exigidos; texto branco sobre amarelo e sobre verde) | Tons mais escuros (amarelo 800, verde 700) e texto escuro no botão amarelo: 0 violações graves nas 6 páginas |
| ACE-07 | O carrossel de montadoras girava sozinho mesmo com "reduzir movimento" ligado no aparelho | Respeita a preferência (as setas continuam funcionando) |
| ACE-08 | No Início, o título "Atendimento rápido" pulava do H1 para H3 | Virou H2 (mesma aparência) |
| RSP-04 | Nomes das montadoras com 11,2 px no celular | 12 px |
| SEO-04 | Só o Início tinha cartão de compartilhamento (Open Graph) | As 6 páginas |
| SEO-08 | Sem `robots.txt` e `sitemap.xml` | Criados; o robots tira `/admin/`, `/servidor/`, `/testes/` e `/docs/` das buscas |
| DES-01, DES-02 | Logos de montadoras de até 3840×2160 px (Jeep com 673 KB), foto de 1 MB, fundo de 946 KB: o Início baixava 5,5 MB | Logos reduzidos para 400 px, foto e fundo recomprimidos sem perda visível: o Início caiu para 1,0 MB e Nossos Serviços de 2,8 para 0,9 MB |
| DES-03 | 26 imagens no Início (e outras nas demais páginas) carregavam mesmo fora da tela | Todas as imagens de conteúdo com `loading="lazy"` |
| Texto | Contato: "Precisa de ajuda? procure um chaveiro especializado no abc" | "Precisa de ajuda? Procure um chaveiro especializado no ABC." |

## 6. Pendências levadas ao parceiro: todas ajustadas

Pontos que funcionavam, mas dependiam de decisão do dono do negócio ou de mudança maior. Ficaram como **aviso** na 2ª rodada (10 avisos). O parceiro confirmou o e-mail oficial e pediu que o resto fosse ajustado. **Todos foram ajustados e retestados na 3ª rodada (0 avisos).**

| Nº | Caso | Situação encontrada | Status | O que foi feito |
| --- | --- | --- | --- | --- |
| P1 | CTT-07 | O botão "Iniciar Parceria" usava `contato@chaveirosenador.com.br`, e o formulário enviava para `chaveirosenadorltda@outlook.com` | ✔ **Ajustado** | O parceiro confirmou que o oficial é **chaveirosenadorltda@outlook.com**; o botão de parceria passou a usá-lo. Agora há um único e-mail no site |
| P2 | (inspeção visual) | A foto de fundo de "Solicite Seu Orçamento" (Contato, e "Conveniência e Acessibilidade" no Início) trazia o logotipo de outra empresa, o "Instituto Santec" | ✔ **Ajustado** | A foto foi recortada para mostrar só a máquina de cópia de chaves e as mãos do chaveiro, sem o logotipo. Quando houver uma foto da própria loja, basta substituir o arquivo `imagens/solicite-seu-orcamento/chaveiro-em-santo-andre-solicite-seu-orcamento.webp` |
| P3 | RSP-08 | No celular, o botão "Ligar" do Início só aparecia depois de rolar (o WhatsApp flutuante aparece logo) | ✔ **Ajustado** | Botão **"Ligar agora"** logo abaixo do título do Início, visível sem rolar no celular e no tablet (no computador o cartão ao lado já mostrava o botão) |
| P4 | SEO-01, SEO-02 | 3 títulos com mais de 70 caracteres e 3 descrições com mais de 160 (a do Início tinha 305): o Google corta | ✔ **Ajustado** | Títulos do Início (69), Quem Somos (54) e FAQ (60) e descrições do Início (145), Quem Somos (145) e Serviços (152) reescritos, mantendo "chaveiro em Santo André" e "ABC". Os cartões de compartilhamento acompanham os novos textos |
| P5 | DES-05 | O site dependia do Tailwind pela CDN, que o próprio Tailwind desaconselha para produção | ✔ **Ajustado** | O CSS passou a ser gerado uma vez, só com as classes usadas (`npm run build:css`): `assets/css/tailwind.css` com 26 KB e `admin/css/tailwind.css` com 10 KB, no lugar de um script de cerca de 400 KB que montava o CSS no navegador a cada visita. A comparação de capturas antes e depois mostrou as páginas iguais. O painel ficou com a política de segurança mais restrita (só scripts do próprio site) |
| P6 | RSP-03 | As bolinhas dos carrosséis no celular tinham menos de 24 px de área de toque | ✔ **Ajustado** | Cada bolinha (carrossel de serviços e de montadoras) virou um botão de 24×24 px; o desenho continua o mesmo |

## 7. Próximos passos: Partes B e C

As Partes B e C do roteiro exigem pessoas e aparelhos reais e não podem ser simuladas:

1. **Parte B (14 passos):** conferir no Chrome, Edge e Firefox, num Android e num iPhone, se o discador, o WhatsApp, o e-mail e o mapa abrem de verdade, e revisar textos e fotos.
2. **Parte C (usabilidade):** aplicar as 7 tarefas e o questionário SUS com 5 participantes indicados pelo parceiro (2 clientes, 2 possíveis clientes, 1 funcionário), registrar nas fichas e consolidar pelos indicadores da seção C7 do roteiro.

O ensaio automático das tarefas (TAR) confirmou que, depois das correções, todas são possíveis pelo menu do celular em até 2 toques. Antes, a tarefa de achar o FAQ falhava (D1). A tarefa T1 (ligar para a loja) agora tem o botão "Ligar agora" à vista logo ao abrir o site no celular (P3).

Para registrar a Parte C, acrescente ao fim deste relatório:

| Tarefa | Sucesso (%) | Tempo médio (s) | Erros médios | SEQ médio | Principais problemas observados |
| --- | --- | --- | --- | --- | --- |
| T1 Ligar | | | | | |
| T2 Chave do Onix | | | | | |
| T3 Endereço e sábado | | | | | |
| T4 Orçamento | | | | | |
| T5 Domingo | | | | | |
| T6 WhatsApp | | | | | |
| T7 Dica | | | | | |
| **SUS médio** | | | | | |

## 8. Requisitos refinados

Requisitos que passaram a valer para o site depois desta validação (cada um é conferido pelo caso indicado):

| Código | Requisito | Caso |
| --- | --- | --- |
| RF-01 | O menu do topo e o do celular dão acesso às 6 páginas e destacam a página atual | NAV-02b, NAV-06 |
| RF-02 | Os carrosséis alcançam todos os cartões pelas setas, pelo teclado e pelo toque | SRV-09, SRV-10 |
| RF-03 | Após o formulário, o aviso diz ao visitante o que ainda falta fazer (tocar em Enviar no e-mail) | FRM-14 |
| RF-04 | O e-mail do formulário traz o nome legível do serviço | FRM-15 |
| RNF-01 | Nenhuma página rola para o lado entre 320 e 1920 px, e o menu cabe inteiro a partir de 1024 px | RSP-01, RSP-06 |
| RNF-02 | Contraste de cores no nível AA da WCAG 2.1 (0 violações graves no axe) | ACE-01 |
| RNF-03 | Movimentos automáticos param quando o aparelho pede "reduzir movimento" | ACE-07 |
| RNF-04 | Nenhuma imagem acima de 400 KB; páginas com até 3 MB; imagens fora da tela com carregamento sob demanda | DES-01 a DES-03 |
| RNF-05 | Metadados (Open Graph, JSON-LD) só citam arquivos que existem; `robots.txt` e `sitemap.xml` publicados | SEO-04, SEO-08, SEO-10 |
| RF-05 | O site usa um único e-mail de contato: chaveirosenadorltda@outlook.com | CTT-07 |
| RF-06 | No celular, "Ligar" e "WhatsApp" ficam à vista ao abrir o Início, sem rolar | RSP-07, RSP-08 |
| RNF-06 | Títulos com até 70 caracteres e descrições com até 160, em todas as páginas | SEO-01, SEO-02 |
| RNF-07 | Estilos servidos pelo próprio site (Tailwind gerado com `npm run build:css`), sem CDN | DES-05 |
| RNF-08 | Botões e bolinhas tocáveis com no mínimo 24×24 px | RSP-03 |
| RNF-09 | Nenhuma imagem do site mostra marca de outra empresa | MAN-11 (Parte B) |

## 9. Evidências

- Saída completa da execução: `testes/capturas/resultado-navegacao.json` (gerado a cada `python testes/e2e-navegacao.py`).
- Capturas de tela das 6 páginas a 375 px e 1280 px: `testes/capturas/site-*.png`.
- A pasta `testes/capturas/` fica fora do Git (`.gitignore`); rode o script para gerá-la de novo.
