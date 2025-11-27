// Variáveis globais
let currentSlideIndex = 0;
let currentMainSlideIndex = 0;
let currentServiceSlideIndex = 0;
let slideInterval;
let mainSlideInterval;
let serviceSlideInterval;
const totalSlides = 3;
const totalServiceSlides = 2;

// Variáveis do novo slider
let slideAtual = 0;
let totalSlidesNovo = 3;
let intervaloSlider;

// Inicialização quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, inicializando componentes...');
    inicializarNovoSlider();
    initializeCarousel();
    initializeServiceDescriptions();
    initializeSmoothScrolling();
    initializeAnimations();
    initializeWhatsAppButton();
    initializeContactForm();
    initializeServiceCarousel();
    initializeSecondContactForm();
    initializeOrcamentoForm();
    initializeFinalContactForm();
    initializeCtaContactForm();
    initializeContactFormNew();
    console.log('Todos os componentes inicializados');
});

// Função para alternar descrições dos serviços
function toggleDescription(serviceId) {
    const description = document.getElementById(serviceId);
    const allDescriptions = document.querySelectorAll('.service-description');
    
    // Fechar todas as outras descrições
    allDescriptions.forEach(desc => {
        if (desc.id !== serviceId) {
            desc.classList.remove('show');
        }
    });
    
    // Alternar a descrição atual
    if (description.classList.contains('show')) {
        description.classList.remove('show');
    } else {
        description.classList.add('show');
        
        // Scroll suave para o serviço
        description.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }
}

// Inicializar novo slider
function inicializarNovoSlider() {
    console.log('Inicializando novo slider...');
    
    const slides = document.querySelectorAll('.slider-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    if (!slides.length) {
        console.log('Slides não encontrados');
        return;
    }
    
    console.log('Slides encontrados:', slides.length);
    console.log('Indicators encontrados:', indicators.length);
    
    // Função para mostrar slide
    function mostrarSlide(index) {
        // Remover active de todos
        slides.forEach(slide => slide.classList.remove('active'));
        indicators.forEach(indicator => indicator.classList.remove('active'));
        
        // Adicionar active ao slide atual
        if (slides[index]) {
            slides[index].classList.add('active');
        }
        if (indicators[index]) {
            indicators[index].classList.add('active');
        }
        
        slideAtual = index;
        console.log('Slide ativo:', index + 1);
    }
    
    // Função para próximo slide
    function proximoSlide() {
        let novoIndex = slideAtual + 1;
        if (novoIndex >= totalSlidesNovo) {
            novoIndex = 0;
        }
        mostrarSlide(novoIndex);
    }
    
    // Função para slide anterior
    function slideAnterior() {
        let novoIndex = slideAtual - 1;
        if (novoIndex < 0) {
            novoIndex = totalSlidesNovo - 1;
        }
        mostrarSlide(novoIndex);
    }
    
    // Funções globais
    window.mudarSlide = function(direcao) {
        if (direcao === 1) {
            proximoSlide();
        } else {
            slideAnterior();
        }
    };
    
    window.irParaSlide = function(index) {
        mostrarSlide(index);
    };
    
    // Inicializar primeiro slide
    mostrarSlide(0);
    
    // Auto-play
    intervaloSlider = setInterval(proximoSlide, 4000);
    
    // Pausar no hover
    const slider = document.querySelector('.novo-slider');
    if (slider) {
        slider.addEventListener('mouseenter', () => {
            clearInterval(intervaloSlider);
        });
        
        slider.addEventListener('mouseleave', () => {
            intervaloSlider = setInterval(proximoSlide, 4000);
        });
    }
    
    console.log('Novo slider inicializado com sucesso!');
}

// Inicializar carrossel de logos
// Variáveis globais para o carrossel de marcas
let brandsCarouselInterval = null;
let currentBrandSlide = 0;
const totalBrandSlides = 3;

// Função para inicializar o carrossel de marcas (refeito do zero)
function initializeCarousel() {
    const carousel = document.getElementById('brands-carousel');
    const carouselWrapper = document.getElementById('brands-carousel-wrapper');
    
    if (!carousel) {
        console.error('Carrossel de marcas não encontrado');
        return;
    }
    
    if (!carouselWrapper) {
        console.error('Wrapper do carrossel não encontrado');
        return;
    }
    
    // Buscar indicadores - procurar em toda a página
    const indicators = document.querySelectorAll('.brand-indicator');
        
    if (indicators.length === 0) {
        console.warn('Indicadores não encontrados, mas continuando...');
    }
    
    // Configurar wrapper - garantir overflow hidden
    carouselWrapper.style.overflow = 'hidden';
    carouselWrapper.style.width = '100%';
    carouselWrapper.style.position = 'relative';
    
    // Configurar carrossel
    carousel.style.display = 'flex';
    carousel.style.transition = 'transform 0.5s ease-in-out';
    carousel.style.width = '300%';
    carousel.style.position = 'relative';
    
    // Garantir que cada slide tenha exatamente 33.333% de largura
    // Usar children em vez de querySelectorAll para obter filhos diretos
    const slides = Array.from(carousel.children).filter(child => child.tagName === 'DIV');
    console.log('Slides encontrados:', slides.length);
    const slideWidth = 100 / totalBrandSlides; // 33.333% para 3 slides
    slides.forEach((slide, index) => {
        slide.style.width = `${slideWidth}%`;
        slide.style.flexShrink = '0';
        slide.style.flexGrow = '0';
        slide.style.minWidth = `${slideWidth}%`;
        slide.style.maxWidth = `${slideWidth}%`;
        console.log(`Slide ${index} configurado com largura ${slideWidth}%`);
    });
    
    // Função para atualizar posição do carrossel
    function updateBrandsCarousel() {
        // Calcular a porcentagem de deslocamento baseada no slide atual
        // Cada slide ocupa 33.333% da largura total (300%)
        const translateX = -(currentBrandSlide * (100 / totalBrandSlides));
        carousel.style.transform = `translateX(${translateX}%)`;
        carousel.style.webkitTransform = `translateX(${translateX}%)`; // Para compatibilidade
        console.log('Carrossel atualizado - Slide:', currentBrandSlide + 1, 'de', totalBrandSlides, 'TranslateX:', translateX + '%');
    }
    
    // Função para atualizar indicadores
    function updateBrandsIndicators() {
        indicators.forEach((indicator, index) => {
            if (index === currentBrandSlide) {
                indicator.classList.add('active');
                indicator.classList.remove('bg-gray-300');
                indicator.classList.add('bg-blue-600');
                indicator.style.width = '2rem';
                indicator.style.height = '0.75rem';
            } else {
                indicator.classList.remove('active');
                indicator.classList.add('bg-gray-300');
                indicator.classList.remove('bg-blue-600');
                indicator.style.width = '0.75rem';
                indicator.style.height = '0.75rem';
            }
        });
    }
    
    // Função para próximo slide
    function nextBrandSlide() {
        currentBrandSlide = (currentBrandSlide + 1) % totalBrandSlides;
        updateBrandsCarousel();
        updateBrandsIndicators();
    }
    
    // Função para slide anterior
    function prevBrandSlide() {
        currentBrandSlide = (currentBrandSlide - 1 + totalBrandSlides) % totalBrandSlides;
        updateBrandsCarousel();
        updateBrandsIndicators();
    }
    
    // Função para reiniciar auto-play
    function resetAutoPlay() {
        if (brandsCarouselInterval) {
            clearInterval(brandsCarouselInterval);
        }
        brandsCarouselInterval = setInterval(nextBrandSlide, 6000); // 6 segundos
    }
    
    // Adicionar eventos aos botões de seta - usar event delegation para garantir que funcione
    // Primeiro, remover event listeners anteriores se existirem
    const prevButton = document.getElementById('brands-carousel-prev');
    const nextButton = document.getElementById('brands-carousel-next');
    
    if (prevButton) {
        // Remover listeners anteriores
        const newPrevButton = prevButton.cloneNode(true);
        prevButton.parentNode.replaceChild(newPrevButton, prevButton);
        
        newPrevButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Botão anterior clicado - Slide atual:', currentBrandSlide);
            prevBrandSlide();
            resetAutoPlay();
        });
        console.log('Botão anterior configurado');
    } else {
        console.error('Botão anterior não encontrado! ID: brands-carousel-prev');
    }
    
    if (nextButton) {
        // Remover listeners anteriores
        const newNextButton = nextButton.cloneNode(true);
        nextButton.parentNode.replaceChild(newNextButton, nextButton);
        
        newNextButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Botão próximo clicado - Slide atual:', currentBrandSlide);
            nextBrandSlide();
            resetAutoPlay();
        });
        console.log('Botão próximo configurado');
    } else {
        console.error('Botão próximo não encontrado! ID: brands-carousel-next');
    }
    
    // Adicionar eventos aos indicadores
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            currentBrandSlide = index;
            updateBrandsCarousel();
            updateBrandsIndicators();
            resetAutoPlay();
        });
    });
    
    // Auto-play com tempo de 6 segundos
    if (brandsCarouselInterval) {
        clearInterval(brandsCarouselInterval);
    }
    brandsCarouselInterval = setInterval(nextBrandSlide, 6000); // 6 segundos
    
    // Pausar no hover
    if (carouselWrapper) {
        carouselWrapper.addEventListener('mouseenter', () => {
            if (brandsCarouselInterval) {
                clearInterval(brandsCarouselInterval);
            }
        });
        
        carouselWrapper.addEventListener('mouseleave', () => {
            if (brandsCarouselInterval) {
                clearInterval(brandsCarouselInterval);
            }
            brandsCarouselInterval = setInterval(nextBrandSlide, 6000); // 6 segundos
        });
    }
    
    // Inicializar - começar no slide 1 (índice 0)
    currentBrandSlide = 0;
    
    // Forçar atualização inicial após um pequeno delay para garantir que o CSS esteja aplicado
    setTimeout(() => {
        updateBrandsCarousel();
        updateBrandsIndicators();
        console.log('Carrossel de marcas inicializado com sucesso!');
        console.log('Total de slides:', totalBrandSlides);
        console.log('Slide atual:', currentBrandSlide);
        console.log('Carrossel width:', carousel.style.width);
        console.log('Wrapper width:', carouselWrapper.style.width);
    }, 100);
}

// Inicializar descrições dos serviços
function initializeServiceDescriptions() {
    const serviceItems = document.querySelectorAll('.service-item');
    
    serviceItems.forEach(item => {
        // Adicionar efeito de hover
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px) scale(1.02)';
        });
        
        item.addEventListener('mouseleave', function() {
            if (!this.querySelector('.service-description.show')) {
                this.style.transform = 'translateY(0) scale(1)';
            }
        });
        
        // Fechar descrição ao clicar fora
        document.addEventListener('click', function(e) {
            if (!item.contains(e.target)) {
                const description = item.querySelector('.service-description');
                if (description) {
                    description.classList.remove('show');
                }
            }
        });
    });
}

// Inicializar scroll suave
function initializeSmoothScrolling() {
    const navLinks = document.querySelectorAll('nav a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const headerHeight = document.querySelector('header').offsetHeight;
                const navHeight = document.querySelector('nav').offsetHeight;
                const offset = headerHeight + navHeight + 20;
                
                const targetPosition = targetSection.offsetTop - offset;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // Destacar link ativo
                navLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            }
        });
    });
    
    // Destacar seção ativa no scroll
    window.addEventListener('scroll', function() {
        const sections = document.querySelectorAll('section[id]');
        const scrollPos = window.scrollY + 200;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    });
}

// Inicializar animações
function initializeAnimations() {
    // Intersection Observer para animações de entrada
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Observar elementos para animação
    const animateElements = document.querySelectorAll('.service-item, .photo, .contact-item');
    animateElements.forEach(el => {
        observer.observe(el);
    });
    
    // Adicionar CSS para animação
    const style = document.createElement('style');
    style.textContent = `
        .service-item, .photo, .contact-item {
            opacity: 0;
            transform: translateY(30px);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }
        
        .service-item.animate-in, .photo.animate-in, .contact-item.animate-in {
            opacity: 1;
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);
}

// Inicializar botão WhatsApp
function initializeWhatsAppButton() {
    const whatsappBtn = document.querySelector('.whatsapp-btn');
    
    if (whatsappBtn) {
        // Adicionar efeito de pulsação
        setInterval(() => {
            whatsappBtn.style.transform = 'scale(1.05)';
            setTimeout(() => {
                whatsappBtn.style.transform = 'scale(1)';
            }, 200);
        }, 3000);
        
        // Adicionar evento de clique com feedback
        whatsappBtn.addEventListener('click', function(e) {
            // Adicionar efeito visual
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
            
            // Analytics ou tracking (opcional)
            console.log('WhatsApp button clicked');
        });
    }
}


// Função para mostrar/ocultar menu mobile (se necessário)
function toggleMobileMenu() {
    const nav = document.querySelector('nav');
    nav.classList.toggle('mobile-open');
}

// Função para fechar menu mobile ao clicar em um link
function closeMobileMenu() {
    const nav = document.querySelector('nav');
    nav.classList.remove('mobile-open');
}

// Adicionar efeitos de hover aos logos
document.addEventListener('DOMContentLoaded', function() {
    const logos = document.querySelectorAll('.logo');
    
    logos.forEach(logo => {
        logo.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1) rotate(2deg)';
        });
        
        logo.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1) rotate(0deg)';
        });
    });
});

// Função para adicionar efeito de parallax suave no header
function initializeParallax() {
    const header = document.querySelector('header');
    
    if (header) {
        window.addEventListener('scroll', function() {
            const scrolled = window.pageYOffset;
            const rate = scrolled * -0.5;
            
            header.style.transform = `translateY(${rate}px)`;
        });
    }
}

// Função para adicionar contador de caracteres em formulários (se houver)
function initializeFormValidation() {
    const textareas = document.querySelectorAll('textarea');
    
    textareas.forEach(textarea => {
        const maxLength = textarea.getAttribute('maxlength');
        if (maxLength) {
            const counter = document.createElement('div');
            counter.className = 'char-counter';
            counter.textContent = `0/${maxLength}`;
            
            textarea.parentNode.appendChild(counter);
            
            textarea.addEventListener('input', function() {
                const remaining = maxLength - this.value.length;
                counter.textContent = `${this.value.length}/${maxLength}`;
                counter.style.color = remaining < 10 ? '#dc3545' : '#6c757d';
            });
        }
    });
}

// Função para adicionar efeito de typing no título principal
function initializeTypingEffect() {
    const title = document.querySelector('header h1');
    if (!title) return;
    
    const originalText = title.textContent;
    title.textContent = '';
    
    let i = 0;
    const typeWriter = () => {
        if (i < originalText.length) {
            title.textContent += originalText.charAt(i);
            i++;
            setTimeout(typeWriter, 100);
        }
    };
    
    // Iniciar efeito após um pequeno delay
    setTimeout(typeWriter, 500);
}

// Função para adicionar efeito de loading nas imagens
function initializeImageLoading() {
    const images = document.querySelectorAll('img, .photo, .slide');
    
    images.forEach(img => {
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s ease';
        
        img.addEventListener('load', function() {
            this.style.opacity = '1';
        });
        
        // Se a imagem já estiver carregada
        if (img.complete) {
            img.style.opacity = '1';
        }
    });
}

// Função para adicionar tooltip aos elementos
function initializeTooltips() {
    const elementsWithTitle = document.querySelectorAll('[title]');
    
    elementsWithTitle.forEach(element => {
        element.addEventListener('mouseenter', function(e) {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.getAttribute('title');
            tooltip.style.cssText = `
                position: absolute;
                background: #333;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 14px;
                z-index: 1000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
            
            setTimeout(() => {
                tooltip.style.opacity = '1';
            }, 10);
            
            this._tooltip = tooltip;
        });
        
        element.addEventListener('mouseleave', function() {
            if (this._tooltip) {
                this._tooltip.remove();
                this._tooltip = null;
            }
        });
    });
}

// Função para adicionar efeito de shake em elementos com erro
function shakeElement(element) {
    element.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
        element.style.animation = '';
    }, 500);
}

// Adicionar CSS para animação de shake
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(shakeStyle);

// Função para adicionar efeito de confetti (para celebrações)
function createConfetti() {
    const colors = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1'];
    const confettiCount = 50;
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
            position: fixed;
            width: 10px;
            height: 10px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            top: -10px;
            left: ${Math.random() * 100}vw;
            z-index: 1000;
            pointer-events: none;
            animation: confetti-fall 3s linear forwards;
        `;
        
        document.body.appendChild(confetti);
        
        setTimeout(() => {
            confetti.remove();
        }, 3000);
    }
}

// Adicionar CSS para animação de confetti
const confettiStyle = document.createElement('style');
confettiStyle.textContent = `
    @keyframes confetti-fall {
        0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(confettiStyle);

// Função para adicionar efeito de partículas no background
function initializeParticles() {
    const particleCount = 50;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: fixed;
            width: 2px;
            height: 2px;
            background: rgba(0, 123, 255, 0.3);
            border-radius: 50%;
            pointer-events: none;
            z-index: -1;
            animation: float ${Math.random() * 10 + 10}s infinite linear;
        `;
        
        particle.style.left = Math.random() * 100 + 'vw';
        particle.style.top = Math.random() * 100 + 'vh';
        particle.style.animationDelay = Math.random() * 10 + 's';
        
        document.body.appendChild(particle);
        particles.push(particle);
    }
}

// Adicionar CSS para animação de partículas
const particleStyle = document.createElement('style');
particleStyle.textContent = `
    @keyframes float {
        0% {
            transform: translateY(100vh) translateX(0);
            opacity: 0;
        }
        10% {
            opacity: 1;
        }
        90% {
            opacity: 1;
        }
        100% {
            transform: translateY(-100vh) translateX(100px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(particleStyle);

// Inicializar todas as funcionalidades quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar funcionalidades adicionais
    initializeParallax();
    initializeFormValidation();
    initializeImageLoading();
    initializeTooltips();
    initializeParticles();
    
    // Adicionar evento de clique no botão WhatsApp para confetti
    const whatsappBtn = document.querySelector('.whatsapp-btn');
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', function() {
            setTimeout(createConfetti, 500);
        });
    }
    
    // Adicionar evento de teclado para navegação
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Fechar todas as descrições abertas
            const openDescriptions = document.querySelectorAll('.service-description.show');
            openDescriptions.forEach(desc => {
                desc.classList.remove('show');
            });
        }
    });
    
    // Adicionar evento de resize para responsividade
    window.addEventListener('resize', function() {
        // Recalcular posições se necessário
        const carousel = document.getElementById('carousel');
        if (carousel) {
            const translateX = -currentSlideIndex * 33.33;
            carousel.style.transform = `translateX(${translateX}%)`;
        }
    });
});

// Função para adicionar efeito de loading global
function showLoading() {
    const loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;
    
    loader.innerHTML = `
        <div style="
            width: 50px;
            height: 50px;
            border: 5px solid #f3f3f3;
            border-top: 5px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        "></div>
    `;
    
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.remove();
    }
}

// Adicionar CSS para animação de loading
const loadingStyle = document.createElement('style');
loadingStyle.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(loadingStyle);

// Exportar funções para uso global
window.toggleDescription = toggleDescription;
window.currentSlide = function(n) {
    if (typeof currentSlide === 'function') {
        currentSlide(n);
    }
};
window.changeSlide = function(direction) {
    if (typeof changeSlide === 'function') {
        changeSlide(direction);
    }
};
// currentCarouselSlide já está definida em initializeCarousel
window.createConfetti = createConfetti;
window.showLoading = showLoading;
window.hideLoading = hideLoading;

// Função para inicializar o formulário de contato
function initializeContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    // Máscara para telefone
    const phoneInput = document.getElementById('telefone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length <= 11) {
                value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                if (value.length < 14) {
                    value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
                }
            }
            e.target.value = value;
        });
    }

    // Inicializar novo formulário
    initializeNewContactForm();
}

// Função para inicializar o novo formulário de contato
function initializeNewContactForm() {
    const form = document.getElementById('contactFormNew');
    if (!form) return;

    // Máscara para telefone no novo formulário
    const phoneInput = document.getElementById('telefoneNew');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length <= 11) {
                if (value.length <= 10) {
                    value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
                } else {
                    value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                }
            }
            e.target.value = value;
        });
    }

    // Contador de caracteres
    const mensagemInput = document.getElementById('mensagemNew');
    const charCount = document.getElementById('charCount');
    
    if (mensagemInput && charCount) {
        mensagemInput.addEventListener('input', function() {
            const currentLength = this.value.length;
            charCount.textContent = currentLength;
            
            // Mudar cor quando próximo do limite
            if (currentLength > 450) {
                charCount.style.color = '#dc3545';
            } else if (currentLength > 400) {
                charCount.style.color = '#ffc107';
            } else {
                charCount.style.color = '#6c757d';
            }
        });
    }

    // Validação em tempo real
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateNewField(this);
        });
        
        input.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateNewField(this);
            }
        });
    });

    // Envio do formulário
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        submitNewForm();
    });
}

// Função para validar campos do novo formulário
function validateNewField(field) {
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';

    // Remove classes de erro anteriores
    field.classList.remove('error');
    const existingError = field.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    // Validações específicas
    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = 'Este campo é obrigatório';
    } else if (field.type === 'email' && value && !isValidEmail(value)) {
        isValid = false;
        errorMessage = 'Digite um e-mail válido';
    } else if (field.type === 'tel' && value && !isValidPhone(value)) {
        isValid = false;
        errorMessage = 'Digite um telefone válido';
    } else if (field.tagName === 'SELECT' && field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = 'Selecione uma opção';
    }

    if (!isValid) {
        field.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = errorMessage;
        field.parentNode.appendChild(errorDiv);
    }

    return isValid;
}

// Função para enviar novo formulário
function submitNewForm() {
    const form = document.getElementById('contactFormNew');
    const formData = new FormData(form);
    
    // Validar todos os campos
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let allValid = true;
    
    inputs.forEach(input => {
        if (!validateNewField(input)) {
            allValid = false;
        }
    });

    if (!allValid) {
        showNotification('Por favor, preencha todos os campos obrigatórios corretamente.', 'error');
        return;
    }

    // Obter dados do formulário
    const nome = formData.get('nomeCompleto');
    const telefone = formData.get('telefoneNew');
    const email = formData.get('emailNew');
    const servico = formData.get('servicoDesejado');
    const mensagem = formData.get('mensagemNew');

    // Enviar email
    sendEmail(nome, telefone, email, servico, mensagem);
    
    // Mostrar notificação de sucesso
    showNotification('Formulário enviado com sucesso! Entraremos em contato em breve.', 'success');
    
    // Limpar formulário
    form.reset();
    const charCount = document.getElementById('charCount');
    if (charCount) {
        charCount.textContent = '0';
        charCount.style.color = '#6c757d';
    }
}

// Função para criar mensagem do WhatsApp do novo formulário
function createNewWhatsAppMessage(nome, telefone, email, servico, mensagem) {
    let message = `Olá! Gostaria de solicitar um orçamento.\n\n`;
    message += `*Nome:* ${nome}\n`;
    message += `*Telefone:* ${telefone}\n`;
    message += `*E-mail:* ${email}\n`;
    message += `*Serviço Desejado:* ${servico}\n`;
    
    if (mensagem) {
        message += `*Mensagem:* ${mensagem}\n`;
    }
    
    message += `\nAguardo retorno. Obrigado!`;
    
    return message;
}

// Função para validar campos
function validateField(field) {
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';

    // Remove classes de erro anteriores
    field.classList.remove('error');
    const existingError = field.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    // Validações específicas
    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = 'Este campo é obrigatório';
    } else if (field.type === 'email' && value && !isValidEmail(value)) {
        isValid = false;
        errorMessage = 'Digite um e-mail válido';
    } else if (field.type === 'tel' && value && !isValidPhone(value)) {
        isValid = false;
        errorMessage = 'Digite um telefone válido';
    }

    if (!isValid) {
        field.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = errorMessage;
        field.parentNode.appendChild(errorDiv);
    }

    return isValid;
}

// Função para validar e-mail
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Função para validar telefone
function isValidPhone(phone) {
    const phoneRegex = /^\(\d{2}\) \d{4,5}-\d{4}$/;
    return phoneRegex.test(phone);
}

// Função para enviar formulário
function submitForm() {
    const form = document.getElementById('contactForm');
    const formData = new FormData(form);
    
    // Validar todos os campos
    const inputs = form.querySelectorAll('input[required], textarea[required]');
    let allValid = true;
    
    inputs.forEach(input => {
        if (!validateField(input)) {
            allValid = false;
        }
    });

    if (!allValid) {
        showNotification('Por favor, preencha todos os campos obrigatórios corretamente.', 'error');
        return;
    }

    // Obter dados do formulário
    const nome = formData.get('nome');
    const telefone = formData.get('telefone');
    const email = formData.get('email');
    const mensagem = formData.get('mensagem');

    // Enviar email
    sendEmail(nome, telefone, email, null, mensagem);
    
    // Mostrar notificação de sucesso
    showNotification('Formulário enviado com sucesso! Entraremos em contato em breve.', 'success');
    
    // Limpar formulário
    form.reset();
}

// Função para criar mensagem do WhatsApp
function createWhatsAppMessage(nome, telefone, email, mensagem) {
    let message = `Olá! Gostaria de solicitar um orçamento.\n\n`;
    message += `*Nome:* ${nome}\n`;
    message += `*Telefone:* ${telefone}\n`;
    
    if (email) {
        message += `*E-mail:* ${email}\n`;
    }
    
    if (mensagem) {
        message += `*Mensagem:* ${mensagem}\n`;
    }
    
    message += `\nAguardo retorno. Obrigado!`;
    
    return message;
}

// Função para enviar email
function sendEmail(nome, telefone, email, servico, mensagem) {
    const emailTo = 'chaveirosenadorltda@outlook.com';
    let assunto = 'Novo Contato - Chaveiro Senador';
    let corpo = `Olá,\n\n`;
    corpo += `Recebemos um novo contato através do site:\n\n`;
    corpo += `Nome: ${nome}\n`;
    corpo += `Telefone: ${telefone}\n`;
    corpo += `E-mail: ${email}\n`;
    if (servico) {
        corpo += `Serviço Desejado: ${servico}\n`;
    }
    corpo += `Mensagem: ${mensagem}\n\n`;
    corpo += `---\n`;
    corpo += `Este email foi enviado automaticamente pelo site.`;
    
    const mailtoLink = `mailto:${emailTo}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    window.location.href = mailtoLink;
}

// Função para mostrar notificações
function showNotification(message, type = 'info') {
    // Remover notificação anterior se existir
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Criar nova notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;

    // Adicionar ao body
    document.body.appendChild(notification);

    // Auto-remover após 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);

    // Botão de fechar
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });
}

// Função para inicializar o carrossel de serviços
function initializeServiceCarousel() {
    const carousel = document.getElementById('servicosCarousel');
    if (!carousel) return;

    // Adicionar suporte a touch/swipe
    let startX = 0;
    let endX = 0;

    carousel.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
    });

    carousel.addEventListener('touchend', function(e) {
        endX = e.changedTouches[0].clientX;
        handleSwipe();
    });

    function handleSwipe() {
        const threshold = 50;
        const diff = startX - endX;

        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                // Swipe para a esquerda - próximo slide
                changeServiceSlide(1);
            } else {
                // Swipe para a direita - slide anterior
                changeServiceSlide(-1);
            }
        }
    }

    // Auto-play do carrossel
    serviceSlideInterval = setInterval(() => {
        changeServiceSlide(1);
    }, 5000);
}

// Função para mudar slide dos serviços
function changeServiceSlide(direction) {
    const slides = document.querySelectorAll('.servicos-slide');
    const dots = document.querySelectorAll('.servico-dot');
    
    if (slides.length === 0) return;

    // Remover classe active do slide atual
    slides[currentServiceSlideIndex].classList.remove('active');
    dots[currentServiceSlideIndex].classList.remove('active');

    // Calcular novo índice
    currentServiceSlideIndex += direction;
    
    if (currentServiceSlideIndex >= totalServiceSlides) {
        currentServiceSlideIndex = 0;
    } else if (currentServiceSlideIndex < 0) {
        currentServiceSlideIndex = totalServiceSlides - 1;
    }

    // Adicionar classe active ao novo slide
    slides[currentServiceSlideIndex].classList.add('active');
    dots[currentServiceSlideIndex].classList.add('active');
}

// Função para ir para um slide específico dos serviços
function currentServiceSlide(n) {
    const slides = document.querySelectorAll('.servicos-slide');
    const dots = document.querySelectorAll('.servico-dot');
    
    if (slides.length === 0) return;

    // Remover classe active do slide atual
    slides[currentServiceSlideIndex].classList.remove('active');
    dots[currentServiceSlideIndex].classList.remove('active');

    // Definir novo índice
    currentServiceSlideIndex = n - 1;

    // Adicionar classe active ao novo slide
    slides[currentServiceSlideIndex].classList.add('active');
    dots[currentServiceSlideIndex].classList.add('active');
}

// Função para inicializar o segundo formulário de contato
function initializeSecondContactForm() {
    const form = document.getElementById('contactFormSecond');
    if (!form) return;

    // Máscara para telefone
    const phoneInput = document.getElementById('telefoneSecond');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length <= 11) {
                value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                if (value.length < 14) {
                    value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
                }
            }
            e.target.value = value;
        });
    }

    // Contador de caracteres
    const mensagemInput = document.getElementById('mensagemSecond');
    const charCount = document.getElementById('charCountSecond');
    
    if (mensagemInput && charCount) {
        mensagemInput.addEventListener('input', function() {
            const currentLength = this.value.length;
            charCount.textContent = currentLength;
            
            // Mudar cor quando próximo do limite
            if (currentLength > 450) {
                charCount.style.color = '#dc3545';
            } else if (currentLength > 400) {
                charCount.style.color = '#ffc107';
            } else {
                charCount.style.color = '#6c757d';
            }
        });
    }

    // Validação em tempo real
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateNewField(this);
        });
        
        input.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateNewField(this);
            }
        });
    });

    // Envio do formulário
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        submitSecondForm();
    });
}

// Função para enviar segundo formulário
function submitSecondForm() {
    const form = document.getElementById('contactFormSecond');
    const formData = new FormData(form);
    
    // Validar todos os campos
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let allValid = true;
    
    inputs.forEach(input => {
        if (!validateNewField(input)) {
            allValid = false;
        }
    });

    if (!allValid) {
        showNotification('Por favor, preencha todos os campos obrigatórios corretamente.', 'error');
        return;
    }

    // Obter dados do formulário
    const nome = formData.get('nomeCompletoSecond');
    const telefone = formData.get('telefoneSecond');
    const email = formData.get('emailSecond');
    const servico = formData.get('servicoDesejadoSecond');
    const mensagem = formData.get('mensagemSecond');

    // Enviar email
    sendEmail(nome, telefone, email, servico, mensagem);
    
    // Mostrar notificação de sucesso
    showNotification('Formulário enviado com sucesso! Entraremos em contato em breve.', 'success');
    
    // Limpar formulário
    form.reset();
    const charCount = document.getElementById('charCountSecond');
    if (charCount) {
        charCount.textContent = '0';
        charCount.style.color = '#6c757d';
    }
}

// Função para criar mensagem do WhatsApp do segundo formulário
function createSecondWhatsAppMessage(nome, telefone, email, servico, mensagem) {
    let message = `Olá! Gostaria de solicitar um orçamento.\n\n`;
    message += `*Nome Completo:* ${nome}\n`;
    message += `*Telefone:* ${telefone}\n`;
    message += `*E-mail:* ${email}\n`;
    message += `*Serviço Desejado:* ${servico}\n`;
    
    if (mensagem) {
        message += `*Mensagem:* ${mensagem}\n`;
    }
    
    message += `\nAguardo retorno. Obrigado!`;
    
    return message;
}

// Função para inicializar formulário de orçamento
function initializeOrcamentoForm() {
    const form = document.getElementById('contactFormOrcamento');
    if (!form) return;

    // Máscara para telefone
    const phoneInput = document.getElementById('telefoneOrcamento');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length <= 11) {
                value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                if (value.length < 14) {
                    value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
                }
            }
            e.target.value = value;
        });
    }

    // Validação e envio
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(form);
        
        const nome = formData.get('nomeOrcamento');
        const telefone = formData.get('telefoneOrcamento');
        const email = formData.get('emailOrcamento');
        const mensagem = formData.get('mensagemOrcamento');

        // Enviar email
        sendEmail(nome, telefone, email, null, mensagem);
        
        showNotification('Formulário enviado com sucesso! Entraremos em contato em breve.', 'success');
        form.reset();
    });
}

// Função para inicializar formulário final de contato
function initializeFinalContactForm() {
    const form = document.getElementById('contactFormFinal');
    if (!form) return;

    // Máscara para telefone
    const phoneInput = document.getElementById('telefoneFinal');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length <= 11) {
                value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                if (value.length < 14) {
                    value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
                }
            }
            e.target.value = value;
        });
    }

    // Contador de caracteres
    const mensagemInput = document.getElementById('mensagemFinal');
    const charCount = document.getElementById('charCountFinal');
    
    if (mensagemInput && charCount) {
        mensagemInput.addEventListener('input', function() {
            const currentLength = this.value.length;
            charCount.textContent = currentLength;
            
            if (currentLength > 450) {
                charCount.style.color = '#dc3545';
            } else if (currentLength > 400) {
                charCount.style.color = '#ffc107';
            } else {
                charCount.style.color = '#6c757d';
            }
        });
    }

    // Validação e envio
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(form);
        
        const nome = formData.get('nomeCompletoFinal');
        const telefone = formData.get('telefoneFinal');
        const email = formData.get('emailFinal');
        const servico = formData.get('servicoFinal');
        const mensagem = formData.get('mensagemFinal');

        // Enviar email
        sendEmail(nome, telefone, email, servico, mensagem);
        
        showNotification('Formulário enviado com sucesso! Entraremos em contato em breve.', 'success');
        form.reset();
        if (charCount) {
            charCount.textContent = '0';
            charCount.style.color = '#6c757d';
        }
    });
}

// Função para inicializar formulário CTA (cta-contact-form)
function initializeCtaContactForm() {
    const form = document.getElementById('cta-contact-form');
    if (!form) return;

    // Máscara para telefone
    const phoneInput = document.getElementById('cta-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length <= 11) {
                value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                if (value.length < 14) {
                    value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
                }
            }
            e.target.value = value;
        });
    }

    // Contador de caracteres
    const mensagemInput = document.getElementById('cta-message');
    const charCount = document.getElementById('cta-charCount');
    
    if (mensagemInput && charCount) {
        mensagemInput.addEventListener('input', function() {
            const currentLength = this.value.length;
            charCount.textContent = currentLength;
            
            if (currentLength > 450) {
                charCount.style.color = '#dc3545';
            } else if (currentLength > 400) {
                charCount.style.color = '#ffc107';
            } else {
                charCount.style.color = '#6c757d';
            }
        });
    }

    // Validação e envio
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(form);
        
        const nome = formData.get('name');
        const telefone = formData.get('phone');
        const email = formData.get('email');
        const servico = formData.get('service');
        const mensagem = formData.get('message');

        // Enviar email
        sendEmail(nome, telefone, email, servico, mensagem);
        
        showNotification('Formulário enviado com sucesso! Entraremos em contato em breve.', 'success');
        form.reset();
        if (charCount) {
            charCount.textContent = '0';
            charCount.style.color = '#6c757d';
        }
    });
}

// Função para inicializar formulário de contato (contact-form)
function initializeContactFormNew() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    // Máscara para telefone
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length <= 11) {
                value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                if (value.length < 14) {
                    value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
                }
            }
            e.target.value = value;
        });
    }

    // Contador de caracteres
    const mensagemInput = document.getElementById('message');
    const charCount = document.getElementById('charCount');
    
    if (mensagemInput && charCount) {
        mensagemInput.addEventListener('input', function() {
            const currentLength = this.value.length;
            charCount.textContent = currentLength;
            
            if (currentLength > 450) {
                charCount.style.color = '#dc3545';
            } else if (currentLength > 400) {
                charCount.style.color = '#ffc107';
            } else {
                charCount.style.color = '#6c757d';
            }
        });
    }

    // Validação e envio
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(form);
        
        const nome = formData.get('name');
        const telefone = formData.get('phone');
        const email = formData.get('email');
        const servico = formData.get('service');
        const mensagem = formData.get('message');

        // Enviar email
        sendEmail(nome, telefone, email, servico, mensagem);
        
        showNotification('Formulário enviado com sucesso! Entraremos em contato em breve.', 'success');
        form.reset();
        if (charCount) {
            charCount.textContent = '0';
            charCount.style.color = '#6c757d';
        }
    });
}

// Tornar funções globais
window.changeServiceSlide = changeServiceSlide;
window.currentServiceSlide = currentServiceSlide;
