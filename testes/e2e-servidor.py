"""
=====================================================================
TESTES DE PONTA A PONTA NO MODO SERVIDOR (navegador + banco de dados)
=====================================================================
Requisitos:  Node.js 22.13+  e  pip install playwright  &&  python -m playwright install chromium
Executar:    python testes/e2e-servidor.py     (ou: npm run test:e2e-servidor)

Liga o servidor (servidor/servidor.js) com um banco TEMPORÁRIO, abre o
painel em dois navegadores ao mesmo tempo (como se fossem o computador
do balcão e o celular) e confere no próprio arquivo do banco que cada
ação foi gravada. O banco de verdade nunca é usado.

Códigos S01..S20 = roteiro docs/ROTEIRO-DE-TESTES.md (parte "Modo servidor").
=====================================================================
"""
import json
import os
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time

from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAPTURAS = os.path.join(RAIZ, 'testes', 'capturas')
os.makedirs(CAPTURAS, exist_ok=True)

resultados = []


def chk(cid, desc, cond):
    resultados.append((cid, desc, bool(cond)))
    print(('OK    ' if cond else 'FALHA ') + cid.ljust(6) + ' ' + desc, flush=True)


def porta_livre():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def ligar_servidor(banco, porta):
    env = dict(os.environ, BANCO=banco, PORTA=str(porta), HOST='127.0.0.1', COPIAS=os.path.join(os.path.dirname(banco), 'copias'))
    proc = subprocess.Popen(['node', os.path.join(RAIZ, 'servidor', 'servidor.js')], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for _ in range(100):
        try:
            socket.create_connection(('127.0.0.1', porta), timeout=0.2).close()
            return proc
        except OSError:
            time.sleep(0.1)
    raise RuntimeError('Servidor não ligou: ' + (proc.stdout.read() if proc.poll() is not None else ''))


def sql(banco, consulta, *params):
    con = sqlite3.connect(banco)
    try:
        linhas = con.execute(consulta, params).fetchall()
        con.commit()
        return linhas
    finally:
        con.close()


def hora_relativa(pg, minutos):
    return pg.evaluate("""(m)=>{const d=new Date(Date.now()+m*60e3);const p=n=>String(n).padStart(2,'0');
        return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())}""", minutos)


def entrar(pg, login, senha):
    pg.fill('#login-usuario', login)
    pg.fill('#login-senha', senha)
    pg.click('#form-login button[type=submit]')
    pg.wait_for_timeout(1200)


def nova_entrada(pg, placa, nome, minutos_atras=0, chave=''):
    pg.evaluate("location.hash='#patio'")
    pg.wait_for_timeout(300)
    pg.fill('#ent-placa', placa)
    pg.fill('#ent-nome', nome)
    pg.fill('#ent-hora', hora_relativa(pg, -minutos_atras))
    if chave:
        pg.evaluate("document.querySelector('.detalhes-opcionais').open = true")
        pg.fill('#ent-chave', chave)
    pg.click('#form-entrada button[type=submit]')
    pg.wait_for_timeout(900)


def main():
    pasta = tempfile.mkdtemp(prefix='e2e-servidor-')
    banco = os.path.join(pasta, 'estacionamento.db')
    porta = porta_livre()
    proc = ligar_servidor(banco, porta)
    url = 'http://127.0.0.1:%d/admin/' % porta

    opcoes = {}
    if os.environ.get('CHROMIUM'):
        opcoes['executable_path'] = os.environ['CHROMIUM']
    if os.environ.get('HTTPS_PROXY'):
        opcoes['proxy'] = {'server': os.environ['HTTPS_PROXY'], 'bypass': '127.0.0.1,localhost'}

    try:
        with sync_playwright() as p:
            nav = p.chromium.launch(**opcoes)

            def contexto(largura=1280, altura=900):
                ctx = nav.new_context(ignore_https_errors=True, viewport={'width': largura, 'height': altura}, accept_downloads=True)
                if os.environ.get('TAILWIND_LOCAL'):
                    ctx.route('https://cdn.tailwindcss.com**', lambda r: r.fulfill(path=os.environ['TAILWIND_LOCAL'], content_type='application/javascript'))
                return ctx

            erros, csp = [], []

            def vigiar(pg):
                pg.on('pageerror', lambda e: erros.append(str(e)))
                pg.on('console', lambda m: csp.append(m.text) if 'Content Security Policy' in m.text else None)

            # ---------- Aparelho A: computador do balcão ----------
            ctxA = contexto()
            a = ctxA.new_page()
            vigiar(a)
            a.goto(url)
            a.wait_for_timeout(1500)
            chk('S01', 'painel detecta o servidor (modo banco de dados)', a.evaluate('Admin.Dados.modo') == 'servidor')
            entrar(a, 'admin', 'admin')
            chk('S01b', 'selo "Dados no banco de dados" no menu', 'banco de dados' in a.inner_text('#modo-dados'))
            chk('S02', 'login admin/admin no servidor + aviso de senha padrão', a.is_visible('#aviso-senha-padrao'))
            chk('S02b', 'login gravado na auditoria do banco', sql(banco, "SELECT COUNT(*) FROM auditoria WHERE acao='LOGIN_OK' AND usuario='admin'")[0][0] == 1)
            chk('S02c', 'nenhum dado do painel no localStorage', a.evaluate("Object.keys(localStorage).filter(k=>/^(adm_|est_)/.test(k)).length") == 0)

            nova_entrada(a, 'ABC1D23', 'Maria Souza', 125, chave='7')
            chk('S03', 'entrada aparece no pátio', 'ABC1D23' in a.inner_text('#lista-patio'))
            linha = sql(banco, "SELECT placa, motorista, chave, situacao, registrado_por_nome FROM estadias")
            chk('S03b', 'entrada gravada no banco (estadias)', linha == [('ABC1D23', 'Maria Souza', '7', 'no_patio', 'Administrador')])

            nova_entrada(a, 'ABC1D23', 'Outra Pessoa', 1)
            chk('S04', 'placa repetida recusada', 'já está no pátio' in a.inner_text('#form-entrada'))

            a.click('[data-saida]')
            a.wait_for_timeout(500)
            chk('S05', 'modal de saída: 2h05 = R$ 9,00', 'R$ 9,00' in a.inner_text('#saida-detalhes'))
            a.fill('#saida-recebido', '20')
            a.click('#btn-confirmar-saida')
            a.wait_for_timeout(1200)
            chk('S05b', 'comprovante com troco R$ 11,00', a.is_visible('#modal-comprovante') and 'R$ 11,00' in a.inner_text('#comprovante'))
            a.screenshot(path=os.path.join(CAPTURAS, 'servidor-01-comprovante.png'))
            fin = sql(banco, "SELECT situacao, minutos, valor_centavos, valor_recebido_centavos, troco_centavos, forma_pagamento FROM estadias")
            # o campo de hora não tem segundos: a permanência pode dar 125 ou 126 min (mesmo valor)
            chk('S05c', 'saída gravada no banco em centavos', len(fin) == 1 and fin[0][1] in (125, 126) and fin[0][:1] + fin[0][2:] == ('finalizada', 900, 2000, 1100, 'Dinheiro'))
            a.keyboard.press('Escape')

            a.evaluate("location.hash='#historico'")
            a.wait_for_timeout(500)
            chk('S06', 'histórico mostra a saída vinda do banco', 'ABC1D23' in a.inner_text('#lista-historico'))

            # ---------- Aparelho B: celular, ao mesmo tempo ----------
            ctxB = contexto(390, 844)
            b = ctxB.new_page()
            vigiar(b)
            b.goto(url)
            b.wait_for_timeout(1500)
            entrar(b, 'admin', 'admin')
            b.evaluate("location.hash='#historico'")
            b.wait_for_timeout(500)
            chk('S07', 'outro aparelho vê o mesmo histórico', 'ABC1D23' in b.inner_text('#lista-historico'))
            nova_entrada(b, 'DEF4G56', 'Carlos Lima', 10)
            a.evaluate("location.hash='#patio'")
            visto = False
            for _ in range(25):  # o painel confere mudanças a cada 15 s
                a.wait_for_timeout(1000)
                if 'DEF4G56' in a.inner_text('#lista-patio'):
                    visto = True
                    break
            chk('S07b', 'entrada feita no celular aparece sozinha no balcão (até 15 s)', visto)
            b.screenshot(path=os.path.join(CAPTURAS, 'servidor-02-celular.png'))

            a.reload()
            a.wait_for_timeout(2000)
            chk('S08', 'F5 mantém a sessão (cookie) e os dados', a.evaluate("document.body.classList.contains('logado')") and 'DEF4G56' in a.inner_text('#lista-patio'))

            # ---------- Configurações ----------
            a.evaluate("location.hash='#config'")
            a.wait_for_timeout(500)
            a.fill('#cfg-adicional', '3')
            a.click('#form-config button[type=submit]')
            a.wait_for_timeout(900)
            chk('S09', 'preço novo gravado no banco', sql(banco, 'SELECT valor_hora_adicional_centavos FROM configuracao')[0][0] == 300)
            chk('S09b', 'texto do backup explica que os dados estão no banco', 'banco de dados' in a.inner_text('#backup-texto'))
            with a.expect_download() as dl:
                a.click('#btn-backup-exportar')
            bk = json.load(open(dl.value.path(), encoding='utf-8'))
            chk('S10', 'backup baixado do banco (formato do painel)', bk.get('origem') == 'banco-de-dados' and len(bk['historico']) == 1 and len(bk['patio']) == 1)
            chk('S10b', 'backup traz a auditoria do banco', any(r['acao'] == 'BACKUP_EXPORTADO' for r in bk['auditoria']))

            # ---------- Usuários e perfil operador ----------
            a.evaluate("location.hash='#usuarios'")
            a.wait_for_timeout(500)
            a.fill('#usu-nome', 'Joana Operadora')
            a.fill('#usu-login', 'joana')
            a.fill('#usu-senha', 'Provisoria1')
            a.select_option('#usu-perfil', 'operador')
            a.click('#form-usuario button[type=submit]')
            a.wait_for_timeout(1200)
            chk('S11', 'operador cadastrado no banco', sql(banco, "SELECT perfil, trocar_senha FROM usuarios WHERE login='joana'") == [('operador', 1)])

            b.evaluate("document.getElementById('btn-sair').click()")  # no celular o botão fica dentro da gaveta do menu
            b.wait_for_timeout(800)
            entrar(b, 'joana', 'Provisoria1')
            chk('S12', 'operador é obrigado a trocar a senha', b.is_visible('#form-troca'))
            b.fill('#troca-senha', 'BalcaoNovo2026')
            b.fill('#troca-senha2', 'BalcaoNovo2026')
            b.click('#form-troca button[type=submit]')
            b.wait_for_timeout(1500)
            chk('S12b', 'troca gravada e painel liberado', b.evaluate("document.body.classList.contains('logado')") and sql(banco, "SELECT trocar_senha FROM usuarios WHERE login='joana'")[0][0] == 0)
            chk('S13', 'operador não vê Usuários/Auditoria/Configurações', not b.is_visible('.menu-item[data-tela="usuarios"]') and b.evaluate("Admin.Auditoria.listar().length") == 0)
            b.evaluate("location.hash='#usuarios'")
            b.wait_for_timeout(1500)
            chk('S13b', 'abrir #usuarios é negado e vai para a auditoria do banco', sql(banco, "SELECT COUNT(*) FROM auditoria WHERE acao='ACESSO_NEGADO' AND usuario='joana'")[0][0] >= 1)
            r = b.evaluate("""fetch('../api/usuarios',{method:'POST',headers:{'Content-Type':'application/json','X-Painel':'1'},body:JSON.stringify({nome:'Invasor',login:'inv',senha:'Invasor123',perfil:'admin'})}).then(r=>r.status)""")
            chk('S13c', 'operador chamando a API direto: 403 (servidor confere a permissão)', r == 403)

            # ---------- Auditoria ----------
            a.evaluate("location.hash='#auditoria'")
            a.wait_for_timeout(1200)
            chk('S14', 'auditoria do banco íntegra na tela', 'Integridade OK' in a.inner_text('#aud-integridade'))
            a.click('#btn-aud-verificar')
            a.wait_for_timeout(1200)
            chk('S14b', 'verificação completa feita no servidor', sql(banco, "SELECT COUNT(*) FROM auditoria WHERE acao='AUDITORIA_VERIFICADA'")[0][0] == 1)
            a.screenshot(path=os.path.join(CAPTURAS, 'servidor-03-auditoria.png'))
            try:
                sql(banco, "DELETE FROM auditoria WHERE seq = 1")
                apagou = True
            except sqlite3.DatabaseError:
                apagou = False
            chk('S15', 'apagar auditoria direto no banco é bloqueado (gatilho)', not apagou)

            # ---------- Sessão expirada no servidor ----------
            sql(banco, "UPDATE sessoes SET ultimo_uso = '2000-01-01T00:00:00.000Z' WHERE encerrada_em IS NULL AND usuario_id = (SELECT id FROM usuarios WHERE login='joana')")
            caiu = False
            for _ in range(25):
                b.wait_for_timeout(1000)
                if b.is_visible('#form-login'):
                    caiu = True
                    break
            chk('S16', 'sessão vencida no servidor volta o celular para o login', caiu)

            # ---------- Celular sem rolagem lateral ----------
            entrar(b, 'admin', 'admin')
            b.evaluate("location.hash='#patio'")
            b.wait_for_timeout(600)
            chk('S17', '390px: sem rolagem lateral no modo servidor', b.evaluate('document.documentElement.scrollWidth') <= 390)

            # ---------- Sair ----------
            a.evaluate("document.getElementById('btn-sair').click()")
            a.wait_for_timeout(800)
            chk('S18', 'sair encerra a sessão no banco', sql(banco, "SELECT COUNT(*) FROM auditoria WHERE acao='LOGOUT' AND usuario='admin'")[0][0] >= 1 and a.is_visible('#form-login'))

            # ---------- Servidor desligado ----------
            entrar(a, 'admin', 'admin')
            proc.terminate()
            proc.wait(5)
            nova_entrada(a, 'GHI7J89', 'Teste Sem Servidor', 1)
            toast = a.inner_text('#toasts')
            chk('S19', 'servidor desligado: aviso claro e nada é gravado no navegador', 'Sem conexão' in toast and a.evaluate("localStorage.getItem('est_patio')") is None)

            chk('S20', 'sem erros de JavaScript nem violação de CSP', not erros and not csp)
            if erros or csp:
                print('   ', erros[:3], csp[:3])
            nav.close()
    finally:
        if proc.poll() is None:
            proc.terminate()

    falhas = [r for r in resultados if not r[2]]
    print('\n%d passaram, %d falharam' % (len(resultados) - len(falhas), len(falhas)))
    sys.exit(1 if falhas else 0)


if __name__ == '__main__':
    main()
