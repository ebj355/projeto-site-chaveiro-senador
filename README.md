# 🔑 Chaveiro Senador - Site Institucional

Site institucional otimizado para SEO do **Chaveiro Senador**, empresa com 46 anos de experiência em serviços de chaveiro em Santo André e região do ABC.

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Funcionalidades](#funcionalidades)
- [Páginas do Site](#páginas-do-site)
- [SEO e Otimizações](#seo-e-otimizações)
- [Como Usar](#como-usar)
- [Desenvolvimento](#desenvolvimento)
- [Estrutura de Arquivos](#estrutura-de-arquivos)
- [Scripts e Funcionalidades JavaScript](#scripts-e-funcionalidades-javascript)
- [Estilos CSS](#estilos-css)
- [Configuração de Imagens](#configuração-de-imagens)
- [Palavras-chave SEO](#palavras-chave-seo)
- [Contato e Informações](#contato-e-informações)

## 📋 Sobre o Projeto

Site responsivo desenvolvido com foco em **SEO Local** e **SEO Técnico**, apresentando os serviços de chaveiro residencial, automotivo e comercial oferecidos pela empresa na região do ABC Paulista.

### 🎯 Objetivos

- **SEO Local**: Otimização para buscas locais em Santo André e região do ABC
- **SEO Técnico**: Meta tags, schema.org, estrutura semântica HTML5
- **Performance**: Site rápido e responsivo
- **Conversão**: Interface moderna e profissional para gerar leads
- **Acessibilidade**: Código semântico e acessível

## 🚀 Tecnologias Utilizadas

### Frontend
- **HTML5**: Estrutura semântica e acessível
- **CSS3**: Estilização customizada com variáveis CSS
- **Tailwind CSS**: Framework CSS utilitário (via CDN)
- **JavaScript (Vanilla)**: Interatividade e funcionalidades dinâmicas
- **RemixIcon**: Biblioteca de ícones moderna
- **Font Awesome**: Biblioteca de ícones complementar
- **Google Fonts**: Tipografia (Inter, Pacifico)

### SEO e Dados Estruturados
- **Schema.org**: Dados estruturados (LocalBusiness, FAQPage)
- **Open Graph**: Metadados para redes sociais
- **Twitter Cards**: Metadados para Twitter
- **Geo Tags**: Tags de localização para SEO local

## 📁 Estrutura do Projeto

```
pagina-chaveiro/
│
├── index.html              # Página principal
├── faq.html                # Página de perguntas frequentes
├── dicas.html              # Página de dicas e orientações
├── contato.html            # Página de contato
├── nossos-servicos.html    # Página de serviços
├── quem-somos.html         # Página sobre a empresa
│
├── script.js               # JavaScript principal do site
├── config-imagens.js       # Configuração centralizada de imagens
├── styles.css              # Estilos CSS customizados
│
├── package.json            # Dependências do projeto
├── README.md               # Documentação do projeto
│
└── imagens/                # Pasta de imagens otimizadas
    ├── banner/              # Banners principais
    ├── galeria/            # Galeria de trabalhos
    ├── logo de carro/      # Logos de montadoras
    ├── nossa-visao/        # Imagens da seção "Nossa Visão"
    ├── parcerias/          # Imagens de parcerias
    ├── servicos/           # Imagens dos serviços
    ├── sobre-nos/          # Imagens sobre a empresa
    └── solicite-seu-orcamento/  # Imagens de CTA
```

## 🎨 Funcionalidades

### Seções do Site (index.html)

1. **Hero Section**: Banner principal com call-to-action
   - Logo do Chaveiro Senador
   - Título destacado "46 Anos de Experiência"
   - Card de atendimento com informações de contato

2. **Sobre Nós**: Apresentação da empresa
   - Imagem do profissional trabalhando
   - Texto sobre experiência e qualidade
   - Badges com diferenciais

3. **Serviços**: Cards de serviços com hover effect
   - Abertura de Portas Residencial
   - Chave Codificada Automotiva
   - Abertura de Veículos
   - Reparo de Ignição
   - Fechadura Digital
   - Troca de Segredo

4. **Marcas/Montadoras**: Carrossel de logos
   - 3 slides com 6 logos cada
   - Auto-play a cada 6 segundos
   - Navegação por setas e indicadores

5. **Parcerias**: Informações sobre parcerias comerciais
   - Benefícios para empresas
   - Formulário de contato para parcerias

6. **Orçamento**: Formulário de solicitação
   - Botões de contato (Telefone e WhatsApp)
   - Formulário completo com validação

7. **Localização**: Informações de contato e mapa
   - Endereço completo
   - Telefone e WhatsApp
   - Horário de funcionamento
   - Mapa do Google Maps

8. **Galeria**: Portfólio de trabalhos
   - Grid responsivo 3 colunas
   - Hover effect com overlay

### Recursos de SEO

- ✅ Meta tags otimizadas (title, description, keywords)
- ✅ Open Graph e Twitter Cards
- ✅ Schema.org (LocalBusiness, FAQPage)
- ✅ Geo tags para SEO local
- ✅ URLs canônicas
- ✅ Imagens com nomes e alt text otimizados
- ✅ Estrutura semântica (H1, H2, H3)
- ✅ Links internos otimizados
- ✅ Horário de funcionamento em Schema.org

## 📄 Páginas do Site

### 1. index.html - Página Principal
Página inicial com todas as seções principais do site, incluindo hero, serviços, marcas, parcerias, orçamento, localização e galeria.

### 2. faq.html - Perguntas Frequentes
Página com perguntas frequentes em formato de accordion interativo. Cada pergunta expande/colapsa ao clicar.

### 3. dicas.html - Dicas e Orientações
Página com dicas úteis sobre chaveiro, segurança e manutenção de fechaduras em formato de accordion.

### 4. contato.html - Formulário de Contato
Página de contato com formulários, informações de contato e seção "Por que nos escolher?".

### 5. nossos-servicos.html - Catálogo de Serviços
Página com catálogo completo de serviços em grid 3 colunas, com cards interativos e hover effects.

### 6. quem-somos.html - Sobre a Empresa
Página sobre a história, valores e experiência do Chaveiro Senador.

## 🔍 SEO e Otimizações

### Meta Tags
Todas as páginas possuem meta tags otimizadas:
- `title`: Otimizado com palavras-chave locais
- `description`: Descrição atrativa com call-to-action
- `keywords`: Palavras-chave relevantes
- `canonical`: URL canônica para evitar conteúdo duplicado

### Schema.org
Dados estruturados implementados:
- **LocalBusiness**: Informações da empresa (endereço, telefone, horário)
- **FAQPage**: Perguntas frequentes estruturadas
- **OpeningHoursSpecification**: Horário de funcionamento

### Geo Tags
Tags de localização para SEO local:
- `geo.position`: Coordenadas geográficas
- `geo.region`: Região (BR-SP)
- `geo.placename`: Cidade (Santo André)

### Otimização de Imagens
- Nomes de arquivo otimizados para SEO
- Alt text descritivo em todas as imagens
- Formato WebP para melhor performance
- Lazy loading onde aplicável

## 🛠️ Como Usar

### Instalação Local

1. Clone o repositório:
```bash
git clone https://github.com/eduabjr/projeto-site-chaveiro-senador.git
```

2. Navegue até a pasta do projeto:
```bash
cd projeto-site-chaveiro-senador
```

3. Abra o arquivo `index.html` em um navegador moderno

### Deploy

O site pode ser hospedado em qualquer serviço de hospedagem estática:
- **Netlify**: Arraste e solte a pasta do projeto
- **Vercel**: Conecte o repositório Git
- **GitHub Pages**: Ative nas configurações do repositório
- **HostGator**: Faça upload via FTP
- Outros serviços de hospedagem

## 💻 Desenvolvimento

### Estrutura de Arquivos

#### HTML
- **index.html**: Página principal com todas as seções
- **faq.html**: Página de perguntas frequentes
- **dicas.html**: Página de dicas
- **contato.html**: Página de contato
- **nossos-servicos.html**: Página de serviços
- **quem-somos.html**: Página sobre a empresa

#### JavaScript
- **script.js**: JavaScript principal com todas as funcionalidades
- **config-imagens.js**: Configuração centralizada de imagens

#### CSS
- **styles.css**: Estilos CSS customizados (complementa Tailwind CSS)

### Scripts e Funcionalidades JavaScript

#### Menu Mobile
- Toggle do menu hamburger
- Animação de abertura/fechamento
- Fechamento ao clicar em link ou fora do menu

#### Carrossel de Marcas
- Auto-play a cada 6 segundos
- Navegação por setas (anterior/próximo)
- Indicadores clicáveis
- Pausa no hover

#### Formulários
- Validação em tempo real
- Máscara de telefone automática
- Contador de caracteres em textareas
- Envio via email (mailto) ou WhatsApp
- Notificações de sucesso/erro

#### Accordion (FAQ/Dicas)
- Expansão/colapso ao clicar
- Animação suave de transição
- Ícone rotaciona ao expandir

#### Animações
- Scroll suave para âncoras
- Animações de entrada (fade-in, slide-in)
- Hover effects em cards e botões

### Estilos CSS

#### Variáveis CSS
O arquivo `styles.css` define variáveis CSS para cores, sombras e transições:
```css
:root {
    --primary-color: #2c3e50;
    --secondary-color: #34495e;
    --accent-color: #25d366;
    /* ... */
}
```

#### Componentes Estilizados
- Header fixo com menu
- Cards de serviços com hover effect
- Formulários com validação visual
- Botões com gradientes e animações
- Footer com grid responsivo

#### Responsividade
Media queries para diferentes tamanhos de tela:
- Desktop: > 1024px
- Tablet: 768px - 1024px
- Mobile: < 768px
- Mobile pequeno: < 480px

### Configuração de Imagens

O arquivo `config-imagens.js` centraliza todas as URLs de imagens:
```javascript
const IMAGENS_CONFIG = {
    header: { background: "..." },
    slider: { slide1: {...}, slide2: {...}, slide3: {...} },
    sobre: { background: "...", photos: [...] },
    galeria: [...],
    servicos: {...}
};
```

Para alterar imagens, edite o objeto `IMAGENS_CONFIG` e as imagens serão aplicadas automaticamente.

## 🔍 Palavras-chave Principais

### Primárias
- chaveiro em santo andré
- chaveiro senador
- chaveiro no abc
- chaveiro em são bernardo do campo
- chaveiro em mauá
- chaveiro em diadema
- chaveiro em são caetano do sul

### Secundárias
- serviços residenciais
- abertura de portas
- troca de fechadura
- instalação de fechadura
- chave automotiva santo andré
- chave codificada
- fechadura digital santo andré
- chaveiro comercial santo andré

## 📱 Responsividade

O site é totalmente responsivo e otimizado para:
- 📱 Dispositivos móveis (320px+)
- 📱 Tablets (768px+)
- 💻 Desktops (1024px+)
- 🖥️ Telas grandes (1440px+)

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🖼️ Otimização de Imagens

Todas as imagens foram renomeadas seguindo padrão SEO:
- Formato: `chaveiro-em-santo-andre-[descricao].jpg/webp`
- Alt text otimizado com palavras-chave
- Títulos de imagem descritivos
- Compressão para melhor performance
- Formato WebP quando possível

## 🔗 Links Importantes

- **Site**: [chaveiroseguro.com.br](https://chaveiroseguro.com.br)
- **Telefone**: (11) 4994-2568
- **WhatsApp**: (11) 99977-6208
- **Endereço**: Rua Senador Flaquer, 561 - Santo André - SP - CEP: 09010-060

## 📧 Contato

Para parcerias e informações comerciais:
- **Email**: contato@chaveirosenador.com.br

## 📝 Notas de Desenvolvimento

### Otimizações Aplicadas

- ✅ Remoção de palavras-chave negativas ("24h", "emergência", "urgente")
- ✅ Otimização de todos os textos com palavras-chave locais
- ✅ Renomeação de todas as imagens com padrão SEO
- ✅ Melhoria de meta descriptions
- ✅ Implementação de Schema.org
- ✅ Otimização de títulos e headings
- ✅ Estrutura semântica HTML5
- ✅ Acessibilidade (alt text, aria-labels)

### Regras de SEO Seguidas

- ❌ **NÃO usar**: "24h", "24 horas", "emergência", "pronto-socorro", "urgente"
- ✅ **Focar em**: SEO local para Santo André e ABC
- ✅ **Tom**: Profissional e comercial
- ✅ **Estrutura**: 1 H1 principal, H2 e H3 organizados
- ✅ **Links internos**: Navegação clara entre páginas

## 📄 Licença

Este projeto é propriedade do **Chaveiro Senador**.

## 👨‍💻 Desenvolvimento

Desenvolvido com foco em SEO local e experiência do usuário.

### Próximos Passos Sugeridos

- [ ] Implementar Google Analytics
- [ ] Adicionar Google Search Console
- [ ] Implementar sistema de blog para conteúdo SEO
- [ ] Adicionar mais dados estruturados (Review, Service)
- [ ] Otimizar ainda mais as imagens (WebP, lazy loading)
- [ ] Implementar PWA (Progressive Web App)

---

**Chaveiro Senador** - 46 anos de experiência em Santo André e região do ABC

Copyright © 2025 Chaveiro Senador - Chaveiro em Santo André com atendimento em todo ABC. Todos os direitos reservados.
