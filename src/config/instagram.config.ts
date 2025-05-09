// src/config/instagram.config.ts - v1.9.9 (Reel Specific Metrics Added)
// - Adicionada constante REEL_SPECIFIC_INSIGHTS_METRICS para métricas exclusivas de Reels.
// - MEDIA_INSIGHTS_METRICS mantém métricas gerais para compatibilidade.
// - Removido ig_reels_avg_watch_time e ig_reels_video_view_total_time de MEDIA_INSIGHTS_METRICS
//   para evitar erro (#100) ao buscar insights de mídias não-Reels (mantido da v1.9.8).

// ATUALIZADO para v22.0 (ou a versão desejada/configurada no painel da Meta)
export const API_VERSION = 'v22.0';
export const BASE_URL = `https://graph.facebook.com`; // BASE_URL não inclui mais a versão

// --- Métricas e Campos por Tipo de Chamada ---
// !! RECOMENDAÇÃO: Verificar se todos os campos/métricas abaixo são válidos na API_VERSION definida !!

// Campos básicos para buscar dados da conta de usuário do Instagram (IG User node)
// OTIMIZADO: Começar com um conjunto mínimo para evitar erros de permissão (#10) durante a revisão.
export const BASIC_ACCOUNT_FIELDS = 'id,username,name,profile_picture_url,followers_count,media_count';

// Métricas GERAIS para buscar insights de mídias (Posts, Reels, Carrosséis)
// Estas são as métricas que funcionam para todos os tipos de mídia sem causar erro.
export const MEDIA_INSIGHTS_METRICS = 'views,reach,total_interactions,saved,likes,comments,shares,profile_visits,follows,profile_activity';

// >>> NOVA CONSTANTE PARA MÉTRICAS ESPECÍFICAS DE REELS (v1.9.9) <<<
// Métricas que só devem ser solicitadas para mídias do tipo Reel (identificadas como media_type: 'VIDEO' no instagramService).
// Os nomes devem corresponder aos campos em IMetricStats e à API do Instagram v22.0.
export const REEL_SPECIFIC_INSIGHTS_METRICS = 'ig_reels_avg_watch_time,ig_reels_video_view_total_time';
// NOTA: É crucial validar se 'ig_reels_avg_watch_time' e 'ig_reels_video_view_total_time' são
// os nomes exatos que a API Graph v22.0 espera para estas métricas de Reels.
// Consulte a documentação da API para /insights do nó de mídia do Instagram.
// Outras métricas de Reels como 'plays' ou 'reels_plays' podem já estar cobertas por 'views'
// em MEDIA_INSIGHTS_METRICS, mas confirme.

// Métricas de Story (principalmente para referência do Webhook e mapeamento)
// Validar se estas ainda são as métricas corretas/disponíveis para webhooks de story na v22.0.
export const STORY_INSIGHTS_METRICS = 'views,reach,navigation,replies,shares,profile_visits,follows,profile_activity,total_interactions';

// Métricas para buscar insights de nível de conta (agregados)
// OTIMIZADO: Reduzido para métricas de nível de conta mais comuns e menos propensas a erros de permissão.
export const ACCOUNT_INSIGHTS_METRICS = 'views,reach,accounts_engaged,total_interactions,profile_links_taps,follows_and_unfollows';

// Métricas para buscar dados demográficos
// Validar se 'follower_demographics' e 'engaged_audience_demographics' são os nomes corretos e se as permissões são suficientes.
export const DEMOGRAPHICS_METRICS = 'follower_demographics,engaged_audience_demographics';


// --- Breakdowns por Tipo de Chamada ---
// !! RECOMENDAÇÃO: Verificar se todos os breakdowns são válidos para as métricas na API_VERSION definida !!

// Breakdowns aplicáveis a insights de Mídia
export const MEDIA_BREAKDOWNS: { [metric: string]: string } = {
  profile_activity: 'action_type',
};

// Breakdowns aplicáveis a insights de Story (para referência do Webhook)
export const STORY_BREAKDOWNS: { [metric: string]: string } = {
  navigation: 'story_navigation_action_type', // Ex: taps_forward, taps_back, exits, replies (se replies for um tipo de navegação)
  profile_activity: 'action_type',
};

// Breakdowns aplicáveis a insights de Conta
export const ACCOUNT_BREAKDOWNS: { [metric: string]: string } = {
  profile_links_taps: 'contact_button_type', // Ex: email_contacts, phone_call_clicks, get_directions_clicks, website_clicks
  follows_and_unfollows: 'follow_type', // Ex: follower_gains, unfollows
};

// Breakdowns aplicáveis a dados Demográficos (passados como string única)
// Validar se 'age' e 'gender' são os breakdowns corretos e se não exigem permissões adicionais.
export const DEMOGRAPHICS_BREAKDOWNS = 'city,country,age,gender';


// --- Timeframes e Períodos ---
// !! RECOMENDAÇÃO: Verificar se estes valores são suportados/ideais na API_VERSION definida !!

// Timeframe padrão para dados demográficos
export const DEMOGRAPHICS_TIMEFRAME = 'last_30_days';

// Período padrão para insights de conta
export const DEFAULT_ACCOUNT_INSIGHTS_PERIOD = 'days_28';


// --- Permissões OAuth Necessárias (Referência) ---
// Esta lista é apenas para referência, as permissões reais são solicitadas no next-auth
// e devem ser justificadas na submissão para Revisão de Aplicativos.
export const REQUIRED_OAUTH_PERMISSIONS = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_read_engagement',
  'pages_show_list',
  'business_management', // Adicionado, pois é necessário para System User / Business API
  'instagram_manage_comments', // Mantido da sua config, justificar se necessário para a IA Tuca
  // Adicionar 'whatsapp_business_management' e 'whatsapp_business_messaging' se o System User também gerenciar WhatsApp
];
