/**
 * ============================================
 * CONFIG-IMAGENS.JS - CONFIGURAÇÃO DE IMAGENS
 * ============================================
 * 
 * Este arquivo centraliza a configuração de todas as imagens do site.
 * Facilita a manutenção e alteração de imagens sem modificar o HTML.
 * 
 * Estrutura:
 * - IMAGENS_CONFIG: Objeto com todas as URLs de imagens
 * - aplicarImagensConfig(): Função que aplica as imagens no DOM
 * 
 * Como usar:
 * 1. Edite as URLs no objeto IMAGENS_CONFIG
 * 2. As imagens serão aplicadas automaticamente quando o DOM carregar
 * 
 * ============================================
 */

// Configuração de Imagens do Site - Chaveiro Senador
// Este arquivo pode ser facilmente editado para alterar as imagens do site

const IMAGENS_CONFIG = {
    // Imagem de fundo do header/título
    header: {
        background: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80"
    },

    // Imagens do slider principal
    slider: {
        slide1: {
            background: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
            title: "Chaveiro Profissional",
            description: "Serviços especializados com equipamentos modernos e técnicos experientes"
        },
        slide2: {
            background: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
            title: "Atendimento 24h",
            description: "Emergências residenciais e comerciais atendidas a qualquer hora"
        },
        slide3: {
            background: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
            title: "Chaves Automotivas",
            description: "Chaves codificadas, abertura de veículos e reparos especializados"
        }
    },

    // Imagens da seção "Quem Somos"
    sobre: {
        background: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
        photos: [
            {
                image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
                title: "Atendimento 24h"
            },
            {
                image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
                title: "Ferramentas Modernas"
            },
            {
                image: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
                title: "Profissionais Qualificados"
            }
        ]
    },

    // Imagens da galeria
    galeria: [
        {
            image: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            title: "Fachada da Loja",
            description: "Chaveiros & Carimbos desde 1979"
        },
        {
            image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            title: "Interior da Loja",
            description: "Nosso espaço de atendimento"
        },
        {
            image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            title: "Chaves Automotivas",
            description: "Chaves para todas as marcas de veículos"
        },
        {
            image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            title: "Carimbos",
            description: "Carimbos automáticos e tradicionais"
        },
        {
            image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            title: "Fechaduras",
            description: "Instalação e manutenção de fechaduras"
        },
        {
            image: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            title: "Estacionamento",
            description: "Área de estacionamento para clientes"
        }
    ],

    // Imagens dos serviços
    servicos: {
        "abertura-residencial": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        "chaves-codificadas": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        "abertura-veiculos": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        "reparo-ignicao": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        "fechaduras-digitais": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        "troca-segredos": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
    }
};

// Função para aplicar as imagens do config
function aplicarImagensConfig() {
        // Aplicar imagem de fundo do header
        if (IMAGENS_CONFIG.header.background) {
            const header = document.querySelector('header');
            if (header) {
                header.style.backgroundImage = `linear-gradient(135deg, rgba(44, 62, 80, 0.9) 0%, rgba(52, 73, 94, 0.9) 100%), url('${IMAGENS_CONFIG.header.background}')`;
                header.style.backgroundSize = 'cover';
                header.style.backgroundPosition = 'center';
                header.style.backgroundAttachment = 'fixed';
            }
        }

    // Aplicar imagens do slider
    const slides = document.querySelectorAll('.slide');
    slides.forEach((slide, index) => {
        const slideKey = `slide${index + 1}`;
        if (IMAGENS_CONFIG.slider[slideKey]) {
            slide.style.backgroundImage = `url('${IMAGENS_CONFIG.slider[slideKey].background}')`;
            
            // Atualizar título e descrição se existirem
            const title = slide.querySelector('h2');
            const description = slide.querySelector('p');
            
            if (title && IMAGENS_CONFIG.slider[slideKey].title) {
                title.textContent = IMAGENS_CONFIG.slider[slideKey].title;
            }
            if (description && IMAGENS_CONFIG.slider[slideKey].description) {
                description.textContent = IMAGENS_CONFIG.slider[slideKey].description;
            }
        }
    });

    // Aplicar imagem de fundo da seção sobre
    if (IMAGENS_CONFIG.sobre.background) {
        const sobreSection = document.querySelector('#sobre');
        if (sobreSection) {
            sobreSection.style.backgroundImage = `linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)), url('${IMAGENS_CONFIG.sobre.background}')`;
            sobreSection.style.backgroundSize = 'cover';
            sobreSection.style.backgroundPosition = 'center';
            sobreSection.style.backgroundAttachment = 'fixed';
        }
    }

    // Aplicar imagens da galeria
    const galleryItems = document.querySelectorAll('.gallery-item img');
    galleryItems.forEach((img, index) => {
        if (IMAGENS_CONFIG.galeria[index]) {
            img.src = IMAGENS_CONFIG.galeria[index].image;
            img.alt = IMAGENS_CONFIG.galeria[index].title;
            
            // Atualizar overlay
            const overlay = img.parentElement.querySelector('.gallery-overlay');
            if (overlay) {
                const title = overlay.querySelector('h3');
                const description = overlay.querySelector('p');
                
                if (title) title.textContent = IMAGENS_CONFIG.galeria[index].title;
                if (description) description.textContent = IMAGENS_CONFIG.galeria[index].description;
            }
        }
    });

    // Aplicar imagens dos serviços
    const serviceImages = document.querySelectorAll('.servico-image img');
    serviceImages.forEach((img) => {
        const src = img.src;
        const filename = src.split('/').pop().split('.')[0];
        
        if (IMAGENS_CONFIG.servicos[filename]) {
            img.src = IMAGENS_CONFIG.servicos[filename];
        }
    });
}

// Executar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    aplicarImagensConfig();
});
