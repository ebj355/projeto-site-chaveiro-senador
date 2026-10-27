/**
 * =====================================================================
 * TELAS/ACESSO.JS - LOGIN E TROCA DE SENHA
 * =====================================================================
 *   #form-login  : login (usuário padrão admin / admin; bloqueio progressivo em sessao.js)
 *   #form-troca  : troca obrigatória após o admin redefinir a senha
 *   #form-conta  : "Trocar minha senha" (modal, a qualquer momento)
 *
 * Exposto em: window.Admin.Telas.acesso
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var A = raiz.Admin;
    var UI = A.UI, $ = UI.$;

    /** Qual formulário mostrar na tela de acesso. */
    function mostrarFormulario(qual) {
        ['login', 'troca'].forEach(function (f) {
            $('form-' + f).classList.toggle('hidden', f !== qual);
        });
        $('acesso-titulo').textContent = { login: 'Área Restrita', troca: 'Nova senha' }[qual];
        var foco = { login: 'login-usuario', troca: 'troca-senha' }[qual];
        setTimeout(function () { $(foco).focus(); }, 50);
    }

    /** Desabilita o botão enquanto o hash da senha é calculado (~0,2 s). */
    function ocupado(form, sim) {
        var b = form.querySelector('button[type=submit]');
        if (b) b.disabled = sim;
    }

    /**
     * Troca a senha do usuário logado. atual = null na troca obrigatória
     * (logo após o login com senha provisória); no modal "Minha conta" a
     * senha atual é conferida (no navegador ou no servidor, conforme o modo).
     */
    function gravarNovaSenha(atual, nova) {
        return A.Repo.trocarMinhaSenha(atual, nova);
    }

    var Acesso = {
        /** Chamado pelo app quando não há sessão. */
        exibir: function () {
            var u = A.Sessao.usuarioAtual();
            if (u && u.trocarSenha) return mostrarFormulario('troca');
            mostrarFormulario('login');
        },

        /** Liga os eventos dos formulários de login, troca de senha e "minha conta". */
        iniciar: function () {
            /* ---- Login ---- */
            $('form-login').addEventListener('submit', function (e) {
                e.preventDefault();
                var form = e.target;
                var login = $('login-usuario').value;
                var senha = $('login-senha').value;
                if (!login.trim() || !senha) { UI.erroForm('login-erro', 'Informe usuário e senha.'); return; }
                ocupado(form, true);
                A.App.pronto.then(function () { return A.Sessao.entrar(login, senha); }).then(function (r) {
                    ocupado(form, false);
                    $('login-senha').value = '';
                    if (!r.ok) { UI.erroForm('login-erro', r.msg); $('login-senha').focus(); return; }
                    UI.erroForm('login-erro', '');
                    form.reset();
                    if (r.trocarSenha) { mostrarFormulario('troca'); return; }
                    UI.toast('Bem-vindo(a), ' + r.usuario.nome.split(' ')[0] + '!');
                    A.App.atualizarEstado('painel');
                });
            });


            /* ---- Troca obrigatória de senha ---- */
            $('form-troca').addEventListener('submit', function (e) {
                e.preventDefault();
                var form = e.target;
                var u = A.Sessao.usuarioAtual();
                if (!u) { Acesso.exibir(); return; }
                var nova = $('troca-senha').value;
                var erro = A.Seguranca.validarSenhaForte(nova, u.login) || (nova !== $('troca-senha2').value ? 'As senhas não conferem.' : '');
                UI.erroForm('troca-erro', erro);
                if (erro) return;
                ocupado(form, true);
                gravarNovaSenha(null, nova).then(function () {
                    ocupado(form, false);
                    form.reset();
                    UI.toast('Senha alterada. Bem-vindo(a)!');
                    A.App.atualizarEstado('painel');
                }).catch(function (erro) { ocupado(form, false); UI.erroForm('troca-erro', erro.message); });
            });

            /* ---- Minha conta (modal) ---- */
            var abrirConta = function () {
                var u = A.Sessao.usuarioAtual();
                if (!u) return;
                $('form-conta').reset();
                UI.erroForm('conta-erro', '');
                $('conta-ultimo').textContent = u.ultimoLoginAnterior ? 'Seu login anterior foi em ' + UI.Datas.dataHora(u.ultimoLoginAnterior) + '.' : '';
                A.App.fecharMenuMobile();
                UI.abrirModal('modal-conta');
            };
            $('btn-conta').addEventListener('click', abrirConta);
            $('btn-trocar-padrao').addEventListener('click', abrirConta);
            $('btn-conta-m').addEventListener('click', abrirConta);

            $('form-conta').addEventListener('submit', function (e) {
                e.preventDefault();
                var form = e.target;
                var u = A.Sessao.usuarioAtual();
                if (!u || !A.Sessao.exigir('senha.propria')) return;
                var atual = $('conta-atual').value, nova = $('conta-nova').value;
                var erro = A.Seguranca.validarSenhaForte(nova, u.login) || (nova !== $('conta-nova2').value ? 'As senhas não conferem.' : '');
                if (!erro && nova === atual) erro = 'A nova senha deve ser diferente da atual.';
                UI.erroForm('conta-erro', erro);
                if (erro) return;
                ocupado(form, true);
                gravarNovaSenha(atual, nova).then(function () {
                    ocupado(form, false);
                    UI.fecharModais();
                    A.App.atualizarEstado();
                    UI.toast('Senha alterada.');
                }).catch(function (erro) { ocupado(form, false); UI.erroForm('conta-erro', erro.message); });
            });

            /* ---- Botões "mostrar senha" ---- */
            document.querySelectorAll('.mostrar-senha').forEach(function (b) {
                b.addEventListener('click', function () {
                    var campo = $(b.dataset.alvo);
                    var mostrar = campo.type === 'password';
                    campo.type = mostrar ? 'text' : 'password';
                    b.innerHTML = '<i class="' + (mostrar ? 'ri-eye-off-line' : 'ri-eye-line') + ' text-lg"></i>';
                    b.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
                });
            });
        }
    };

    A.Telas = A.Telas || {};
    A.Telas.acesso = Acesso;
    A.gravarNovaSenha = gravarNovaSenha;
})(window);
