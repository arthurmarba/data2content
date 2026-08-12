const NICHE_ALIASES: Array<{ key: string; terms: string[] }> = [
  { key: 'beleza', terms: ['beleza', 'cabelo', 'maquiagem', 'makeup', 'skincare', 'cosmetico'] },
  { key: 'moda', terms: ['moda', 'fashion', 'estilo', 'style'] },
  { key: 'lifestyle', terms: ['lifestyle', 'rotina', 'maternidade', 'familia', 'casa', 'decoracao'] },
  { key: 'tech', terms: ['tecnologia', 'tech', 'games', 'gaming', 'gamer'] },
  { key: 'alimentacao', terms: ['alimentacao', 'gastronomia', 'comida', 'culinaria', 'receita'] },
  { key: 'educacao', terms: ['educacao', 'ensino', 'conhecimento', 'estudo'] },
  { key: 'fitness', terms: ['fitness', 'saude', 'bem estar', 'esporte', 'treino'] },
  { key: 'entretenimento', terms: ['entretenimento', 'humor', 'comedia'] },
  { key: 'viagens', terms: ['viagem', 'viagens', 'turismo', 'travel'] },
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function resolvePricingNiche(niches?: string[] | null): string {
  const normalized = (niches ?? []).map(normalize).filter(Boolean);
  for (const niche of normalized) {
    const match = NICHE_ALIASES.find(({ terms }) => terms.some((term) => niche.includes(term)));
    if (match) return match.key;
  }
  return 'default';
}
