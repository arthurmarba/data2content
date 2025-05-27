// src/app/lib/constants.ts
// ATUALIZADO: Métricas de performance para regras relevantes alteradas para 'views'.
// ATUALIZADO: Adicionado FPC_COMBO_OPPORTUNITY para insights de fallback.
// ATUALIZADO: Adicionado VIDEO_DURATION_PERFORMANCE para insights de fallback.
// ATUALIZADO: Adicionados RECENT_ENGAGEMENT_LEVEL, RECENT_REACH_LEVEL, FOLLOWER_GROWTH_RATE_HIGHLIGHT para insights de fallback.

import { DeterminedIntent } from '@/app/lib/intentService';
import { IMetricStats } from '@/app/models/Metric';
import { PostObjectForAverage } from '@/app/lib/utils';


// ... (outras constantes permanecem iguais) ...

export const STREAM_READ_TIMEOUT_MS = Number(process.env.STREAM_READ_TIMEOUT_MS) || 90_000;
export const HISTORY_LIMIT = Number(process.env.LLM_HISTORY_LIMIT) || 10;
export const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5; // 5 minutos

export const SUMMARY_GENERATION_INTERVAL = 3;
export const EXPERTISE_INFERENCE_INTERVAL = 5;

export const GREETING_THRESHOLD_MILLISECONDS = (process.env.GREETING_THRESHOLD_HOURS ? parseInt(process.env.GREETING_THRESHOLD_HOURS) : 3) * 60 * 60 * 1000;
export const ACK_SKIP_THRESHOLD_MILLISECONDS = (process.env.ACK_SKIP_THRESHOLD_MINUTES ? parseInt(process.env.ACK_SKIP_THRESHOLD_MINUTES) : 2) * 60 * 1000;

export const COMPLEX_TASK_INTENTS: DeterminedIntent[] = [
    'content_plan',
    'report',
];

export const COMMON_GREETINGS_FOR_STRIPPING: string[] = [
    'fala meu querido', 'fala minha querida',
    'querido tuca', 'querida tuca',
    'tudo bem', 'tudo bom', 'bom dia', 'boa tarde', 'boa noite',
    'e aí', 'eae', 'fala aí',
    'oi', 'olá', 'ola', 'opa', 'fala', 'tuca'
];

export const ALERT_HISTORY_LOOKBACK_DAYS = 7;
export const DEFAULT_METRICS_FETCH_DAYS = 30;
export const DEFAULT_RADAR_STREAM_READ_TIMEOUT_MS = 30_000;

// --- Constantes para Análise de Crescimento (dataService/helpers.ts) ---
export const GROWTH_ANALYSIS_PERIOD_SHORT_TERM_DAYS = Number(process.env.GROWTH_ANALYSIS_PERIOD_SHORT_TERM_DAYS) || 90;
export const GROWTH_ANALYSIS_PERIOD_LONG_TERM_MONTHS = Number(process.env.GROWTH_ANALYSIS_PERIOD_LONG_TERM_MONTHS) || 6;

// --- Constantes para Memória de Curto Prazo (Proposta 2.1.3) ---
export const SHORT_TERM_CONTEXT_VALIDITY_MINUTES = Number(process.env.SHORT_TERM_CONTEXT_VALIDITY_MINUTES) || 5;
export const CONTEXT_EXTRACTION_MODEL = process.env.CONTEXT_EXTRACTION_MODEL || 'gpt-3.5-turbo';
export const CONTEXT_EXTRACTION_TEMP = Number(process.env.CONTEXT_EXTRACTION_TEMP) || 0.2;
export const CONTEXT_EXTRACTION_MAX_TOKENS = Number(process.env.CONTEXT_EXTRACTION_MAX_TOKENS) || 150;

// --- Constantes para Perguntas Instigantes (userMessageHandler.ts) ---
export const INSTIGATING_QUESTION_MODEL = process.env.INSTIGATING_QUESTION_MODEL || 'gpt-3.5-turbo';
export const INSTIGATING_QUESTION_TEMP = Number(process.env.INSTIGATING_QUESTION_TEMP) || 0.7;
export const INSTIGATING_QUESTION_MAX_TOKENS = Number(process.env.INSTIGATING_QUESTION_MAX_TOKENS) || 80;

// --- Constantes para Insights de Fallback ---
export const FALLBACK_INSIGHT_TYPES = {
  FOLLOWER_GROWTH: "follower_growth",
  TOP_POST_PERFORMANCE: "top_post_performance",
  BEST_DAY_ENGAGEMENT: "best_day_engagement",
  AVG_LIKES_METRIC: "avg_likes_metric",
  AVG_REACH_METRIC: "avg_reach_metric",
  MOST_USED_FORMAT: "most_used_format",
  FOLLOWER_COUNT: "follower_count",
  TOTAL_POSTS: "total_posts",
  POSTING_CONSISTENCY_POSITIVE: "posting_consistency_positive",
  FORMAT_VARIATION_SUGGESTION: "format_variation_suggestion",
  REACH_METRIC_HIGHLIGHT: "reach_metric_highlight",
  TUCA_FEATURE_REMINDER_BEST_TIMES: "tuca_feature_reminder_best_times",
  CONTENT_TYPE_PERFORMANCE_COMPARISON: "content_type_performance_comparison",
  PROPOSAL_SUCCESS_REMINDER: "proposal_success_reminder",
  FPC_COMBO_OPPORTUNITY: "fpc_combo_opportunity",
  VIDEO_DURATION_PERFORMANCE: "video_duration_performance",
  // === INÍCIO DAS NOVAS ADIÇÕES (HISTORICAL COMPARISONS) ===
  RECENT_ENGAGEMENT_LEVEL: "recent_engagement_level",
  RECENT_REACH_LEVEL: "recent_reach_level",
  FOLLOWER_GROWTH_RATE_HIGHLIGHT: "follower_growth_rate_highlight",
  // === FIM DAS NOVAS ADIÇÕES (HISTORICAL COMPARISONS) ===
} as const;

export type FallbackInsightType = typeof FALLBACK_INSIGHT_TYPES[keyof typeof FALLBACK_INSIGHT_TYPES];

export const FALLBACK_INSIGHT_COOLDOWNS_DAYS: Record<FallbackInsightType, number> = {
  [FALLBACK_INSIGHT_TYPES.FOLLOWER_GROWTH]: 7,
  [FALLBACK_INSIGHT_TYPES.TOP_POST_PERFORMANCE]: 5,
  [FALLBACK_INSIGHT_TYPES.BEST_DAY_ENGAGEMENT]: 7,
  [FALLBACK_INSIGHT_TYPES.AVG_LIKES_METRIC]: 3,
  [FALLBACK_INSIGHT_TYPES.AVG_REACH_METRIC]: 3,
  [FALLBACK_INSIGHT_TYPES.MOST_USED_FORMAT]: 10,
  [FALLBACK_INSIGHT_TYPES.FOLLOWER_COUNT]: 2,
  [FALLBACK_INSIGHT_TYPES.TOTAL_POSTS]: 2,
  [FALLBACK_INSIGHT_TYPES.POSTING_CONSISTENCY_POSITIVE]: 4,
  [FALLBACK_INSIGHT_TYPES.FORMAT_VARIATION_SUGGESTION]: 14,
  [FALLBACK_INSIGHT_TYPES.REACH_METRIC_HIGHLIGHT]: 4,
  [FALLBACK_INSIGHT_TYPES.TUCA_FEATURE_REMINDER_BEST_TIMES]: 15,
  [FALLBACK_INSIGHT_TYPES.CONTENT_TYPE_PERFORMANCE_COMPARISON]: 10,
  [FALLBACK_INSIGHT_TYPES.PROPOSAL_SUCCESS_REMINDER]: 14,
  [FALLBACK_INSIGHT_TYPES.FPC_COMBO_OPPORTUNITY]: 10,
  [FALLBACK_INSIGHT_TYPES.VIDEO_DURATION_PERFORMANCE]: 14,
  // === INÍCIO DAS NOVAS ADIÇÕES (HISTORICAL COMPARISONS) ===
  [FALLBACK_INSIGHT_TYPES.RECENT_ENGAGEMENT_LEVEL]: 7,
  [FALLBACK_INSIGHT_TYPES.RECENT_REACH_LEVEL]: 7,
  [FALLBACK_INSIGHT_TYPES.FOLLOWER_GROWTH_RATE_HIGHLIGHT]: 10,
  // === FIM DAS NOVAS ADIÇÕES (HISTORICAL COMPARISONS) ===
};
// --- FIM da Seção de Insights de Fallback ---


// --- Radar Tuca - Configurações Gerais de Detecção de Alertas ---
// ... (restante do arquivo igual ao que você forneceu) ...

export const SHARES_MIN_POST_AGE_DAYS_FOR_PICO = 2;
export const SHARES_MAX_POST_AGE_DAYS_FOR_PICO = 5;
export const SHARES_COMPARISON_LOOKBACK_DAYS = 30;
export const SHARES_MAX_POSTS_FOR_AVG = 10;
export const SHARES_PICO_THRESHOLD_MULTIPLIER = 2.0;
export const SHARES_MIN_ABSOLUTE_FOR_PICO = 5;

export const REELS_WATCH_TIME_LOOKBACK_DAYS = 14;
export const REELS_WATCH_TIME_MIN_FOR_ANALYSIS = 2;
export const REELS_WATCH_TIME_HISTORICAL_LOOKBACK_DAYS = 90;
export const REELS_WATCH_TIME_MAX_HISTORICAL_FOR_AVG = 15;
export const REELS_WATCH_TIME_DROP_THRESHOLD_PERCENTAGE = 0.25;
export const REELS_WATCH_TIME_MIN_HISTORICAL_FOR_ALERT = 10;

export const FORMAT_ANALYSIS_PERIOD_DAYS = 90;
export const FORMAT_UNUSED_THRESHOLD_DAYS = 14;
export const FORMAT_MIN_POSTS_FOR_AVG = 2;
export const FORMAT_PERFORMANCE_METRIC_KEY: keyof IMetricStats = 'views';
export const FORMAT_PROMISSING_THRESHOLD_MULTIPLIER = 1.1;

export const UNTAPPED_POTENTIAL_PAST_LOOKBACK_DAYS = 180;
export const UNTAPPED_POTENTIAL_RECENT_THRESHOLD_DAYS = 45;
export const UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY = 2;
export const UNTAPPED_POTENTIAL_PERFORMANCE_METRIC: keyof IMetricStats = 'views';
export const UNTAPPED_POTENTIAL_TOP_PERCENTILE_THRESHOLD = 0.60;
export const UNTAPPED_POTENTIAL_SUPERIORITY_MULTIPLIER = 1.15;

export const ENGAGEMENT_PEAK_POST_AGE_MIN_DAYS = 3;
export const ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS = 10;
export const ENGAGEMENT_PEAK_MIN_ABSOLUTE_COMMENTS = 10;
export const ENGAGEMENT_PEAK_COMMENT_MULTIPLIER = 2.0;

export const BEST_DAY_FORMAT_LOOKBACK_DAYS_GLOBAL = 90;
export const BEST_DAY_FORMAT_MIN_POSTS_PER_SLOT_GLOBAL = 3;
export const BEST_DAY_FORMAT_SUPERIORITY_MULTIPLIER_VS_FORMAT_AVG_GLOBAL = 1.3;
export const BEST_DAY_FORMAT_SUPERIORITY_MULTIPLIER_VS_OVERALL_AVG_GLOBAL = 1.5;
export const BEST_DAY_FORMAT_RECENT_POST_THRESHOLD_WEEKS_GLOBAL = 2;
export const BEST_DAY_FORMAT_METRIC_KEY_GLOBAL: keyof IMetricStats = 'total_interactions';

export const STAGNATION_LOOKBACK_WEEKS = 8;
export const STAGNATION_COMPARISON_PERIOD_WEEKS = 4;
export const STAGNATION_SIGNIFICANT_DROP_THRESHOLD = 0.75;
export const STAGNATION_MIN_FOLLOWERS_FOR_ANALYSIS = 100;
export const STAGNATION_MIN_GROWTH_FOR_SIGNIFICANCE = 5;

export const CONSISTENCY_LOOKBACK_WEEKS_FOR_AVG = 4;
export const CONSISTENCY_CHECK_PERIOD_DAYS = 7;
export const CONSISTENCY_ALERT_THRESHOLD_DAYS_INCREASE = 3;
export const CONSISTENCY_MIN_POSTS_FOR_AVG = 3;

export const EVERGREEN_MIN_POST_AGE_MONTHS = 4;
export const EVERGREEN_MAX_POST_AGE_MONTHS = 18;
export const EVERGREEN_PERFORMANCE_MULTIPLIER = 1.2;
export const EVERGREEN_MIN_POSTS_FOR_HISTORICAL_AVG = 5;
export const EVERGREEN_RECENT_REPOST_THRESHOLD_DAYS = 90;

export const NEW_FORMAT_LOOKBACK_DAYS_GLOBAL = 60;
export const NEW_FORMAT_MAX_POSTS_CONSIDERED_NEW_GLOBAL = 3;
export const NEW_FORMAT_MIN_POSTS_FOR_COMPARISON_AVG_GLOBAL = 5;
export const NEW_FORMAT_PERFORMANCE_THRESHOLD_POSITIVE_GLOBAL = 1.5;
export const NEW_FORMAT_PERFORMANCE_THRESHOLD_NEGATIVE_GLOBAL = 0.7;

export const MEDIA_TYPE_LOOKBACK_DAYS_GLOBAL = 30;
export const MEDIA_TYPE_MIN_POSTS_PER_TYPE_GLOBAL = 3;
export const MEDIA_TYPE_COMPARISON_METRIC_KEY_GLOBAL: keyof IMetricStats = 'total_interactions';
export const MEDIA_TYPE_SIGNIFICANT_DIFFERENCE_THRESHOLD_GLOBAL = 0.25;

export const NEW_USER_THRESHOLD_DAYS = Number(process.env.NEW_USER_THRESHOLD_DAYS) || 90;
