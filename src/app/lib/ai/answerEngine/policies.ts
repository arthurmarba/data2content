import { logger } from '@/app/lib/logger';
import type { AnswerEnginePolicy, AnswerIntent, Thresholds, UserBaselines } from './types';

const HIGH_ENGAGEMENT_KEYWORDS = [
  'maior engajamento',
  'melhor engajamento',
  'melhores',
  'top',
  'topo',
  'viral',
  'recorde',
  'mais bombou',
  'bombou',
  'performou mais',
  'alto desempenho',
  'maior desempenho',
  'top performance',
  'que performou mais',
];

const REACH_KEYWORDS = ['alcance', 'reach', 'impress', 'views'];
const SAVES_KEYWORDS = ['salvo', 'salvos', 'saves', 'salvamentos', 'salvaram'];
const REELS_KEYWORDS = ['reels', 'reel'];
const CAROUSEL_KEYWORDS = ['carrossel', 'carrosséis', 'carrossel de fotos'];
const PHOTO_KEYWORDS = ['foto', 'imagem', 'imagem estática', 'foto única'];

const INTENT_KEYWORDS: Array<{ intent: AnswerIntent; patterns: RegExp[] }> = [
  {
    intent: 'top_performance_inspirations',
    patterns: [/melhor|maior|top|viral|bomb/i, /engajamento|desempenho|performance/i],
  },
  { intent: 'community_examples', patterns: [/inspira(ç|c)ões?|exemplos?|refer(ê|e)ncias?/i] },
  { intent: 'content_ideas_for_goal', patterns: [/ideias?|o que postar|sugest/i] },
  { intent: 'why_my_content_flopped', patterns: [/por que|flop|caiu|fracass|não deu certo|nao deu certo/i] },
  { intent: 'growth_plan', patterns: [/plano|estrat(é|e)gia|roteiro|agenda|cronograma/i] },
  { intent: 'best_formats_for_user', patterns: [/formato(s)?|reels?|carross(e|é)is?|foto(s)?/i] },
  { intent: 'pricing_suggestion', patterns: [/pre(ç|c)o|cobrar|quanto vale|quanto cobrar|pricing/i] },
  { intent: 'top_reach', patterns: [/alcance|reach|impress(ões)?|views/i] },
  { intent: 'top_saves', patterns: [/salv(o|a)|saves|salvamento/i] },
];

function keywordMatch(query: string, patterns: RegExp[]) {
  return patterns.every((pattern) => pattern.test(query));
}

export function detectAnswerIntent(query: string, fallback?: AnswerIntent | string | null): AnswerIntent {
  const normalized = (query || '').trim().toLowerCase();
  for (const entry of INTENT_KEYWORDS) {
    if (keywordMatch(normalized, entry.patterns)) return entry.intent;
  }

  if (HIGH_ENGAGEMENT_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'top_performance_inspirations';
  }

  const mapped = coerceToAnswerIntent(fallback);
  return mapped;
}

export function coerceToAnswerIntent(intent?: string | null): AnswerIntent {
  if (!intent) return 'generic_qna';
  const normalized = intent.toLowerCase();
  if (normalized.includes('community')) return 'community_examples';
  if (normalized.includes('best') || normalized.includes('ranking') || normalized.includes('ask_best')) {
    return 'top_performance_inspirations';
  }
  if (normalized.includes('plan')) return 'growth_plan';
  if (normalized.includes('idea') || normalized.includes('content_ideas')) return 'content_ideas_for_goal';
  if (normalized.includes('format')) return 'best_formats_for_user';
  if (normalized.includes('price')) return 'pricing_suggestion';
  if (normalized.includes('flop') || normalized.includes('report')) return 'why_my_content_flopped';
  if (normalized.includes('reach')) return 'top_reach';
  if (normalized.includes('save')) return 'top_saves';
  return 'generic_qna';
}

export function wantsHighEngagement(query: string): boolean {
  const normalized = (query || '').toLowerCase();
  return HIGH_ENGAGEMENT_KEYWORDS.some((kw) => normalized.includes(kw));
}

export function minAbsoluteByFollowers(followers?: number | null): number {
  if (typeof followers !== 'number' || Number.isNaN(followers)) return 30;
  if (followers < 10_000) return 30;
  if (followers < 50_000) return 80;
  if (followers < 200_000) return 200;
  return 500;
}

export function detectRequestedFormat(query: string): string | null {
  const normalized = (query || '').toLowerCase();
  if (REELS_KEYWORDS.some((kw) => normalized.includes(kw))) return 'reel';
  if (CAROUSEL_KEYWORDS.some((kw) => normalized.includes(kw))) return 'carrossel';
  if (PHOTO_KEYWORDS.some((kw) => normalized.includes(kw))) return 'foto';
  return null;
}

export function buildThresholds(
  baselines: UserBaselines | null | undefined,
  followers?: number | null,
  format?: string | null,
): Thresholds {
  const formatBaseline = format ? baselines?.perFormat?.[format] : null;
  const baseInteractions = formatBaseline?.totalInteractionsP50 ?? baselines?.totalInteractionsP50 ?? 0;
  const baseEr = formatBaseline?.engagementRateP50 ?? baselines?.engagementRateP50 ?? null;
  const minAbsolute = minAbsoluteByFollowers(followers);
  const minRelativeInteractions = Math.max(Math.round(baseInteractions * 1.25), 0);
  const effectiveInteractions = Math.max(minRelativeInteractions, minAbsolute);
  const minRelativeEr = baseEr && baseEr > 0 ? baseEr * 1.15 : null;
  const effectiveEr = minRelativeEr && minRelativeEr > 0 ? minRelativeEr : null;
  return {
    minAbsolute,
    minRelativeInteractions,
    minRelativeEr,
    effectiveInteractions,
    effectiveEr,
    baselineInteractionP50: baseInteractions,
    baselineErP50: baseEr,
  };
}

export function resolvePolicy(
  intent: AnswerIntent,
  query: string,
  baselines: UserBaselines | null | undefined,
  followers?: number | null,
): AnswerEnginePolicy & { thresholds: Thresholds } {
  const formatLocked = detectRequestedFormat(query);
  const metricsRequired: AnswerEnginePolicy['metricsRequired'] = [];
  if (intent === 'top_reach' || REACH_KEYWORDS.some((kw) => query.toLowerCase().includes(kw))) {
    metricsRequired.push('reach', 'shares');
  }
  if (intent === 'top_saves' || SAVES_KEYWORDS.some((kw) => query.toLowerCase().includes(kw))) {
    metricsRequired.push('saves', 'shares');
  }
  if (intent === 'top_performance_inspirations' || wantsHighEngagement(query)) {
    metricsRequired.push('interactions');
    metricsRequired.push('er');
  }

  const basePolicy: AnswerEnginePolicy = {
    intent,
    requireHighEngagement: intent === 'top_performance_inspirations' || wantsHighEngagement(query),
    maxPosts: intent === 'community_examples' ? 6 : 8,
    windowDays: 120,
    formatLocked,
    metricsRequired: metricsRequired.length ? metricsRequired : undefined,
  };

  const thresholds = buildThresholds(baselines, followers, formatLocked || undefined);
  const policyWithThresholds = { ...basePolicy, thresholds };

  if (!baselines) {
    logger.warn('[answer-engine] Baselines ausentes; aplicando apenas min absoluto');
  }

  return policyWithThresholds;
}
