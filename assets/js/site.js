/**
 * =====================================================================
 * SITE.JS - COMPORTAMENTO DAS PÁGINAS PÚBLICAS DO CHAVEIRO SENADOR
 * =====================================================================
 *
 * Carregado no fim de todas as páginas públicas:
 *   chaveiro-em-santo-andre.html (início), chaveiro-santo-andre.html
 *   (quem somos), chaveiro-abc.html (serviços), chaveiro-sao-bernardo-
 *   do-campo.html (contato), chaveiro-maua.html (FAQ) e
 *   chaveiro-diadema.html (dicas). Cada módulo abaixo verifica
 * se os elementos que ele usa existem na página; se não existirem,
 * ele simplesmente não faz nada.
 *
 * Módulos:
 *   1. MenuMobile      - abre/fecha o menu "hambúrguer" no celular
 *   2. CarrosselMarcas - carrossel de logos das montadoras
 *   3. Formulario      - máscara de telefone, contador e envio por e-mail
 *   4. Perguntas       - acordeão das páginas FAQ e Dicas
 *   5. Notificacao     - aviso flutuante após enviar o formulário
 *   6. Carrosseis      - carrossel de serviços da home ([data-carrossel])
 *   7. Catalogo        - abre o serviço do endereço (#servico) na grade
 *   8. BuscaModelos    - busca de marca/modelo nas chaves codificadas;
 *                        no celular as marcas ficam recolhidas (toque abre)
 *
 * Limpeza (out/2026): o arquivo antigo tinha ~1.800 linhas com sliders,
 * formulários e efeitos que não existem mais nas páginas. Foi reescrito
 * mantendo só o que é usado. A versão anterior está no histórico do Git.
 * =====================================================================
 */
(function () {
    'use strict';

    /* =================================================================
       5. NOTIFICAÇÃO
       -----------------------------------------------------------------
       Mostra um aviso no canto da tela por 5 segundos.
       Usa textContent (e não innerHTML) para que nenhum texto vindo de
       formulário possa injetar HTML/JavaScript na página.
       ================================================================= */
    var Notificacao = {
        /**
         * @param {string} mensagem texto do aviso
         * @param {'success'|'error'|'info'} tipo cor do aviso
         */
        mostrar: function (mensagem, tipo) {
            // Só um aviso por vez
            var anterior = document.querySelector('.notification');
            if (anterior) anterior.remove();

            var caixa = document.createElement('div');
            caixa.className = 'notification notification-' + (tipo || 'info');
            caixa.setAttribute('role', 'status');

            var conteudo = document.createElement('div');
            conteudo.className = 'notification-content';

            var texto = document.createElement('span');
            texto.className = 'notification-message';
            texto.textContent = mensagem;

            var fechar = document.createElement('button');
            fechar.className = 'notification-close';
            fechar.type = 'button';
            fechar.setAttribute('aria-label', 'Fechar aviso');
            fechar.textContent = '×';
            fechar.addEventListener('click', function () { caixa.remove(); });

            conteudo.appendChild(texto);
            conteudo.appendChild(fechar);
            caixa.appendChild(conteudo);
            document.body.appendChild(caixa);

            setTimeout(function () { if (caixa.parentNode) caixa.remove(); }, 5000);
        }
    };

    /* =================================================================
       1. MENU MOBILE
       -----------------------------------------------------------------
       Elementos: #mobile-menu-button (botão), #mobile-menu (painel),
       #menu-icon / #close-icon (ícones que alternam) e .mobile-menu-link.
       O painel abre animando max-height de 0 até a altura do conteúdo.
       ================================================================= */
    var MenuMobile = {
        iniciar: function () {
            this.botao = document.getElementById('mobile-menu-button');
            this.painel = document.getElementById('mobile-menu');
            this.iconeAbrir = document.getElementById('menu-icon');
            this.iconeFechar = document.getElementById('close-icon');
            if (!this.botao || !this.painel) return;

            var self = this;
            this.botao.setAttribute('aria-expanded', 'false');
            this.botao.setAttribute('aria-controls', 'mobile-menu');

            // Clique no hambúrguer abre/fecha
            this.botao.addEventListener('click', function (e) {
                e.stopPropagation();
                self.estaAberto() ? self.fechar() : self.abrir();
            });

            // Clique em um link do menu fecha o painel
            document.querySelectorAll('.mobile-menu-link').forEach(function (link) {
                link.addEventListener('click', function () { self.fechar(); });
            });

            // Clique fora do menu fecha o painel
            document.addEventListener('click', function (e) {
                if (self.estaAberto() && !self.painel.contains(e.target) && !self.botao.contains(e.target)) {
                    self.fechar();
                }
            });

            // Tecla Esc fecha o painel
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && self.estaAberto()) self.fechar();
            });

            // Ao voltar para a largura de desktop (>= 1024px) o menu mobile some
            window.addEventListener('resize', function () {
                if (window.innerWidth >= 1024 && self.estaAberto()) self.fechar();
            });
        },

        /** O painel do menu mobile está aberto? */
        estaAberto: function () {
            var h = this.painel.style.maxHeight;
            return !!h && h !== '0px' && h !== '0';
        },

        /** Abre o menu mobile e trava a rolagem da página por trás. */
        abrir: function () {
            this.painel.style.maxHeight = this.painel.scrollHeight + 'px';
            if (this.iconeAbrir) this.iconeAbrir.classList.add('hidden');
            if (this.iconeFechar) this.iconeFechar.classList.remove('hidden');
            this.botao.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden'; // trava a rolagem por trás do menu
        },

        fechar: function () {
            this.painel.style.maxHeight = '0';
            if (this.iconeAbrir) this.iconeAbrir.classList.remove('hidden');
            if (this.iconeFechar) this.iconeFechar.classList.add('hidden');
            this.botao.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
    };

    /* =================================================================
       2. CARROSSEL DE MARCAS
       -----------------------------------------------------------------
       Elementos: #brands-carousel-wrapper (moldura), #brands-carousel
       (faixa com 3 páginas), #brands-carousel-prev / -next (setas) e
       .brand-indicator (bolinhas). Avança sozinho a cada 6 segundos e
       pausa quando o mouse está em cima.
       ================================================================= */
    var CarrosselMarcas = {
        INTERVALO_MS: 6000,

        /** Configura o carrossel de marcas: largura das páginas, setas, bolinhas e pausa no mouse. */
        iniciar: function () {
            this.faixa = document.getElementById('brands-carousel');
            this.moldura = document.getElementById('brands-carousel-wrapper');
            if (!this.faixa || !this.moldura) return;

            var self = this;
            this.paginas = Array.prototype.filter.call(this.faixa.children, function (el) { return el.tagName === 'DIV'; });
            this.total = this.paginas.length || 1;
            this.atual = 0;
            this.indicadores = document.querySelectorAll('.brand-indicator');
            this.timer = null;

            var anterior = document.getElementById('brands-carousel-prev');
            var proximo = document.getElementById('brands-carousel-next');
            if (anterior) anterior.addEventListener('click', function (e) { e.preventDefault(); self.irPara(self.atual - 1); self.reiniciarTimer(); });
            if (proximo) proximo.addEventListener('click', function (e) { e.preventDefault(); self.irPara(self.atual + 1); self.reiniciarTimer(); });

            this.indicadores.forEach(function (bolinha, i) {
                bolinha.setAttribute('role', 'button');
                bolinha.setAttribute('aria-label', 'Ir para o grupo ' + (i + 1) + ' de marcas');
                bolinha.addEventListener('click', function () { self.irPara(i); self.reiniciarTimer(); });
            });

            // Pausa o avanço automático com o mouse sobre o carrossel
            this.moldura.addEventListener('mouseenter', function () { self.pararTimer(); });
            this.moldura.addEventListener('mouseleave', function () { self.reiniciarTimer(); });

            this.irPara(0);
            this.reiniciarTimer();
        },

        /** Mostra a página "indice" (dá a volta no início/fim). */
        irPara: function (indice) {
            this.atual = (indice + this.total) % this.total;
            this.faixa.style.transform = 'translateX(' + (-this.atual * (100 / this.total)) + '%)';

            var atual = this.atual;
            this.indicadores.forEach(function (bolinha, i) {
                var ativo = i === atual;
                bolinha.classList.toggle('active', ativo);
                bolinha.classList.toggle('bg-blue-600', ativo);
                bolinha.classList.toggle('bg-gray-300', !ativo);
                bolinha.style.width = ativo ? '2rem' : '0.75rem'; // bolinha ativa vira "pílula"
                bolinha.style.height = '0.75rem';
                bolinha.setAttribute('aria-current', ativo ? 'true' : 'false');
            });
        },

        /** Para o avanço automático do carrossel de marcas. */
        pararTimer: function () {
            if (this.timer) clearInterval(this.timer);
            this.timer = null;
        },

        /** Recomeça a contagem do avanço automático (6 s). */
        reiniciarTimer: function () {
            var self = this;
            this.pararTimer();
            this.timer = setInterval(function () { self.irPara(self.atual + 1); }, this.INTERVALO_MS);
        }
    };

    /* =================================================================
       3. FORMULÁRIO DE CONTATO (chaveiro-em-santo-andre.html e chaveiro-sao-bernardo-do-campo.html)
       -----------------------------------------------------------------
       Elementos: #cta-contact-form e os campos #cta-name, #cta-email,
       #cta-phone, #cta-service, #cta-message, #cta-charCount.
       Ao enviar, abre o programa de e-mail do visitante já preenchido
       (mailto:). Não há servidor recebendo os dados.
       ================================================================= */
    var Formulario = {
        EMAIL_DESTINO: 'chaveirosenadorltda@outlook.com',
        LIMITE_MENSAGEM: 500,

        /** Liga máscara de telefone, contador de caracteres e envio do formulário de contato. */
        iniciar: function () {
            var form = document.getElementById('cta-contact-form');
            if (!form) return;

            var telefone = document.getElementById('cta-phone');
            var mensagem = document.getElementById('cta-message');
            var contador = document.getElementById('cta-charCount');
            var self = this;

            // Máscara do telefone: (11) 99999-9999 ou (11) 9999-9999
            if (telefone) {
                telefone.addEventListener('input', function () {
                    telefone.value = self.mascararTelefone(telefone.value);
                });
            }

            // Contador de caracteres que muda de cor perto do limite
            if (mensagem && contador) {
                mensagem.addEventListener('input', function () {
                    self.atualizarContador(mensagem, contador);
                });
            }

            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var dados = new FormData(form);
                var campos = {
                    nome: String(dados.get('name') || '').trim(),
                    telefone: String(dados.get('phone') || '').trim(),
                    email: String(dados.get('email') || '').trim(),
                    servico: String(dados.get('service') || '').trim(),
                    mensagem: String(dados.get('message') || '').trim().slice(0, self.LIMITE_MENSAGEM)
                };

                var erro = self.validar(campos);
                if (erro) {
                    Notificacao.mostrar(erro, 'error');
                    return;
                }

                self.enviarPorEmail(campos);
                Notificacao.mostrar('Formulário enviado com sucesso! Entraremos em contato em breve.', 'success');
                form.reset();
                if (contador) self.atualizarContador({ value: '' }, contador);
            });
        },

        /** Formata apenas os dígitos digitados no padrão de telefone brasileiro. */
        mascararTelefone: function (valor) {
            var d = valor.replace(/\D/g, '').slice(0, 11);
            if (d.length <= 2) return d.length ? '(' + d : '';
            if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
            if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
            return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
        },

        /** Mostra quantos caracteres foram digitados e muda a cor perto do limite. */
        atualizarContador: function (campo, contador) {
            var n = campo.value.length;
            contador.textContent = n;
            contador.style.color = n > 450 ? '#dc3545' : (n > 400 ? '#ffc107' : '#6c757d');
        },

        /** Retorna a mensagem de erro do primeiro campo inválido, ou '' se tudo ok. */
        validar: function (c) {
            if (c.nome.length < 3) return 'Informe seu nome completo.';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return 'Informe um e-mail válido.';
            if (c.telefone.replace(/\D/g, '').length < 10) return 'Informe um telefone com DDD.';
            if (!c.servico) return 'Selecione o serviço desejado.';
            if (c.mensagem.length < 5) return 'Escreva uma mensagem.';
            return '';
        },

        /** Monta o e-mail e abre o programa de e-mail do visitante. */
        enviarPorEmail: function (c) {
            var corpo = 'Olá,\n\nRecebemos um novo contato através do site:\n\n' +
                'Nome: ' + c.nome + '\n' +
                'Telefone: ' + c.telefone + '\n' +
                'E-mail: ' + c.email + '\n' +
                (c.servico ? 'Serviço Desejado: ' + c.servico + '\n' : '') +
                'Mensagem: ' + c.mensagem + '\n\n---\nEste email foi enviado automaticamente pelo site.';
            window.location.href = 'mailto:' + this.EMAIL_DESTINO +
                '?subject=' + encodeURIComponent('Novo Contato - Chaveiro Senador') +
                '&body=' + encodeURIComponent(corpo);
        }
    };

    /* =================================================================
       4. PERGUNTAS (acordeão das páginas FAQ e Dicas)
       -----------------------------------------------------------------
       Cada .faq-question é um botão; a resposta é o elemento logo
       depois dele (.faq-answer). Abre uma por vez e gira a seta.
       ================================================================= */
    var Perguntas = {
        /** Liga o clique de cada pergunta: abre uma resposta por vez e gira a seta. */
        iniciar: function () {
            var perguntas = document.querySelectorAll('.faq-question');
            if (!perguntas.length) return;

            perguntas.forEach(function (pergunta) {
                pergunta.setAttribute('aria-expanded', 'false');

                pergunta.addEventListener('click', function () {
                    var resposta = pergunta.nextElementSibling;
                    var estavaAberta = resposta && !resposta.classList.contains('hidden');

                    // Fecha todas
                    document.querySelectorAll('.faq-answer').forEach(function (r) { r.classList.add('hidden'); });
                    document.querySelectorAll('.faq-icon').forEach(function (i) { i.classList.remove('rotate-180'); });
                    perguntas.forEach(function (p) { p.setAttribute('aria-expanded', 'false'); });

                    // Abre a clicada (se estava fechada)
                    if (resposta && !estavaAberta) {
                        resposta.classList.remove('hidden');
                        var icone = pergunta.querySelector('.faq-icon');
                        if (icone) icone.classList.add('rotate-180');
                        pergunta.setAttribute('aria-expanded', 'true');
                    }
                });
            });
        }
    };

    /* =================================================================
       6. CARROSSÉIS DE SERVIÇOS ([data-carrossel])
       -----------------------------------------------------------------
       A rolagem é do próprio navegador (CSS scroll-snap), então funciona
       arrastando no celular. Este módulo só adiciona:
         - setas que avançam/voltam uma "página" de cartões
         - bolinhas de posição (uma por página)
         - avanço automático opcional (data-autoplay="ms"), que pausa
           com o mouse em cima, ao tocar ou com foco do teclado
         - abrir direto no cartão do endereço (ex.: #chave-codificada)
       ================================================================= */
    var Carrosseis = {
        iniciar: function () {
            var self = this;
            document.querySelectorAll('[data-carrossel]').forEach(function (raiz) { self.montar(raiz); });
        },

        /** Prepara um carrossel: setas, bolinhas, teclado, avanço automático e #endereço. */
        montar: function (raiz) {
            var trilho = raiz.querySelector('[data-carrossel-trilho]');
            var anterior = raiz.querySelector('[data-carrossel-anterior]');
            var proximo = raiz.querySelector('[data-carrossel-proximo]');
            var pontos = raiz.querySelector('[data-carrossel-pontos]');
            if (!trilho) return;

            /** Cartões do carrossel (filhos da faixa). */
            var cartoes = function () { return Array.prototype.slice.call(trilho.children); };
            /** Quantos cartões cabem na largura visível. */
            var porPagina = function () {
                var c = cartoes()[0];
                return c ? Math.max(1, Math.round(trilho.clientWidth / c.getBoundingClientRect().width)) : 1;
            };
            /** Quantas "páginas" de cartões existem para a largura atual. */
            var totalPaginas = function () { return Math.max(1, Math.ceil(cartoes().length / porPagina())); };
            var paginaAtual = function () {
                var max = trilho.scrollWidth - trilho.clientWidth;
                if (max <= 0) return 0;
                return Math.round((trilho.scrollLeft / max) * (totalPaginas() - 1));
            };
            /** Rola suavemente até a página n (dá a volta no início/fim). */
            var irParaPagina = function (n) {
                var total = totalPaginas();
                n = (n + total) % total; // dá a volta no fim
                var alvo = cartoes()[Math.min(n * porPagina(), cartoes().length - 1)];
                trilho.scrollTo({ left: alvo.offsetLeft - trilho.offsetLeft - 4, behavior: 'smooth' });
            };

            // Bolinhas: refeitas quando muda o número de páginas (ex.: girar o celular)
            var desenharPontos = function () {
                if (!pontos) return;
                var total = totalPaginas();
                if (pontos.children.length !== total) {
                    pontos.innerHTML = '';
                    for (var i = 0; i < total; i++) {
                        var b = document.createElement('button');
                        b.type = 'button';
                        b.setAttribute('aria-label', 'Ir para o grupo ' + (i + 1) + ' de ' + total);
                        b.addEventListener('click', (function (n) { return function () { irParaPagina(n); reiniciar(); }; })(i));
                        pontos.appendChild(b);
                    }
                }
                var atual = paginaAtual();
                Array.prototype.forEach.call(pontos.children, function (b, i) {
                    b.classList.toggle('ativo', i === atual);
                    b.setAttribute('aria-current', i === atual ? 'true' : 'false');
                });
            };

            /** Desabilita as setas no início/fim (exceto com avanço automático). */
            var atualizarSetas = function () {
                var max = trilho.scrollWidth - trilho.clientWidth - 2;
                var auto = raiz.hasAttribute('data-autoplay'); // com avanço automático as setas dão a volta
                if (anterior) anterior.disabled = !auto && trilho.scrollLeft <= 2;
                if (proximo) proximo.disabled = !auto && trilho.scrollLeft >= max;
            };

            if (anterior) anterior.addEventListener('click', function () { irParaPagina(paginaAtual() - 1); reiniciar(); });
            if (proximo) proximo.addEventListener('click', function () { irParaPagina(paginaAtual() + 1); reiniciar(); });

            // Teclado: setas esquerda/direita com o foco no carrossel
            trilho.addEventListener('keydown', function (e) {
                if (e.key === 'ArrowRight') { e.preventDefault(); irParaPagina(paginaAtual() + 1); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); irParaPagina(paginaAtual() - 1); }
            });

            var agendado = null;
            trilho.addEventListener('scroll', function () {
                if (agendado) return;
                agendado = requestAnimationFrame(function () { agendado = null; desenharPontos(); atualizarSetas(); });
            }, { passive: true });
            window.addEventListener('resize', function () { desenharPontos(); atualizarSetas(); });

            // Avanço automático (só se pedido e se o usuário não preferir menos movimento)
            var intervalo = parseInt(raiz.getAttribute('data-autoplay'), 10);
            var reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            var timer = null, pausado = false;
            /** Recomeça o avanço automático, se ativado e se o usuário não pediu menos movimento. */
            function reiniciar() {
                if (timer) clearInterval(timer);
                timer = null;
                if (!intervalo || reduzir) return;
                timer = setInterval(function () { if (!pausado) irParaPagina(paginaAtual() + 1); }, intervalo);
            }
            ['mouseenter', 'focusin', 'touchstart'].forEach(function (ev) { raiz.addEventListener(ev, function () { pausado = true; }, { passive: true }); });
            ['mouseleave', 'focusout'].forEach(function (ev) { raiz.addEventListener(ev, function () { pausado = false; }); });

            // Endereço com #servico: rola até o cartão e abre os detalhes
            var abrirDoEndereco = function () {
                var id = decodeURIComponent((location.hash || '').slice(1));
                var alvo = id && document.getElementById(id);
                if (!alvo || alvo.parentNode !== trilho) return;
                trilho.scrollTo({ left: alvo.offsetLeft - trilho.offsetLeft - 4, behavior: 'auto' });
                var det = alvo.querySelector('details');
                if (det) det.open = true;
                raiz.scrollIntoView({ block: 'center' });
                alvo.classList.add('destaque');
                setTimeout(function () { alvo.classList.remove('destaque'); }, 2500);
            };
            window.addEventListener('hashchange', abrirDoEndereco);

            desenharPontos();
            atualizarSetas();
            reiniciar();
            setTimeout(abrirDoEndereco, 150);
        }
    };

    /* =================================================================
       7. CATÁLOGO EM GRADE (chaveiro-abc.html)
       -----------------------------------------------------------------
       Quando a página abre com #servico no endereço (link "Saiba mais"
       da home), rola até o cartão, abre "Ver detalhes" e o destaca.
       ================================================================= */
    var Catalogo = {
        iniciar: function () {
            var grade = document.querySelector('.grade-servicos');
            if (!grade) return;
            /** Abre o cartão indicado no endereço (#servico): rola, abre os detalhes e destaca. */
            var abrir = function () {
                var id = decodeURIComponent((location.hash || '').slice(1));
                var alvo = id && document.getElementById(id);
                if (!alvo || !grade.contains(alvo)) return;
                var det = alvo.querySelector('details');
                if (det) det.open = true;
                alvo.scrollIntoView({ block: 'center' });
                alvo.classList.add('destaque');
                setTimeout(function () { alvo.classList.remove('destaque'); }, 2500);
            };
            window.addEventListener('hashchange', abrir);
            setTimeout(abrir, 150);
        }
    };

    /* =================================================================
       8. BUSCA DE MODELOS - CHAVES CODIFICADAS (chaveiro-abc.html)
       -----------------------------------------------------------------
       Ao digitar no campo #busca-modelo:
         - esconde as marcas que não têm o texto no nome nem nos modelos
         - destaca (classe .achou) as etiquetas dos modelos encontrados
         - atualiza o contador e mostra um aviso quando nada é encontrado
       A comparação ignora acentos e maiúsculas: o HTML já traz o texto
       normalizado em data-busca (cartão) e data-modelo (etiqueta).
       O cartão de WhatsApp (.marca-chave-cta) fica sempre visível.

       Celular (até 639px): para a lista não ficar enorme, cada marca
       mostra só o cabeçalho; tocar nele (ou Enter/Espaço no teclado)
       abre os modelos (.aberto). Ao buscar, as marcas encontradas
       abrem sozinhas. A classe .recolhivel na grade liga esse visual
       no CSS (seção 15); sem JavaScript tudo fica aberto.
       ================================================================= */
    var BuscaModelos = {
        iniciar: function () {
            var caixa = document.querySelector('[data-busca-modelos]');
            var grade = document.querySelector('.grade-marcas');
            if (!caixa || !grade) return;
            var campo = caixa.querySelector('input');
            var resultado = caixa.querySelector('.busca-modelos-resultado');
            var cartoes = Array.prototype.slice.call(grade.querySelectorAll('.marca-chave[data-busca]'));
            var textoInicial = resultado.textContent;

            // Aviso "nada encontrado" (criado uma vez e escondido)
            var vazio = document.createElement('p');
            vazio.className = 'marca-chave-vazio';
            vazio.hidden = true;
            vazio.textContent = 'Não encontramos esse modelo na lista, mas provavelmente fazemos a chave. Consulte pelo WhatsApp.';
            grade.insertBefore(vazio, grade.querySelector('.marca-chave-cta'));

            /** Remove acentos e passa para minúsculas ("Mégane" -> "megane"). */
            var normalizar = function (t) {
                return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            };

            /** Aplica o filtro digitado aos cartões e às etiquetas. */
            var filtrar = function () {
                var termo = normalizar(campo.value);
                var marcas = 0, modelos = 0;
                cartoes.forEach(function (c) {
                    var bate = !termo || c.getAttribute('data-busca').indexOf(termo) !== -1;
                    c.classList.toggle('oculto', !bate);
                    c.querySelectorAll('li[data-modelo]').forEach(function (li) {
                        var achou = !!termo && li.getAttribute('data-modelo').indexOf(termo) !== -1;
                        li.classList.toggle('achou', achou);
                        if (achou) modelos++;
                    });
                    if (bate) marcas++;
                });
                vazio.hidden = marcas > 0;
                if (!termo) resultado.textContent = textoInicial;
                else if (!marcas) resultado.textContent = 'Nenhum resultado para "' + campo.value.trim() + '".';
                else resultado.textContent = marcas + (marcas === 1 ? ' marca' : ' marcas') +
                    (modelos ? ' · ' + modelos + (modelos === 1 ? ' modelo encontrado' : ' modelos encontrados') : '');
            };

            /* ---- Marcas recolhíveis no celular ---- */
            var celular = window.matchMedia ? window.matchMedia('(max-width: 639px)') : { matches: false };
            grade.classList.add('recolhivel');

            /** Abre/fecha uma marca e atualiza o aria-expanded. */
            var definirAberto = function (cartao, aberto) {
                cartao.classList.toggle('aberto', aberto);
                var topo = cartao.querySelector('.marca-chave-topo');
                if (topo && celular.matches) topo.setAttribute('aria-expanded', aberto ? 'true' : 'false');
            };

            /** No celular o cabeçalho vira botão; no computador volta ao normal. */
            var prepararTopos = function () {
                cartoes.forEach(function (c) {
                    var topo = c.querySelector('.marca-chave-topo');
                    if (!topo) return;
                    if (celular.matches) {
                        topo.setAttribute('role', 'button');
                        topo.setAttribute('tabindex', '0');
                        topo.setAttribute('aria-expanded', c.classList.contains('aberto') ? 'true' : 'false');
                    } else {
                        ['role', 'tabindex', 'aria-expanded'].forEach(function (a) { topo.removeAttribute(a); });
                    }
                });
            };

            cartoes.forEach(function (c) {
                var topo = c.querySelector('.marca-chave-topo');
                if (!topo) return;
                topo.addEventListener('click', function () {
                    if (celular.matches) definirAberto(c, !c.classList.contains('aberto'));
                });
                topo.addEventListener('keydown', function (e) {
                    if (!celular.matches || (e.key !== 'Enter' && e.key !== ' ')) return;
                    e.preventDefault();
                    definirAberto(c, !c.classList.contains('aberto'));
                });
            });
            prepararTopos();
            if (celular.addEventListener) celular.addEventListener('change', prepararTopos);

            /** Depois de filtrar: marcas encontradas abrem; busca vazia recolhe tudo. */
            var abrirEncontradas = function () {
                var termo = normalizar(campo.value);
                cartoes.forEach(function (c) { definirAberto(c, !!termo && !c.classList.contains('oculto')); });
            };

            campo.addEventListener('input', function () { filtrar(); abrirEncontradas(); });
            // Esc limpa a busca
            campo.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') { campo.value = ''; filtrar(); abrirEncontradas(); }
            });
        }
    };

    /* =================================================================
       INICIALIZAÇÃO
       ================================================================= */
    document.addEventListener('DOMContentLoaded', function () {
        MenuMobile.iniciar();
        CarrosselMarcas.iniciar();
        Formulario.iniciar();
        Perguntas.iniciar();
        Carrosseis.iniciar();
        Catalogo.iniciar();
        BuscaModelos.iniciar();
    });
})();
