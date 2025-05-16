// src/app/lib/instagram/types.ts
import { IUser } from "@/app/models/User"; 
import { IMetricStats } from "@/app/models/Metric"; 

// --- Tipos de Erro da API do Facebook/Instagram ---

/**
 * Estrutura detalhada de um erro retornado pela API do Facebook/Instagram.
 * Esta é a que você já tinha, mantida para consistência interna se usada.
 */
export interface FacebookApiErrorStructure {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  error_user_title?: string; 
  error_user_msg?: string;   
  fbtrace_id: string;
  is_transient?: boolean;    
}

/**
 * ADICIONADO: Estrutura comum para erros retornados pela API Graph do Facebook/Instagram.
 * Esta interface é a que o fetchers.ts estava tentando importar.
 * Pode ser uma duplicata ou uma versão mais específica de FacebookApiErrorStructure.
 * Por ora, definimos explicitamente para resolver o erro de importação.
 */
export interface InstagramApiErrorDetail {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id: string;
  is_transient?: boolean;
  // Outros campos que podem vir no erro
  [key: string]: any; 
}

/**
 * Contêiner para um possível erro da API do Facebook/Instagram no nível raiz da resposta.
 */
export interface FacebookApiError { // Este é o seu tipo existente
  error?: FacebookApiErrorStructure;
}

// --- Tipos para Respostas da API Graph do Instagram ---

/**
 * Estrutura genérica para uma resposta paginada da API Graph.
 * ATUALIZADO: Usa InstagramApiErrorDetail para o campo error.
 */
export interface InstagramApiResponse<T = InstagramApiInsightItem | InstagramMedia> {
  data?: T[]; // T pode ser um array ou um único objeto dependendo do endpoint
  paging?: {
    cursors?: {
      before: string;
      after: string;
    };
    next?: string;
    previous?: string;
  };
  error?: InstagramApiErrorDetail; // Usa a interface detalhada para erros
}

/**
 * ADICIONADO: Estrutura para um nó individual retornado pela API Graph (não paginado).
 * Pode ser o próprio objeto de dados ou um objeto de erro.
 */
export type InstagramApiNodeResponse<T> = T & {
  error?: InstagramApiErrorDetail; // Usa a interface detalhada para erros
};


// --- Tipos de Conexão e Conta ---

export interface InstagramConnectionDetails {
  accessToken: string | null;
  accountId: string | null;
}

export interface AvailableInstagramAccount {
  igAccountId: string;
  pageId: string;
  pageName: string;
  username?: string;
  profile_picture_url?: string;
}

export interface FetchInstagramAccountsResult {
  success: true;
  accounts: AvailableInstagramAccount[];
  longLivedAccessToken: string | null; 
}

export interface FetchInstagramAccountsError {
  success: false;
  error: string;
  errorCode?: number; 
}


// --- Tipos de Mídia do Instagram ---

export interface InstagramMediaChild { 
  id: string;
  media_type?: 'IMAGE' | 'VIDEO';
  media_product_type?: string; // Adicionado para consistência
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
}

/**
 * Representa um item de mídia do Instagram (Post, Reel, Story, etc.).
 * ATUALIZADO: Adicionados media_product_type, parent_id e media_product_type em children.
 */
export interface InstagramMedia {
  id: string; 
  media_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'STORY';
  media_product_type?: 'FEED' | 'STORY' | 'REELS' | 'AD' | 'IGTV'; // IGTV é depreciado
  timestamp?: string; 
  caption?: string; 
  permalink?: string; 
  media_url?: string; 
  thumbnail_url?: string; 
  username?: string; 
  is_published?: boolean; 
  children?: { // Presente se media_type for CAROUSEL_ALBUM
    data: InstagramMediaChild[]; // Usando o tipo definido acima
  };
  parent_id?: string; // ID da mídia pai se esta for uma mídia filha
  owner?: { id: string }; 
  like_count?: number; 
  comments_count?: number; 
}

export interface FetchMediaResult {
  success: boolean;
  data?: InstagramMedia[];
  error?: string;
  nextPageUrl?: string | null; 
}


// --- Tipos de Insights da API do Instagram ---

export interface InstagramApiInsightValue {
  value: number | string | { [key: string]: number | { [key: string]: number } }; 
  end_time?: string; // end_time é opcional em algumas respostas de insight
}

export interface InstagramApiInsightItem {
  name: string; 
  period: string; 
  values: InstagramApiInsightValue[];
  title?: string; // title e description são opcionais
  description?: string; 
  id?: string; 
}

// Removido InstagramApiDemographicItem pois InstagramApiInsightItem é genérico o suficiente.
// A distinção pode ser feita pelo valor de 'name' na métrica.

// --- Tipos de Resultado para Funções de Fetch ---

/**
 * Resultado genérico para funções que buscam insights.
 * @template T O tipo dos dados de insight esperados.
 * ATUALIZADO: error e errorMessage para string | null e adicionado requestedMetrics.
 */
export interface FetchInsightsResult<T = Record<string, any>> {
  success: boolean;
  data?: T;
  error?: string | null; 
  errorMessage?: string | null; 
  requestedMetrics?: string; // Para depuração
}

/**
 * Resultado da busca de dados básicos de uma conta Instagram.
 */
export interface FetchBasicAccountDataResult {
  success: boolean;
  data?: Partial<IUser>; 
  error?: string;
}


// --- Tipos para Processamento Interno de Tarefas de Insight (ex: em triggerDataRefresh) ---

export interface InsightTaskSkippedResult {
  mediaId: string;
  status: 'skipped';
  reason: string;
  media: InstagramMedia; 
  insightsResult: { success: false; error: string; data?: undefined; errorMessage?: undefined, requestedMetrics?: string }; // Adicionado requestedMetrics
  insightTokenSource?: undefined;
}

export interface InsightTaskProcessedResult {
  mediaId: string;
  status: 'processed';
  reason?: undefined;
  media: InstagramMedia; 
  insightsResult: FetchInsightsResult<IMetricStats>; // Usa IMetricStats
  insightTokenSource: string; 
}

export type InsightTaskInternalResult = InsightTaskSkippedResult | InsightTaskProcessedResult;


// --- Tipos para Webhooks (Exemplo para Stories, pode ser expandido) ---
export interface StoryWebhookValue {
    media_id: string; 
    impressions?: number; // Manter para webhooks se a API ainda enviar, mas 'views' é o novo padrão
    views?: number;       // Adicionar 'views'
    reach?: number;
    taps_forward?: number;
    taps_back?: number;
    exits?: number;
    replies?: number;
    // Adicione outras métricas de story que o webhook possa enviar
}

export interface InstagramWebhookChange {
    field: 'story_insights'; 
    value: StoryWebhookValue;
}

export interface InstagramWebhookEntry {
    id: string; 
    time: number; 
    changes: InstagramWebhookChange[];
}

export interface InstagramWebhookPayload {
    object: 'instagram';
    entry: InstagramWebhookEntry[];
}
