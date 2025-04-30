// src/config/instagram.config.ts
// Centraliza constantes para a integração com a API Graph do Instagram

export const API_VERSION = 'v19.0';
export const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// --- Métricas e Campos por Tipo de Chamada ---

// Campos básicos para buscar dados da conta de usuário do Instagram (IG User node)
export const BASIC_ACCOUNT_FIELDS = 'id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,is_published,shopping_product_tag_eligibility';

// Métricas para buscar insights de mídias (Posts, Reels, Carrosséis)
export const MEDIA_INSIGHTS_METRICS = 'views,reach,total_interactions,saved,likes,comments,shares,ig_reels_avg_watch_time,ig_reels_video_view_total_time,profile_visits,follows,profile_activity';

// Métricas de Story (principalmente para referência do Webhook e mapeamento)
// Nota: A coleta via polling será removida, mas a lista é útil para processar webhooks.
export const STORY_INSIGHTS_METRICS = 'views,reach,navigation,replies,shares,profile_visits,follows,profile_activity,total_interactions';

// Métricas para buscar insights de nível de conta (agregados)
export const ACCOUNT_INSIGHTS_METRICS = 'views,reach,accounts_engaged,total_interactions,profile_links_taps,follows_and_unfollows,comments,likes,saved,shares,replies';

// Métricas para buscar dados demográficos
export const DEMOGRAPHICS_METRICS = 'follower_demographics,engaged_audience_demographics';


// --- Breakdowns por Tipo de Chamada ---

// Breakdowns aplicáveis a insights de Mídia
export const MEDIA_BREAKDOWNS: { [metric: string]: string } = {
  profile_activity: 'action_type', // Necessário ao solicitar 'profile_activity'
};

// Breakdowns aplicáveis a insights de Story (para referência do Webhook)
export const STORY_BREAKDOWNS: { [metric: string]: string } = {
  navigation: 'story_navigation_action_type', // Necessário ao solicitar 'navigation'
  profile_activity: 'action_type',           // Necessário ao solicitar 'profile_activity'
};

// Breakdowns aplicáveis a insights de Conta
export const ACCOUNT_BREAKDOWNS: { [metric: string]: string } = {
  profile_links_taps: 'contact_button_type',  // Necessário ao solicitar 'profile_links_taps'
  follows_and_unfollows: 'follow_type',        // Necessário ao solicitar 'follows_and_unfollows'
};

// Breakdowns aplicáveis a dados Demográficos (passados como string única)
export const DEMOGRAPHICS_BREAKDOWNS = 'city,country,age,gender';


// --- Timeframes e Períodos ---

// Timeframe padrão para dados demográficos (pode ser configurável)
export const DEMOGRAPHICS_TIMEFRAME = 'last_30_days';

// Período padrão para insights de conta (se não especificado)
// Nota: A API pode ter diferentes períodos disponíveis para diferentes métricas.
// 'days_28' é comum para muitas métricas de nível de conta.
export const DEFAULT_ACCOUNT_INSIGHTS_PERIOD = 'days_28';


// --- Permissões OAuth Necessárias (Referência) ---
// Verificado no arquivo next-auth, todas presentes.
export const REQUIRED_OAUTH_PERMISSIONS = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_read_engagement',
  'pages_show_list',
  // 'catalog_management' // Se necessário para shopping tags
  // 'instagram_manage_comments' // Presente na sua config atual, pode manter
];