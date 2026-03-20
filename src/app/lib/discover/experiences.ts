// src/app/lib/discover/experiences.ts

export type ExperienceKey = 'for_you' | 'learn' | 'learn_fun' | 'inspire' | 'sell' | 'niche_humor';

type Spec = {
  key: ExperienceKey;
  label: string;
  include: {
    format?: string[];
    context?: string[];
    references?: string[];
    contentIntent?: string[];
    narrativeForm?: string[];
    contentSignals?: string[];
    proofStyle?: string[];
    commercialMode?: string[];
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
      contentIntent: ['teach'],
      narrativeForm: ['tutorial'],
      proofStyle: ['demonstration', 'list_based'],
      format: ['reel', 'carousel'],
    },
  },
  learn_fun: {
    key: 'learn_fun',
    label: 'Aprender + diversão',
    include: {
      contentIntent: ['teach', 'entertain'],
      narrativeForm: ['tutorial', 'sketch_scene'],
      proofStyle: ['demonstration', 'list_based'],
      references: ['pop_culture'],
      format: ['reel', 'carousel'],
    },
  },
  inspire: {
    key: 'inspire',
    label: 'Inspirar-se',
    include: {
      contentIntent: ['inspire', 'connect'],
      narrativeForm: ['behind_the_scenes', 'day_in_the_life'],
      proofStyle: ['personal_story'],
    },
  },
  sell: {
    key: 'sell',
    label: 'Vender mais',
    include: {
      contentIntent: ['convert'],
      narrativeForm: ['review', 'comparison'],
      contentSignals: ['sponsored', 'promo_offer', 'link_in_bio_cta'],
      proofStyle: ['demonstration', 'social_proof'],
      commercialMode: ['paid_partnership', 'discount_offer', 'product_launch'],
    },
  },
  niche_humor: {
    key: 'niche_humor',
    label: 'Humor do seu nicho',
    include: {
      contentIntent: ['entertain'],
      narrativeForm: ['sketch_scene'],
      // context será complementado dinamicamente com top contexts do usuário quando disponível
    },
  },
};

export function getExperienceFilters(
  exp: string | null,
  opts: { allowedPersonalized?: boolean; topContextIds?: string[] }
): {
  format?: string;
  context?: string;
  references?: string;
  contentIntent?: string;
  narrativeForm?: string;
  contentSignals?: string;
  proofStyle?: string;
  commercialMode?: string;
} {
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
    context: toCsv(include.context),
    references: toCsv(include.references),
    contentIntent: toCsv(include.contentIntent),
    narrativeForm: toCsv(include.narrativeForm),
    contentSignals: toCsv(include.contentSignals),
    proofStyle: toCsv(include.proofStyle),
    commercialMode: toCsv(include.commercialMode),
  };
}

// Ordem sugerida de prateleiras (rails) por experiência.
// Chaves possíveis de seção: trending, rising_72h, for_you, best_times_hot, weekend_ideas, niche_match,
// trend_fashion_beauty, trend_tips, trend_humor, top_in_your_format, collabs, community_new
export function getExperienceShelfOrder(exp?: string | null): string[] {
  const baseDefault = [
    'for_you',
    'user_suggested',
    'rising_72h',
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
        'rising_72h',
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
        'rising_72h',
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
        'rising_72h',
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
        'rising_72h',
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
        'rising_72h',
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
