"""
=====================================================================
TESTES DO SITE PÚBLICO (navegador real)
=====================================================================
Executar:  python testes/e2e-site.py   (requer Playwright)
Confere em todas as páginas: sem erros de JavaScript, sem rolagem
lateral no celular (320 e 360px), layout mobile-first (títulos,
espaçamentos, catálogo e marcas no celular), menu mobile, carrossel de marcas,
acordeão do FAQ/Dicas, formulário de contato e link da Área Restrita.
=====================================================================
"""
import os, sys
from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGINAS = ['chaveiro-em-santo-andre', 'chaveiro-santo-andre', 'chaveiro-abc', 'chaveiro-sao-bernardo-do-campo', 'chaveiro-maua', 'chaveiro-diadema']
res = []
def chk(cid, desc, cond):
    res.append(bool(cond)); print(('OK    ' if cond else 'FALHA ') + cid.ljust(6) + ' ' + desc, flush=True)

opcoes = {'executable_path': os.environ['CHROMIUM']} if os.environ.get('CHROMIUM') else {}
if os.environ.get('HTTPS_PROXY'): opcoes['proxy'] = {'server': os.environ['HTTPS_PROXY']}
with sync_playwright() as p:
    nav = p.chromium.launch(**opcoes)
    for largura in (360, 1280):
        ctx = nav.new_context(ignore_https_errors=True, viewport={'width': largura, 'height': 800})
        if os.environ.get('TAILWIND_LOCAL'):
            ctx.route('https://cdn.tailwindcss.com**', lambda r: r.fulfill(path=os.environ['TAILWIND_LOCAL'], content_type='application/javascript'))
        for n in PAGINAS:
            pg = ctx.new_page(); erros = []; falta = []
            pg.on('pageerror', lambda e: erros.append(str(e)))
            pg.on('requestfailed', lambda r: falta.append(r.url) if r.url.startswith('file:') else None)
            pg.goto('file://' + os.path.join(RAIZ, n + '.html')); pg.wait_for_timeout(1200)
            chk('JS', f'{n} {largura}px sem erros de JavaScript {erros}', not erros)
            chk('ARQ', f'{n} {largura}px todos os arquivos locais carregam {falta[:2]}', not falta)
            imgs = pg.evaluate("[...document.images].filter(i=>i.complete && i.naturalWidth===0).map(i=>i.src)")
            chk('IMG', f'{n} {largura}px nenhuma imagem quebrada {imgs[:2]}', not imgs)
            if largura == 360:
                sw = pg.evaluate('document.documentElement.scrollWidth')
                chk('RESP', f'{n} 360px sem rolagem lateral ({sw})', sw <= 360)
                chk('MENU', f'{n} botão do menu mobile visível', pg.is_visible('#mobile-menu-button'))
                pg.click('#mobile-menu-button'); pg.wait_for_timeout(400)
                chk('MENU', f'{n} menu mobile abre', pg.evaluate("document.getElementById('mobile-menu').getBoundingClientRect().height") > 100)
                pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
                chk('MENU', f'{n} Esc fecha o menu', pg.evaluate("document.getElementById('mobile-menu').getBoundingClientRect().height") < 5)
                # ---- Mobile-first: o que vale sem prefixo é o tamanho do celular ----
                maior = pg.evaluate("Math.max(...[...document.querySelectorAll('h1,h2')].filter(h=>h.offsetParent).map(h=>parseFloat(getComputedStyle(h).fontSize)))")
                chk('MOB', f'{n} 360px títulos no tamanho do celular (maior: {maior}px)', maior <= 34)
                pad = pg.evaluate("Math.max(...[...document.querySelectorAll('section')].map(s=>parseFloat(getComputedStyle(s).paddingTop)))")
                chk('MOB', f'{n} 360px seções com espaçamento de celular (maior: {pad}px)', pad <= 56)
                just = pg.evaluate("[...document.querySelectorAll('p')].filter(p=>p.offsetParent && getComputedStyle(p).textAlign==='justify').length")
                chk('MOB', f'{n} 360px nenhum parágrafo justificado (evita buracos no texto) ({just})', just == 0)
                pg.set_viewport_size({'width': 320, 'height': 800}); pg.wait_for_timeout(300)
                sw = pg.evaluate('document.documentElement.scrollWidth')
                chk('RESP', f'{n} 320px sem rolagem lateral ({sw})', sw <= 320)
                if pg.locator('#brands-carousel').count():
                    cortados = pg.evaluate("[...document.querySelectorAll('#brands-carousel h4')].filter(h=>h.getBoundingClientRect().right>h.parentElement.getBoundingClientRect().right+1).length")
                    chk('MOB', f'{n} 320px nomes das montadoras cabem nos cartões ({cortados} cortados)', cortados == 0)
                pg.set_viewport_size({'width': 360, 'height': 800}); pg.wait_for_timeout(300)
                if n == 'chaveiro-abc':
                    chk('MOB', 'catálogo 360px: cartão horizontal (foto à esquerda)', pg.evaluate("getComputedStyle(document.querySelector('.grade-servicos .cartao-servico')).flexDirection") == 'row')
                    chk('MOB', 'marcas 360px: começam recolhidas', pg.locator('.marca-chave-modelos:visible').count() == 0)
                    pg.locator('.marca-chave[data-busca] .marca-chave-topo').first.click(); pg.wait_for_timeout(200)
                    chk('MOB', 'marcas 360px: tocar no nome abre os modelos', pg.locator('.marca-chave-modelos:visible').count() == 1 and pg.locator('.marca-chave-topo[aria-expanded=true]').count() == 1)
                    pg.locator('.marca-chave[data-busca] .marca-chave-topo').first.click(); pg.wait_for_timeout(200)
            corpo = pg.inner_text('body')
            chk('TEL', f'{n} {largura}px nenhum número de telefone aparece na página', '99977' not in corpo and '4994' not in corpo)
            if n in ('chaveiro-em-santo-andre', 'chaveiro-sao-bernardo-do-campo'):
                esperado = 2 if n == 'chaveiro-em-santo-andre' else 4
                chk('TEL', f'{n} botões de contato "Ligar agora" e "WhatsApp" (sem número)', pg.locator('a.botao-contato[href^="tel:"]').count() + pg.locator('a.botao-contato[href*="wa.me"]').count() == esperado)
            chk('ROD', f'{n} rodapé com botões discretos e sem números', pg.locator('footer .rodape-botao').count() == 2 and '99977' not in pg.inner_text('footer') and '4994' not in pg.inner_text('footer'))
            chk('ADM', f'{n} link Área Restrita aponta para admin/', pg.locator('a[href="admin/index.html"]').count() == 1)
            if n in ('chaveiro-em-santo-andre', 'chaveiro-abc') and largura == 1280:
                pg.click('#brands-carousel-next'); pg.wait_for_timeout(700)
                chk('CARR', f'{n} carrossel avança', 'translateX(-33' in pg.evaluate("document.getElementById('brands-carousel').style.transform"))
            chk('WPP', f'{n} {largura}px WhatsApp flutuante visível e fixo', pg.is_visible('.whatsapp-flutuante') and pg.evaluate("getComputedStyle(document.querySelector('.whatsapp-flutuante')).position") == 'fixed')
            chk('WPP', f'{n} sem botão "Fale Conosco" no topo', pg.locator('header a[href*="wa.me"]').count() == 0)
            if n == 'chaveiro-em-santo-andre':
                chk('HOME', 'seção "Solicite Seu Orçamento" removida da home', pg.locator('#orcamento').count() == 0)
                chk('HOME', 'sem botões abaixo do carrossel de serviços', pg.locator('#services a:not(.cartao-servico):has-text("Solicitar Orçamento"), #services a:not(.cartao-servico):has-text("Ver todos os serviços")').count() == 0)
                chk('HOME', 'sem "FALE CONOSCO" em Conveniência e Acessibilidade', pg.locator('#location a:has-text("FALE CONOSCO")').count() == 0)
                chk('HOME', '"Conveniência e Acessibilidade" com o fundo de foto', 'solicite-seu-orcamento' in pg.evaluate("document.getElementById('location').style.backgroundImage"))
                chk('CARR', 'home: carrossel com 6 serviços + "ver todos"', pg.locator('#services .cartao-servico').count() == 7)
                if largura == 1280:
                    antes = pg.evaluate("document.querySelector('#services [data-carrossel-trilho]').scrollLeft")
                    pg.click('#services [data-carrossel-proximo]'); pg.wait_for_timeout(900)
                    chk('CARR', 'home: seta avança o carrossel de serviços', pg.evaluate("document.querySelector('#services [data-carrossel-trilho]').scrollLeft") > antes)
                    pg.click('#chave-codificada .servico-link'); pg.wait_for_timeout(1500)
                    chk('CARR', '"Saiba mais" abre o serviço no catálogo com detalhes abertos', pg.url.endswith('chaveiro-abc.html#chave-codificada') and pg.evaluate("document.querySelector('#chave-codificada details').open"))
                    pg.goto('file://' + os.path.join(RAIZ, n + '.html')); pg.wait_for_timeout(800)
            if n == 'chaveiro-abc':
                chk('GRADE', 'catálogo: 15 serviços + cartão de orçamento em grade (sem carrossel)', pg.locator('.grade-servicos .cartao-servico[id]').count() == 15 and pg.locator('.grade-servicos .cartao-servico-todos').count() == 1 and pg.locator('[data-carrossel]').count() == 0)
                colunas = lambda sel: pg.evaluate("getComputedStyle(document.querySelector('%s')).gridTemplateColumns.split(' ').length" % sel)
                if largura == 1280:
                    chk('GRADE', 'catálogo: 4 serviços por linha no computador', colunas('.grade-servicos') == 4)
                    chk('CHAVE', 'chaves codificadas: 4 marcas por linha no computador', colunas('.grade-marcas') == 4)
                chk('CHAVE', f'{largura}px chaves codificadas: 19 marcas com modelos em etiquetas', pg.locator('.marca-chave[data-busca]').count() == 19 and pg.locator('.marca-chave-modelos li').count() > 100)
                pg.fill('#busca-modelo', 'onix'); pg.wait_for_timeout(200)
                chk('CHAVE', f'{largura}px busca "onix" mostra só Chevrolet e destaca o modelo', pg.locator('.marca-chave[data-busca]:visible').count() == 1 and 'Chevrolet' in pg.inner_text('.marca-chave[data-busca]:visible') and pg.locator('li.achou').count() == 1)
                pg.fill('#busca-modelo', 'megane'); pg.wait_for_timeout(200)
                chk('CHAVE', f'{largura}px busca ignora acentos ("megane" acha Mégane)', pg.locator('li.achou').count() == 1)
                pg.fill('#busca-modelo', 'xyzw'); pg.wait_for_timeout(200)
                chk('CHAVE', f'{largura}px busca sem resultado mostra aviso e mantém o WhatsApp', pg.is_visible('.marca-chave-vazio') and pg.is_visible('.marca-chave-cta'))
                pg.fill('#busca-modelo', ''); pg.wait_for_timeout(200)
                chk('CHAVE', f'{largura}px limpar a busca mostra todas as marcas', pg.locator('.marca-chave[data-busca]:visible').count() == 19)
                chk('CARR', 'catálogo: cada cartão tem foto', pg.evaluate("[...document.querySelectorAll('.cartao-servico .cartao-servico-foto img')].filter(i=>i.complete&&i.naturalWidth>0).length") >= 1)
            if n in ('chaveiro-maua', 'chaveiro-diadema'):
                pg.locator('.faq-question').first.click(); pg.wait_for_timeout(150)
                chk('FAQ', f'{n} acordeão abre a resposta', pg.locator('.faq-answer').first.is_visible())
            if n == 'chaveiro-sao-bernardo-do-campo' and largura == 1280:  # formulário só na página de contato
                pg.fill('#cta-phone', '11999776208')
                chk('FORM', f'{n} máscara de telefone', pg.input_value('#cta-phone') == '(11) 99977-6208')
                pg.fill('#cta-message', 'abc')
                chk('FORM', f'{n} contador de caracteres', pg.inner_text('#cta-charCount') == '3')
            pg.close()
        ctx.close()
    nav.close()
print(f'\n{sum(res)} passaram, {len(res) - sum(res)} falharam'); sys.exit(0 if all(res) else 1)
