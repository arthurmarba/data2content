// src/app/lib/instagram/config/instagramApiConfig.ts
// ATUALIZADO CONFORME RELATÓRIO DE PESQUISA PARA API v22.0
// E REVISADO PARA SUPORTAR FETCHERS GRANULARES

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
 * 'engagement' é uma métrica comum, mas o relatório v22.0 foca em 'views', 'reach', 'likes', 'comments', 'saved', 'shares'.
 * 'profile_activity', 'profile_visits', 'navigation', 'replies' são para tipos específicos (Story/Feed).
 */
export const MEDIA_INSIGHTS_METRICS = 'views,reach,likes,comments,saved,shares,total_interactions,profile_activity,profile_visits,navigation,replies'; 
// 'engagement' foi removido para focar nas métricas diretas da API v22.0. Se 'engagement' for uma métrica calculada ou uma métrica específica de um tipo de post, deve ser tratada.
// A API v22.0 não lista 'engagement' como uma métrica direta para /insights de mídia geral.
// Para Reels, 'plays', 'video_views' e 'impressions' foram substituídos por 'views'.

/**
 * General metrics considered safe for REELS media insights.
 * Foco em 'views' como principal métrica de consumo.
 * Fonte: Seção IV.B e Tabela 5 do relatório.
 */
export const REEL_SAFE_GENERAL_METRICS = 'views,reach,comments,likes,saved,shares,total_interactions'; 
// 'plays' removido, 'impressions' (implícito) substituído por 'views'

/**
 * Specific insight metrics for REELS.
 * Fonte: Seção IV.B e Tabela 5 do relatório.
 */
export const REEL_SPECIFIC_INSIGHTS_METRICS = 'ig_reels_avg_watch_time,ig_reels_video_view_total_time'; 
// 'clips_replays_count' e 'ig_reels_aggregated_all_plays_count' removidos (depreciados)

/**
 * Metrics for ACCOUNT-level insights (/{ig-user-id}/insights).
 * 'impressions', 'follower_count', 'website_clicks', 'profile_views', 'profile_activity' (account) removidos/ajustados conforme relatório.
 * Esta lista é usada por fetchAccountInsights para fazer chamadas individuais por métrica se necessário.
 * Fonte: Seção II e Tabela 2 do relatório.
 */
export const ACCOUNT_INSIGHTS_METRICS = 'views,reach,accounts_engaged,total_interactions,profile_links_taps'; 
// Adicionado 'views', removidas métricas não válidas/diretas.

/**
 * Metrics for audience DEMOGRAPHICS (/{ig-user-id}/insights).
 * Fonte: Seção III e Tabela 3 do relatório.
 * Estas serão buscadas individualmente por fetchAudienceDemographics.
 */
export const DEMOGRAPHICS_METRICS = 'follower_demographics,engaged_audience_demographics';

// --- Períodos e Timeframes ---

/**
 * Default period for requesting account insights.
 * Fonte: Seção II (ex: 'reach' suporta 'day').
 */
export const DEFAULT_ACCOUNT_INSIGHTS_PERIOD = 'day'; 

/**
 * Default period for demographic metrics.
 * Fonte: Seção III.A (follower_demographics usa period=lifetime).
 */
export const DEMOGRAPHICS_PERIOD = 'lifetime';

/**
 * Timeframe parameter for demographic metrics to get recent snapshots.
 * Fonte: Seção III.A e III.B (ex: last_30_days).
 */
export const DEMOGRAPHICS_TIMEFRAME_RECENT = 'last_30_days';

// --- Breakdowns ---

/**
 * Specifies breakdowns for specific MEDIA insight metrics.
 * Usado por fetchMediaInsights se a lógica for estendida para aplicar breakdowns automaticamente.
 * Atualmente, fetchMediaInsights espera a string de métrica completa, incluindo breakdowns se necessário.
 * Fonte: Seção IV.B e Tabela 5 (ex: profile_activity tem action_type).
 */
export const MEDIA_BREAKDOWNS: { [metric: string]: string } = {
  profile_activity: 'action_type', // (BIO_LINK_CLICKED, CALL, DIRECTION, EMAIL, OTHER, TEXT)
  navigation: 'story_navigation_action_type', // (SWIPE_FORWARD, TAP_BACK, TAP_EXIT, TAP_FORWARD)
};

/**
 * Specifies breakdowns for specific ACCOUNT insight metrics.
 * Crucial para a lógica granular em fetchAccountInsights.
 * Fonte: Seção II.D, II.B, II.G, I.B e Tabela 2 do relatório.
 */
export const ACCOUNT_BREAKDOWNS: { [metric: string]: string } = {
  profile_links_taps: 'contact_button_type',
  reach: 'media_product_type,follow_type', 
  total_interactions: 'media_product_type', 
  views: 'follower_type,media_product_type', 
  // 'accounts_engaged' não possui breakdowns listados na documentação para /insights de usuário.
};

/**
 * Specifies breakdowns for DEMOGRAPHIC metrics (como 'follower_demographics').
 * Fonte: Seção III.A e Tabela 3.
 */
export const DEMOGRAPHICS_BREAKDOWNS = 'age,gender,country,city'; // Aplicável a follower_demographics e engaged_audience_demographics

// --- Requisitos de metric_type=total_value ---

/**
 * Account insight metrics that require `metric_type=total_value` quando usadas com System User Token,
 * ou que geralmente são solicitadas como um total.
 * Fonte: Seção II.I e Tabela 2.
 */
export const ACCOUNT_INSIGHTS_REQUIRING_TOTAL_VALUE: string[] = [
  'accounts_engaged',
  'profile_links_taps',
  'total_interactions',
  'views', // Para user-level views, 'metric_type=total_value' é necessário.
  // 'reach' também suporta total_value, mas não é estritamente obrigatório se time_series for usado.
  // Para consistência com o System User Token, pode ser incluído se for o padrão.
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
// Estas constantes não foram diretamente implicadas nos erros recentes, mas são boas para revisão periódica.
export const RETRY_OPTIONS = { retries: 3, factor: 2, minTimeout: 500, maxTimeout: 5000, randomize: true };
export const INSIGHTS_CONCURRENCY_LIMIT = 5; // Para fetchMediaInsights
export const MAX_PAGES_MEDIA = 10; // Para fetchInstagramMedia
export const DELAY_MS = 250; // Atraso entre páginas de mídia
export const MAX_ACCOUNT_FETCH_PAGES = 30; // Para accountDiscovery (páginas do Facebook)
export const ACCOUNT_FETCH_DELAY_MS = 100; // Para accountDiscovery
export const INSIGHT_FETCH_CUTOFF_DAYS = 180; // Para buscar apenas insights de mídias recentes
