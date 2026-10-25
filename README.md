# Chaveiro Senador — Site Institucional + Painel Administrativo

Site do **Chaveiro Senador** (Santo André/SP, 46 anos de mercado), com foco em SEO local, e um **painel administrativo** de uso interno com controle de estacionamento, usuários e auditoria.

- Site: [chaveirosenador.com.br](https://chaveirosenador.com.br)
- Telefone: (11) 4994-2568 · WhatsApp: (11) 99977-6208
- Endereço: Rua Senador Flaquer, 561 — Centro — Santo André/SP — CEP 09010-060

---

## Estrutura do projeto

```
├── index.html                          Só redireciona o domínio para a página inicial
├── chaveiro-em-santo-andre.html        Página inicial (carrossel dos 6 principais serviços)
├── chaveiro-santo-andre.html           Quem Somos
├── chaveiro-abc.html                   Nossos Serviços (grade 4 por linha + marcas de chave codificada com busca)
├── chaveiro-sao-bernardo-do-campo.html Contato (formulário de orçamento + mapa)
├── chaveiro-maua.html                  FAQ (sanfona)
├── chaveiro-diadema.html               Dicas (sanfona)
├── package.json                        Atalhos: npm test / npm run test:e2e
│
├── assets/
│   ├── css/site.css         Estilos próprios do site, em 15 seções numeradas (o resto é Tailwind)
│   ├── js/site.js           Notificação, menu mobile, carrosséis, formulário, FAQ, catálogo, busca de modelos
│   └── vendor/remixicon/    Ícones RemixIcon 3.5 (cópia local, funciona sem CDN)
│
├── admin/                   PAINEL ADMINISTRATIVO (área restrita, noindex)
│   ├── index.html           Login + todas as telas e modais do painel
│   ├── css/admin.css        Visual do painel, em 12 seções numeradas
│   └── js/
│       ├── nucleo/                       Regras e segurança (sem tela)
│       │   ├── seguranca.js              SHA-256, PBKDF2, comparação em tempo constante, escape, CSV seguro
│       │   ├── regras-estacionamento.js  Cálculo do valor, placa (antiga e Mercosul), formatação
│       │   ├── armazenamento.js          Leitura/gravação no localStorage e configuração padrão
│       │   ├── auditoria.js              Registro de auditoria encadeado por hash + verificação
│       │   └── sessao.js                 Login, bloqueio progressivo, sessão, perfis e permissões
│       ├── ui.js                         Avisos, modais, datas, gráficos, exportação
│       ├── telas/                        Uma tela por arquivo
│       │   ├── acesso.js                 Login e troca obrigatória de senha
│       │   ├── painel.js                 Indicadores do dia e estatísticas (Admin.Estat)
│       │   ├── patio.js                  Entrada, saída com troco e comprovante
│       │   ├── historico.js              Saídas pagas, filtros, CSV
│       │   ├── relatorios.js             Faturamento, pagamentos, horários de pico, clientes
│       │   ├── usuarios.js               Cadastro e gestão de funcionários
│       │   ├── auditoria.js              Consulta, integridade e exportação da auditoria
│       │   └── configuracoes.js          Preços, vagas, backup e restauração
│       └── app.js                        Navegação, atalhos, aviso de sessão, inicialização
│
├── imagens/                 Imagens do site (nomes otimizados para SEO, sem espaços)
├── docs/                    SEGURANCA.md e listas de palavras-chave (SEO)
├── testes/                  Testes automáticos (unitários + navegador)
└── scripts/                 push-git.ps1 / pull-git.ps1 (PowerShell)
```

## Como abrir

- **Site:** abra `index.html` (ou `chaveiro-em-santo-andre.html`) no navegador.
- **Painel:** abra `admin/index.html` (ou clique em **Área Restrita** no rodapé de qualquer página).
  - Login padrão: usuário **admin**, senha **admin** (criado automaticamente na primeira abertura).
  - Enquanto a senha padrão estiver em uso, o painel mostra um aviso amarelo com o botão **Trocar senha**. Troque logo no primeiro uso.
  - Depois, em **Usuários**, cadastre os funcionários com perfil **Operador**.

## Painel administrativo

O painel funciona como uma plataforma: menu lateral (gaveta no celular), barra superior com relógio e botão **Nova entrada**, fundo cinza claro e cartões brancos. No celular e no tablet aparece uma **barra de navegação inferior** (Painel, Pátio, Entrada, Histórico, Mais), ao alcance do polegar.

| Tela | O que faz | Administrador | Operador |
| --- | --- | --- | --- |
| Painel | Saudação, indicadores do dia (pátio e ocupação das vagas, faturamento e saídas comparados com ontem, ticket médio), gráfico dos últimos 7 dias, pagamentos do dia, veículos há mais tempo, atividades | ✔ | ✔ (só as próprias atividades) |
| Pátio | Entrada começando pela placa (reconhece cliente antigo e sugere o nome), lista colorida pelo tempo (verde/âmbar/vermelho), ordenação, saída com **cálculo de troco**, comprovante | ✔ + excluir lançamento errado | ✔ |
| Histórico | Período (Hoje, Ontem, 7/30 dias ou datas), filtro por pagamento, totais por forma de pagamento | ✔ + exportar CSV e excluir | ✔ só hoje |
| Relatórios | Faturamento por dia, formas de pagamento, entradas por horário (pico), clientes frequentes, exportar resumo | ✔ | — |
| Usuários | Cadastrar, redefinir senha, desativar, remover | ✔ | — |
| Auditoria | Consultar, verificar integridade, exportar | ✔ | — |
| Configurações | Preços com simulação, número de vagas, **backup e restauração** | ✔ | — |

Atalhos de teclado: **N** nova entrada · **/** buscar · **Esc** fechar. A sessão avisa 2 minutos antes de expirar.

**Cobrança:** R$ 5,00 até 60 min + R$ 2,00 por hora adicional iniciada (61 min = R$ 7,00). Valores e tolerância são ajustáveis em Configurações.

**Segurança e auditoria:** veja [docs/SEGURANCA.md](docs/SEGURANCA.md).

> Os dados do painel ficam no navegador do computador do estacionamento (não há servidor). Para usar em vários computadores ou ter segurança forte, o próximo passo é um back-end — detalhes em `docs/SEGURANCA.md`.

## Celular primeiro (mobile-first)

O site e o painel são pensados primeiro para o celular. Nas classes do Tailwind, o valor sem prefixo é o do celular, e `sm:` (640 px), `md:` (768 px) e `lg:` (1024 px) só **aumentam** em telas maiores. Por exemplo, `text-[1.75rem] sm:text-4xl md:text-5xl`, `py-14 md:py-24` e `text-left md:text-justify`.

| No celular | Como fica |
| --- | --- |
| Títulos e espaçamentos | Menores (títulos até ~32 px, seções com 56 px de respiro em vez de 96 px) |
| Textos longos | Alinhados à esquerda (justificado só a partir do tablet, para não abrir buracos entre as palavras) |
| Catálogo de serviços | Cartões horizontais (foto à esquerda, texto à direita): a página ficou com metade da altura |
| Chaves codificadas | Marcas recolhidas; toque no nome para ver os modelos (a busca abre as marcas encontradas) |
| Montadoras | 3 logos por linha (2 abaixo de 360 px), nomes sem cortar |
| Galeria | 2 colunas, legenda sempre visível (não existe "passar o mouse" no toque) |
| Botões e links | Área de toque de pelo menos 44 px (logo, rodapé, indicadores, "Ver detalhes") |
| Painel | Barra inferior, campos com 16 px (o iPhone não dá zoom ao tocar), filtros em 2 colunas, botões de 44 px |

Os ajustes de componentes ficam em `assets/css/site.css` (seção 15) e `admin/css/admin.css` (seção 12). Os testes conferem tudo isso a 320 e 360 px.

## Código comentado

Todo o código tem comentários em português, para facilitar a manutenção:

- **Páginas HTML:** cada página começa com um bloco que descreve sua estrutura (seções na ordem em que aparecem, scripts e estilos usados) e cada seção tem um bloco `<!-- ===== NOME DA SEÇÃO ===== -->` explicando o que contém e qual módulo do `site.js` a controla.
- **CSS:** `site.css` e `admin.css` abrem com um índice; as seções são numeradas na mesma ordem do arquivo.
- **JavaScript:** cada arquivo abre com um cabeçalho (o que faz, o que expõe em `window.Admin` ou no site) e cada função tem um comentário `/** ... */` dizendo o que faz, o que recebe e o que devolve.
- **Testes:** cada verificação tem uma descrição legível, exibida no resultado.

Como achar as coisas:

| Quero mudar... | Onde |
| --- | --- |
| Preço do estacionamento (padrão) | `admin/js/nucleo/regras-estacionamento.js` → `CONFIG_PADRAO` (ou pela tela Configurações) |
| O que cada perfil pode fazer | `admin/js/nucleo/sessao.js` → `PERMISSOES` |
| Regras de senha | `admin/js/nucleo/seguranca.js` → `validarSenhaForte` |
| Tentativas e tempos de bloqueio | `admin/js/nucleo/sessao.js` → `MAX_TENTATIVAS`, `BLOQUEIOS_MIN` |
| Ações registradas na auditoria | `admin/js/nucleo/auditoria.js` → `ACOES` |
| Cor de fundo do site | `assets/css/site.css` → seção 11 (`--fundo-pagina`, `--fundo-secao`) |
| Serviços do catálogo | `chaveiro-abc.html` → cartões `.cartao-servico` (o `id` é o link usado na home) |
| Marcas e modelos de chave codificada | `chaveiro-abc.html` → seção `#chaves-codificadas` (`data-busca` = marca + modelos sem acento) |
| Número do WhatsApp/telefone | links `wa.me/5511999776208` e `tel:+551149942568` (botão flutuante, rodapé e botões de contato) |

## Testes

```bash
node testes/testes-unitarios.js        # regras, segurança e auditoria (40 testes, sem dependências)
python testes/e2e-admin.py             # painel no navegador, inclusive no celular (68 verificações; requer Playwright)
python testes/e2e-site.py              # site público em 320/360 px e 1280 px (189 verificações)
```

## Tecnologias

HTML5 · Tailwind CSS (CDN) · JavaScript puro · RemixIcon · Google Fonts (Inter) · Schema.org (LocalBusiness, FAQPage).

## SEO

- `title`, `description`, `canonical`, Open Graph e Geo Tags em todas as páginas
- Dados estruturados Schema.org (LocalBusiness, FAQPage, horário)
- Imagens com nomes e `alt` descritivos
- Regras de texto: **não** usar "24h", "emergência", "urgente"; foco em Santo André e ABC
- Listas de palavras-chave em `docs/`
- O painel (`admin/`) tem `noindex, nofollow` e não aparece no menu

## Publicação

Qualquer hospedagem estática (Netlify, Vercel, GitHub Pages, FTP). Envie a pasta inteira mantendo a estrutura.

## Novidades de out/2026

- Seção de serviços da home virou carrossel (foto na frente, resumo e "Saiba mais"); "Saiba mais" abre e destaca o mesmo serviço no catálogo `chaveiro-abc.html`, que mostra os 15 serviços em grade (texto completo em "Ver detalhes")
- Fotos dos serviços escolhidas pelo conteúdo real da imagem (antes, por exemplo, "Reparo de Ignição" mostrava uma fechadura digital)
- Botão "Fale Conosco" do topo trocado por um **botão flutuante do WhatsApp** em todas as páginas; rodapé com botões discretos "Ligar" e "WhatsApp" (sem mostrar os números)
- Fundo do site em cinza claro (menos cansativo que o branco); cartões continuam brancos
- Botões abaixo do carrossel da home e "FALE CONOSCO" da seção de localização removidos
- Painel administrativo redesenhado como plataforma: menu lateral, indicadores, gráficos, relatórios, cálculo de troco, backup e atalhos de teclado
- Código inteiro comentado e README atualizado (veja "Código comentado")
- Catálogo de serviços com **4 cartões por linha** no computador (16º cartão: pedido de orçamento pelo WhatsApp)
- Seção de chaves codificadas reorganizada: um cartão por marca com logo, quantidade e modelos em etiquetas (ordem alfabética), **busca por modelo** que ignora acentos, 4 por linha e cartão "Não achou o seu modelo?"
- **Nenhum número de telefone aparece mais na tela**: "Telefones para contato" e o bloco "Contato" viraram botões "Ligar agora" e "Chamar no WhatsApp"; os números continuam só nos links e nos dados para o Google
- Botões do rodapé preenchidos (azul e verde), mais visíveis sem exagero
- **Revisão mobile-first** do site e do painel (veja "Celular primeiro"): páginas até 45% mais curtas no celular, sem rolagem lateral a partir de 320 px
- Seção "Solicite Seu Orçamento" removida da home; a foto de fundo dela passou para "Conveniência e Acessibilidade" (o formulário continua na página de contato)
- Páginas com nomes de cidade (SEO) e domínio chaveirosenador.com.br; canonicals corrigidos para os nomes novos e `index.html` redirecionando para a página inicial

## Limpeza feita em out/2026

- CSS: de 683 regras para só as realmente usadas (`assets/css/site.css`); o resto vem do Tailwind
- JavaScript: de ~1.800 linhas para um único `assets/js/site.js` organizado em módulos, só com o que as páginas usam
- Header, menu mobile e rodapé iguais em todas as páginas
- Corrigido: mapa do Google com códigos de exemplo (não mostrava o endereço) agora aponta para a Rua Senador Flaquer, 561; textos e botões cortados no celular, menu "hambúrguer" que sumia em telas pequenas, contador de caracteres duplicado no formulário, `<div>`s fechados a mais em `chaveiro-em-santo-andre.html` e `chaveiro-sao-bernardo-do-campo.html`
- Removidos: Font Awesome e fonte Pacifico (não eram usados), `config-imagens.js` (não era carregado) e 10 imagens sem uso
- Pastas de imagem sem espaços (`logo-site/`, `logos-carros/`)

---

Copyright © 2025–2026 Chaveiro Senador. Todos os direitos reservados.
