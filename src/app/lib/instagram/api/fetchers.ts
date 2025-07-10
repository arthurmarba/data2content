// src/app/lib/instagram/api/fetchers.ts
import { logger } from '@/app/lib/logger';
import { IUser } from '@/app/models/User';
import { IMetricStats } from '@/app/models/Metric';
import { IAccountInsightsPeriod } from '@/app/models/AccountInsight';
import { IAudienceDemographics } from '@/app/models/demographics/AudienceDemographicSnapshot';
import {
  API_VERSION,
  BASE_URL,
  BASIC_ACCOUNT_FIELDS,
  ACCOUNT_INSIGHTS_METRICS_LIST,
  DEMOGRAPHICS_BREAKDOWNS_LIST,
  ACCOUNT_INSIGHTS_BREAKDOWNS,
  ACCOUNT_INSIGHTS_REQUIRING_TOTAL_VALUE,
  DEFAULT_ACCOUNT_INSIGHTS_PERIOD,
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
import axios, { AxiosError } from 'axios';

// --- As funções fetchInstagramMedia, fetchMediaInsights, e fetchBasicAccountData permanecem as mesmas ---

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

/**
 * Transforma a resposta bruta e aninhada da API demográfica em um objeto de chave-valor simples.
 */
function transformApiResponse(rawData: any[]): Record<string, number> {
  const transformed: Record<string, number> = {};
  try {
    if (!rawData?.[0]?.total_value?.breakdowns?.[0]?.results) {
      return transformed;
    }
    const results = rawData[0].total_value.breakdowns[0].results;
    for (const item of results) {
      if (item.dimension_values?.[0] && typeof item.value === 'number') {
        transformed[item.dimension_values[0]] = item.value;
      }
    }
  } catch (e) {
    logger.error('[transformApiResponse] Falha ao analisar dados demográficos brutos', e);
  }
  return transformed;
}

/**
 * Busca dados demográficos de seguidores da API do Instagram.
 * CORRIGIDO: Realiza chamadas separadas para cada 'breakdown' e usa o client 'axios' diretamente.
 * OTIMIZADO: Transforma a resposta da API em um formato limpo e fácil de usar.
 */
export async function fetchAudienceDemographics(
  accountId: string,
  accessToken: string
): Promise<FetchInsightsResult<IAudienceDemographics>> {
  const logContext = 'fetchAudienceDemographics v3.3 (direct axios)';
  logger.info(`[${logContext}] INICIANDO COLETA DEMOGRÁFICA COM AXIOS DIRETO`);
  
  if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
  if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

  const aggregatedDemographics: Partial<IAudienceDemographics> = {
    follower_demographics: {},
  };
  const errors: string[] = [];
  let anyDataCollected = false;

  const baseUrl = `${BASE_URL}/${API_VERSION}/${accountId}/insights`;

  for (const breakdown of DEMOGRAPHICS_BREAKDOWNS_LIST) {
    const params = {
      metric: 'follower_demographics',
      period: 'lifetime',
      metric_type: 'total_value',
      breakdown,
      access_token: accessToken,
    };
    
    try {
      // ** CORREÇÃO FINAL: Usando axios.get diretamente para replicar o teste original **
      const response = await axios.get<{ data?: any[], error?: InstagramApiErrorDetail }>(baseUrl, { params });

      if (response.data.error) {
        const errorDetail = response.data.error;
        const errorMsg = errorDetail.message || `Erro desconhecido ao buscar breakdown '${breakdown}'.`;
        logger.error(`[${logContext}] Erro da API para breakdown '${breakdown}': ${errorMsg} (Code: ${errorDetail.code})`);
        errors.push(`${breakdown}: ${errorMsg}`);
        continue;
      }

      if (response.data.data && response.data.data.length > 0) {
        const transformedData = transformApiResponse(response.data.data);
        if (Object.keys(transformedData).length > 0) {
          if (!aggregatedDemographics.follower_demographics) {
            aggregatedDemographics.follower_demographics = {};
          }
          (aggregatedDemographics.follower_demographics as any)[breakdown] = transformedData;
          anyDataCollected = true;
        } else {
            logger.warn(`[${logContext}] A transformação da resposta para '${breakdown}' resultou em dados vazios.`);
        }
      } else {
          logger.warn(`[${logContext}] A resposta para '${breakdown}' não continha o campo 'data' ou ele estava vazio.`);
      }
    } catch (err: any) {
      const message = err.message || String(err);
      logger.error(`[${logContext}] Erro de rede/axios ao buscar breakdown '${breakdown}': ${message}`);
      errors.push(`${breakdown}: ${message}`);
    }
  }

  if (!anyDataCollected && errors.length > 0) {
    return { success: false, error: `Falha ao coletar todos os dados demográficos. Erros: ${errors.join('; ')}` };
  }

  if (!anyDataCollected) {
    return { success: true, data: aggregatedDemographics as IAudienceDemographics, errorMessage: 'Nenhum dado demográfico disponível para esta conta.' };
  }

  return { success: true, data: aggregatedDemographics as IAudienceDemographics };
}

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
