// src/app/lib/discover/experiences.ts

export type ExperienceKey = 'for_you' | 'learn' | 'learn_fun' | 'inspire' | 'sell' | 'niche_humor';

type Spec = {
  key: ExperienceKey;
  label: string;
  include: {
    format?: string[];
    proposal?: string[];
    context?: string[];
  };
};

export const EXPERIENCE_SPECS: Record<ExperienceKey, Spec> = {
  for_you: {
    key: 'for_you',
    label: 'Para você',
    include: {},
  },
  learn: {
    key: 'learn',
    label: 'Aprender',
    include: {
      proposal: ['tips', 'tutorial', 'how_to', 'educational', 'guide'],
      format: ['reel', 'carousel'],
    },
  },
  learn_fun: {
    key: 'learn_fun',
    label: 'Aprender + diversão',
    include: {
      proposal: ['tips', 'tutorial', 'how_to', 'educational', 'guide', 'humor_scene'],
      context: ['pop_culture'],
      format: ['reel', 'carousel'],
    },
  },
  inspire: {
    key: 'inspire',
    label: 'Inspirar-se',
    include: {
      proposal: ['message_motivational', 'behind_the_scenes', 'lifestyle'],
    },
  },
  sell: {
    key: 'sell',
    label: 'Vender mais',
    include: {
      proposal: ['call_to_action', 'announcement', 'product_review', 'before_after', 'testimonial'],
    },
  },
  niche_humor: {
    key: 'niche_humor',
    label: 'Humor do seu nicho',
    include: {
      proposal: ['humor_scene'],
      // context será complementado dinamicamente com top contexts do usuário quando disponível
    },
  },
};

export function getExperienceFilters(
  exp: string | null,
  opts: { allowedPersonalized?: boolean; topContextIds?: string[] }
): { format?: string; proposal?: string; context?: string } {
  if (!exp) return {};
  const key = exp as ExperienceKey;
  const spec = EXPERIENCE_SPECS[key];
  if (!spec) return {};

  const include = { ...spec.include };

  // niche_humor: acrescenta contextos do usuário quando houver
  if (key === 'niche_humor' && opts.allowedPersonalized && opts.topContextIds?.length) {
    include.context = [...(include.context || []), ...opts.topContextIds];
  }

  const toCsv = (arr?: string[]) => (arr && arr.length ? arr.join(',') : undefined);
  return {
    format: toCsv(include.format),
    proposal: toCsv(include.proposal),
    context: toCsv(include.context),
  };
}

// Ordem sugerida de prateleiras (rails) por experiência.
// Chaves possíveis de seção: trending, for_you, best_times_hot, weekend_ideas, niche_match,
// trend_fashion_beauty, trend_tips, trend_humor, top_in_your_format, collabs, community_new
export function getExperienceShelfOrder(exp?: string | null): string[] {
  const baseDefault = [
    'for_you',
    'user_suggested',
    'reels_lt_15',
    'reels_15_45',
    'reels_gt_45',
    'trending',
    'community_new',
    'collabs',
    'weekend_ideas',
    'top_saved',
    'top_comments',
    'top_shares',
    'top_in_your_format',
    'niche_match',
  ];
  switch (exp) {
    case 'learn':
      return [
        // 'for_you' removido
        'trend_tips',
        'community_new',
        // 'best_times_hot' removido
        'top_in_your_format',
        'trending',
        'collabs',
        'weekend_ideas',
        'niche_match',
      ];
    case 'learn_fun':
      return [
        // 'for_you' removido
        'trend_tips',
        'trend_humor',
        'trending',
        // 'best_times_hot' removido
        'community_new',
        'collabs',
        'weekend_ideas',
        'niche_match',
      ];
    case 'inspire':
      return [
        // 'for_you' removido
        'weekend_ideas',
        'trending',
        'community_new',
        'collabs',
        // tendências fixas removidas
        'niche_match',
        // 'best_times_hot' removido
        'top_in_your_format',
      ];
    case 'sell':
      return [
        // 'for_you' removido
        'collabs',
        'trending',
        'community_new',
        // 'best_times_hot' removido
        'top_in_your_format',
        'weekend_ideas',
        'niche_match',
      ];
    case 'niche_humor':
      return [
        // 'for_you' removido
        // tendências fixas removidas
        'trending',
        'community_new',
        'weekend_ideas',
        // 'best_times_hot' removido
        'niche_match',
      ];
    default:
      return baseDefault;
  }
}
