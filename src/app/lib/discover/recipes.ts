// src/app/lib/discover/recipes.ts

export type ShelfSpec = {
  key: string;
  title: string;
  include?: {
    format?: string[];
    proposal?: string[];
    context?: string[];
  };
  sortBy?: 'postDate' | 'stats.likes' | 'stats.shares' | 'stats.comments' | 'stats.reach' | 'stats.saved' | 'stats.views' | 'stats.video_views' | 'stats.impressions' | 'stats.engagement' | 'stats.total_interactions';
  sortOrder?: 'asc' | 'desc';
  minInteractions?: number;
  onlyOptIn?: boolean;
  limitMultiplier?: number; // fetch more and dedup depois
  // Regras adicionais aplicadas em pós-processamento
  weekendOnly?: boolean;
  duration?: { lt?: number; between?: [number, number]; gt?: number };
  hourRanges?: Array<[number, number]>; // faixas [start,end) em horas 0-24
  // Regras de ranking customizado (quando presentes, substituem sortBy)
  weights?: {
    interactions?: number;
    savedRate?: number; // saved / (reach||views)
    shares?: number;
    comments?: number;
    recency?: number; // decaimento exponencial (meia-vida 14d)
  };
  maxPerCreatorTop?: number; // diversidade: máx itens do mesmo criador no topo (default: 2)
};

export type Recipe = { key: string; shelves: ShelfSpec[] };

export function getRecipe(params: { exp?: string | null; view?: string | null; allowedPersonalized?: boolean; topContextIds?: string[] }): Recipe | null {
  const { exp, view, allowedPersonalized, topContextIds } = params;

  // 1) Prioridade para view (chips de refinamento de duração e ranking)
  switch (view) {
    case 'reels_lt_15':
      return { key: 'view_reels_lt_15', shelves: [
        { key: 'reels_short', title: 'Reels relâmpago (<15s)', include: { format: ['reel'] }, duration: { lt: 15 }, sortBy: 'stats.total_interactions', sortOrder: 'desc', minInteractions: 3, onlyOptIn: true, limitMultiplier: 3 },
      ]};
    case 'reels_15_45':
      return { key: 'view_reels_15_45', shelves: [
        { key: 'reels_mid', title: 'Reels certeiros (15–45s)', include: { format: ['reel'] }, duration: { between: [15,45] }, sortBy: 'stats.total_interactions', sortOrder: 'desc', minInteractions: 3, onlyOptIn: true, limitMultiplier: 3 },
      ]};
    case 'reels_gt_45':
      return { key: 'view_reels_gt_45', shelves: [
        { key: 'reels_long', title: 'Reels longos (45s+)', include: { format: ['reel'] }, duration: { gt: 45 }, sortBy: 'stats.views', sortOrder: 'desc', minInteractions: 3, onlyOptIn: true, limitMultiplier: 3 },
      ]};
    case 'top_comments':
      return { key: 'view_top_comments', shelves: [
        { key: 'most_commented', title: 'Mais comentados', sortBy: 'stats.comments', sortOrder: 'desc', minInteractions: 1, onlyOptIn: true, limitMultiplier: 2 },
      ]};
    case 'top_shares':
      return { key: 'view_top_shares', shelves: [
        { key: 'most_shared', title: 'Mais compartilhados', sortBy: 'stats.shares', sortOrder: 'desc', minInteractions: 1, onlyOptIn: true, limitMultiplier: 2 },
      ]};
    case 'top_saves':
      return { key: 'view_top_saves', shelves: [
        { key: 'most_saved', title: 'Mais salvos', sortBy: 'stats.saved', sortOrder: 'desc', minInteractions: 1, onlyOptIn: true, limitMultiplier: 2 },
      ]};
    case 'viral_weekend':
      return { key: 'view_viral_weekend', shelves: [
        { key: 'weekend_virals', title: 'Virais de fim de semana', sortBy: 'stats.total_interactions', sortOrder: 'desc', weekendOnly: true, minInteractions: 3, onlyOptIn: true, limitMultiplier: 3 },
      ]};
    case 'viral_morning':
      return { key: 'view_viral_morning', shelves: [
        { key: 'morning_virals', title: 'Virais pela manhã', sortBy: 'stats.total_interactions', sortOrder: 'desc', hourRanges: [[6,12]], minInteractions: 3, onlyOptIn: true, limitMultiplier: 3 },
      ]};
    case 'viral_night':
      return { key: 'view_viral_night', shelves: [
        { key: 'night_virals', title: 'Virais à noite', sortBy: 'stats.total_interactions', sortOrder: 'desc', hourRanges: [[18,24],[0,2]], minInteractions: 3, onlyOptIn: true, limitMultiplier: 3 },
      ]};
  }

  // 2) Experiências (exp)
  if (exp === 'for_you') {
    const ctx = (allowedPersonalized && topContextIds && topContextIds.length) ? topContextIds : undefined;
    const shelves: ShelfSpec[] = [
      { key: 'for_you_hot', title: 'Em alta para você', include: { context: ctx }, minInteractions: 3, onlyOptIn: true, limitMultiplier: 2, weights: { interactions: 0.5, savedRate: 0.2, shares: 0.2, recency: 0.1 }, maxPerCreatorTop: 2 },
      { key: 'fresh_now', title: 'Novidades da comunidade', include: { context: ctx }, sortBy: 'postDate', sortOrder: 'desc', minInteractions: 0, onlyOptIn: true, limitMultiplier: 2, maxPerCreatorTop: 2 },
    ];
    return { key: 'exp_for_you', shelves };
  }
  switch (exp) {
    case 'learn':
      return { key: 'exp_learn', shelves: [
        { key: 'learn_guides', title: 'Guia passo-a-passo', include: { proposal: ['tutorial','how_to','guide'], format: ['reel','carousel'] }, minInteractions: 3, onlyOptIn: true, limitMultiplier: 2, weights: { interactions: 0.4, savedRate: 0.3, comments: 0.2, recency: 0.1 }, maxPerCreatorTop: 2 },
        { key: 'learn_tips', title: 'Dicas rápidas', include: { proposal: ['tips','educational'], format: ['reel','carousel'] }, minInteractions: 1, onlyOptIn: true, limitMultiplier: 2, weights: { savedRate: 0.5, interactions: 0.2, comments: 0.2, recency: 0.1 }, maxPerCreatorTop: 2 },
      ]};
    case 'learn_fun':
      return { key: 'exp_learn_fun', shelves: [
        { key: 'learn_fun_combo', title: 'Aprenda rindo', include: { proposal: ['humor_scene','tips','tutorial','how_to','educational','guide'], context: ['pop_culture'], format: ['reel'] }, minInteractions: 1, onlyOptIn: true, limitMultiplier: 2, weights: { shares: 0.45, interactions: 0.35, recency: 0.2 }, maxPerCreatorTop: 2 },
      ]};
    case 'inspire':
      return { key: 'exp_inspire', shelves: [
        { key: 'motivational', title: 'Mensagens motivacionais', include: { proposal: ['message_motivational'] }, minInteractions: 1, onlyOptIn: true, limitMultiplier: 2, weights: { savedRate: 0.5, shares: 0.2, interactions: 0.2, recency: 0.1 }, maxPerCreatorTop: 2 },
        { key: 'bts', title: 'Bastidores que inspiram', include: { proposal: ['behind_the_scenes','lifestyle'] }, minInteractions: 1, onlyOptIn: true, limitMultiplier: 2, weights: { interactions: 0.5, savedRate: 0.2, shares: 0.2, recency: 0.1 }, maxPerCreatorTop: 2 },
      ]};
    case 'sell':
      return { key: 'exp_sell', shelves: [
        { key: 'social_proof', title: 'Provas sociais', include: { proposal: ['testimonial','before_after'] }, minInteractions: 1, onlyOptIn: true, limitMultiplier: 2, weights: { savedRate: 0.5, interactions: 0.3, recency: 0.2 }, maxPerCreatorTop: 2 },
        { key: 'cta_reviews', title: 'Reviews que convertem', include: { proposal: ['product_review','call_to_action','announcement'] }, minInteractions: 1, onlyOptIn: true, limitMultiplier: 2, weights: { interactions: 0.5, savedRate: 0.3, recency: 0.2 }, maxPerCreatorTop: 2 },
      ]};
    case 'niche_humor': {
      const ctx = (allowedPersonalized && topContextIds && topContextIds.length) ? topContextIds : undefined;
      return { key: 'exp_niche_humor', shelves: [
        { key: 'humor_niche', title: 'Humor do seu nicho', include: { proposal: ['humor_scene'], context: ctx }, minInteractions: 1, onlyOptIn: true, limitMultiplier: 2, weights: { shares: 0.5, interactions: 0.3, recency: 0.2 }, maxPerCreatorTop: 2 },
      ]};
    }
  }

  return null;
}
