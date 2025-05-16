// src/app/lib/instagram/config/instagramApiConfig.ts
// ATUALIZADO CONFORME RELATÓRIO DE PESQUISA PARA API v22.0

/**
 * Base URL for the Facebook Graph API.
 */
export const BASE_URL = 'https://graph.facebook.com';

/**
 * API version for the Facebook Graph API.
 */
export const API_VERSION = 'v22.0';

// --- Campos e Métricas Chave ---

/**
 * Default fields to request for basic Instagram account data (IG User node).
 * Fonte: Seção IV.A do relatório (confirmando follows_count).
 */
export const BASIC_ACCOUNT_FIELDS = 'id,username,name,profile_picture_url,followers_count,media_count,biography,website,follows_count';

/**
 * Metrics for MEDIA insights (/{ig-media-id}/insights).
 * Prioriza 'views' e 'reach' sobre 'impressions' (depreciado).
 * 'total_interactions' está "Under Development" mas pode ser útil.
 * Fonte: Seção IV.B e Tabela 5 do relatório.
 */
export const MEDIA_INSIGHTS_METRICS = 'views,reach,engagement,saved,comments,likes,shares,total_interactions,profile_activity,profile_visits,navigation,replies'; // 'video_views' removido (depreciado), 'impressions' substituído por 'views'

/**
 * General metrics considered safe for REELS media insights.
 * Foco em 'views' como principal métrica de consumo.
 * Fonte: Seção IV.B e Tabela 5 do relatório.
 */
export const REEL_SAFE_GENERAL_METRICS = 'views,reach,comments,likes,saved,shares,total_interactions'; // 'plays' removido, 'impressions' (implícito) substituído por 'views'

/**
 * Specific insight metrics for REELS.
 * Fonte: Seção IV.B e Tabela 5 do relatório.
 */
export const REEL_SPECIFIC_INSIGHTS_METRICS = 'ig_reels_avg_watch_time,ig_reels_video_view_total_time'; // 'clips_replays_count' e 'ig_reels_aggregated_all_plays_count' removidos (depreciados)

/**
 * Metrics for ACCOUNT-level insights (/{ig-user-id}/insights).
 * 'impressions', 'follower_count', 'website_clicks', 'profile_views', 'profile_activity' (account) removidos/ajustados conforme relatório.
 * Fonte: Seção II e Tabela 2 do relatório.
 */
export const ACCOUNT_INSIGHTS_METRICS = 'views,reach,accounts_engaged,total_interactions,profile_links_taps'; // Adicionado 'views', removidas métricas não válidas/diretas.

/**
 * Metrics for audience DEMOGRAPHICS (/{ig-user-id}/insights).
 * Fonte: Seção III e Tabela 3 do relatório.
 */
export const DEMOGRAPHICS_METRICS = 'follower_demographics,engaged_audience_demographics';

// --- Períodos e Timeframes ---

/**
 * Default period for requesting account insights.
 * Fonte: Seção II (ex: 'reach' suporta 'day').
 */
export const DEFAULT_ACCOUNT_INSIGHTS_PERIOD = 'day'; // Ajustado para 'day' que é mais comum para métricas de interação de conta

/**
 * Default period for demographic metrics.
 * Fonte: Seção III.A (follower_demographics usa period=lifetime).
 */
export const DEMOGRAPHICS_PERIOD = 'lifetime';

/**
 * Timeframe parameter for demographic metrics to get recent snapshots.
 * Fonte: Seção III.A e III.B (ex: last_30_days).
 */
export const DEMOGRAPHICS_TIMEFRAME_RECENT = 'last_30_days'; // Para buscar dados recentes

// --- Breakdowns ---

/**
 * Specifies breakdowns for specific MEDIA insight metrics.
 * Fonte: Seção IV.B e Tabela 5 (ex: profile_activity tem action_type).
 */
export const MEDIA_BREAKDOWNS: { [metric: string]: string } = {
  profile_activity: 'action_type', // (BIO_LINK_CLICKED, CALL, DIRECTION, EMAIL, OTHER, TEXT)
  navigation: 'story_navigation_action_type', // (SWIPE_FORWARD, TAP_BACK, TAP_EXIT, TAP_FORWARD)
};

/**
 * Specifies breakdowns for specific ACCOUNT insight metrics.
 * Fonte: Seção II.D e Tabela 2 (ex: profile_links_taps tem contact_button_type).
 */
export const ACCOUNT_BREAKDOWNS: { [metric: string]: string } = {
  profile_links_taps: 'contact_button_type',
  reach: 'media_product_type,follow_type', // Conforme Seção II.B
  total_interactions: 'media_product_type', // Conforme Seção II.G
  views: 'follower_type,media_product_type', // Conforme Seção I.B (para user insights)
};

/**
 * Specifies breakdowns for DEMOGRAPHIC metrics (como 'follower_demographics').
 * Fonte: Seção III.A e Tabela 3.
 */
export const DEMOGRAPHICS_BREAKDOWNS = 'age,gender,country,city';

// --- Requisitos de metric_type=total_value ---

/**
 * Account insight metrics that require `metric_type=total_value`.
 * Fonte: Seção II.I e Tabela 2.
 */
export const ACCOUNT_INSIGHTS_REQUIRING_TOTAL_VALUE: string[] = [
  'accounts_engaged',
  // 'comments', // Comentários geralmente são contagens diretas, não insights que precisam de total_value
  // 'likes',    // Idem para likes
  'profile_links_taps',
  // 'saved',    // Idem para saves
  // 'shares',   // Idem para shares
  'total_interactions',
  'views', // Para user-level views
  // 'reach' também suporta total_value, mas não é obrigatório se time_series for usado.
];

/**
 * Demographic metrics that require `metric_type=total_value`.
 * Fonte: Seção III e Tabela 3.
 */
export const DEMOGRAPHICS_REQUIRING_TOTAL_VALUE: string[] = [
  'follower_demographics',
  'engaged_audience_demographics'
];


// --- Constantes de Controle de Fluxo e Limites (mantidas do original, verificar se ainda são ideais) ---
export const RETRY_OPTIONS = { retries: 3, factor: 2, minTimeout: 500, maxTimeout: 5000, randomize: true };
export const INSIGHTS_CONCURRENCY_LIMIT = 5;
export const MAX_PAGES_MEDIA = 10;
export const DELAY_MS = 250;
export const MAX_ACCOUNT_FETCH_PAGES = 30;
export const ACCOUNT_FETCH_DELAY_MS = 100;
export const INSIGHT_FETCH_CUTOFF_DAYS = 180; // Para buscar apenas insights de mídias recentes

