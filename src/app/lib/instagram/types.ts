// src/app/lib/instagram/types.ts
import { IUser } from "@/app/models/User"; // Assumindo que IUser está aqui
import { IMetricStats } from "@/app/models/Metric"; // Assumindo que IMetricStats está aqui

// --- Tipos de Conexão e Conta ---

/**
 * Detalhes da conexão Instagram de um usuário.
 */
export interface InstagramConnectionDetails {
  accessToken: string | null;
  accountId: string | null;
}

/**
 * Representa uma conta Instagram disponível para conexão, associada a uma Página do Facebook.
 */
export interface AvailableInstagramAccount {
  igAccountId: string;
  pageId: string;
  pageName: string;
  // Adicione aqui outros campos que possam vir da API e sejam úteis, como username ou profile_picture_url da conta IG
  username?: string;
  profile_picture_url?: string;
}

/**
 * Resultado de sucesso ao buscar contas Instagram disponíveis.
 */
export interface FetchInstagramAccountsResult {
  success: true;
  accounts: AvailableInstagramAccount[];
  longLivedAccessToken: string | null; // LLAT do usuário do Instagram/Facebook
}

/**
 * Resultado de erro ao buscar contas Instagram disponíveis.
 */
export interface FetchInstagramAccountsError {
  success: false;
  error: string;
  errorCode?: number; // Código de erro da API do Facebook, se aplicável
}


// --- Tipos de Mídia do Instagram ---

/**
 * Representa um item de mídia do Instagram (Post, Reel, Story, etc.).
 */
export interface InstagramMedia {
  id: string; // ID da mídia
  media_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'STORY';
  timestamp?: string; // Data de publicação em formato ISO 8601
  caption?: string; // Legenda da mídia
  permalink?: string; // URL permanente da mídia
  media_url?: string; // URL do conteúdo da mídia (pode expirar)
  thumbnail_url?: string; // URL da miniatura (para vídeos)
  username?: string; // Nome de usuário do proprietário da mídia
  is_published?: boolean; // Se a mídia está publicada
  // Campos para álbuns/carrosséis
  children?: {
    id: string;
    media_type?: 'IMAGE' | 'VIDEO';
    media_url?: string;
    permalink?: string;
    thumbnail_url?: string;
  }[];
  // Outros campos que podem ser úteis
  owner?: { id: string }; // ID do proprietário da mídia (geralmente a conta IG)
  like_count?: number; // Contagem de curtidas (disponível em alguns contextos)
  comments_count?: number; // Contagem de comentários (disponível em alguns contextos)
  // Adicione quaisquer outros campos relevantes que você busca da API
}

/**
 * Resultado da busca de mídias do Instagram.
 */
export interface FetchMediaResult {
  success: boolean;
  data?: InstagramMedia[];
  error?: string;
  nextPageUrl?: string | null; // URL para a próxima página de resultados, se houver
}


// --- Tipos de Insights da API do Instagram ---

/**
 * Valor individual de um insight da API do Instagram.
 * Pode ser um número ou um objeto (para breakdowns).
 */
export interface InstagramApiInsightValue {
  value: number | { [key: string]: number } | { [key: string]: { [key: string]: number } }; // Estendido para demografia
  end_time: string; // Data final do período do insight
}

/**
 * Item de insight retornado pela API do Instagram (para métricas de mídia ou conta).
 */
export interface InstagramApiInsightItem {
  name: string; // Nome da métrica (ex: "reach", "impressions")
  period: string; // Período do insight (ex: "day", "lifetime")
  values: InstagramApiInsightValue[];
  title: string; // Título descritivo da métrica
  description: string; // Descrição da métrica
  id: string; // ID do insight (geralmente no formato <media_id>/insights/<metric_name>/<period>)
}

/**
 * Item de insight demográfico retornado pela API do Instagram.
 * O campo 'name' é mais específico aqui.
 */
export interface InstagramApiDemographicItem {
  name: 'follower_demographics' | 'engaged_audience_demographics' | 'audience_city' | 'audience_country' | 'audience_gender_age'; // Nomes de métricas demográficas
  period: string; // Geralmente "lifetime" para demografia de seguidores
  values: InstagramApiInsightValue[]; // O 'value' interno terá a estrutura de breakdown (ex: cidade: {count})
  title: string;
  description: string;
  id: string;
}

/**
 * Estrutura genérica para respostas da API do Instagram que contêm dados e paginação.
 */
export interface InstagramApiResponse<T = InstagramApiInsightItem | InstagramMedia> {
  data: T[];
  paging?: {
    next?: string;
    previous?: string;
    cursors?: { // Adicionado para consistência com algumas respostas da API
        before?: string;
        after?: string;
    }
  };
  error?: FacebookApiErrorStructure; // Incluído para erros no nível da resposta principal
}


// --- Tipos de Erro da API do Facebook/Instagram ---

/**
 * Estrutura detalhada de um erro retornado pela API do Facebook/Instagram.
 */
export interface FacebookApiErrorStructure {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  error_user_title?: string; // Adicionado, às vezes presente
  error_user_msg?: string;   // Adicionado, às vezes presente
  fbtrace_id: string;
  is_transient?: boolean;    // Adicionado, indica se o erro é temporário
}

/**
 * Contêiner para um possível erro da API do Facebook/Instagram.
 * Muitas respostas da API podem incluir um campo 'error' no nível raiz.
 */
export interface FacebookApiError {
  error?: FacebookApiErrorStructure;
}


// --- Tipos de Resultado para Funções de Fetch ---

/**
 * Resultado genérico para funções que buscam insights.
 * @template T O tipo dos dados de insight esperados.
 */
export interface FetchInsightsResult<T = Record<string, any>> {
  success: boolean;
  data?: T;
  error?: string; // Mensagem de erro técnica ou da API
  errorMessage?: string; // Mensagem de erro mais amigável ou específica (ex: dados insuficientes)
}

/**
 * Resultado da busca de dados básicos de uma conta Instagram.
 * Os dados são um subconjunto da interface `IUser`.
 */
export interface FetchBasicAccountDataResult {
  success: boolean;
  data?: Partial<IUser>; // Dados básicos do perfil da conta
  error?: string;
}


// --- Tipos para Processamento Interno de Tarefas de Insight (ex: em triggerDataRefresh) ---

/**
 * Resultado para uma tarefa de busca de insight de mídia que foi pulada.
 */
export interface InsightTaskSkippedResult {
  mediaId: string;
  status: 'skipped';
  reason: string;
  media: InstagramMedia; // A mídia original
  insightsResult: { success: false; error: string; data?: undefined; errorMessage?: undefined };
  insightTokenSource?: undefined;
}

/**
 * Resultado para uma tarefa de busca de insight de mídia que foi processada.
 */
export interface InsightTaskProcessedResult {
  mediaId: string;
  status: 'processed';
  reason?: undefined;
  media: InstagramMedia; // A mídia original
  insightsResult: FetchInsightsResult<IMetricStats>; // Resultado da busca de insights
  insightTokenSource: string; // Qual token foi usado (User LLAT, System Token, etc.)
}

/**
 * Tipo unificado para o resultado interno de uma tarefa de busca de insight de mídia.
 */
export type InsightTaskInternalResult = InsightTaskSkippedResult | InsightTaskProcessedResult;


// --- Tipos para Webhooks (Exemplo para Stories, pode ser expandido) ---
/**
 * Payload esperado para um webhook de insights de Story.
 * Ajuste conforme a estrutura real do payload que você recebe.
 */
export interface StoryWebhookValue {
    media_id: string; // ID da mídia do Story
    impressions?: number;
    reach?: number;
    taps_forward?: number;
    taps_back?: number;
    exits?: number;
    replies?: number;
    // Adicione outras métricas de story que o webhook possa enviar
}

export interface InstagramWebhookChange {
    field: 'story_insights'; // Ou outros campos de webhook que você usa
    value: StoryWebhookValue;
}

export interface InstagramWebhookEntry {
    id: string; // ID da conta Instagram (ou página) que disparou o webhook
    time: number; // Timestamp do evento
    changes: InstagramWebhookChange[];
}

export interface InstagramWebhookPayload {
    object: 'instagram';
    entry: InstagramWebhookEntry[];
}

