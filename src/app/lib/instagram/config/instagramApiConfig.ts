// src/app/lib/instagram/config/instagramApiConfig.ts

/**
 * Base URL for the Facebook Graph API.
 */
export const BASE_URL = 'https://graph.facebook.com';

/**
 * API version for the Facebook Graph API.
 * Note: This should be kept up-to-date with the latest stable version supported by your application.
 */
export const API_VERSION = 'v22.0'; // Atualizado conforme o arquivo fornecido

/**
 * Default fields to request for basic Instagram account data.
 */
export const BASIC_ACCOUNT_FIELDS = 'id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website';

/**
 * Metrics to request for individual media insights (posts, carousels).
 * Common metrics for most media types.
 */
export const MEDIA_INSIGHTS_METRICS = 'impressions,reach,engagement,saved,video_views,comments,likes,shares,total_interactions,profile_activity,profile_visits,navigation,follows,website_clicks'; // Adicionei mais métricas comuns, ajuste conforme necessidade

/**
 * General metrics that are safe to request for Reels and other video types.
 * These are typically available for Reels.
 */
export const REEL_SAFE_GENERAL_METRICS = 'comments,likes,reach,saved,shares,total_interactions,plays,ig_reels_avg_watch_time,ig_reels_video_view_total_time'; // Adicionado ig_reels_video_view_total_time

/**
 * Specific insight metrics that might be unique to Reels or have different behavior.
 * Combine with REEL_SAFE_GENERAL_METRICS for a comprehensive list for Reels.
 */
export const REEL_SPECIFIC_INSIGHTS_METRICS = 'ig_reels_loops_count,ig_reels_people_reached'; // Exemplo, adicione outras métricas específicas de Reels se necessário

/**
 * Metrics to request for account-level insights.
 */
export const ACCOUNT_INSIGHTS_METRICS = 'impressions,reach,follower_count,email_contacts,phone_call_clicks,text_message_clicks,get_directions_clicks,website_clicks,profile_views,accounts_engaged,total_interactions'; // Adicionei total_interactions

/**
 * Metrics to request for audience demographics.
 * Typically 'follower_demographics' or 'engaged_audience_demographics'.
 */
export const DEMOGRAPHICS_METRICS = 'audience_city,audience_country,audience_gender_age'; // Simplificado para os nomes de métricas reais

/**
 * Default period for requesting account insights (e.g., "day", "week", "days_28").
 */
export const DEFAULT_ACCOUNT_INSIGHTS_PERIOD = 'days_28';

/**
 * Timeframe for demographic data (usually "lifetime" for follower demographics).
 */
export const DEMOGRAPHICS_TIMEFRAME = 'lifetime';

/**
 * Specifies breakdowns for specific media insight metrics if needed.
 * Example: { "story_exits_by_type": "story_exit_type" }
 * (Atualmente não usado no código original, mas pode ser útil)
 */
export const MEDIA_BREAKDOWNS: { [key: string]: string } = {
    // e.g., "video_view_retention_graph": "view_type"
};

/**
 * Specifies breakdowns for specific account insight metrics.
 * Example: { "audience_gender_age": "gender,age" }
 * (O código original construía a URL com base nisso, mas a API espera os breakdowns como parte da métrica ou parâmetros separados)
 */
export const ACCOUNT_BREAKDOWNS: { [key: string]: string } = {
    // Este objeto não é diretamente usado na URL da API da forma como estava no código original.
    // A API espera `audience_city`, `audience_country`, `audience_gender_age` como métricas diretas
    // ou como parâmetros de `breakdown` para outras métricas, o que é menos comum para insights de conta agregados.
};

/**
 * Specifies breakdowns for demographic metrics.
 * This is usually implicitly handled by requesting metrics like 'audience_city', 'audience_country', 'audience_gender_age'.
 * O parâmetro 'breakdown' na API de demografia é menos comum, pois as métricas já são detalhadas.
 */
export const DEMOGRAPHICS_BREAKDOWNS = 'age,gender,country,city'; // Este é um exemplo de como poderia ser usado se a API o suportasse diretamente para um único 'metric'

/**
 * Account insight metrics that require `metric_type=total_value` when using a System User Token.
 */
export const ACCOUNT_INSIGHTS_REQUIRING_TOTAL_VALUE: string[] = [
    'impressions',
    'reach',
    'follower_count',
    // Adicione outras métricas se aplicável
];

/**
 * Demographic metrics that require `metric_type=total_value` when using a System User Token.
 * (Geralmente, dados demográficos não usam `total_value` da mesma forma que insights de alcance/impressões)
 */
export const DEMOGRAPHICS_REQUIRING_TOTAL_VALUE: string[] = [
    // Verifique a documentação da API se alguma métrica demográfica específica requer isso com System User.
    // Normalmente, 'audience_city', 'audience_country', 'audience_gender_age' não precisam.
];


// --- Constantes de Controle de Fluxo e Limites ---

/**
 * Retry options for API calls.
 */
export const RETRY_OPTIONS = { retries: 3, factor: 2, minTimeout: 500, maxTimeout: 5000, randomize: true };

/**
 * Concurrency limit for fetching media insights.
 */
export const INSIGHTS_CONCURRENCY_LIMIT = 5;

/**
 * Maximum number of pages to fetch for media items.
 */
export const MAX_PAGES_MEDIA = 10; // Limite de páginas para buscar mídias

/**
 * Delay in milliseconds between paginated media fetch calls.
 */
export const DELAY_MS = 250; // Atraso entre chamadas de busca de mídia paginada

/**
 * Maximum number of pages to fetch when discovering accounts (e.g., via /me/accounts or /<BUSINESS_ID>/owned_pages).
 */
export const MAX_ACCOUNT_FETCH_PAGES = 30;

/**
 * Delay in milliseconds between paginated account fetch calls.
 */
export const ACCOUNT_FETCH_DELAY_MS = 100;

/**
 * Cutoff in days for fetching insights for media. Media older than this will be skipped for insights processing.
 */
export const INSIGHT_FETCH_CUTOFF_DAYS = 180;

