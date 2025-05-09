// src/config/instagram.config.ts - v1.9.10 (Reel Safe General Metrics Added)
// - Adicionada constante REEL_SAFE_GENERAL_METRICS para métricas gerais compatíveis com Reels.
// - Adicionada constante REEL_SPECIFIC_INSIGHTS_METRICS para métricas exclusivas de Reels (mantido de v1.9.9).
// - MEDIA_INSIGHTS_METRICS mantém métricas gerais para compatibilidade com outros formatos (mantido).

// ATUALIZADO para v22.0 (ou a versão desejada/configurada no painel da Meta)
export const API_VERSION = 'v22.0';
export const BASE_URL = `https://graph.facebook.com`; // BASE_URL não inclui mais a versão

// --- Métricas e Campos por Tipo de Chamada ---
// !! RECOMENDAÇÃO: Verificar se todos os campos/métricas abaixo são válidos na API_VERSION definida !!

// Campos básicos para buscar dados da conta de usuário do Instagram (IG User node)
export const BASIC_ACCOUNT_FIELDS = 'id,username,name,profile_picture_url,followers_count,media_count';

// Métricas GERAIS para buscar insights de mídias (Posts, Reels, Carrosséis)
// Estas são as métricas que funcionam para todos os tipos de mídia (exceto Reels, que têm restrições).
export const MEDIA_INSIGHTS_METRICS = 'views,reach,total_interactions,saved,likes,comments,shares,profile_visits,follows,profile_activity';

// >>> NOVA CONSTANTE: MÉTRICAS GERAIS SEGURAS PARA REELS (v1.9.10) <<<
// Métricas de MEDIA_INSIGHTS_METRICS que SÃO suportadas para Reels.
// Exclui 'profile_visits', 'follows', 'profile_activity' conforme erro da API.
export const REEL_SAFE_GENERAL_METRICS = 'views,reach,total_interactions,saved,likes,comments,shares';
// NOTA: Confirme na documentação da API se 'views' é a métrica correta para visualizações de Reels ou se 'plays'/'reels_plays' seria mais apropriado.
// Se 'views' funcionar, esta lista está correta. Caso contrário, ajuste.

// Métricas ESPECÍFICAS DE REELS (mantido de v1.9.9)
// Métricas que só devem ser solicitadas para mídias do tipo Reel.
export const REEL_SPECIFIC_INSIGHTS_METRICS = 'ig_reels_avg_watch_time,ig_reels_video_view_total_time';
// NOTA: É crucial validar se 'ig_reels_avg_watch_time' e 'ig_reels_video_view_total_time' são
// os nomes exatos que a API Graph v22.0 espera para estas métricas de Reels.

// Métricas de Story (principalmente para referência do Webhook e mapeamento)
export const STORY_INSIGHTS_METRICS = 'views,reach,navigation,replies,shares,profile_visits,follows,profile_activity,total_interactions';

// Métricas para buscar insights de nível de conta (agregados)
export const ACCOUNT_INSIGHTS_METRICS = 'views,reach,accounts_engaged,total_interactions,profile_links_taps,follows_and_unfollows';

// Métricas para buscar dados demográficos
export const DEMOGRAPHICS_METRICS = 'follower_demographics,engaged_audience_demographics';


// --- Breakdowns por Tipo de Chamada ---
export const MEDIA_BREAKDOWNS: { [metric: string]: string } = {
  profile_activity: 'action_type',
};
export const STORY_BREAKDOWNS: { [metric: string]: string } = {
  navigation: 'story_navigation_action_type',
  profile_activity: 'action_type',
};
export const ACCOUNT_BREAKDOWNS: { [metric: string]: string } = {
  profile_links_taps: 'contact_button_type',
  follows_and_unfollows: 'follow_type',
};
export const DEMOGRAPHICS_BREAKDOWNS = 'city,country,age,gender';


// --- Timeframes e Períodos ---
export const DEMOGRAPHICS_TIMEFRAME = 'last_30_days';
export const DEFAULT_ACCOUNT_INSIGHTS_PERIOD = 'days_28';


// --- Permissões OAuth Necessárias (Referência) ---
export const REQUIRED_OAUTH_PERMISSIONS = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_read_engagement',
  'pages_show_list',
  'business_management',
  'instagram_manage_comments',
];
