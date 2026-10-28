"""
=====================================================================
ROTEIRO DE TESTES DO SITE PÚBLICO - EXECUÇÃO AUTOMÁTICA
=====================================================================
Executa, num navegador real (Chromium via Playwright), os casos da
Parte A de docs/ROTEIRO-TESTES-SITE.md. Cada linha impressa traz o
código do caso (NAV-01, FRM-03...), o resultado e o detalhe.

Executar (na pasta do projeto):
    python testes/e2e-navegacao.py

Requer, uma vez: pip install playwright  e  python -m playwright install chromium
Opcional: axe-core para o teste automático de acessibilidade
    (npm i axe-core e AXE=caminho/axe.min.js, ou deixe em node_modules/).

Resultados:
    OK     o caso passou
    FALHA  defeito: o site não faz o que o roteiro espera
    AVISO  funciona, mas há melhoria recomendada (não reprova)
Gera testes/capturas/resultado-navegacao.json e capturas de tela.
O site é servido por um servidor HTTP local (como numa hospedagem).
=====================================================================
"""
import functools, http.server, json, os, re, socketserver, sys, threading, time, urllib.parse
from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAPTURAS = os.path.join(RAIZ, 'testes', 'capturas')
os.makedirs(CAPTURAS, exist_ok=True)

PAGINAS = {  # arquivo -> (nome no menu, H1 esperado)
    'chaveiro-em-santo-andre': ('Início', 'Chaveiro com 46 Anos'),
    'chaveiro-santo-andre': ('Quem Somos', 'Sobre Nós'),
    'chaveiro-abc': ('Nossos Serviços', 'Nossos Serviços'),
    'chaveiro-sao-bernardo-do-campo': ('Contato', 'Fale Conosco'),
    'chaveiro-maua': ('FAQ', 'Perguntas Frequentes'),
    'chaveiro-diadema': ('Dicas', 'Dicas'),
}
TEL = 'tel:+551149942568'
WPP = '5511999776208'
LARGURAS = [320, 360, 375, 414, 768, 1024, 1280, 1920]

# ---------------------------------------------------------------- resultados
resultados = []
def registrar(cid, desc, status, detalhe=''):
    resultados.append({'id': cid, 'descricao': desc, 'status': status, 'detalhe': str(detalhe)[:300]})
    print(f'{status:<6} {cid:<7} {desc}' + (f'  [{detalhe}]' if detalhe else ''), flush=True)
def chk(cid, desc, cond, detalhe='', aviso=False):
    registrar(cid, desc, 'OK' if cond else ('AVISO' if aviso else 'FALHA'), '' if cond else detalhe)

# ---------------------------------------------------------------- servidor local
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class Servidor(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    def handle_error(self, *a):  # navegador fechou a página no meio do download: não é erro do site
        if not isinstance(sys.exc_info()[1], (BrokenPipeError, ConnectionResetError)): super().handle_error(*a)
srv = Servidor(('127.0.0.1', 0), functools.partial(Silencioso, directory=RAIZ))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/'
url = lambda n: BASE + n + '.html'

AXE = os.environ.get('AXE') or next((c for c in [os.path.join(RAIZ, 'node_modules/axe-core/axe.min.js')] if os.path.exists(c)), None)

opcoes = {'executable_path': os.environ['CHROMIUM']} if os.environ.get('CHROMIUM') else {}
if os.environ.get('HTTPS_PROXY'): opcoes['proxy'] = {'server': os.environ['HTTPS_PROXY'], 'bypass': '127.0.0.1'}

def novo_contexto(nav, largura=1280, altura=800, **kw):
    ctx = nav.new_context(ignore_https_errors=True, viewport={'width': largura, 'height': altura}, **kw)
    if os.environ.get('TAILWIND_LOCAL'):
        ctx.route('https://cdn.tailwindcss.com**', lambda r: r.fulfill(path=os.environ['TAILWIND_LOCAL'], content_type='application/javascript'))
    if os.environ.get('SEM_EXTERNOS'):  # para rodar sem internet: corta fontes e mapa
        ctx.route(re.compile(r'https://(fonts|www\.google|maps)'), lambda r: r.abort())
    return ctx

def abrir(ctx, n, espera=900):
    pg = ctx.new_page()
    pg.erros_js, pg.console_erros, pg.falhas, pg.navs = [], [], [], []
    pg.on('pageerror', lambda e: pg.erros_js.append(str(e)))
    pg.on('console', lambda m: pg.console_erros.append(m.text) if m.type == 'error' else None)
    pg.on('requestfailed', lambda r: pg.falhas.append(r.url) if r.url.startswith(BASE) else None)
    pg.on('response', lambda r: pg.falhas.append(f'{r.status} {r.url}') if r.url.startswith(BASE) and r.status >= 400 else None)
    cdp = ctx.new_cdp_session(pg); cdp.send('Page.enable')
    cdp.on('Page.frameRequestedNavigation', lambda e: pg.navs.append(e['url']))
    pg.goto(url(n) if not n.startswith('http') else n, wait_until='load'); pg.wait_for_timeout(espera)
    return pg

def h1(pg):
    return ' '.join(pg.locator('h1').first.inner_text().split()) if pg.locator('h1').count() else ''

inicio = time.time()
with sync_playwright() as p:
    nav = p.chromium.launch(**opcoes)

    # ================================================================ 1. NAVEGAÇÃO
    ctx = novo_contexto(nav)
    pg = abrir(ctx, 'index')
    chk('NAV-01', 'index.html (domínio) redireciona para a página inicial', pg.url.endswith('chaveiro-em-santo-andre.html'), pg.url)
    pg.close()

    for n, (nome, titulo) in PAGINAS.items():
        pg = abrir(ctx, n)
        # Menu superior (computador)
        links = pg.locator('header nav a')
        destinos = [links.nth(i).get_attribute('href') for i in range(links.count())]
        erros = []
        for i, d in enumerate(destinos):
            pg.goto(url(n)); pg.wait_for_timeout(200)
            pg.locator('header nav a').nth(i).click(); pg.wait_for_load_state('load')
            alvo = d.split('#')[0].replace('.html', '')
            if not pg.url.split('#')[0].endswith(d.split('#')[0]) or PAGINAS.get(alvo, ('', '~'))[1] not in h1(pg):
                erros.append(f'{d} -> {pg.url} / H1 "{h1(pg)}"')
        chk('NAV-02', f'{nome}: os {len(destinos)} links do menu superior abrem a página certa', destinos and not erros, erros)
        faltam = [x for x in ('chaveiro-maua.html', 'chaveiro-diadema.html') if x not in destinos]
        if n == 'chaveiro-em-santo-andre':
            chk('NAV-02b', 'Menu superior dá acesso a todas as 6 páginas (FAQ e Dicas incluídas)', not faltam, f'faltam no menu: {faltam}')
        # Logo
        pg.goto(url(n)); pg.wait_for_timeout(200)
        pg.locator('header a[href="chaveiro-em-santo-andre.html"]').first.click(); pg.wait_for_load_state('load')
        chk('NAV-03', f'{nome}: logo/nome no topo volta para o Início', pg.url.endswith('chaveiro-em-santo-andre.html'), pg.url)
        # Rodapé
        pg.goto(url(n)); pg.wait_for_timeout(200)
        rod = pg.locator('footer a[href$=".html"]:not([href^="admin"])')
        hrefs = sorted(set(rod.nth(i).get_attribute('href') for i in range(rod.count())))
        erros = []
        for d in hrefs:
            pg.goto(url(n)); pg.wait_for_timeout(150)
            pg.locator(f'footer a[href="{d}"]').first.click(); pg.wait_for_load_state('load')
            if not pg.url.endswith(d): erros.append(d)
        chk('NAV-05', f'{nome}: links rápidos do rodapé ({len(hrefs)}) abrem as páginas certas', len(hrefs) == 6 and not erros, f'{hrefs} {erros}')
        # Página atual indicada no menu
        pg.goto(url(n)); pg.wait_for_timeout(200)
        atual = pg.locator(f'header nav a[href="{n}.html"][aria-current="page"]')
        destaque = atual.count() == 1 and atual.evaluate("a=>getComputedStyle(a).color") != pg.locator(f'header nav a:not([aria-current])').first.evaluate("a=>getComputedStyle(a).color")
        chk('NAV-06', f'{nome}: o menu mostra em qual página o visitante está (destaque + aria-current)', destaque, 'página não aparece/destacada no menu superior')
        # Cabeçalho fixo
        pg.mouse.wheel(0, 2500); pg.wait_for_timeout(300)
        topo = pg.evaluate("document.querySelector('header').getBoundingClientRect().top")
        chk('NAV-13', f'{nome}: cabeçalho continua visível ao rolar a página', abs(topo) < 2, topo)
        pg.close()

    # Botão voltar
    pg = abrir(ctx, 'chaveiro-em-santo-andre')
    pg.locator('header nav a[href="chaveiro-abc.html"]').click(); pg.wait_for_load_state('load')
    pg.go_back(); pg.wait_for_load_state('load')
    chk('NAV-09', 'Botão Voltar do navegador retorna à página anterior', pg.url.endswith('chaveiro-em-santo-andre.html'), pg.url)
    # Saiba mais dos 6 serviços da home
    ids = pg.evaluate("[...document.querySelectorAll('#services a.servico-link')].map(a=>a.getAttribute('href'))")
    erros = []
    for href in ids:
        pg.goto(url('chaveiro-em-santo-andre')); pg.wait_for_timeout(300)
        pg.evaluate(f"document.querySelector('#services a.servico-link[href=\"{href}\"]').click()"); pg.wait_for_timeout(1200)
        alvo = href.split('#')[1]
        ok = pg.url.endswith(href) and pg.evaluate(f"(()=>{{const c=document.getElementById('{alvo}');if(!c)return false;const r=c.getBoundingClientRect();return c.querySelector('details').open && r.top<innerHeight && r.bottom>0}})()")
        if not ok: erros.append(href)
    chk('NAV-10', f'"Saiba mais" dos {len(ids)} serviços da home abre o serviço no catálogo, visível e com detalhes abertos', len(ids) == 6 and not erros, erros)
    pg.close()

    # Varredura de links: todas as páginas, todos os href internos
    quebrados, externos, sem_noopener, grafo = [], [], [], {}
    for n in PAGINAS:
        pg = abrir(ctx, n, 300)
        ls = pg.evaluate("[...document.querySelectorAll('a[href]')].map(a=>({h:a.getAttribute('href'),t:a.target,r:a.rel,txt:(a.innerText||a.getAttribute('aria-label')||'').trim().slice(0,40)}))")
        grafo[n] = set()
        for l in ls:
            h = l['h']
            if h.startswith(('http', 'mailto:', 'tel:')):
                externos.append((n, l))
                if l['t'] == '_blank' and 'noopener' not in l['r']: sem_noopener.append(f'{n}: {h[:50]}')
                continue
            arq, _, ancora = h.partition('#')
            arq = arq or n + '.html'
            caminho = os.path.join(RAIZ, urllib.parse.unquote(arq))
            if not os.path.exists(caminho): quebrados.append(f'{n}: {h}'); continue
            if arq.endswith('.html') and not arq.startswith('admin'): grafo[n].add(arq[:-5])
            if ancora:
                with open(caminho, encoding='utf-8') as f:
                    if f'id="{ancora}"' not in f.read(): quebrados.append(f'{n}: {h} (âncora inexistente)')
        pg.close()
    chk('NAV-08', f'Nenhum link interno quebrado (arquivos e âncoras) nas 6 páginas', not quebrados, quebrados)
    chk('NAV-14', 'Links que abrem nova aba usam rel="noopener"', not sem_noopener, sem_noopener)
    # Distância em cliques a partir da home
    dist, fila = {'chaveiro-em-santo-andre': 0}, ['chaveiro-em-santo-andre']
    while fila:
        a = fila.pop(0)
        for b in grafo.get(a, ()):
            if b not in dist: dist[b] = dist[a] + 1; fila.append(b)
    chk('NAV-07', 'Todas as páginas são alcançáveis em até 2 cliques a partir do Início', all(dist.get(n, 9) <= 2 for n in PAGINAS), dist)

    # ================================================================ 2. CONTATO
    tels = sorted(set(l['h'] for _, l in externos if l['h'].startswith('tel:')))
    chk('CTT-01', 'Todos os botões "Ligar" usam o mesmo número da loja', tels == [TEL], tels)
    wpps = [l['h'] for _, l in externos if 'wa.me' in l['h']]
    chk('CTT-02', f'Todos os {len(wpps)} links de WhatsApp usam o número {WPP} e abrem em nova aba',
        wpps and all(f'wa.me/{WPP}' in h for h in wpps) and all(l['t'] == '_blank' for _, l in externos if 'wa.me' in l['h']), wpps)
    msgs = sorted(set(urllib.parse.unquote(h.split('text=')[1]) for h in wpps if 'text=' in h))
    chk('CTT-02b', 'Mensagens prontas do WhatsApp chegam legíveis (acentos corretos)', all('Olá' in m for m in msgs), msgs)
    mails = sorted(set(l['h'].split('?')[0] for _, l in externos if l['h'].startswith('mailto:')))
    with open(os.path.join(RAIZ, 'assets/js/site.js'), encoding='utf-8') as f:
        destino_form = re.search(r"EMAIL_DESTINO:\s*'([^']+)'", f.read()).group(1)
    chk('CTT-07', 'Um único e-mail de contato no site (link de parceria = destino do formulário)', all(m == 'mailto:' + destino_form for m in mails),
        f'parceria {mails} x formulário {destino_form}', aviso=True)
    enderecos, horarios = {}, {}
    for n in PAGINAS:
        pg = abrir(ctx, n, 200)
        txt = ' '.join(pg.inner_text('body').split())
        enderecos[n] = ('Senador Flaquer, 561' in txt, '09010-060' in txt)
        if 'Segunda a Sexta' in txt: horarios[n] = re.findall(r'Segunda a Sexta:? ?[^S]{0,20}|Sábado:? ?\S+ às \S+', txt)
        flut = pg.locator('a.whatsapp-flutuante')
        if not (flut.count() == 1 and flut.is_visible() and 'wa.me' in flut.get_attribute('href')):
            enderecos[n] = (False, 'sem WhatsApp flutuante')
        pg.close()
    chk('CTT-03', 'Botão flutuante do WhatsApp em todas as páginas', all(v[1] != 'sem WhatsApp flutuante' for v in enderecos.values()), enderecos)
    chk('CTT-04', 'Endereço e CEP da loja presentes e iguais em todas as páginas (rodapé)', all(v == (True, True) for v in enderecos.values()), enderecos)
    chk('CTT-05', 'Horário de funcionamento igual em todas as páginas que o mostram', len(set(json.dumps(v) for v in horarios.values())) <= 1, horarios)
    pg = abrir(ctx, 'chaveiro-sao-bernardo-do-campo', 2500)
    src = pg.get_attribute('iframe', 'src') or ''
    chk('CTT-06', 'Mapa do Google aponta para Rua Senador Flaquer, 561 e tem título acessível',
        'Senador+Flaquer,+561' in src and pg.get_attribute('iframe', 'title'), src)
    pg.locator('iframe').scroll_into_view_if_needed(); pg.wait_for_timeout(2500)
    carregou = any('google.com/maps' in f.url for f in pg.frames)
    chk('CTT-08', 'Mapa carrega na página de Contato', carregou, 'sem acesso ao Google (rodar com internet)', aviso=True)
    pg.screenshot(path=os.path.join(CAPTURAS, 'site-contato-1280.png'), full_page=True)
    pg.close()

    # ================================================================ 3. FORMULÁRIO
    def form(pg, nome='João da Silva', email='joao@email.com', tel='11999776208', serv='manutencao', msg='Preciso trocar o segredo da fechadura.'):
        pg.fill('#cta-name', nome); pg.fill('#cta-email', email); pg.fill('#cta-phone', ''); pg.type('#cta-phone', tel)
        pg.select_option('#cta-service', serv); pg.fill('#cta-message', msg)
    def enviar(pg):
        pg.navs.clear(); pg.evaluate("document.querySelector('.notification')?.remove()")
        pg.click('#cta-contact-form button[type=submit]'); pg.wait_for_timeout(400)
        aviso = pg.inner_text('.notification-message') if pg.locator('.notification-message').count() else ''
        invalido = pg.evaluate("(document.querySelector('#cta-contact-form :invalid')||{}).id||''")
        return aviso, invalido, [u for u in pg.navs if u.startswith('mailto:')]

    pg = abrir(ctx, 'chaveiro-sao-bernardo-do-campo', 300)
    rotulos = pg.evaluate("['cta-name','cta-email','cta-phone','cta-service','cta-message'].filter(id=>!document.querySelector('label[for='+id+']'))")
    chk('FRM-01', 'Cada campo do formulário tem rótulo (label) ligado a ele', not rotulos, rotulos)
    av, inv, m = enviar(pg)
    chk('FRM-02', 'Enviar vazio é bloqueado e indica o 1º campo obrigatório (Nome)', not m and inv == 'cta-name', (av, inv))
    form(pg, nome='Jo'); av, inv, m = enviar(pg)
    chk('FRM-03', 'Nome com 2 letras: "Informe seu nome completo."', not m and av == 'Informe seu nome completo.', (av, inv))
    for ruim in ('joao@', 'joao.email.com', 'joao@email'):
        form(pg, email=ruim); av, inv, m = enviar(pg)
        chk('FRM-04', f'E-mail inválido "{ruim}" é recusado', not m and (inv == 'cta-email' or 'e-mail' in av), (av, inv))
    form(pg, tel='1199977'); av, inv, m = enviar(pg)
    chk('FRM-05', 'Telefone incompleto: "Informe um telefone com DDD."', not m and av == 'Informe um telefone com DDD.', (av, inv))
    pg.fill('#cta-phone', ''); pg.type('#cta-phone', '11999776208'); cel = pg.input_value('#cta-phone')
    pg.fill('#cta-phone', ''); pg.type('#cta-phone', '1149942568'); fixo = pg.input_value('#cta-phone')
    chk('FRM-06', 'Máscara de telefone: celular (11) 99977-6208 e fixo (11) 4994-2568', (cel, fixo) == ('(11) 99977-6208', '(11) 4994-2568'), (cel, fixo))
    pg.fill('#cta-phone', ''); pg.type('#cta-phone', '11abc9999-77620899'); v = pg.input_value('#cta-phone')
    chk('FRM-07', 'Telefone ignora letras e limita a 11 dígitos', v == '(11) 99997-7620', v)
    form(pg, serv=''); av, inv, m = enviar(pg)
    chk('FRM-08', 'Sem serviço selecionado o envio é bloqueado', not m and (inv == 'cta-service' or 'serviço' in av), (av, inv))
    form(pg, msg='oi'); av, inv, m = enviar(pg)
    chk('FRM-09', 'Mensagem curta: "Escreva uma mensagem."', not m and av == 'Escreva uma mensagem.', (av, inv))
    pg.fill('#cta-message', ''); pg.type('#cta-message', 'x' * 520, delay=0)
    n_cars, cont, cor = len(pg.input_value('#cta-message')), pg.inner_text('#cta-charCount'), pg.evaluate("getComputedStyle(document.getElementById('cta-charCount')).color")
    chk('FRM-10', 'Mensagem limitada a 500 caracteres; contador mostra 500 em vermelho', n_cars == 500 and cont == '500' and cor == 'rgb(220, 53, 69)', (n_cars, cont, cor))
    form(pg); av, inv, m = enviar(pg)
    corpo = urllib.parse.unquote(m[0]) if m else ''
    chk('FRM-11', 'Envio válido abre o e-mail para a loja com nome, telefone, e-mail, serviço e mensagem',
        m and corpo.startswith('mailto:' + destino_form) and all(x in corpo for x in ('João da Silva', '(11) 99977-6208', 'joao@email.com', 'segredo da fechadura')), corpo[:120])
    servico_legivel = 'Manutenção' in corpo
    chk('FRM-15', 'No e-mail, o serviço aparece com o nome legível ("Manutenção", não "manutencao")', servico_legivel, re.findall(r'Servi\S+ Desejado: \S+', corpo), aviso=True)
    vazio = pg.evaluate("['cta-name','cta-email','cta-phone','cta-service','cta-message'].every(id=>!document.getElementById(id).value)")
    chk('FRM-12', 'Após o envio: aviso na tela e formulário limpo (contador volta a 0)', av and vazio and pg.inner_text('#cta-charCount') == '0', (av, vazio))
    chk('FRM-14', 'Aviso não afirma "enviado" quando só abre o programa de e-mail do visitante', 'enviado com sucesso' not in av.lower(), av, aviso=True)
    pg.wait_for_timeout(5200)
    chk('FRM-12b', 'O aviso some sozinho em até 5 segundos', pg.locator('.notification').count() == 0)
    form(pg, nome='<img src=x onerror="window.__xss=1">Ana')
    enviar(pg); pg.wait_for_timeout(300)
    chk('FRM-13', 'Texto com HTML/JavaScript no formulário não é executado (sem XSS)', not pg.evaluate('window.__xss') and not pg.erros_js)
    pg.close()

    # ================================================================ 4. SERVIÇOS, CARROSSÉIS, FAQ
    pg = abrir(ctx, 'chaveiro-abc', 500)
    cart = pg.evaluate("[...document.querySelectorAll('.grade-servicos .cartao-servico[id]')].map(c=>({id:c.id,img:!!c.querySelector('img'),t:!!c.querySelector('h2,h3,h4'),d:!!c.querySelector('details')}))")
    chk('SRV-01', f'Catálogo: {len(cart)} serviços, todos com foto, título e "Ver detalhes"', len(cart) == 15 and all(c['img'] and c['t'] and c['d'] for c in cart), [c for c in cart if not all(c.values())][:3])
    pg.locator('.grade-servicos details summary').first.click(); a = pg.evaluate("document.querySelector('.grade-servicos details').open")
    pg.locator('.grade-servicos details summary').first.click(); f_ = pg.evaluate("document.querySelector('.grade-servicos details').open")
    chk('SRV-02', '"Ver detalhes" abre e fecha a descrição do serviço', a and not f_)
    casos = [('onix', 'Chevrolet', 1), ('MÉGANE', 'Renault', 1), ('fiat', 'Fiat', 1), ('hb20', 'Hyundai', 1)]
    for termo, marca, n_ in casos:
        pg.fill('#busca-modelo', termo); pg.wait_for_timeout(150)
        vis = pg.locator('.marca-chave[data-busca]:visible')
        chk('SRV-03', f'Busca de chave codificada "{termo}" encontra {marca}', vis.count() >= 1 and marca in pg.inner_text('.grade-marcas'), pg.inner_text('.busca-modelos-resultado'))
    pg.fill('#busca-modelo', 'xyzw'); pg.wait_for_timeout(150)
    chk('SRV-04', 'Busca sem resultado mostra aviso e mantém o botão de WhatsApp', pg.is_visible('.marca-chave-vazio') and pg.is_visible('.marca-chave-cta') and 'Nenhum resultado' in pg.inner_text('.busca-modelos-resultado'))
    pg.focus('#busca-modelo'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    chk('SRV-05', 'Tecla Esc limpa a busca e volta a mostrar as 19 marcas', pg.input_value('#busca-modelo') == '' and pg.locator('.marca-chave[data-busca]:visible').count() == 19)
    # Carrossel de marcas
    tr = lambda: pg.evaluate("document.getElementById('brands-carousel').style.transform")
    pg.locator('#brands-carousel-wrapper').scroll_into_view_if_needed(); pg.mouse.move(5, 5)
    t0 = tr(); pg.click('#brands-carousel-next'); t1 = tr(); pg.click('#brands-carousel-prev'); t2 = tr()
    pg.locator('.brand-indicator').nth(2).click(); t3 = tr()
    chk('SRV-06', 'Carrossel de montadoras: setas e bolinhas trocam o grupo de marcas', t1 != t0 and t2 == t0 and t3 != t0, (t0, t1, t2, t3))
    pg.mouse.move(5, 5); pg.click('#brands-carousel-prev'); pg.mouse.move(5, 5); antes = tr(); pg.wait_for_timeout(6500)
    chk('SRV-07', 'Carrossel de montadoras avança sozinho (6 s)', tr() != antes, (antes, tr()))
    box = pg.locator('#brands-carousel-wrapper').bounding_box(); pg.mouse.move(box['x'] + 50, box['y'] + 50); antes = tr(); pg.wait_for_timeout(6500)
    chk('SRV-08', 'Carrossel pausa com o mouse em cima', tr() == antes)
    pg.close()

    pg = abrir(ctx, 'chaveiro-em-santo-andre', 500)
    trilho = "document.querySelector('#services [data-carrossel-trilho]')"
    s0 = pg.evaluate(trilho + '.scrollLeft'); pg.click('#services [data-carrossel-proximo]'); pg.wait_for_timeout(900)
    s1 = pg.evaluate(trilho + '.scrollLeft'); pg.click('#services [data-carrossel-anterior]'); pg.wait_for_timeout(900)
    s2 = pg.evaluate(trilho + '.scrollLeft')
    chk('SRV-09', 'Carrossel de serviços da home: setas avançam e voltam', s1 > s0 and s2 < s1, (s0, s1, s2))
    pg.focus('#services [data-carrossel-trilho]'); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(900)
    chk('SRV-10', 'Carrossel de serviços responde às setas do teclado', pg.evaluate(trilho + '.scrollLeft') > s2)
    pg.close()

    for n in ('chaveiro-maua', 'chaveiro-diadema'):
        pg = abrir(ctx, n, 300)
        q = pg.locator('.faq-question'); total = q.count(); erros = []
        for i in range(total):
            q.nth(i).click(); pg.wait_for_timeout(60)
            abertas = pg.locator('.faq-answer:visible').count()
            if not (abertas == 1 and q.nth(i).get_attribute('aria-expanded') == 'true'): erros.append(i + 1)
        chk('FAQ-01', f'{PAGINAS[n][0]}: as {total} perguntas abrem a resposta, uma de cada vez (aria-expanded)', total > 0 and not erros, erros)
        q.nth(total - 1).click(); pg.wait_for_timeout(60)
        chk('FAQ-02', f'{PAGINAS[n][0]}: clicar de novo na pergunta aberta fecha a resposta', pg.locator('.faq-answer:visible').count() == 0)
        q.nth(0).focus(); pg.keyboard.press('Enter'); pg.wait_for_timeout(60)
        chk('FAQ-03', f'{PAGINAS[n][0]}: pergunta abre pelo teclado (Tab + Enter)', pg.locator('.faq-answer:visible').count() == 1)
        pg.close()
    ctx.close()

    # ================================================================ 5. RESPONSIVIDADE / CELULAR
    for largura in LARGURAS:
        ctx = novo_contexto(nav, largura, 800, is_mobile=largura < 768, has_touch=largura < 1024)
        lateral, menu_errado, cortados = [], [], []
        for n in PAGINAS:
            pg = abrir(ctx, n, 400)
            sw = pg.evaluate('document.documentElement.scrollWidth')
            if sw > largura: lateral.append(f'{n}: {sw}px')
            hamb = pg.is_visible('#mobile-menu-button'); desk = pg.locator('header nav a').first.is_visible()
            if (largura < 1024) != hamb or (largura >= 1024) != desk: menu_errado.append(n)
            if largura >= 1024:
                fora = pg.evaluate("""(()=>{const logo=document.querySelector('header span').getBoundingClientRect().right;
                    return [...document.querySelectorAll('header nav a')].filter(a=>{const r=a.getBoundingClientRect();return r.right>innerWidth||r.left<logo||r.width<10}).map(a=>a.innerText)})()""")
                if fora: cortados.append(f'{n}: {fora}')
            if largura in (375, 1280): pg.screenshot(path=os.path.join(CAPTURAS, f'site-{n}-{largura}.png'))
            pg.close()
        chk('RSP-01', f'{largura}px: nenhuma página rola para o lado', not lateral, lateral)
        chk('RSP-02', f'{largura}px: menu certo para a tela ({"hambúrguer" if largura < 1024 else "menu completo"})', not menu_errado, menu_errado)
        if largura >= 1024:
            chk('RSP-06', f'{largura}px: os 6 itens do menu do topo cabem inteiros, sem cortar nem encostar no logo', not cortados, cortados)
        ctx.close()

    ctx = novo_contexto(nav, 375, 800, is_mobile=True, has_touch=True)
    for n, (nome, titulo) in PAGINAS.items():
        pg = abrir(ctx, n, 300)
        destinos = pg.evaluate("[...document.querySelectorAll('.mobile-menu-link')].map(a=>a.getAttribute('href'))")
        erros = []
        for d in destinos:
            pg.goto(url(n)); pg.wait_for_timeout(200)
            pg.tap('#mobile-menu-button'); pg.wait_for_timeout(450)
            if pg.evaluate("document.body.style.overflow") != 'hidden': erros.append('rolagem não travou')
            with pg.expect_navigation(wait_until='load'):
                pg.locator(f'.mobile-menu-link[href="{d}"]').tap()
            if not pg.url.endswith(d): erros.append(d)
        chk('NAV-04', f'{nome}: menu do celular abre, trava a rolagem e leva às {len(destinos)} páginas', destinos and not erros, erros)
        pg.close()
    pg = abrir(ctx, 'chaveiro-em-santo-andre', 300)
    pg.tap('#mobile-menu-button'); pg.wait_for_timeout(450)
    pg.mouse.click(300, 700); pg.wait_for_timeout(450)
    fechou_fora = pg.evaluate("document.getElementById('mobile-menu').getBoundingClientRect().height") < 5
    chk('RSP-05', 'Menu do celular fecha ao tocar fora dele', fechou_fora)
    # Alvos de toque e tamanho de texto
    pequenos = pg.evaluate("""[...document.querySelectorAll('a,button,input,select,textarea,summary,[role=button]')].filter(e=>{const r=e.getBoundingClientRect();
        return e.offsetParent && r.width>0 && (r.height<24||r.width<24) && !e.closest('p,li,footer')}).map(e=>(e.innerText||e.getAttribute('aria-label')||e.className).trim().slice(0,30))""")
    chk('RSP-03', 'Celular (Início): botões e links isolados com no mínimo 24×24 px (WCAG 2.5.8)', not pequenos, pequenos[:6], aviso=True)
    # Ligar visível sem rolar
    ligar = pg.evaluate(f"[...document.querySelectorAll('a[href=\"{TEL}\"]')].some(a=>{{const r=a.getBoundingClientRect();return a.offsetParent&&r.top<innerHeight}})")
    chk('RSP-07', 'Celular: WhatsApp à vista sem rolar no Início (botão flutuante)', pg.locator('a.whatsapp-flutuante').is_visible())
    chk('RSP-08', 'Celular: botão "Ligar" à vista sem rolar no Início', ligar, 'só aparece depois de rolar', aviso=True)
    pg.close()
    texto_peq = {}
    for n in PAGINAS:
        pg = abrir(ctx, n, 300)
        q = pg.evaluate("[...document.querySelectorAll('p,li,a,span,label,button,h1,h2,h3,h4')].filter(e=>e.offsetParent&&[...e.childNodes].some(c=>c.nodeType==3&&c.textContent.trim())&&parseFloat(getComputedStyle(e).fontSize)<12).length")
        if q: texto_peq[n] = q
        pg.close()
    chk('RSP-04', 'Celular: nenhum texto menor que 12 px', not texto_peq, texto_peq, aviso=True)
    ctx.close()

    # ================================================================ 6. ACESSIBILIDADE
    ctx = novo_contexto(nav)
    for n, (nome, _) in PAGINAS.items():
        pg = abrir(ctx, n, 600)
        info = pg.evaluate("""({lang:document.documentElement.lang, h1:document.querySelectorAll('h1').length,
            semAlt:[...document.images].filter(i=>!i.hasAttribute('alt')).map(i=>i.src.split('/').pop()),
            semNome:[...document.querySelectorAll('a,button')].filter(e=>e.offsetParent&&!(e.innerText.trim()||e.getAttribute('aria-label')||e.title||e.querySelector('img[alt]:not([alt=""])'))).map(e=>e.outerHTML.slice(0,60)),
            pulos:(()=>{let u=0,p=[];document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h=>{const l=+h.tagName[1];if(u&&l>u+1)p.push(h.tagName+' '+h.innerText.trim().slice(0,25));u=l});return p})()})""")
        chk('ACE-02', f'{nome}: idioma da página declarado como pt-BR', info['lang'] == 'pt-BR', info['lang'])
        chk('ACE-03', f'{nome}: exatamente um título principal (H1)', info['h1'] == 1, info['h1'])
        chk('ACE-04', f'{nome}: todas as imagens com texto alternativo (alt)', not info['semAlt'], info['semAlt'][:4])
        chk('ACE-06', f'{nome}: todos os botões e links têm nome acessível', not info['semNome'], info['semNome'][:3])
        chk('ACE-08', f'{nome}: títulos em ordem, sem pular nível (H2 → H4)', not info['pulos'], info['pulos'][:4], aviso=True)
        # Teclado: Tab percorre e mostra foco
        pg.keyboard.press('Tab'); pg.keyboard.press('Tab')
        foco = pg.evaluate("(()=>{const e=document.activeElement,s=getComputedStyle(e);return {tag:e.tagName,out:s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0,box:s.boxShadow!=='none'}})()")
        chk('ACE-05', f'{nome}: Tab leva o foco aos links do topo com indicação visível', foco['tag'] == 'A' and (foco['out'] or foco['box']), foco)
        if AXE:
            pg.add_script_tag(path=AXE)
            r = pg.evaluate("axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa']}).then(r=>r.violations.map(v=>({id:v.id,imp:v.impact,n:v.nodes.length})))")
            graves = [v for v in r if v['imp'] in ('critical', 'serious')]
            chk('ACE-01', f'{nome}: axe-core (WCAG 2.1 AA) sem violações graves/críticas', not graves, [f"{v['id']}({v['n']})" for v in graves], aviso=True)
            leves = [v for v in r if v['imp'] not in ('critical', 'serious')]
            if leves: registrar('ACE-01b', f'{nome}: axe-core, violações moderadas/leves', 'AVISO', [f"{v['id']}({v['n']})" for v in leves])
        pg.close()
    # Menos movimento
    ctx2 = novo_contexto(nav, reduced_motion='reduce')
    pg = abrir(ctx2, 'chaveiro-abc', 300); pg.mouse.move(5, 5)
    antes = pg.evaluate("document.getElementById('brands-carousel').style.transform"); pg.wait_for_timeout(6500)
    chk('ACE-07', 'Com "reduzir movimento" ligado no aparelho, carrosséis não avançam sozinhos', pg.evaluate("document.getElementById('brands-carousel').style.transform") == antes, 'carrossel de montadoras continua girando', aviso=True)
    pg.close(); ctx2.close()

    # ================================================================ 7. SEO
    titulos, descricoes = {}, {}
    for n, (nome, _) in PAGINAS.items():
        pg = abrir(ctx, n, 200)
        meta = pg.evaluate("""({t:document.title, d:(document.querySelector('meta[name=description]')||{}).content||'',
            c:(document.querySelector('link[rel=canonical]')||{}).href||'', og:['og:title','og:description','og:image'].filter(p=>!document.querySelector('meta[property="'+p+'"]')),
            ico:!!document.querySelector('link[rel~=icon]'), ld:[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>s.textContent)})""")
        titulos[n], descricoes[n] = meta['t'], meta['d']
        chk('SEO-01', f'{nome}: título da aba entre 30 e 70 caracteres ({len(meta["t"])})', 30 <= len(meta['t']) <= 70, meta['t'], aviso=True)
        chk('SEO-02', f'{nome}: descrição (meta description) entre 70 e 160 caracteres ({len(meta["d"])})', 70 <= len(meta['d']) <= 160, len(meta['d']), aviso=True)
        chk('SEO-03', f'{nome}: endereço canônico aponta para a própria página', meta['c'] == f'https://chaveirosenador.com.br/{n}.html', meta['c'])
        chk('SEO-04', f'{nome}: cartão de compartilhamento (Open Graph: título, descrição, imagem)', not meta['og'], f'faltam {meta["og"]}', aviso=True)
        chk('SEO-07', f'{nome}: ícone da aba (favicon)', meta['ico'])
        validos = 0
        for bloco in meta['ld']:
            try: json.loads(bloco); validos += 1
            except Exception as e: registrar('SEO-05', f'{nome}: dados estruturados com JSON inválido', 'FALHA', e)
        if n == 'chaveiro-em-santo-andre':
            tipos = re.findall(r'"@type"\s*:\s*"(\w+)"', ' '.join(meta['ld']))
            chk('SEO-05', 'Início: dados estruturados (JSON-LD) válidos de empresa local', validos == len(meta['ld']) and any(t in ('Locksmith', 'LocalBusiness') for t in tipos), tipos)
        pg.close()
    chk('SEO-06', 'Títulos e descrições diferentes em cada página', len(set(titulos.values())) == 6 and len(set(descricoes.values())) == 6)
    chk('SEO-08', 'Arquivos robots.txt e sitemap.xml na raiz do site', all(os.path.exists(os.path.join(RAIZ, f)) for f in ('robots.txt', 'sitemap.xml')),
        [f for f in ('robots.txt', 'sitemap.xml') if not os.path.exists(os.path.join(RAIZ, f))], aviso=True)
    faltando = set()
    for n in PAGINAS:
        with open(os.path.join(RAIZ, n + '.html'), encoding='utf-8') as f:
            for u in re.findall(r'https://chaveirosenador\.com\.br/([^"\s]+)', f.read()):
                if not os.path.exists(os.path.join(RAIZ, u)): faltando.add(u)
    chk('SEO-10', 'Imagens e páginas citadas nos metadados (Open Graph, JSON-LD) existem no site', not faltando, sorted(faltando))
    with open(os.path.join(RAIZ, 'admin/index.html'), encoding='utf-8') as f:
        chk('SEO-09', 'Área Restrita fora do Google (noindex)', 'noindex' in f.read())

    # ================================================================ 8. DESEMPENHO E ERROS
    pesadas = []
    for pasta, _, arqs in os.walk(os.path.join(RAIZ, 'imagens')):
        for a in arqs:
            t = os.path.getsize(os.path.join(pasta, a))
            if t > 400_000: pesadas.append(f'{a} ({t // 1024} KB)')
    chk('DES-02', 'Nenhuma imagem com mais de 400 KB', not pesadas, pesadas, aviso=True)
    for n, (nome, _) in PAGINAS.items():
        pg = ctx.new_page(); bytes_ = [0]; erros_js = []; falhas = []; cons = []
        pg.on('pageerror', lambda e: erros_js.append(str(e)))
        pg.on('console', lambda m: cons.append(m.text) if m.type == 'error' else None)
        pg.on('response', lambda r: falhas.append(f'{r.status} {r.url}') if r.url.startswith(BASE) and r.status >= 400 else None)
        pg.on('requestfinished', lambda r: bytes_.__setitem__(0, bytes_[0] + (r.sizes()['responseBodySize'] if r.url.startswith(BASE) else 0)))
        t = time.time(); pg.goto(url(n), wait_until='load'); carga = time.time() - t
        pg.mouse.wheel(0, 30000); pg.wait_for_timeout(1500)
        chk('ERR-01', f'{nome}: nenhum erro de JavaScript', not erros_js, erros_js[:2])
        chk('ERR-02', f'{nome}: nenhum erro no console do navegador', not cons, cons[:2])
        chk('ERR-03', f'{nome}: nenhum arquivo do site faltando (404)', not falhas, falhas[:3])
        chk('DES-01', f'{nome}: página completa com até 3 MB de arquivos do site ({bytes_[0] / 1048576:.1f} MB)', bytes_[0] < 3 * 1048576, '', aviso=True)
        chk('DES-04', f'{nome}: carrega em menos de 3 s ({carga:.1f} s, servidor local)', carga < 3, '', aviso=True)
        semlazy = pg.evaluate("[...document.images].filter(i=>!i.closest('header')&&i.getBoundingClientRect().top+scrollY>1600&&i.loading!=='lazy').length")
        chk('DES-03', f'{nome}: imagens fora da primeira tela com carregamento sob demanda (lazy)', semlazy == 0, f'{semlazy} imagens sem loading="lazy"', aviso=True)
        pg.close()
    usa_cdn = any('cdn.tailwindcss.com' in open(os.path.join(RAIZ, n + '.html'), encoding='utf-8').read() for n in PAGINAS)
    chk('DES-05', 'Estilos sem depender do Tailwind via CDN (o próprio Tailwind avisa que não é para produção)', not usa_cdn, 'cdn.tailwindcss.com em todas as páginas', aviso=True)

    # ================================================================ 9. ÁREA RESTRITA E RODAPÉ
    pg = abrir(ctx, 'chaveiro-em-santo-andre', 300)
    pg.locator('footer a[href="admin/index.html"]').click(); pg.wait_for_load_state('load'); pg.wait_for_timeout(1200)
    chk('ADM-01', 'Link "Área Restrita" do rodapé abre a tela de login do painel', pg.url.endswith('admin/index.html') and pg.locator('input[type=password]').first.is_visible())
    ano = time.localtime().tm_year
    pg.goto(url('chaveiro-em-santo-andre')); pg.wait_for_timeout(200)
    chk('ROD-01', f'Rodapé com o ano atual no copyright (© {ano})', f'© {ano}' in pg.inner_text('footer'), re.findall(r'© \d{4}', pg.inner_text('footer')))
    pg.close(); ctx.close()

    # ================================================================ 10. PERCURSO DAS TAREFAS DE USABILIDADE (piloto)
    # Mede quantos cliques/toques um visitante precisa no celular, partindo do Início.
    ctx = novo_contexto(nav, 375, 800, is_mobile=True, has_touch=True)
    pg = abrir(ctx, 'chaveiro-em-santo-andre', 400)
    tarefas = []
    def menu(destino):
        pg.goto(url('chaveiro-em-santo-andre')); pg.wait_for_timeout(200)
        pg.tap('#mobile-menu-button'); pg.wait_for_timeout(400)
        with pg.expect_navigation(wait_until='load'):
            pg.locator(f'.mobile-menu-link[href="{destino}"]').tap()
        pg.wait_for_timeout(300)
    menu('chaveiro-abc.html'); pg.fill('#busca-modelo', 'onix'); pg.wait_for_timeout(200)
    tarefas.append(('TAR-02', 'Descobrir se fazem chave do Onix', 2, 'Chevrolet' in pg.inner_text('.grade-marcas')))
    menu('chaveiro-sao-bernardo-do-campo.html')
    tarefas.append(('TAR-03', 'Achar endereço e horário de sábado', 2, 'Sábado' in pg.inner_text('body')))
    tarefas.append(('TAR-04', 'Pedir orçamento pelo formulário', 2, pg.locator('#cta-contact-form').count() == 1))
    faq_no_menu = pg.locator('.mobile-menu-link[href="chaveiro-maua.html"]').count() > 0
    tarefas.append(('TAR-05', 'Abrir o FAQ (perguntas frequentes)', 2, faq_no_menu))
    for cid, desc, toques, ok in tarefas:
        chk(cid, f'Percurso "{desc}" possível em {toques} toques pelo menu do celular', ok,
            'FAQ e Dicas não estão no menu: só pelo rodapé, no fim da página' if cid == 'TAR-05' else '')
    pg.close(); ctx.close()
    nav.close()

srv.shutdown()
tot = {s: sum(1 for r in resultados if r['status'] == s) for s in ('OK', 'FALHA', 'AVISO')}
with open(os.path.join(CAPTURAS, 'resultado-navegacao.json'), 'w', encoding='utf-8') as f:
    json.dump({'data': time.strftime('%Y-%m-%d %H:%M'), 'duracao_s': round(time.time() - inicio), 'totais': tot, 'casos': resultados}, f, ensure_ascii=False, indent=1)
print(f"\n{tot['OK']} OK, {tot['FALHA']} falharam, {tot['AVISO']} avisos  ({len(resultados)} verificações em {time.time() - inicio:.0f} s)")
sys.exit(1 if tot['FALHA'] else 0)
