"""
=====================================================================
TESTES DE PONTA A PONTA DO PAINEL ADMIN (navegador real)
=====================================================================
Requisitos:  pip install playwright  &&  python -m playwright install chromium
Executar:    python testes/e2e-admin.py
             (variável CHROMIUM=/caminho/do/chrome é opcional)

Abre admin/index.html como arquivo local (file://), igual ao uso no
computador do estacionamento, e percorre o roteiro de testes:
acesso, perfis, pátio, saída, histórico, auditoria, usuários,
configurações, segurança e responsividade. Salva capturas de tela em
testes/capturas/.
=====================================================================
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(RAIZ, 'admin', 'index.html')
CAPTURAS = os.path.join(RAIZ, 'testes', 'capturas')
os.makedirs(CAPTURAS, exist_ok=True)

resultados = []


def chk(cid, desc, cond):
    resultados.append((cid, desc, bool(cond)))
    print(('OK    ' if cond else 'FALHA ') + cid.ljust(6) + ' ' + desc, flush=True)


def hora_relativa(pg, minutos):
    """Valor para input datetime-local 'minutos' a partir de agora (negativo = passado)."""
    return pg.evaluate("""(m)=>{const d=new Date(Date.now()+m*60e3);const p=n=>String(n).padStart(2,'0');
        return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())}""", minutos)


def main():
    opcoes = {}
    if os.environ.get('CHROMIUM'):
        opcoes['executable_path'] = os.environ['CHROMIUM']
    if os.environ.get('HTTPS_PROXY'):
        opcoes['proxy'] = {'server': os.environ['HTTPS_PROXY']}
    with sync_playwright() as p:
        nav = p.chromium.launch(**opcoes)
        ctx = nav.new_context(ignore_https_errors=True, viewport={'width': 1280, 'height': 900}, accept_downloads=True)
        if os.environ.get('TAILWIND_LOCAL'):  # ambiente sem internet: usa cópia local do Tailwind
            ctx.route('https://cdn.tailwindcss.com**', lambda r: r.fulfill(path=os.environ['TAILWIND_LOCAL'], content_type='application/javascript'))
        pg = ctx.new_page()
        erros, csp = [], []
        pg.on('pageerror', lambda e: erros.append(str(e)))
        pg.on('console', lambda m: csp.append(m.text) if 'Content Security Policy' in m.text else None)
        vis = pg.is_visible

        pg.goto(URL)
        pg.wait_for_timeout(1500)

        # ---------------- ACESSO ----------------
        chk('CT09', 'abre direto na tela de login (sem tela de primeiro acesso)', vis('#form-login') and pg.locator('#form-setup').count() == 0)
        chk('CT10', 'sem login nenhum dado do painel aparece', not vis('#app'))
        pg.screenshot(path=CAPTURAS + '/01-login.png', full_page=True)

        pg.fill('#login-usuario', 'admin')
        pg.fill('#login-senha', 'admin')
        pg.click('#form-login button[type=submit]')
        pg.wait_for_selector('#app', state='visible', timeout=25000)
        chk('RF02', 'login padrão admin / admin entra como Administrador', 'Administrador' in pg.inner_text('#usuario-perfil'))
        u = pg.evaluate("JSON.parse(localStorage.adm_usuarios)[0]")
        chk('RN05', 'senha padrão gravada só como hash PBKDF2', u['senha'].startswith('pbkdf2$') and '"admin"' not in json.dumps(u['senha']))
        chk('AVISO', 'aviso de senha padrão aparece', vis('#aviso-senha-padrao'))
        pg.screenshot(path=CAPTURAS + '/02-painel-aviso-senha.png', full_page=True)

        # Troca a senha padrão pelo botão do aviso
        pg.click('#btn-trocar-padrao')
        pg.fill('#conta-atual', 'admin')
        pg.fill('#conta-nova', 'abc123')
        pg.fill('#conta-nova2', 'abc123')
        pg.click('#form-conta button[type=submit]')
        chk('SEG', 'nova senha fraca (menos de 8 caracteres) é recusada', '8 caracteres' in pg.inner_text('#conta-erro'))
        pg.fill('#conta-nova', 'Estac2026!')
        pg.fill('#conta-nova2', 'Estac2026!')
        pg.click('#form-conta button[type=submit]')
        pg.wait_for_selector('#modal-conta', state='hidden', timeout=25000)  # PBKDF2 leva alguns segundos
        pg.wait_for_timeout(300)
        chk('AVISO', 'aviso some depois de trocar a senha', not vis('#aviso-senha-padrao') and not vis('#modal-conta'))
        pg.screenshot(path=CAPTURAS + '/03-painel.png', full_page=True)

        # ---------------- PÁTIO ----------------
        pg.click('#menu-lateral .menu-item[data-tela=patio]')

        def entrada(nome, placa, hora=None):
            pg.fill('#ent-nome', nome)
            pg.fill('#ent-placa', placa)
            if hora:
                pg.fill('#ent-hora', hora)
            pg.click('#form-entrada button[type=submit]')
            pg.wait_for_timeout(150)

        entrada('Maria Souza', 'ABC1D23')
        chk('CT16', 'entrada aparece no pátio com R$ 5,00', 'ABC1D23' in pg.inner_text('#lista-patio') and 'R$ 5,00' in pg.inner_text('#lista-patio'))
        entrada('Joao', 'AB12')
        chk('CT17', 'placa inválida recusada', 'Placa inválida' in pg.inner_text('[data-erro=ent-placa]'))
        entrada('Joao', 'ABC1D23')
        chk('CT19', 'placa repetida no pátio recusada', 'já está no pátio' in pg.inner_text('[data-erro=ent-placa]'))
        entrada('', 'XYZ9876')
        chk('CT21', 'nome vazio recusado', 'Informe o nome' in pg.inner_text('[data-erro=ent-nome]'))
        entrada('Joao Lima', 'XYZ9876', hora_relativa(pg, 180))
        chk('CT20', 'hora de entrada no futuro recusada', 'futuro' in pg.inner_text('[data-erro=ent-hora]'))
        entrada('Joao Lima', 'abc-1234', hora_relativa(pg, -90))
        t = pg.inner_text('#lista-patio')
        chk('CT18', 'abc-1234 vira ABC-1234', 'ABC-1234' in t)
        chk('CT05', '1h30 no pátio = R$ 7,00 parcial', 'R$ 7,00' in t)
        pg.fill('#busca-patio', '1234')
        pg.wait_for_timeout(100)
        t = pg.inner_text('#lista-patio')
        chk('CT22', 'busca filtra por placa', 'ABC-1234' in t and 'ABC1D23' not in t)
        pg.fill('#busca-patio', '')
        entrada('<img src=x onerror=window.__xss=1>Ana', 'QWE1234')
        chk('SEG', 'HTML digitado não é executado (anti-XSS)', pg.locator('#lista-patio img').count() == 0 and not pg.evaluate('window.__xss'))
        pg.screenshot(path=CAPTURAS + '/03-patio.png', full_page=True)

        # ---------------- SAÍDA ----------------
        linha = pg.locator('#lista-patio table tr', has_text='ABC-1234')
        linha.locator('[data-saida]').click()
        pg.wait_for_timeout(200)
        d = pg.inner_text('#saida-detalhes')
        chk('CT23', 'saída mostra 1h 30min e R$ 7,00', '1h 30min' in d and 'R$ 7,00' in d)
        pg.screenshot(path=CAPTURAS + '/04-saida.png')
        pg.locator('#modal-saida .fechar-modal').last.click()
        chk('CT24', 'cancelar mantém o veículo no pátio', 'ABC-1234' in pg.inner_text('#lista-patio'))
        linha.locator('[data-saida]').click()
        pg.click('label.opcao-pgto:has-text("Pix")')
        pg.click('#btn-confirmar-saida')
        pg.wait_for_timeout(200)
        chk('CT25', 'comprovante aberto com Pix', vis('#modal-comprovante') and 'Pix' in pg.inner_text('#comprovante'))
        pg.screenshot(path=CAPTURAS + '/05-comprovante.png')
        pg.click('#modal-comprovante .fechar-modal')
        chk('CT23b', 'veículo saiu do pátio', 'ABC-1234' not in pg.inner_text('#lista-patio'))

        # Saída em dinheiro com troco (veículo QWE-1234, R$ 5,00, recebe R$ 20,00)
        pg.locator('#lista-patio table tr', has_text='QWE-1234').locator('[data-saida]').click()
        pg.wait_for_timeout(200)
        chk('TROCO', 'área de troco aparece para dinheiro', vis('#saida-troco-area'))
        pg.fill('#saida-recebido', '3')
        chk('TROCO', 'avisa quando falta dinheiro', 'Faltam' in pg.inner_text('#saida-troco'))
        pg.click('#saida-notas button:has-text("R$ 20,00")')
        chk('TROCO', 'troco de R$ 20,00 para R$ 5,00 = R$ 15,00', pg.inner_text('#saida-troco') == 'R$ 15,00')
        pg.screenshot(path=CAPTURAS + '/04b-saida-troco.png')
        pg.click('#btn-confirmar-saida')
        pg.wait_for_timeout(200)
        chk('TROCO', 'comprovante mostra recebido e troco', 'Troco' in pg.inner_text('#comprovante') and 'R$ 15,00' in pg.inner_text('#comprovante'))
        pg.click('#modal-comprovante .fechar-modal')

        # Painel com os indicadores do dia
        pg.click('#menu-lateral .menu-item[data-tela=painel]')
        pg.wait_for_timeout(300)
        chk('IND', 'painel: faturamento R$ 12,00 e 2 saídas', pg.inner_text('#kpi-faturamento') == 'R$ 12,00' and pg.inner_text('#kpi-saidas') == '2')
        chk('IND', 'painel: gráfico de 7 dias desenhado', pg.locator('#graf-7dias svg rect').count() >= 1)
        chk('IND', 'painel: pagamentos de hoje por forma', 'Pix' in pg.inner_text('#graf-pgto-hoje') and 'Dinheiro' in pg.inner_text('#graf-pgto-hoje'))
        pg.screenshot(path=CAPTURAS + '/02b-painel-com-dados.png', full_page=True)

        # Atalho N leva à nova entrada
        pg.keyboard.press('n')
        pg.wait_for_timeout(300)
        chk('ATALHO', 'tecla N abre o pátio com foco na placa', vis('#tela-patio') and pg.evaluate("document.activeElement.id") == 'ent-placa')
        pg.click('#titulo-tela')

        # ---------------- HISTÓRICO ----------------
        pg.click('#menu-lateral .menu-item[data-tela=historico]')
        resumo = pg.inner_text('#hist-resumo')
        chk('CT31', 'histórico soma R$ 12,00 (Pix 7 + Dinheiro 5)', 'R$ 12,00' in resumo and 'R$ 7,00' in resumo and 'R$ 5,00' in resumo)
        pg.select_option('#hist-pgto', 'Pix')
        chk('HIST', 'filtro por pagamento (Pix)', 'ABC-1234' in pg.inner_text('#lista-historico') and 'QWE-1234' not in pg.inner_text('#lista-historico'))
        pg.select_option('#hist-pgto', '')

        # ---------------- RELATÓRIOS ----------------
        pg.click('#menu-lateral .menu-item[data-tela=relatorios]')
        pg.wait_for_timeout(300)
        chk('REL', 'relatórios: faturamento do período', 'R$ 12,00' in pg.inner_text('#rel-kpis'))
        chk('REL', 'relatórios: gráficos desenhados', pg.locator('#rel-graf-dias svg rect').count() >= 7 and pg.locator('#rel-graf-horas svg rect').count() >= 1)
        chk('REL', 'relatórios: clientes frequentes', 'ABC-1234' in pg.inner_text('#rel-placas'))
        pg.screenshot(path=CAPTURAS + '/06b-relatorios.png', full_page=True)
        pg.click('#menu-lateral .menu-item[data-tela=historico]')
        with pg.expect_download() as dl:
            pg.click('#btn-hist-csv')
        bruto = open(dl.value.path(), 'rb').read()
        chk('CT30', 'CSV com acentos (BOM UTF-8)', bruto.startswith(b'\xef\xbb\xbf') and 'Permanência' in bruto.decode('utf-8-sig'))
        pg.screenshot(path=CAPTURAS + '/06-historico.png', full_page=True)

        # ---------------- CONFIGURAÇÕES ----------------
        pg.click('#menu-lateral .menu-item[data-tela=config]')
        pg.fill('#cfg-adicional', '3')
        pg.click('#form-config button[type=submit]')
        v = pg.evaluate("Admin.Regras.calcularValorPorMinutos(150, Admin.Dados.config())")
        chk('CT29', 'hora adicional R$ 3 → 2h30 = R$ 11,00', v == 11)
        pg.fill('#cfg-adicional', '2')
        pg.click('#form-config button[type=submit]')
        pg.fill('#cfg-vagas', '40')
        pg.click('#form-vagas button[type=submit]')
        chk('CFG', 'número de vagas salvo', pg.evaluate("Admin.Dados.config().vagas") == 40)
        with pg.expect_download() as dl:
            pg.click('#btn-backup-exportar')
        backup = json.load(open(dl.value.path(), encoding='utf-8'))
        chk('BACKUP', 'backup baixado com histórico e auditoria', backup.get('sistema') == 'chaveiro-senador-painel' and len(backup['historico']) == 2 and len(backup['auditoria']) > 5)
        pg.screenshot(path=CAPTURAS + '/07b-configuracoes.png', full_page=True)

        # ---------------- USUÁRIOS ----------------
        pg.click('#menu-lateral .menu-item[data-tela=usuarios]')
        pg.fill('#usu-nome', 'Carlos Funcionario')
        pg.fill('#usu-login', 'carlos')
        pg.fill('#usu-senha', 'Func2026x')
        pg.select_option('#usu-perfil', 'operador')
        pg.click('#form-usuario button[type=submit]')
        pg.wait_for_timeout(800)
        chk('CT27', 'operador cadastrado', '@carlos' in pg.inner_text('#lista-usuarios'))
        chk('CT28', 'não há botão para remover a si mesmo', pg.locator('#lista-usuarios [data-usu-remover]').count() == 1)
        pg.screenshot(path=CAPTURAS + '/07-usuarios.png', full_page=True)

        # ---------------- AUDITORIA ----------------
        pg.click('#menu-lateral .menu-item[data-tela=auditoria]')
        t = pg.inner_text('#lista-auditoria')
        chk('AUD', 'auditoria registra entrada, saída, config e usuário', all(x in t for x in ['Entrada de veículo', 'Saída e pagamento', 'Configurações alteradas', 'Usuário criado']))
        chk('AUD', 'cadeia íntegra', 'Integridade OK' in pg.inner_text('#aud-integridade'))
        pg.screenshot(path=CAPTURAS + '/08-auditoria.png', full_page=True)
        # Adultera um registro direto no armazenamento e verifica
        pg.evaluate("(()=>{const a=JSON.parse(localStorage.adm_auditoria);a[3].detalhes.placa='ZZZ9999';localStorage.adm_auditoria=JSON.stringify(a)})()")
        pg.click('#btn-aud-verificar')
        pg.wait_for_timeout(200)
        chk('AUD', 'adulteração detectada no registro nº 4', 'adulterada' in pg.inner_text('#aud-integridade') and 'nº 4' in pg.inner_text('#aud-integridade'))
        pg.screenshot(path=CAPTURAS + '/09-auditoria-adulterada.png')
        with pg.expect_download() as dl:
            pg.click('#btn-aud-csv')
        chk('AUD', 'auditoria exporta CSV', 'Hash' in open(dl.value.path(), encoding='utf-8-sig').readline())

        # ---------------- SAIR / SESSÃO / BLOQUEIO ----------------
        pg.click('#btn-sair')
        chk('CT15', 'após sair volta ao login', vis('#form-login') and not vis('#app'))
        pg.goto(URL)
        pg.wait_for_timeout(800)
        chk('CT15b', 'reabrir sem sessão mostra login', not vis('#app'))
        pg.fill('#login-usuario', 'admin')
        pg.fill('#login-senha', 'errada123')
        pg.click('#form-login button[type=submit]')
        pg.wait_for_timeout(600)
        chk('CT11', 'senha errada: mensagem genérica', 'inválidos' in pg.inner_text('#login-erro'))
        for _ in range(4):
            pg.fill('#login-senha', 'errada123')
            pg.click('#form-login button[type=submit]')
            pg.wait_for_timeout(500)
        chk('CT12', 'bloqueio após 5 erros', 'bloqueado' in pg.inner_text('#login-erro'))
        pg.fill('#login-senha', 'Estac2026!')
        pg.click('#form-login button[type=submit]')
        pg.wait_for_timeout(500)
        chk('CT12b', 'bloqueado mesmo com a senha certa', not vis('#app'))
        pg.screenshot(path=CAPTURAS + '/10-bloqueio.png', full_page=True)

        # Operador entra (o bloqueio é por usuário)
        pg.fill('#login-usuario', 'carlos')
        pg.fill('#login-senha', 'Func2026x')
        pg.click('#form-login button[type=submit]')
        pg.wait_for_timeout(600)
        chk('TROCA', 'operador novo é obrigado a trocar a senha', vis('#form-troca') and not vis('#app'))
        pg.fill('#troca-senha', 'Turno2027y')
        pg.fill('#troca-senha2', 'Turno2027y')
        pg.click('#form-troca button[type=submit]')
        pg.wait_for_selector('#app', state='visible', timeout=25000)
        chk('CT27b', 'operador entra após trocar a senha', 'Operador' in pg.inner_text('#usuario-perfil'))
        chk('CT13', 'operador não vê Auditoria/Usuários/Configurações',
            not vis('#menu-lateral .menu-item[data-tela=auditoria]') and not vis('#menu-lateral .menu-item[data-tela=usuarios]') and not vis('#menu-lateral .menu-item[data-tela=config]'))
        pg.click('#menu-lateral .menu-item[data-tela=historico]')
        chk('CT13b', 'operador não vê exportar/excluir', not vis('#btn-hist-csv') and pg.locator('#lista-historico [data-excluir-hist]').count() == 0)
        pg.evaluate("location.hash='#usuarios'")
        pg.wait_for_timeout(300)
        chk('SEG', 'abrir #usuarios pelo endereço é bloqueado', not vis('#tela-usuarios'))
        chk('SEG', 'tentativa negada vai para a auditoria', pg.evaluate("Admin.Auditoria.listar().some(r=>r.acao==='ACESSO_NEGADO' && r.usuario==='carlos')"))

        # Aviso 2 minutos antes de expirar
        pg.evaluate("(()=>{const s=JSON.parse(sessionStorage.adm_sessao);s.ultimoUso=Date.now()-29*60e3;sessionStorage.adm_sessao=JSON.stringify(s)})()")
        pg.wait_for_timeout(5600)
        chk('SESSAO', 'aviso de sessão expirando aparece', vis('#aviso-sessao'))
        pg.click('#btn-continuar-sessao')
        chk('SESSAO', '"Continuar conectado" renova a sessão', not vis('#aviso-sessao') and pg.evaluate("Admin.Sessao.segundosRestantes()") > 1700)

        # Sessão vencida
        pg.evaluate("(()=>{const s=JSON.parse(sessionStorage.adm_sessao);s.ultimoUso=Date.now()-31*60e3;sessionStorage.adm_sessao=JSON.stringify(s)})()")
        pg.reload()
        pg.wait_for_timeout(800)
        chk('CT14', 'sessão vencida (30 min) volta ao login', not vis('#app'))

        # Persistência
        pg.fill('#login-usuario', 'carlos')
        pg.fill('#login-senha', 'Turno2027y')
        pg.click('#form-login button[type=submit]')
        pg.wait_for_selector('#app', state='visible', timeout=25000)
        pg.click('#menu-lateral .menu-item[data-tela=patio]')
        pg.reload()
        pg.wait_for_timeout(800)
        chk('CT26', 'F5 mantém sessão e dados', 'ABC1D23' in pg.inner_text('#lista-patio'))

        # ---------------- RESPONSIVIDADE ----------------
        for largura, nome in [(360, '11-celular-360'), (768, '12-tablet-768')]:
            pg.set_viewport_size({'width': largura, 'height': 800})
            pg.wait_for_timeout(300)
            sw = pg.evaluate('document.documentElement.scrollWidth')
            chk('CT32', f'{largura}px sem rolagem lateral (largura do conteúdo {sw})', sw <= largura)
            pg.screenshot(path=CAPTURAS + f'/{nome}.png', full_page=True)
        pg.set_viewport_size({'width': 360, 'height': 800})
        chk('CT32b', '360px: cartões no lugar da tabela', pg.locator('#lista-patio .cartao-lista:visible').count() > 0 and not vis('#lista-patio table'))
        chk('MOB', '360px: barra de navegação inferior visível', vis('.nav-inferior'))
        pg.click('.nav-inferior-item[data-ir=historico]'); pg.wait_for_timeout(300)
        chk('MOB', '360px: barra inferior navega (Histórico)', vis('#tela-historico') and 'ativa' in pg.get_attribute('.nav-inferior-item[data-ir=historico]', 'class'))
        pg.click('.nav-inferior-item[data-ir=patio]'); pg.wait_for_timeout(300)
        alvos = pg.evaluate("[...document.querySelectorAll('.nav-inferior-item')].filter(b=>b.offsetParent && b.getBoundingClientRect().height<44).length")
        chk('MOB', '360px: botões da barra inferior com 44px ou mais de altura', alvos == 0)
        pg.click('#btn-menu-mobile')
        pg.wait_for_timeout(400)
        pg.screenshot(path=CAPTURAS + '/13-menu-mobile.png')
        chk('MENU', 'menu mobile (gaveta) abre', pg.evaluate("document.getElementById('menu-lateral').getBoundingClientRect().left") >= 0)
        pg.click('#menu-lateral .menu-item[data-tela=historico]')
        pg.wait_for_timeout(300)
        chk('MENU', 'menu mobile navega', vis('#tela-historico'))

        chk('CSP', 'nenhuma violação da política de segurança (CSP)', not csp)
        chk('JS', 'sem erros de JavaScript: ' + '; '.join(erros), not erros)
        nav.close()

    passou = sum(r[2] for r in resultados)
    print(f'\n{passou} passaram, {len(resultados) - passou} falharam')
    sys.exit(0 if passou == len(resultados) else 1)


if __name__ == '__main__':
    main()
