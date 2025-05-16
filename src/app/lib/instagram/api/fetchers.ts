// src/app/lib/instagram/api/fetchers.ts
import { logger } from '@/app/lib/logger';
import { IUser } from '@/app/models/User';
import { IMetricStats } from '@/app/models/Metric';
// ATUALIZADO: Importa IDemographicBreakdown
import { IAccountInsightsPeriod, IAudienceDemographics, IDemographicBreakdown } from '@/app/models/AccountInsight';
import {
  API_VERSION,
  BASE_URL,
  BASIC_ACCOUNT_FIELDS,
  ACCOUNT_INSIGHTS_METRICS_LIST, 
  DEMOGRAPHICS_METRICS_LIST,     
  DEMOGRAPHICS_BREAKDOWNS_LIST,  
  DEMOGRAPHICS_PERIOD,       
  DEMOGRAPHICS_TIMEFRAME_RECENT, 
  DEFAULT_ACCOUNT_INSIGHTS_PERIOD,
  ACCOUNT_INSIGHTS_REQUIRING_TOTAL_VALUE,
  DEMOGRAPHICS_REQUIRING_TOTAL_VALUE,
  ACCOUNT_INSIGHTS_BREAKDOWNS, 
} from '../config/instagramApiConfig';
import {
  FetchMediaResult,
  InstagramMedia, 
  FetchInsightsResult,
  FetchBasicAccountDataResult,
  InstagramApiInsightItem,
  InstagramApiErrorDetail, 
} from '../types'; 
import { graphApiRequest, graphApiNodeRequest } from './client';

/**
 * Fetches Instagram media for a given account.
 * ATUALIZADO: Solicita 'media_product_type' e 'parent_id' para cada mídia.
 * @param accountId - The Instagram account ID.
 * @param accessToken - The user's access token.
 * @param pageUrl - Optional URL for pagination.
 * @returns Promise<FetchMediaResult>
 */
export async function fetchInstagramMedia(
  accountId: string,
  accessToken: string,
  pageUrl?: string
): Promise<FetchMediaResult> {
  const logContext = pageUrl ? 'fetchInstagramMedia (Paginação)' : 'fetchInstagramMedia';
  logger.info(`[${logContext}] Iniciando busca de mídias para Conta IG ${accountId}...`);

  if (!accountId) return { success: false, error: 'ID da conta Instagram não fornecido.' };
  if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

  let url: string;
  if (pageUrl) {
    url = pageUrl;
    if (!url.includes('access_token=')) {
        url += (url.includes('?') ? '&' : '?') + `access_token=${accessToken}`;
    }
  } else {
    const fields = 'id,media_type,media_product_type,timestamp,caption,permalink,username,media_url,thumbnail_url,children{id,media_type,media_product_type,media_url,thumbnail_url},parent_id';
    const limit = 25; 
    url = `${BASE_URL}/${API_VERSION}/${accountId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`;
  }
  logger.debug(`[${logContext}] URL da requisição de mídia: ${url.replace(accessToken, '[TOKEN_OCULTO]')}`);

  try {
    const response = await graphApiRequest<InstagramMedia>(url, undefined, logContext, accessToken);

    if (response.error) {
      const errorMsg = response.error.message || 'Erro desconhecido ao buscar mídias.';
      logger.error(`[${logContext}] Erro da API ao buscar mídias para Conta ${accountId}: ${errorMsg} (Code: ${response.error.code}, Type: ${response.error.type}, Trace: ${response.error.fbtrace_id})`);
      return { success: false, error: `Falha ao buscar mídias: ${errorMsg}` };
    }
    
    logger.info(`[${logContext}] Mídias buscadas com sucesso para Conta ${accountId}. ${response.data?.length || 0} itens retornados. Próxima página: ${!!response.paging?.next}`);
    return {
      success: true,
      data: response.data || [], 
      nextPageUrl: response.paging?.next || null,
    };
  } catch (error: any) {
    logger.error(`[${logContext}] Erro final ao buscar mídias para Conta ${accountId}:`, error);
    const message = error.message || String(error);
    return { success: false, error: message.startsWith('Token') || message.startsWith('Falha') ? message : `Erro interno ao buscar mídias: ${message}` };
  }
}

/**
 * Fetches insights for a specific media item.
 * @param mediaId - The ID of the media item.
 * @param accessToken - The user's access token.
 * @param metricsToFetch - A comma-separated string of metrics to fetch.
 * @returns Promise<FetchInsightsResult<IMetricStats>>
 */
export async function fetchMediaInsights(
  mediaId: string,
  accessToken: string,
  metricsToFetch: string 
): Promise<FetchInsightsResult<IMetricStats>> {
  const logContext = 'fetchMediaInsights';
  logger.debug(`[${logContext}] Buscando insights para Media ID: ${mediaId} (Métricas: ${metricsToFetch.substring(0,50)}... )`);

  if (!mediaId) return { success: false, error: 'ID da mídia não fornecido.' , requestedMetrics: metricsToFetch};
  if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' , requestedMetrics: metricsToFetch};
  if (!metricsToFetch || metricsToFetch.trim() === '') {
    logger.warn(`[${logContext}] Lista de métricas para buscar não fornecida ou vazia para Media ID: ${mediaId}.`);
    return { success: true, data: {} as IMetricStats, error: null, errorMessage: 'Nenhuma métrica solicitada.' , requestedMetrics: metricsToFetch};
  }

  const url = `${BASE_URL}/${API_VERSION}/${mediaId}/insights?metric=${metricsToFetch}&access_token=${accessToken}`;

  try {
    const response = await graphApiRequest<InstagramApiInsightItem>(url, undefined, logContext, accessToken);

    const resultWithErrorContext: FetchInsightsResult<IMetricStats> = { 
        success: false, 
        error: 'Erro inicial', 
        requestedMetrics: metricsToFetch 
    };

    if (response.error) {
      const errorDetail: InstagramApiErrorDetail = response.error;
      const errorMsg = errorDetail.message || 'Erro desconhecido ao buscar insights de mídia.';
      logger.warn(`[${logContext}] Erro da API ao buscar insights para Mídia ${mediaId} (Métricas: ${metricsToFetch}): ${errorMsg} (Code: ${errorDetail.code}, Type: ${errorDetail.type}, Subcode: ${errorDetail.error_subcode}, Trace: ${errorDetail.fbtrace_id})`);
      
      resultWithErrorContext.error = `Falha API (${errorDetail.code}): ${errorMsg}`;
      
      if (errorDetail.code === 100 && errorMsg.toLowerCase().includes('metric')) {
         resultWithErrorContext.error = `Métrica inválida para mídia ${mediaId} (API ${API_VERSION}): ${errorMsg}.`;
      } else if (errorDetail.code === 10 || (errorDetail.code === 200 && errorMsg.toLowerCase().includes('permission'))) {
         resultWithErrorContext.error = `Permissão insuficiente para insights da mídia (${errorDetail.code}): ${errorMsg}`;
      } else if (errorDetail.code === 80004 && errorMsg.toLowerCase().includes('not enough data')) {
         logger.info(`[${logContext}] Dados insuficientes para insights da mídia ${mediaId} (Code: ${errorDetail.code}): ${errorMsg}. Considerado como sem dados.`);
         return { success: true, data: {} as IMetricStats, error: null, errorMessage: `Dados insuficientes: ${errorMsg}`, requestedMetrics: metricsToFetch };
      }
      return resultWithErrorContext;
    }

    const insights: Partial<IMetricStats> = {};
    if (response.data) { 
      response.data.forEach(item => {
        const metricName = item.name as keyof IMetricStats; 
        if (item.values && item.values.length > 0) {
          const latestValueEntry = item.values[item.values.length - 1];
          if (latestValueEntry && latestValueEntry.value !== undefined) {
            const value = latestValueEntry.value;
            if (typeof value === 'number') {
              insights[metricName] = value;
            } else if (typeof value === 'object' && value !== null) {
              insights[metricName] = value as any; 
            } else {
               logger.warn(`[${logContext}] Valor inesperado para métrica ${metricName} (Mídia ${mediaId}): `, value);
            }
          } else {
             logger.warn(`[${logContext}] Métrica ${metricName} (Mídia ${mediaId}) não continha 'value' em 'values[${item.values.length - 1}]'.`);
          }
        } else {
           logger.warn(`[${logContext}] Métrica ${metricName} (Mídia ${mediaId}) não continha 'values' ou 'values' estava vazio.`);
        }
      });
    }
    return { success: true, data: insights as IMetricStats, requestedMetrics: metricsToFetch };
  } catch (error: any) {
    logger.error(`[${logContext}] Erro final ao buscar insights para Mídia ${mediaId} (Métricas: ${metricsToFetch}):`, error);
    const message = error.message || String(error);
    return { 
        success: false, 
        error: `Erro interno ao buscar insights de mídia: ${message}`, 
        requestedMetrics: metricsToFetch 
    };
  }
}

/**
 * Fetches aggregated account insights for a given Instagram account.
 * @param accountId - The Instagram account ID.
 * @param accessToken - The access token (User LLAT or System User Token).
 * @param period - The period for the insights (e.g., 'day', 'week', 'month_28').
 * @returns Promise<FetchInsightsResult<IAccountInsightsPeriod>>
 */
export async function fetchAccountInsights(
  accountId: string,
  accessToken: string,
  period: string = DEFAULT_ACCOUNT_INSIGHTS_PERIOD
): Promise<FetchInsightsResult<IAccountInsightsPeriod>> {
  const logContext = 'fetchAccountInsights v2.1'; 
  const isSystemToken = accessToken === process.env.FB_SYSTEM_USER_TOKEN;
  const tokenTypeForLog = isSystemToken ? 'System User' : 'User LLAT';
  logger.debug(`[${logContext}] Buscando insights da conta ${accountId} período: ${period}... (Token: ${tokenTypeForLog})`);

  if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
  if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

  const aggregatedInsights: Partial<IAccountInsightsPeriod> = { period: period };
  let overallSuccess = true;
  const errors: string[] = [];

  for (const metric of ACCOUNT_INSIGHTS_METRICS_LIST) {
    let url = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${metric}&period=${period}`;
    
    const breakdownsForMetric = ACCOUNT_INSIGHTS_BREAKDOWNS[metric]; 
    if (breakdownsForMetric && breakdownsForMetric.length > 0) {
      const breakdownQueryParam = breakdownsForMetric.join(',');
      url += `&breakdown=${breakdownQueryParam}`;
      logger.debug(`[${logContext}] Adicionando breakdown(s) '${breakdownQueryParam}' para métrica '${metric}'.`);
    }

    if (ACCOUNT_INSIGHTS_REQUIRING_TOTAL_VALUE.includes(metric)) {
      url += `&metric_type=total_value`;
      logger.debug(`[${logContext}] Adicionado '&metric_type=total_value' para métrica '${metric}'.`);
    }
    url += `&access_token=${accessToken}`;

    try {
      logger.debug(`[${logContext}] Chamando API para métrica '${metric}'. URL: ${url.replace(accessToken, '[TOKEN_OCULTO]')}`);
      const response = await graphApiRequest<InstagramApiInsightItem>(url, undefined, `${logContext} - ${metric}`, accessToken);

      if (response.error) {
        const errorDetail: InstagramApiErrorDetail = response.error;
        const errorMsg = errorDetail.message || `Erro desconhecido ao buscar métrica '${metric}'.`;
        logger.error(`[${logContext}] Erro da API ao buscar métrica '${metric}' para Conta ${accountId}: ${errorMsg} (Code: ${errorDetail.code}, Type: ${errorDetail.type}, Subcode: ${errorDetail.error_subcode})`);
        errors.push(`Métrica ${metric}: ${errorMsg} (Code: ${errorDetail.code})`);
        overallSuccess = false; 
        continue; 
      }

      if (response.data && response.data.length > 0) {
        response.data.forEach(item => {
          const metricNameInResponse = item.name as keyof IAccountInsightsPeriod;
          if (item.values && item.values.length > 0) {
            const valueData = item.values[0]?.value; 
            if (valueData !== undefined) { 
              if (typeof valueData === 'number' || typeof valueData === 'string') { 
                (aggregatedInsights as any)[metricNameInResponse] = valueData;
              } else if (typeof valueData === 'object' && valueData !== null) {
                (aggregatedInsights as any)[metricNameInResponse] = valueData;
              }
            } else {
              logger.warn(`[${logContext}] Valor para métrica '${metricNameInResponse}' (Conta ${accountId}) estava undefined.`);
            }
          } else {
             logger.warn(`[${logContext}] Métrica '${metricNameInResponse}' (Conta ${accountId}) não continha 'values' ou 'values' estava vazio.`);
          }
        });
      } else {
        logger.warn(`[${logContext}] Métrica '${metric}' para conta ${accountId} retornou sem dados (array 'data' vazio ou ausente).`);
      }
    } catch (error: any) {
      const message = error.message || String(error);
      logger.error(`[${logContext}] Erro final ao buscar métrica '${metric}' para Conta ${accountId}:`, error);
      errors.push(`Métrica ${metric} (Erro interno): ${message}`);
      overallSuccess = false;
    }
  } 

  const hasCollectedData = Object.keys(aggregatedInsights).filter(k => k !== 'period').length > 0;

  if (!overallSuccess && errors.length > 0) {
    logger.error(`[${logContext}] Finalizado com erros ao buscar insights da conta ${accountId}. Erros: ${errors.join('; ')}`);
    return { 
        success: hasCollectedData, 
        data: hasCollectedData ? (aggregatedInsights as IAccountInsightsPeriod) : undefined,
        error: `Falhas ao buscar algumas métricas de conta: ${errors.join('; ')}` 
    };
  }
  
  if (!hasCollectedData && ACCOUNT_INSIGHTS_METRICS_LIST.length > 0) { 
    logger.warn(`[${logContext}] Nenhum insight de conta foi efetivamente coletado para ${accountId}, apesar de não haver erros críticos diretos nas chamadas.`);
    return { success: true, data: aggregatedInsights as IAccountInsightsPeriod, errorMessage: 'Nenhum dado de insight de conta foi retornado pela API (pode ser normal para contas novas/sem atividade).' };
  }

  logger.debug(`[${logContext}] Insights da conta ${accountId} (${period}) processados agregadamente.`);
  return { success: true, data: aggregatedInsights as IAccountInsightsPeriod };
}

type ProcessedDemographicValue = {
    [breakdownKey: string]: Array<{ dimension: string; value: number }>;
};
type RawDemographicValue = {
    [breakdownKey: string]: { [dimensionKey: string]: number };
};

export async function fetchAudienceDemographics(
  accountId: string,
  accessToken: string,
  timeframe: string = DEMOGRAPHICS_TIMEFRAME_RECENT 
): Promise<FetchInsightsResult<IAudienceDemographics>> {
  const logContext = 'fetchAudienceDemographics v2.2'; 
  const isSystemToken = accessToken === process.env.FB_SYSTEM_USER_TOKEN;
  const tokenTypeForLog = isSystemToken ? 'System User' : 'User LLAT';
  logger.debug(`[${logContext}] Buscando dados demográficos da conta ${accountId} (Timeframe: ${timeframe})... (Token: ${tokenTypeForLog})`);

  if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
  if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

  const aggregatedDemographics: Partial<IAudienceDemographics> = {};
  let overallSuccess = true;
  const errors: string[] = [];
  let anyDataCollected = false;

  for (const demographicMetric of DEMOGRAPHICS_METRICS_LIST) { 
    const period = DEMOGRAPHICS_PERIOD; 
    const breakdownQueryParam = DEMOGRAPHICS_BREAKDOWNS_LIST.join(','); 
    
    let url = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${demographicMetric}&period=${period}&breakdown=${breakdownQueryParam}&timeframe=${timeframe}`;

    if (DEMOGRAPHICS_REQUIRING_TOTAL_VALUE.includes(demographicMetric)) {
      url += `&metric_type=total_value`;
      logger.debug(`[${logContext}] Adicionado '&metric_type=total_value' para métrica demográfica '${demographicMetric}'.`);
    }
    url += `&access_token=${accessToken}`;

    try {
      logger.debug(`[${logContext}] Chamando API para métrica demográfica '${demographicMetric}'. URL: ${url.replace(accessToken, '[TOKEN_OCULTO]')}`);
      const response = await graphApiRequest<InstagramApiInsightItem>(url, undefined, `${logContext} - ${demographicMetric}`, accessToken);

      if (response.error) {
        const errorDetail: InstagramApiErrorDetail = response.error;
        const errorMsg = errorDetail.message || `Erro desconhecido ao buscar ${demographicMetric}.`;
        logger.error(`[${logContext}] Erro da API ao buscar ${demographicMetric} para Conta ${accountId}: ${errorMsg} (Code: ${errorDetail.code}, Type: ${errorDetail.type}, Subcode: ${errorDetail.error_subcode})`);
        errors.push(`${demographicMetric}: ${errorMsg} (Code: ${errorDetail.code})`);
        
        if (errorDetail.code === 10 || (errorDetail.code === 200 && errorMsg.toLowerCase().includes('permission')) || (errorDetail.code === 80004 && errorMsg.toLowerCase().includes('not enough data'))) {
          logger.warn(`[${logContext}] Permissão/Dados insuficientes (${errorDetail.code}) para ${demographicMetric} da conta ${accountId}. Detalhe: ${errorMsg}`);
          if (errorDetail.code !== 80004) overallSuccess = false;
        } else {
          overallSuccess = false; 
        }
        continue; 
      }
      
      if (!response.data || response.data.length === 0) {
        logger.warn(`[${logContext}] Demografia para ${demographicMetric} OK, mas 'data' array estava vazio para conta ${accountId}.`);
        continue;
      }
      
      const demographicItem = response.data[0]; 

      if (demographicItem && demographicItem.values && demographicItem.values.length > 0) {
          const firstValEntry = demographicItem.values[0];
          if (firstValEntry && typeof firstValEntry.value === 'object' && firstValEntry.value !== null) {
              const rawBreakdownValues = firstValEntry.value as RawDemographicValue;
              // Correção: IDemographicBreakdown é uma interface para um *único* item do array,
              // não para o objeto inteiro que contém city, country, age, gender.
              // A estrutura de processedMetricData deve ser { city: IDemographicBreakdown[], country: IDemographicBreakdown[], ... }
              // E isso já está alinhado com IAudienceDemographics.
              const processedMetricData: {
                  city?: IDemographicBreakdown[];
                  country?: IDemographicBreakdown[];
                  age?: IDemographicBreakdown[];
                  gender?: IDemographicBreakdown[];
              } = {};

              DEMOGRAPHICS_BREAKDOWNS_LIST.forEach(breakdownKey => { 
                  const keyAsserted = breakdownKey as keyof typeof processedMetricData; // 'city', 'country', 'age', 'gender'
                  if (rawBreakdownValues[breakdownKey]) {
                      processedMetricData[keyAsserted] = Object.entries(rawBreakdownValues[breakdownKey])
                          .map(([dimensionValue, countValue]) => ({ value: dimensionValue, count: countValue }))
                          .sort((a, b) => b.count - a.count); 
                      anyDataCollected = true;
                  } else {
                      processedMetricData[keyAsserted] = []; 
                  }
              });
              
              if (demographicMetric === 'follower_demographics') {
                aggregatedDemographics.follower_demographics = processedMetricData; 
              } else if (demographicMetric === 'engaged_audience_demographics') {
                aggregatedDemographics.engaged_audience_demographics = processedMetricData;
              }
          } else {
               logger.warn(`[${logContext}] Item demográfico '${demographicItem.name}' para conta ${accountId} sem dados válidos (values[0].value não é objeto ou nulo) ou em formato inesperado.`);
          }
      } else {
          logger.warn(`[${logContext}] Nenhum item de dados ou valores encontrados na resposta de ${demographicMetric} para conta ${accountId}.`);
      }

    } catch (error: any) {
      const message = error.message || String(error);
      logger.error(`[${logContext}] Erro final na busca de ${demographicMetric} para Conta ${accountId}:`, error);
      errors.push(`${demographicMetric} (Erro interno): ${message}`);
      overallSuccess = false;
    }
  } 

  if (!anyDataCollected && errors.length === 0 && DEMOGRAPHICS_METRICS_LIST.length > 0) {
    logger.warn(`[${logContext}] Nenhuma demografia foi efetivamente coletada para ${accountId}, mas sem erros diretos de API.`);
    return { success: true, data: aggregatedDemographics as IAudienceDemographics, errorMessage: 'Dados demográficos insuficientes ou indisponíveis para esta conta.' };
  }

  if (!overallSuccess && errors.length > 0) {
    logger.error(`[${logContext}] Finalizado com erros ao buscar demografia da conta ${accountId}. Erros: ${errors.join('; ')}`);
    return { 
        success: anyDataCollected, 
        data: anyDataCollected ? (aggregatedDemographics as IAudienceDemographics) : undefined,
        error: `Falhas ao buscar algumas métricas demográficas: ${errors.join('; ')}`,
        errorMessage: anyDataCollected ? undefined : `Falhas ao buscar algumas métricas demográficas: ${errors.join('; ')}`
    };
  }
  
  logger.debug(`[${logContext}] Demografia processada para conta ${accountId}. ${anyDataCollected ? 'Dados OK.' : 'Dados não disponíveis.'}`);
  return { 
    success: true, 
    data: aggregatedDemographics as IAudienceDemographics, 
    errorMessage: anyDataCollected ? undefined : (errors.length > 0 ? errors.join('; ') : 'Dados demográficos insuficientes ou indisponíveis.')
  };
}

/**
 * Fetches basic account data for a given Instagram account.
 * @param accountId - The Instagram account ID.
 * @param accessToken - The user's access token.
 * @returns Promise<FetchBasicAccountDataResult>
 */
export async function fetchBasicAccountData(
  accountId: string,
  accessToken: string
): Promise<FetchBasicAccountDataResult> {
  const logContext = 'fetchBasicAccountData';
  logger.debug(`[${logContext}] Buscando dados básicos da conta ${accountId}...`);

  if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
  if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

  const fields = BASIC_ACCOUNT_FIELDS; 
  const url = `${BASE_URL}/${API_VERSION}/${accountId}?fields=${fields}&access_token=${accessToken}`;

  try {
    const responseNode = await graphApiNodeRequest<Partial<IUser>>(url, undefined, logContext, accessToken);

    if (responseNode.error) {
      const errorDetail: InstagramApiErrorDetail = responseNode.error;
      const errorMsg = errorDetail.message || 'Erro desconhecido ao buscar dados básicos da conta.';
      logger.error(`[${logContext}] Erro da API ao buscar dados básicos para Conta ${accountId}: ${errorMsg} (Code: ${errorDetail.code}, Type: ${errorDetail.type}, Subcode: ${errorDetail.error_subcode})`);
       if (errorDetail.code === 10 || (errorDetail.code === 200 && errorMsg.toLowerCase().includes('permission'))) {
         return { success: false, error: `Permissão insuficiente para dados básicos (${errorDetail.code}): ${errorMsg}` };
       }
      return { success: false, error: `Falha ao buscar dados básicos da conta: ${errorMsg}` };
    }

    const accountDataFromApi = responseNode; 
    const accountData: Partial<IUser> = {};
    
    if (accountDataFromApi.id) { 
        accountData.instagramAccountId = accountDataFromApi.id;
    }
    if (accountDataFromApi.username) accountData.username = accountDataFromApi.username;
    if (accountDataFromApi.name) accountData.name = accountDataFromApi.name;
    if (accountDataFromApi.biography) accountData.biography = accountDataFromApi.biography;
    if (accountDataFromApi.website) accountData.website = accountDataFromApi.website;
    if (accountDataFromApi.profile_picture_url) accountData.profile_picture_url = accountDataFromApi.profile_picture_url;
    if (typeof accountDataFromApi.followers_count === 'number') accountData.followers_count = accountDataFromApi.followers_count;
    if (typeof accountDataFromApi.follows_count === 'number') accountData.follows_count = accountDataFromApi.follows_count; 
    if (typeof accountDataFromApi.media_count === 'number') accountData.media_count = accountDataFromApi.media_count;
    
    logger.debug(`[${logContext}] Dados básicos da conta ${accountId} processados.`);
    return { success: true, data: accountData };
  } catch (error: any) {
    logger.error(`[${logContext}] Erro final ao buscar dados básicos para Conta ${accountId}:`, error);
    const message = error.message || String(error);
    return { success: false, error: `Erro interno ao buscar dados básicos da conta: ${message}` };
  }
}
