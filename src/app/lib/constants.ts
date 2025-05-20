// src/app/lib/constants.ts
import { DeterminedIntent } from '@/app/lib/intentService'; 
import { PostObjectForAverage } from '@/app/lib/utils'; 

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

// --- Radar Tuca - Configurações Gerais de Detecção de Alertas ---

// Regra 1: detectPeakPerformanceShares
export const SHARES_MIN_POST_AGE_DAYS_FOR_PICO = 2;
export const SHARES_MAX_POST_AGE_DAYS_FOR_PICO = 5;
export const SHARES_COMPARISON_LOOKBACK_DAYS = 30;
export const SHARES_MAX_POSTS_FOR_AVG = 10;
export const SHARES_PICO_THRESHOLD_MULTIPLIER = 2.0;
export const SHARES_MIN_ABSOLUTE_FOR_PICO = 5;

// Regra 2: detectUnexpectedDropReelsWatchTime
export const REELS_WATCH_TIME_LOOKBACK_DAYS = 14;
export const REELS_WATCH_TIME_MIN_FOR_ANALYSIS = 2;
export const REELS_WATCH_TIME_HISTORICAL_LOOKBACK_DAYS = 90;
export const REELS_WATCH_TIME_MAX_HISTORICAL_FOR_AVG = 15;
export const REELS_WATCH_TIME_DROP_THRESHOLD_PERCENTAGE = 0.25; 
export const REELS_WATCH_TIME_MIN_HISTORICAL_FOR_ALERT = 10; 

// Regra 3: detectForgottenPromisingFormat
export const FORMAT_ANALYSIS_PERIOD_DAYS = 90;
export const FORMAT_UNUSED_THRESHOLD_DAYS = 21;
export const FORMAT_MIN_POSTS_FOR_AVG = 3; 
export const FORMAT_PERFORMANCE_METRIC_KEY: keyof PostObjectForAverage | string = 'totalImpressions'; 
export const FORMAT_PROMISSING_THRESHOLD_MULTIPLIER = 1.2; 

// Regra 4: detectUntappedPotentialTopic
export const UNTAPPED_POTENTIAL_PAST_LOOKBACK_DAYS = 180;
export const UNTAPPED_POTENTIAL_RECENT_THRESHOLD_DAYS = 30;
export const UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY = 3;
export const UNTAPPED_POTENTIAL_PERFORMANCE_METRIC: keyof PostObjectForAverage | string = 'totalImpressions'; 
export const UNTAPPED_POTENTIAL_TOP_PERCENTILE_THRESHOLD = 0.75; 
export const UNTAPPED_POTENTIAL_SUPERIORITY_MULTIPLIER = 1.3; 

// Regra 5: detectEngagementPeakNotCapitalized
export const ENGAGEMENT_PEAK_POST_AGE_MIN_DAYS = 3;
export const ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS = 10;
export const ENGAGEMENT_PEAK_MIN_ABSOLUTE_COMMENTS = 10;
export const ENGAGEMENT_PEAK_COMMENT_MULTIPLIER = 2.0;

// Regra 6: BestDayFormatEngagementRule
export const BEST_DAY_FORMAT_LOOKBACK_DAYS = 90;
export const BEST_DAY_FORMAT_MIN_POSTS_PER_SLOT = 3;
export const BEST_DAY_FORMAT_SUPERIORITY_MULTIPLIER_VS_FORMAT_AVG = 1.3; 
export const BEST_DAY_FORMAT_SUPERIORITY_MULTIPLIER_VS_OVERALL_AVG = 1.5; 
export const BEST_DAY_FORMAT_RECENT_POST_THRESHOLD_WEEKS = 2;
export const BEST_DAY_FORMAT_METRIC_KEY: keyof PostObjectForAverage | string = 'totalEngagement';

// Regra 7: FollowerGrowthStagnationRule
export const STAGNATION_LOOKBACK_WEEKS = 8;
export const STAGNATION_COMPARISON_PERIOD_WEEKS = 4;
export const STAGNATION_SIGNIFICANT_DROP_THRESHOLD = 0.75; 
export const STAGNATION_MIN_FOLLOWERS_FOR_ANALYSIS = 100;
export const STAGNATION_MIN_GROWTH_FOR_SIGNIFICANCE = 5;

// --- Constantes para PostingConsistencyRule ---
export const CONSISTENCY_LOOKBACK_WEEKS_FOR_AVG = 4; 
export const CONSISTENCY_CHECK_PERIOD_DAYS = 7;    
export const CONSISTENCY_ALERT_THRESHOLD_DAYS_INCREASE = 3; 
export const CONSISTENCY_MIN_POSTS_FOR_AVG = 3; 

// --- Constantes para EvergreenRepurposeRule ---
export const EVERGREEN_MIN_POST_AGE_MONTHS = 6;
export const EVERGREEN_MAX_POST_AGE_MONTHS = 18; 
export const EVERGREEN_PERFORMANCE_MULTIPLIER = 1.5; 
export const EVERGREEN_MIN_POSTS_FOR_HISTORICAL_AVG = 10;
export const EVERGREEN_RECENT_REPOST_THRESHOLD_DAYS = 90;

// --- Constantes para NewFormatPerformanceRule ---
export const NEW_FORMAT_LOOKBACK_DAYS = 60; 
export const NEW_FORMAT_MAX_POSTS_CONSIDERED_NEW = 3; 
export const NEW_FORMAT_MIN_POSTS_FOR_COMPARISON_AVG = 5; 
export const NEW_FORMAT_PERFORMANCE_THRESHOLD_POSITIVE = 1.5; 
export const NEW_FORMAT_PERFORMANCE_THRESHOLD_NEGATIVE = 0.7; 
// (Utiliza FORMAT_PERFORMANCE_METRIC_KEY já definido)

// --- Constantes para MediaTypeComparisonRule ---
export const MEDIA_TYPE_LOOKBACK_DAYS = 30;
export const MEDIA_TYPE_MIN_POSTS_PER_TYPE = 3;
export const MEDIA_TYPE_COMPARISON_METRIC_KEY: keyof PostObjectForAverage | string = 'totalEngagement'; 
export const MEDIA_TYPE_SIGNIFICANT_DIFFERENCE_THRESHOLD = 0.25;
