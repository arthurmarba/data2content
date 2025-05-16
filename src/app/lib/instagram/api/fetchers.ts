// src/app/lib/instagram/api/fetchers.ts
import { logger } from '@/app/lib/logger';
import { IUser } from '@/app/models/User';
import { IMetricStats } from '@/app/models/Metric';
import { IAccountInsightsPeriod, IAudienceDemographics, IDemographicBreakdown } from '@/app/models/AccountInsight'; // IDemographicBreakdown is imported here
import {
  API_VERSION,
  BASE_URL,
  BASIC_ACCOUNT_FIELDS,
  MEDIA_INSIGHTS_METRICS,
  REEL_SAFE_GENERAL_METRICS, 
  REEL_SPECIFIC_INSIGHTS_METRICS, 
  ACCOUNT_INSIGHTS_METRICS, 
  DEMOGRAPHICS_METRICS,      
  DEMOGRAPHICS_BREAKDOWNS, 
  DEMOGRAPHICS_PERIOD,       
  DEMOGRAPHICS_TIMEFRAME_RECENT, 
  DEFAULT_ACCOUNT_INSIGHTS_PERIOD,
  ACCOUNT_INSIGHTS_REQUIRING_TOTAL_VALUE,
  DEMOGRAPHICS_REQUIRING_TOTAL_VALUE,
  ACCOUNT_BREAKDOWNS, 
} from '../config/instagramApiConfig';
import {
  FetchMediaResult,
  InstagramMedia,
  FetchInsightsResult,
  FetchBasicAccountDataResult,
  InstagramApiInsightItem,
} from '../types';
import { graphApiRequest, graphApiNodeRequest } from './client';

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
    const fields = 'id,media_type,timestamp,caption,permalink,username,media_url,thumbnail_url,children{id,media_type,media_url,permalink,thumbnail_url}';
    const limit = 25; 
    url = `${BASE_URL}/${API_VERSION}/${accountId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`;
  }

  try {
    const response = await graphApiRequest<InstagramMedia>(url, undefined, logContext, accessToken);

    if (response.error) {
      const errorMsg = response.error.message || 'Erro desconhecido ao buscar mídias.';
      logger.error(`[${logContext}] Erro da API ao buscar mídias para Conta ${accountId}: ${errorMsg} (Code: ${response.error.code})`);
      return { success: false, error: `Falha ao buscar mídias: ${errorMsg}` };
    }
    
    logger.info(`[${logContext}] Mídias buscadas com sucesso para Conta ${accountId}. ${response.data?.length || 0} itens retornados.`);
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
  logger.debug(`[${logContext}] Buscando insights para Media ID: ${mediaId} com métricas: ${metricsToFetch}...`);

  if (!mediaId) return { success: false, error: 'ID da mídia não fornecido.' };
  if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };
  if (!metricsToFetch || metricsToFetch.trim() === '') {
    return { success: false, error: 'Lista de métricas para buscar não fornecida ou vazia.' };
  }

  const url = `${BASE_URL}/${API_VERSION}/${mediaId}/insights?metric=${metricsToFetch}&access_token=${accessToken}`;

  try {
    const response = await graphApiRequest<InstagramApiInsightItem>(url, undefined, logContext, accessToken);

    if (response.error) {
      const errorMsg = response.error.message || 'Erro desconhecido ao buscar insights de mídia.';
      logger.error(`[${logContext}] Erro da API ao buscar insights para Mídia ${mediaId}: ${errorMsg} (Code: ${response.error.code})`);
       if (response.error.code === 100 && errorMsg.toLowerCase().includes('metric')) {
         return { success: false, error: `Métrica inválida para mídia ${mediaId} (API ${API_VERSION}): ${errorMsg}. Pedido: ${metricsToFetch}` };
       }
       if (response.error.code === 10 || (response.error.code === 200 && errorMsg.toLowerCase().includes('permission'))) {
         return { success: false, error: `Permissão insuficiente para insights da mídia (${response.error.code}): ${errorMsg}` };
       }
      return { success: false, error: `Falha ao buscar insights de mídia: ${errorMsg}` };
    }

    const insights: Partial<IMetricStats> = {};
    if (response.data) { 
      response.data.forEach(item => {
        const metricName = item.name as keyof IMetricStats;
        if (item.values && item.values.length > 0) {
          const latestValue = item.values[item.values.length - 1]?.value;
          if (typeof latestValue === 'number') {
            insights[metricName] = latestValue;
          } else if (typeof latestValue === 'object' && latestValue !== null) {
            insights[metricName] = latestValue as any; 
          }
        }
      });
    }
    logger.debug(`[${logContext}] Insights para mídia ${mediaId} processados.`);
    return { success: true, data: insights as IMetricStats };
  } catch (error: any) {
    logger.error(`[${logContext}] Erro final ao buscar insights para Mídia ${mediaId}:`, error);
    const message = error.message || String(error);
    const permissionErrorKeywords = ['permissão', 'permission', '(#10)', '(#200)'];
    const isPermError = permissionErrorKeywords.some(keyword => message.toLowerCase().includes(keyword.toLowerCase()));

    if (isPermError || message.toLowerCase().includes('token') || message.toLowerCase().includes('falha') || message.toLowerCase().includes('inválida')) {
        return { success: false, error: message };
    }
    return { success: false, error: `Erro interno ao buscar insights de mídia: ${message}` };
  }
}

export async function fetchAccountInsights(
  accountId: string,
  accessToken: string,
  period: string = DEFAULT_ACCOUNT_INSIGHTS_PERIOD
): Promise<FetchInsightsResult<IAccountInsightsPeriod>> {
  const logContext = 'fetchAccountInsights v2';
  const isSystemToken = accessToken === process.env.FB_SYSTEM_USER_TOKEN;
  const tokenTypeForLog = isSystemToken ? 'System User' : 'User LLAT';
  logger.debug(`[${logContext}] Buscando insights da conta ${accountId} período: ${period}... (Token: ${tokenTypeForLog})`);

  if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
  if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

  const allRequestedMetrics: string[] = ACCOUNT_INSIGHTS_METRICS.split(',').map(m => m.trim()).filter(m => m);
  const aggregatedInsights: Partial<IAccountInsightsPeriod> = { period: period };
  let overallSuccess = true;
  const errors: string[] = [];

  for (const metric of allRequestedMetrics) {
    let url = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${metric}&period=${period}`;
    const breakdownForMetric = ACCOUNT_BREAKDOWNS[metric];

    if (breakdownForMetric) {
      url += `&breakdown=${breakdownForMetric}`;
      logger.debug(`[${logContext}] Adicionando breakdown '${breakdownForMetric}' para métrica '${metric}'.`);
    }

    if (isSystemToken && ACCOUNT_INSIGHTS_REQUIRING_TOTAL_VALUE.includes(metric)) {
      url += `&metric_type=total_value`;
      logger.debug(`[${logContext}] Adicionado '&metric_type=total_value' para métrica '${metric}' com System Token.`);
    }
    url += `&access_token=${accessToken}`;

    try {
      logger.debug(`[${logContext}] Chamando API para métrica '${metric}'. URL: ${url.replace(accessToken, '[TOKEN_OCULTO]')}`);
      const response = await graphApiRequest<InstagramApiInsightItem>(url, undefined, `${logContext} - ${metric}`, accessToken);

      if (response.error) {
        const errorMsg = response.error.message || `Erro desconhecido ao buscar métrica '${metric}'.`;
        logger.error(`[${logContext}] Erro da API ao buscar métrica '${metric}' para Conta ${accountId}: ${errorMsg} (Code: ${response.error.code})`);
        errors.push(`Métrica ${metric}: ${errorMsg} (Code: ${response.error.code})`);
        overallSuccess = false; 
        continue; 
      }

      if (response.data && response.data.length > 0) {
        response.data.forEach(item => {
          const metricNameInResponse = item.name as keyof IAccountInsightsPeriod;
          if (item.values && item.values.length > 0) {
            const valueData = item.values[0]?.value; 
            if (typeof valueData === 'number') {
              aggregatedInsights[metricNameInResponse] = valueData;
            } else if (typeof valueData === 'object' && valueData !== null) {
              aggregatedInsights[metricNameInResponse] = valueData as any;
            }
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

  if (!overallSuccess && errors.length > 0) {
    logger.error(`[${logContext}] Finalizado com erros ao buscar insights da conta ${accountId}. Erros: ${errors.join('; ')}`);
    const hasPartialData = Object.keys(aggregatedInsights).length > 1;
    return { 
        success: hasPartialData, 
        data: hasPartialData ? (aggregatedInsights as IAccountInsightsPeriod) : undefined,
        error: `Falhas ao buscar algumas métricas de conta: ${errors.join('; ')}` 
    };
  }
  
  if (Object.keys(aggregatedInsights).length <= 1 && allRequestedMetrics.length > 0) { 
    logger.warn(`[${logContext}] Nenhum insight de conta foi efetivamente coletado para ${accountId}, apesar de não haver erros críticos diretos nas chamadas.`);
    return { success: false, error: 'Nenhum dado de insight de conta foi retornado pela API.' };
  }

  logger.debug(`[${logContext}] Insights da conta ${accountId} (${period}) processados agregadamente.`);
  return { success: true, data: aggregatedInsights as IAccountInsightsPeriod };
}

// Define an explicit type for the structure we are building for each demographic metric's breakdown data
type DemographicBreakdownDataType = {
    city: Array<{ value: string; count: number }>;
    country: Array<{ value: string; count: number }>;
    age: Array<{ value: string; count: number }>;
    gender: Array<{ value: string; count: number }>;
};

export async function fetchAudienceDemographics(
  accountId: string,
  accessToken: string,
  timeframe: string = DEMOGRAPHICS_TIMEFRAME_RECENT 
): Promise<FetchInsightsResult<IAudienceDemographics>> {
  const logContext = 'fetchAudienceDemographics v2.1_typefix_any_cast'; // Versioning for log
  const isSystemToken = accessToken === process.env.FB_SYSTEM_USER_TOKEN;
  const tokenTypeForLog = isSystemToken ? 'System User' : 'User LLAT';
  logger.debug(`[${logContext}] Buscando dados demográficos da conta ${accountId} (Timeframe: ${timeframe})... (Token: ${tokenTypeForLog})`);

  if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
  if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

  const demographicMetricsToFetch = DEMOGRAPHICS_METRICS.split(',').map(m => m.trim()).filter(m => m);
  const aggregatedDemographics: Partial<IAudienceDemographics> = {};
  let overallSuccess = true;
  const errors: string[] = [];
  let anyDataCollected = false;

  for (const demographicMetric of demographicMetricsToFetch) {
    const period = DEMOGRAPHICS_PERIOD; 
    const breakdown = DEMOGRAPHICS_BREAKDOWNS; 
    
    let url = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${demographicMetric}&period=${period}&breakdown=${breakdown}&timeframe=${timeframe}`;

    if (isSystemToken && DEMOGRAPHICS_REQUIRING_TOTAL_VALUE.includes(demographicMetric)) {
      url += `&metric_type=total_value`;
      logger.debug(`[${logContext}] Adicionado '&metric_type=total_value' para System Token (Métrica: ${demographicMetric}).`);
    }
    url += `&access_token=${accessToken}`;

    try {
      logger.debug(`[${logContext}] Chamando API para métrica demográfica '${demographicMetric}'. URL: ${url.replace(accessToken, '[TOKEN_OCULTO]')}`);
      const response = await graphApiRequest<InstagramApiInsightItem>(url, undefined, `${logContext} - ${demographicMetric}`, accessToken);

      if (response.error) {
        const errorMsg = response.error.message || `Erro desconhecido ao buscar ${demographicMetric}.`;
        logger.error(`[${logContext}] Erro da API ao buscar ${demographicMetric} para Conta ${accountId}: ${errorMsg} (Code: ${response.error.code})`);
        errors.push(`${demographicMetric}: ${errorMsg} (Code: ${response.error.code})`);
        
        if (response.error.code === 10 || (response.error.code === 200 && errorMsg.toLowerCase().includes('permission')) || (response.error.code === 80004 && errorMsg.toLowerCase().includes('not enough data'))) {
          logger.warn(`[${logContext}] Permissão/Dados insuficientes (${response.error.code}) para ${demographicMetric} da conta ${accountId}. Detalhe: ${errorMsg}`);
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
              const breakdownValues = firstValEntry.value as { [breakdownType: string]: { [key:string]: number }};
              
              const currentMetricData: DemographicBreakdownDataType = { city: [], country: [], age: [], gender: [] };

              if (breakdownValues.city) {
                  currentMetricData.city = Object.entries(breakdownValues.city).map(([v, c]) => ({ value: v, count: c }));
              }
              if (breakdownValues.country) {
                  currentMetricData.country = Object.entries(breakdownValues.country).map(([v, c]) => ({ value: v, count: c }));
              }
              if (breakdownValues.age) { 
                  currentMetricData.age = Object.entries(breakdownValues.age).map(([v, c]) => ({ value: v, count: c }));
              }
              if (breakdownValues.gender) { 
                  currentMetricData.gender = Object.entries(breakdownValues.gender).map(([v, c]) => ({ value: v, count: c }));
              }
              
              // TODO: Review and align the IDemographicBreakdown type in src/app/models/AccountInsight.ts
              // to match the structure of DemographicBreakdownDataType (i.e., an object with city, country, age, gender arrays).
              // Using 'as any' here to bypass current type mismatch.
              if (demographicMetric === 'follower_demographics') {
                aggregatedDemographics.follower_demographics = currentMetricData as any; 
                anyDataCollected = true;
              } else if (demographicMetric === 'engaged_audience_demographics') {
                aggregatedDemographics.engaged_audience_demographics = currentMetricData as any; 
                anyDataCollected = true;
              }
          } else {
               logger.warn(`[${logContext}] Item demográfico '${demographicItem.name}' para conta ${accountId} sem dados válidos (values[0].value não é objeto) ou em formato inesperado.`);
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

  if (!anyDataCollected && errors.length === 0) {
    logger.warn(`[${logContext}] Nenhuma demografia foi efetivamente coletada para ${accountId}, mas sem erros diretos.`);
    return { success: true, data: {}, errorMessage: 'Dados demográficos insuficientes ou indisponíveis para esta conta.' };
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
      const errorMsg = responseNode.error.message || 'Erro desconhecido ao buscar dados básicos da conta.';
      logger.error(`[${logContext}] Erro da API ao buscar dados básicos para Conta ${accountId}: ${errorMsg} (Code: ${responseNode.error.code})`);
       if (responseNode.error.code === 10 || (responseNode.error.code === 200 && errorMsg.toLowerCase().includes('permission'))) {
         return { success: false, error: `Permissão insuficiente para dados básicos (${responseNode.error.code}): ${errorMsg}` };
       }
      return { success: false, error: `Falha ao buscar dados básicos da conta: ${errorMsg}` };
    }

    const accountDataFromApi = responseNode; 
    const accountData: Partial<IUser> = {};
    const requestedFieldsArray = fields.split(',');

    requestedFieldsArray.forEach(field => {
      const apiFieldValue = (accountDataFromApi as any)[field];
      if (apiFieldValue !== undefined) {
        if (field === 'id') {
          (accountData as any)['instagramAccountId'] = apiFieldValue; 
        }
        const knownUserFields: (keyof IUser)[] = ['username', 'name', 'biography', 'website', 'profile_picture_url', 'followers_count', 'follows_count', 'media_count'];
        if (knownUserFields.includes(field as keyof IUser)) {
          (accountData as any)[field] = apiFieldValue;
        } else if (field !== 'id') { 
            logger.warn(`[${logContext}] Campo '${field}' da API não mapeado diretamente para IUser, mas recebido.`);
            (accountData as any)[field] = apiFieldValue; 
        }
      }
    });
    
    if (requestedFieldsArray.includes('id') && accountDataFromApi.id) {
        accountData.instagramAccountId = accountDataFromApi.id;
    }

    logger.debug(`[${logContext}] Dados básicos da conta ${accountId} processados.`, accountData);
    return { success: true, data: accountData };
  } catch (error: any) {
    logger.error(`[${logContext}] Erro final ao buscar dados básicos para Conta ${accountId}:`, error);
    const message = error.message || String(error);
    const permissionErrorKeywords = ['permissão', 'permission', '(#10)', '(#200)'];
    const isPermError = permissionErrorKeywords.some(keyword => message.toLowerCase().includes(keyword.toLowerCase()));

    if (isPermError || message.toLowerCase().includes('token') || message.toLowerCase().includes('falha') || message.startsWith('Falha dados básicos (Erro 400)')) {
        return { success: false, error: message };
    }
    return { success: false, error: `Erro interno ao buscar dados básicos da conta: ${message}` };
  }
}
