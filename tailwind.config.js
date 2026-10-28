/**
 * =====================================================================
 * TAILWIND - CONFIGURAÇÃO DO CSS GERADO
 * =====================================================================
 * Antes as páginas carregavam o Tailwind pela CDN (cdn.tailwindcss.com),
 * que monta o CSS no navegador do visitante a cada visita. O próprio
 * Tailwind avisa que isso não é para produção (roteiro de testes DES-05).
 * Agora o CSS é gerado uma vez, só com as classes usadas, em:
 *   assets/css/tailwind.css  (site, este arquivo)
 *   admin/css/tailwind.css   (painel, tailwind.admin.config.js)
 *
 * Mudou alguma classe do Tailwind num HTML ou JS? Gere de novo:
 *   npm run build:css
 * (precisa de internet só na primeira vez, para o npx baixar o Tailwind 3.4)
 * =====================================================================
 */
module.exports = {
    // Arquivos onde o Tailwind procura as classes usadas (o JS também, pois ele liga/desliga classes)
    content: ['./*.html', './assets/js/**/*.js'],
    theme: { extend: {} },
    plugins: [],
};
