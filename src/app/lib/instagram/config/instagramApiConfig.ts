// src/app/lib/instagram/config/instagramApiConfig.ts
// ATUALIZADO E OTIMIZADO CONFORME RELATÓRIO DE PESQUISA PARA API v22.0
// E SUGESTÕES PARA MÉTRICAS GRANULARES.
// CORREÇÃO: Ajustado breakdown para a métrica 'views' em ACCOUNT_INSIGHTS_BREAKDOWNS.
// ATUALIZADO: DEFAULT_ACCOUNT_INSIGHTS_PERIOD revertido para 'day'.
// ATUALIZADO: Breakdown de 'views' para [] (sem breakdown) para teste.

/**
 * Base URL for the Facebook Graph API.
 */
export const BASE_URL = 'https://graph.facebook.com';

/**
 * API version for the Facebook Graph API.
 */
export const API_VERSION = 'v22.0'; // Confirmado como v22.0

// --- Campos e Métricas Chave ---

/**
 * Default fields to request for basic Instagram account data (IG User node).
 * Fonte: Seção IV.A do relatório (confirmando follows_count).
 */
export const BASIC_ACCOUNT_FIELDS = 'id,username,name,profile_picture_url,followers_count,media_count,biography,website,follows_count';

// --- Métricas de Insights para Mídia Individual (/{ig-media-id}/insights) ---
// Baseado na Tabela 3.5 do relatório e nas melhores práticas da v22.0.

const COMMON_REACH_AND_VIEWS_METRICS = 'reach,views'; // 'views' é a nova métrica principal.
const COMMON_ENGAGEMENT_METRICS = 'likes,comments,saved,shares,total_interactions';

/**
 * Métricas para mídias do tipo FEED (media_product_type: FEED).
 * Inclui Imagens e Vídeos (que não são Reels).
 * Exclui 'navigation' e 'replies'. 'impressions' e 'plays' depreciadas em favor de 'views'.
 * Fonte: Tabela 3.5 do relatório.
 */
export const FEED_MEDIA_INSIGHTS_METRICS = 
    `${COMMON_REACH_AND_VIEWS_METRICS},${COMMON_ENGAGEMENT_METRICS},profile_activity,profile_visits,follows`;

/**
 * Metrics for REELS media insights (media_product_type: REELS).
 * Fonte: Tabela 3.5 do relatório.
 * Combina suas REEL_SAFE_GENERAL_METRICS e REEL_SPECIFIC_INSIGHTS_METRICS, garantindo 'views'.
 */
export const REEL_INSIGHTS_METRICS = 
    `${COMMON_REACH_AND_VIEWS_METRICS},${COMMON_ENGAGEMENT_METRICS},ig_reels_avg_watch_time,ig_reels_video_view_total_time`;

/**
 * Metrics for STORY media insights (media_product_type: STORY).
 * Inclui 'navigation' e 'replies'.
 * Fonte: Tabela 3.5 do relatório.
 */
export const STORY_INSIGHTS_METRICS = 
    `${COMMON_REACH_AND_VIEWS_METRICS},${COMMON_ENGAGEMENT_METRICS},navigation,replies,follows,profile_activity,profile_visits`;

/**
 * Constante para CAROUSEL_ALBUM (media_product_type: CAROUSEL_ALBUM) - Itens Filhos.
 * Insights NÃO estão disponíveis para itens filhos de um carrossel via /{ig-media-id}/insights.
 * Usar esta constante no dataSyncService para pular a busca de insights para filhos de carrossel.
 * Fonte: Seção 3.4 do relatório.
 */
export const CAROUSEL_CHILD_NO_MEDIA_INSIGHTS_FLAG = 'SKIP_INSIGHTS_FOR_CAROUSEL_CHILD';

/**
 * MÉTRICA GENÉRICA DEPRECIADA - NÃO USAR DIRETAMENTE PARA NOVAS LÓGICAS.
 * A constante original MEDIA_INSIGHTS_METRICS era muito ampla e causava erros.
 * Mantida aqui para referência do que precisa ser substituído pela lógica granular
 * no dataSyncService.ts.
 */
export const DEPRECATED_OR_TOO_BROAD_MEDIA_INSIGHTS_METRICS = 'views,reach,likes,comments,saved,shares,total_interactions,profile_activity,profile_visits,navigation,replies';


// --- Métricas de Insights para Nível de Conta (/{ig-user-id}/insights) ---

/**
 * Metrics for ACCOUNT-level insights (/{ig-user-id}/insights).
 * Fonte: Seção II e Tabela 2 do relatório.
 * Ajustado para refletir métricas válidas e diretas na v22.0.
 */
export const ACCOUNT_INSIGHTS_METRICS_LIST = [ // Transformado em array para facilitar iteração se necessário
  'views', 
  'reach', 
  'accounts_engaged', 
  'total_interactions', 
  'profile_links_taps'
];

/**
 * Metrics for audience DEMOGRAPHICS (/{ig-user-id}/insights).
 * Fonte: Seção III e Tabela 3 do relatório.
 */
export const DEMOGRAPHICS_METRICS_LIST = [ // Transformado em array
  'follower_demographics', 
  'engaged_audience_demographics'
];

// --- Períodos e Timeframes ---

export const DEFAULT_ACCOUNT_INSIGHTS_PERIOD = 'day'; 
export const DEMOGRAPHICS_PERIOD = 'lifetime';
export const DEMOGRAPHICS_TIMEFRAME_RECENT = 'this_month'; // Mantido como 'this_month'

// --- Breakdowns ---

/**
 * Specifies breakdowns for specific MEDIA insight metrics.
 * Usado por fetchMediaInsights se a lógica for estendida para aplicar breakdowns automaticamente.
 * Fonte: Seção IV.B e Tabela 5 (ex: profile_activity tem action_type).
 */
export const MEDIA_INSIGHTS_BREAKDOWNS: { [metric: string]: string } = {
  profile_activity: 'action_type', 
  navigation: 'story_navigation_action_type', 
};

/**
 * Specifies breakdowns for specific ACCOUNT insight metrics.
 * Fonte: Seção II.D, II.B, II.G, I.B e Tabela 2 do relatório.
 * Tabela 3.6 do relatório também é relevante.
 */
export const ACCOUNT_INSIGHTS_BREAKDOWNS: { [metric: string]: string[] } = { // Permitindo múltiplos breakdowns
  profile_links_taps: ['contact_button_type'], 
  reach: ['media_product_type', 'follow_type'], 
  total_interactions: ['media_product_type'], 
  // === INÍCIO DA MODIFICAÇÃO ===
  // Alterado para testar sem breakdown para 'views'.
  // Anteriormente: ['follower_type']
  views: [], 
  // === FIM DA MODIFICAÇÃO ===
  // 'accounts_engaged' não possui breakdowns listados na documentação para /insights de usuário.
};

/**
 * Specifies breakdowns for DEMOGRAPHIC metrics.
 * Fonte: Seção III.A e Tabela 3.
 */
export const DEMOGRAPHICS_BREAKDOWNS_LIST = ['age', 'gender', 'country', 'city'];

// --- Requisitos de metric_type=total_value ---

/**
 * Account insight metrics that may require `metric_type=total_value`.
 * Fonte: Seção II.I e Tabela 2.
 */
export const ACCOUNT_INSIGHTS_REQUIRING_TOTAL_VALUE: string[] = [
  'accounts_engaged',
  'profile_links_taps',
  'total_interactions',
  'views',
  'reach', // Reach também pode usar, especialmente se não for série temporal.
];

/**
 * Demographic metrics that require `metric_type=total_value`.
 * Fonte: Seção III e Tabela 3.
 */
export const DEMOGRAPHICS_REQUIRING_TOTAL_VALUE: string[] = [
  'follower_demographics',
  'engaged_audience_demographics'
];


// --- Constantes de Controle de Fluxo e Limites (mantidas do seu arquivo original) ---
export const RETRY_OPTIONS = { retries: 3, factor: 2, minTimeout: 500, maxTimeout: 5000, randomize: true };
export const INSIGHTS_CONCURRENCY_LIMIT = 5; 
export const MAX_PAGES_MEDIA = 10; 
export const DELAY_MS = 250; 
export const MAX_ACCOUNT_FETCH_PAGES = 30; 
export const ACCOUNT_FETCH_DELAY_MS = 100; 
export const INSIGHT_FETCH_CUTOFF_DAYS = 180;
