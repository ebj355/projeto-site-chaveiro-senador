/**
 * =====================================================================
 * TELAS/USUARIOS.JS - CADASTRO DE USUÁRIOS (somente Administrador)
 * =====================================================================
 *   - Cadastrar (nome, usuário, senha forte, perfil, troca no 1º login)
 *   - Redefinir senha (o usuário é obrigado a trocar no próximo login)
 *   - Desativar / reativar (bloqueia o acesso sem apagar o histórico)
 *   - Remover
 *   Proteções: não remove nem desativa a si mesmo nem o último
 *   Administrador ativo. Tudo vai para a auditoria.
 *
 * Exposto em: window.Admin.Telas.usuarios
 * =====================================================================
 */
(function (raiz) {
    'use strict';

    var A = raiz.Admin;
    var UI = A.UI, $ = UI.$, esc = UI.esc, D = UI.Datas;

    /** Quantos Administradores ativos existem (nunca pode chegar a zero). */
    function adminsAtivos(lista) {
        return lista.filter(function (u) { return u.perfil === 'admin' && u.ativo !== false; }).length;
    }

    /** Redesenha a lista de usuários com perfil, situação e último login. */
    function renderizar() {
        var eu = A.Sessao.usuarioAtual();
        $('lista-usuarios').innerHTML = A.Dados.usuarios().map(function (u) {
            var admin = u.perfil === 'admin';
            var ativo = u.ativo !== false;
            var meu = u.id === eu.id;
            return '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200 rounded-xl p-4' + (ativo ? '' : ' bg-slate-50 opacity-80') + '">' +
                '<div class="flex items-center gap-3 min-w-0">' +
                '<span class="avatar" style="' + (admin ? '' : 'background:#2563eb;color:#fff') + '">' + esc(u.nome.split(/\s+/).map(function (p) { return p[0]; }).slice(0, 2).join('').toUpperCase()) + '</span>' +
                '<div class="min-w-0"><p class="font-semibold text-gray-900 break-words">' + esc(u.nome) + (meu ? ' <span class="text-xs text-gray-500">(você)</span>' : '') + '</p>' +
                '<p class="text-sm text-gray-500 flex flex-wrap items-center gap-2">@' + esc(u.login) +
                ' <span class="selo ' + (admin ? 'selo-admin' : 'selo-operador') + '">' + (admin ? 'Administrador' : 'Operador') + '</span>' +
                (ativo ? '' : ' <span class="selo selo-inativo">Desativado</span>') +
                (u.trocarSenha ? ' <span class="selo selo-inativo">Troca de senha pendente</span>' : '') + '</p>' +
                '<p class="text-xs text-gray-400">Último login: ' + (u.ultimoLogin ? esc(D.dataHora(u.ultimoLogin)) : 'nunca') + '</p></div></div>' +
                '<div class="flex flex-wrap gap-2 sm:flex-shrink-0">' +
                '<button class="btn btn-secundario btn-pequeno" data-usu-senha="' + esc(u.id) + '"><i class="ri-key-2-line"></i> Redefinir senha</button>' +
                (meu ? '' : '<button class="btn btn-secundario btn-pequeno" data-usu-ativo="' + esc(u.id) + '">' + (ativo ? '<i class="ri-forbid-line"></i> Desativar' : '<i class="ri-check-line"></i> Reativar') + '</button>' +
                    '<button class="btn-icone" data-usu-remover="' + esc(u.id) + '" title="Remover usuário" aria-label="Remover usuário"><i class="ri-delete-bin-6-line"></i></button>') +
                '</div></div>';
        }).join('');
    }

    /** Valida e cadastra um novo usuário (senha com hash PBKDF2). */
    function cadastrar(e) {
        e.preventDefault();
        if (!A.Sessao.exigir('usuarios.gerenciar')) return;
        var form = e.target;
        var nome = $('usu-nome').value, login = $('usu-login').value, senha = $('usu-senha').value;
        var perfil = $('usu-perfil').value === 'admin' ? 'admin' : 'operador';
        var erro = A.Sessao.validarNovoUsuario(nome, login, senha);
        UI.erroForm('usu-erro', erro);
        if (erro) return;
        form.querySelector('button[type=submit]').disabled = true;
        A.Sessao.criarUsuario(nome, login, senha, perfil, $('usu-trocar').checked).then(function (u) {
            var lista = A.Dados.usuarios();
            lista.push(u);
            A.Dados.salvar(A.Dados.CHAVES.usuarios, lista);
            A.Auditoria.registrar('USUARIO_CRIADO', { alvo: u.login, perfil: u.perfil });
            form.reset();
            $('usu-trocar').checked = true;
            form.querySelector('button[type=submit]').disabled = false;
            UI.toast('Usuário cadastrado.');
            renderizar();
        });
    }

    /** Desativa ou reativa um usuário (não apaga o histórico dele). */
    function alternarAtivo(id) {
        if (!A.Sessao.exigir('usuarios.gerenciar')) return;
        var lista = A.Dados.usuarios();
        var alvo = lista.find(function (u) { return u.id === id; });
        var eu = A.Sessao.usuarioAtual();
        if (!alvo || alvo.id === eu.id) return;
        var desativar = alvo.ativo !== false;
        if (desativar && alvo.perfil === 'admin' && adminsAtivos(lista) <= 1) { UI.toast('É preciso manter ao menos um Administrador ativo.', 'erro'); return; }
        alvo.ativo = !desativar;
        A.Dados.salvar(A.Dados.CHAVES.usuarios, lista);
        A.Auditoria.registrar(desativar ? 'USUARIO_DESATIVADO' : 'USUARIO_ATIVADO', { alvo: alvo.login });
        UI.toast(desativar ? 'Usuário desativado: ele não consegue mais entrar.' : 'Usuário reativado.', 'info');
        renderizar();
    }

    /** Remove um usuário (com confirmação; nunca a si mesmo nem o último admin). */
    function remover(id) {
        if (!A.Sessao.exigir('usuarios.gerenciar')) return;
        var lista = A.Dados.usuarios();
        var alvo = lista.find(function (u) { return u.id === id; });
        var eu = A.Sessao.usuarioAtual();
        if (!alvo) return;
        if (alvo.id === eu.id) { UI.toast('Você não pode remover o próprio usuário.', 'erro'); return; }
        if (alvo.perfil === 'admin' && alvo.ativo !== false && adminsAtivos(lista) <= 1) { UI.toast('É preciso manter ao menos um Administrador ativo.', 'erro'); return; }
        UI.confirmar('Remover usuário?', alvo.nome + ' (@' + alvo.login + ') perderá o acesso ao painel. Os registros de auditoria dele continuam guardados.', function () {
            if (!A.Sessao.exigir('usuarios.gerenciar')) return;
            A.Dados.salvar(A.Dados.CHAVES.usuarios, A.Dados.usuarios().filter(function (u) { return u.id !== id; }));
            A.Auditoria.registrar('USUARIO_REMOVIDO', { alvo: alvo.login, perfil: alvo.perfil });
            UI.toast('Usuário removido.', 'info');
            renderizar();
        }, { rotulo: 'Remover' });
    }

    /** Define uma senha provisória; o usuário troca no próximo login. */
    function redefinirSenha(id) {
        if (!A.Sessao.exigir('usuarios.gerenciar')) return;
        var alvo = A.Dados.usuarios().find(function (u) { return u.id === id; });
        if (!alvo) return;
        var html = '<label for="nova-senha" class="rotulo">Nova senha (mín. 8, letras e números)</label>' +
            '<input id="nova-senha" type="password" class="campo" autocomplete="new-password" maxlength="128">' +
            '<p class="erro-campo" data-erro="nova-senha"></p>' +
            '<p class="text-xs text-gray-500 mt-2">' + esc(alvo.nome) + ' será obrigado(a) a criar uma senha nova no próximo login.</p>';
        UI.confirmar('Redefinir senha', 'Defina uma senha provisória para ' + alvo.nome + '.', function () {
            if (!A.Sessao.exigir('usuarios.gerenciar')) return false;
            var senha = $('nova-senha').value;
            var erro = A.Seguranca.validarSenhaForte(senha, alvo.login);
            if (erro) { UI.erroCampo('nova-senha', erro); return false; }
            return A.Seguranca.hashSenha(senha).then(function (h) {
                var lista = A.Dados.usuarios();
                var u = lista.find(function (x) { return x.id === id; });
                u.senha = h;
                delete u.hash; delete u.sal;
                u.senhaPadrao = false;
                // Ao redefinir a própria senha não há troca obrigatória
                u.trocarSenha = u.id !== A.Sessao.usuarioAtual().id;
                A.Dados.salvar(A.Dados.CHAVES.usuarios, lista);
                A.Auditoria.registrar('SENHA_REDEFINIDA', { alvo: u.login });
                UI.toast('Senha redefinida.');
                renderizar();
            });
        }, { rotulo: 'Salvar senha', estilo: 'normal', htmlExtra: html });
        setTimeout(function () { $('nova-senha').focus(); }, 60);
    }

    A.Telas = A.Telas || {};
    A.Telas.usuarios = {
        titulo: 'Usuários',
        subtitulo: 'Funcionários e administradores',
        permissao: 'usuarios.gerenciar',
        renderizar: renderizar,
        /** Liga o formulário de cadastro e os botões de cada usuário. */
        iniciar: function () {
            $('form-usuario').addEventListener('submit', cadastrar);
            document.addEventListener('click', function (e) {
                var b = e.target.closest('[data-usu-senha],[data-usu-ativo],[data-usu-remover]');
                if (!b) return;
                if (b.dataset.usuSenha) redefinirSenha(b.dataset.usuSenha);
                else if (b.dataset.usuAtivo) alternarAtivo(b.dataset.usuAtivo);
                else remover(b.dataset.usuRemover);
            });
        }
    };
})(window);
