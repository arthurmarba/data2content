// @/app/lib/fallbackInsightService/fallbackInsight.constants.ts
import type { IMetricStats } from './fallbackInsight.types'; // <-- ADICIONADA ESTA LINHA

/**
 * Tag base para logging em todo o serviço de insights de fallback.
 * A versão é mantida para rastreabilidade.
 */
export const BASE_SERVICE_TAG = '[FallbackInsightService v1.6.19]';

// Constantes para tryGeneratePostingConsistencyPositiveInsight
export const MIN_POSTS_FOR_CONSISTENCY_INSIGHT = 3;
export const CONSISTENCY_LOOKBACK_DAYS = 7;
export const CONSISTENCY_RECENT_POST_MIN_INTERACTIONS = 5;

// Constantes para tryGenerateFormatVariationSuggestion
export const KEY_FORMATS_FOR_VARIATION = ['CAROUSEL', 'REELS'];
export const MIN_DAYS_SINCE_LAST_FORMAT_USE = 21;

// Constantes para tryGenerateReachMetricHighlightInsight
export const REACH_HIGHLIGHT_LOOKBACK_DAYS = 7;
export const MIN_AVG_REACH_FOR_POSITIVE_HIGHLIGHT = 100;
export const MIN_POSTS_FOR_REACH_HIGHLIGHT = 2;
export const REACH_HIGHLIGHT_MIN_DAY1_REACH_FOR_MENTION = 50;

// Constantes para tryGenerateContentTypePerformanceComparisonInsight
export const COMPARISON_MIN_POSTS_PER_TYPE = 3;
export const COMPARISON_SIGNIFICANT_DIFFERENCE_MULTIPLIER = 1.3;
// COMPARISON_LOOKBACK_PERIOD_DAYS usará DEFAULT_METRICS_FETCH_DAYS de @/app/lib/constants
export const COMPARISON_MIN_DAY1_METRIC_FOR_MENTION = 50;

// Constantes para tryGenerateProposalSuccessReminderInsight
export const PROPOSAL_MIN_POSTS_WITH_TAG = 2;
export const PROPOSAL_ENGAGEMENT_SUPERIORITY_MULTIPLIER = 1.2;
export const PROPOSAL_RECENT_POST_THRESHOLD_DAYS = 21;
export const PROPOSAL_EXAMPLE_POST_MIN_DAY1_INTERACTIONS = 5;

// Constantes para tryGenerateBestDayInsight
export const BEST_DAY_MIN_POSTS_IN_SLOT = 2; // Adicionado conforme lógica implícita na função original
export const BEST_DAY_MIN_ENGAGEMENT_VALUE = 1;

// Constantes para tryGenerateAvgLikesInsight
export const AVG_LIKES_MIN_FOR_INSIGHT = 10;
export const AVG_LIKES_MIN_DAY1_LIKES_FOR_MENTION = 3;

// Constantes para tryGenerateAvgReachInsight
export const AVG_REACH_MIN_FOR_INSIGHT = 50;
export const AVG_REACH_MIN_DAY1_REACH_FOR_MENTION = 20;

// Constantes para tryGenerateFpcComboOpportunityInsight
export const FPC_MIN_POSTS_FOR_COMBO_RELEVANCE = 2;
export const FPC_MAX_POSTS_FOR_UNDERUTILIZED = 4;
export const FPC_PERFORMANCE_MULTIPLIER = 1.25;
export const FPC_METRIC_KEY: keyof IMetricStats = 'total_interactions';

// Constantes para tryGenerateVideoDurationPerformanceInsight
export const VIDEO_DURATION_MIN_POSTS_PER_RANGE = 2;
export const VIDEO_DURATION_MIN_RETENTION_THRESHOLD = 0.35;
export const VIDEO_DURATION_EXAMPLE_MIN_VIEWS_OR_RETENTION_VALUE = 50;

// Constantes para insights históricos (RECENT_ENGAGEMENT_LEVEL, RECENT_REACH_LEVEL, FOLLOWER_GROWTH_RATE_HIGHLIGHT)
export const HISTORICAL_RECENT_ENGAGEMENT_MIN_VALUE = 10;
export const HISTORICAL_RECENT_REACH_MIN_VALUE = 100;
export const HISTORICAL_FOLLOWER_GROWTH_RATE_MIN_THRESHOLD = 0.01; // Usado também por FOLLOWER_GROWTH
export const FOLLOWER_GROWTH_ABS_THRESHOLD = 5; // Usado por FOLLOWER_GROWTH

// Constantes para tryGenerateTopPostInsight
export const TOP_POST_METRIC_MULTIPLIER = 1.3;
// MIN_AVG_LIKES_FOR_INSIGHT e MIN_AVG_REACH_FOR_INSIGHT já definidos acima como AVG_LIKES_MIN_FOR_INSIGHT e AVG_REACH_MIN_FOR_INSIGHT

// Constantes para tryGenerateMostUsedFormatInsight
export const MIN_POSTS_FOR_FORMAT_INSIGHT = 3;

// Adicione outras constantes específicas conforme necessário.
