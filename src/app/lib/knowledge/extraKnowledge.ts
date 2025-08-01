// @/app/lib/knowledge/extraKnowledge.ts - v1.0
// Conhecimento adicional que não se encaixa nas outras categorias.

/**
 * Dicas gerais sobre melhores horários de postagem.
 */
export function getBestPostingTimes(): string {
    const currentYear = new Date().getFullYear();
    return `
**Quando Postar nas Redes (${currentYear})?**

Não existe um horário mágico que funcione para todo mundo. O ideal é observar seus próprios Insights para ver quando seu público está mais ativo. Em geral, manhã cedo, horário de almoço e noite costumam ter picos de uso no Brasil, mas teste diferentes horários e acompanhe as primeiras horas de engajamento para descobrir o que funciona melhor para você.`;
}

/**
 * Breve explicação sobre a Comunidade de Inspiração IA Mobi.
 */
export function getCommunityInspirationOverview(): string {
    return `
**O que é a Comunidade de Inspiração IA Mobi?**

É o nosso acervo de posts da comunidade que tiveram bom desempenho qualitativo. Ele serve para gerar exemplos práticos quando você usa a função de buscar inspirações. Assim você recebe ideias baseadas em conteúdos reais que já engajaram outras pessoas.`;
}
