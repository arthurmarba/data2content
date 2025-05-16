// src/app/lib/instagram/api/fetchers.ts
import { logger } from '@/app/lib/logger';
import { IUser } from '@/app/models/User';
import { IMetricStats } from '@/app/models/Metric';
import { IAccountInsightsPeriod, IAudienceDemographics, IDemographicBreakdown } from '@/app/models/AccountInsight';
import {
  API_VERSION,
  BASE_URL,
  BASIC_ACCOUNT_FIELDS,
  MEDIA_INSIGHTS_METRICS,
  ACCOUNT_INSIGHTS_METRICS,
  DEMOGRAPHICS_METRICS,
  // DEMOGRAPHICS_TIMEFRAME, // timeframe é usado na URL, mas não diretamente aqui
  DEFAULT_ACCOUNT_INSIGHTS_PERIOD,
  ACCOUNT_INSIGHTS_REQUIRING_TOTAL_VALUE,
  DEMOGRAPHICS_REQUIRING_TOTAL_VALUE,
} from '../config/instagramApiConfig';
import {
  FetchMediaResult,
  InstagramMedia,
  FetchInsightsResult,
  FetchBasicAccountDataResult,
  InstagramApiInsightItem,
  InstagramApiDemographicItem,
} from '../types';
// Importa ambas as funções do cliente da API
import { graphApiRequest, graphApiNodeRequest } from './client';

/**
 * Busca mídias de uma conta Instagram.
 *
 * @param accountId - O ID da conta Instagram.
 * @param accessToken - O token de acesso para a API.
 * @param pageUrl - URL opcional para paginação (busca a próxima página de resultados).
 * @returns Uma promessa que resolve para FetchMediaResult.
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
    const fields = 'id,media_type,timestamp,caption,permalink,username,media_url,thumbnail_url,children{id,media_type,media_url,permalink,thumbnail_url}';
    const limit = 25;
    url = `${BASE_URL}/${API_VERSION}/${accountId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`;
  }

  try {
    // graphApiRequest espera uma resposta no formato { data: T[] }
    const response = await graphApiRequest<InstagramMedia>(url, undefined, logContext, accessToken);

    if (response.error) {
      const errorMsg = response.error.message || 'Erro desconhecido ao buscar mídias.';
      logger.error(`[${logContext}] Erro da API ao buscar mídias para Conta ${accountId}: ${errorMsg} (Code: ${response.error.code})`);
      return { success: false, error: `Falha ao buscar mídias: ${errorMsg}` };
    }
    
    logger.info(`[${logContext}] Mídias buscadas com sucesso para Conta ${accountId}. ${response.data?.length || 0} itens retornados.`);
    return {
      success: true,
      data: response.data || [], // graphApiRequest garante que data é um array se não houver erro
      nextPageUrl: response.paging?.next || null,
    };
  } catch (error: any) {
    logger.error(`[${logContext}] Erro final ao buscar mídias para Conta ${accountId}:`, error);
    const message = error.message || String(error);
    return { success: false, error: message.startsWith('Token') || message.startsWith('Falha') ? message : `Erro interno ao buscar mídias: ${message}` };
  }
}

/**
 * Busca insights para uma mídia específica do Instagram.
 *
 * @param mediaId - O ID da mídia.
 * @param accessToken - O token de acesso para a API.
 * @param metricsToFetch - String CSV das métricas a serem buscadas.
 * @returns Uma promessa que resolve para FetchInsightsResult<IMetricStats>.
 */
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
    // Insights de mídia também retornam no formato { data: [...] }
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
    if (response.data) { // response.data é garantido como array por graphApiRequest
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

/**
 * Busca insights agregados de uma conta Instagram.
 *
 * @param accountId - O ID da conta Instagram.
 * @param accessToken - O token de acesso para a API.
 * @param period - O período para os insights (ex: "day", "week", "days_28").
 * @returns Uma promessa que resolve para FetchInsightsResult<IAccountInsightsPeriod>.
 */
export async function fetchAccountInsights(
  accountId: string,
  accessToken: string,
  period: string = DEFAULT_ACCOUNT_INSIGHTS_PERIOD
): Promise<FetchInsightsResult<IAccountInsightsPeriod>> {
  const logContext = 'fetchAccountInsights';
  const isSystemToken = accessToken === process.env.FB_SYSTEM_USER_TOKEN;
  const tokenTypeForLog = isSystemToken ? 'System User' : 'User LLAT';
  logger.debug(`[${logContext}] Buscando insights da conta ${accountId} período: ${period}... (Token: ${tokenTypeForLog})`);

  if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
  if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

  const metricsCsv = ACCOUNT_INSIGHTS_METRICS;
  let url = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${metricsCsv}&period=${period}`;

  if (isSystemToken) {
    const requestedMetricsArray = metricsCsv.split(',');
    const hasTotalValueMetrics = requestedMetricsArray.some(metric =>
      ACCOUNT_INSIGHTS_REQUIRING_TOTAL_VALUE.includes(metric)
    );
    if (hasTotalValueMetrics) {
      url += `&metric_type=total_value`;
      logger.debug(`[${logContext}] Adicionado '&metric_type=total_value' para System Token.`);
    }
  }
  url += `&access_token=${accessToken}`;

  try {
    // Insights de conta também retornam no formato { data: [...] }
    const response = await graphApiRequest<InstagramApiInsightItem>(url, undefined, logContext, accessToken);

    if (response.error) {
      const errorMsg = response.error.message || 'Erro desconhecido ao buscar insights da conta.';
      logger.error(`[${logContext}] Erro da API ao buscar insights para Conta ${accountId}: ${errorMsg} (Code: ${response.error.code})`);
      if (response.error.code === 10 || (response.error.code === 200 && errorMsg.toLowerCase().includes('permission'))) {
        return { success: false, error: `Permissão insuficiente para insights da conta (${response.error.code}): ${errorMsg}` };
      }
      if (response.error.code === 100 && errorMsg.toLowerCase().includes('metric')) {
        return { success: false, error: `Métrica inválida solicitada para insights de conta: ${errorMsg}` };
      }
      return { success: false, error: `Falha ao buscar insights da conta: ${errorMsg}` };
    }

    const insights: Partial<IAccountInsightsPeriod> = { period: period };
    if (response.data) { // response.data é garantido como array
      response.data.forEach(item => {
        const metricName = item.name as keyof IAccountInsightsPeriod;
        if (item.values && item.values.length > 0) {
          const valueData = item.values[0]?.value;
          if (typeof valueData === 'number') {
            insights[metricName] = valueData;
          } else if (typeof valueData === 'object' && valueData !== null) {
            insights[metricName] = valueData as any;
          }
        }
      });
    }
    logger.debug(`[${logContext}] Insights da conta ${accountId} (${period}) processados.`);
    return { success: true, data: insights as IAccountInsightsPeriod };
  } catch (error: any) {
    logger.error(`[${logContext}] Erro final ao buscar insights para Conta ${accountId}:`, error);
    const message = error.message || String(error);
    const permissionErrorKeywords = ['permissão', 'permission', '(#10)', '(#200)'];
    const isPermError = permissionErrorKeywords.some(keyword => message.toLowerCase().includes(keyword.toLowerCase()));

    if (isPermError || message.toLowerCase().includes('token') || message.toLowerCase().includes('falha') || message.toLowerCase().includes('métrica inválida')) {
        return { success: false, error: message };
    }
    return { success: false, error: `Erro interno ao buscar insights da conta: ${message}` };
  }
}

/**
 * Busca dados demográficos de uma conta Instagram.
 *
 * @param accountId - O ID da conta Instagram.
 * @param accessToken - O token de acesso para a API.
 * @returns Uma promessa que resolve para FetchInsightsResult<IAudienceDemographics>.
 */
export async function fetchAudienceDemographics(
  accountId: string,
  accessToken: string
): Promise<FetchInsightsResult<IAudienceDemographics>> {
  const logContext = 'fetchAudienceDemographics';
  const isSystemToken = accessToken === process.env.FB_SYSTEM_USER_TOKEN;
  const tokenTypeForLog = isSystemToken ? 'System User' : 'User LLAT';
  logger.debug(`[${logContext}] Buscando dados demográficos da conta ${accountId}... (Token: ${tokenTypeForLog})`);

  if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
  if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

  const metricsCsv = DEMOGRAPHICS_METRICS; // e.g., "audience_city,audience_country,audience_gender_age"
  const period = 'lifetime';
  let url = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${metricsCsv}&period=${period}`;

  if (isSystemToken) {
    const requestedMetricsArray = metricsCsv.split(',');
    const hasTotalValueMetrics = requestedMetricsArray.some(metric =>
      DEMOGRAPHICS_REQUIRING_TOTAL_VALUE.includes(metric)
    );
    if (hasTotalValueMetrics) {
      url += `&metric_type=total_value`;
      logger.debug(`[${logContext}] Adicionado '&metric_type=total_value' para System Token (Demografia).`);
    }
  }
  url += `&access_token=${accessToken}`;

  try {
    const response = await graphApiRequest<InstagramApiDemographicItem>(url, undefined, logContext, accessToken);

    if (response.error) {
      const errorMsg = response.error.message || 'Erro desconhecido ao buscar demografia.';
      logger.error(`[${logContext}] Erro da API ao buscar demografia para Conta ${accountId}: ${errorMsg} (Code: ${response.error.code})`);
      if (response.error.code === 10 || (response.error.code === 200 && errorMsg.toLowerCase().includes('permission')) || (response.error.code === 80004 && errorMsg.toLowerCase().includes('not enough data'))) {
        logger.warn(`[${logContext}] Permissão/Dados insuficientes (${response.error.code}) para demografia da conta ${accountId}. Detalhe: ${errorMsg}`);
        return { success: true, data: {}, errorMessage: `Dados demográficos indisponíveis ou insuficientes (${response.error.code}): ${errorMsg}` };
      }
      if (response.error.code === 100 && errorMsg.toLowerCase().includes('metric')) {
        return { success: false, error: `Métrica inválida solicitada para demografia: ${errorMsg}` };
      }
      return { success: false, error: `Falha ao buscar demografia: ${errorMsg}` };
    }
    
    if (!response.data || response.data.length === 0) {
      logger.warn(`[${logContext}] Demografia OK, mas 'data' array estava vazio para conta ${accountId}.`);
      return { success: true, data: {}, errorMessage: 'Dados demográficos não encontrados para esta conta.' };
    }
    
    const demographics: Partial<IAudienceDemographics> = { 
        follower_demographics: { 
            city: [],
            country: [],
            age: [],
            gender: []
        } 
    };
    
    const ageMap: { [ageRange: string]: number } = {};
    const genderMap: { [genderCode: string]: number } = {};

    response.data.forEach(item => {
      const firstValEntry = item.values?.[0];
      
      if (firstValEntry && typeof firstValEntry.value === 'object' && firstValEntry.value !== null) {
        const breakdownData = firstValEntry.value as { [key: string]: number };
        const parsedBreakdowns: IDemographicBreakdown[] = Object.entries(breakdownData)
          .filter(([_, count]) => typeof count === 'number')
          .map(([val, count]) => ({ value: val, count: count as number }));

        if (parsedBreakdowns.length > 0) {
          if (demographics.follower_demographics) {
            if (item.name === 'audience_city') {
              demographics.follower_demographics.city = parsedBreakdowns;
            } else if (item.name === 'audience_country') {
              demographics.follower_demographics.country = parsedBreakdowns;
            } else if (item.name === 'audience_gender_age') {
              parsedBreakdowns.forEach(entry => {
                const parts = entry.value.split('.');
                if (parts.length === 2) {
                  const genderKey = parts[0]; // ex: "F", "M", "U"
                  const ageRangeKey = parts[1]; // ex: "13-17", "18-24"
                  
                  // CORREÇÃO APLICADA AQUI:
                  // Garantir que genderKey e ageRangeKey são strings válidas antes de usar como chaves
                  if (typeof genderKey === 'string' && genderKey.length > 0) {
                    genderMap[genderKey] = (genderMap[genderKey] || 0) + entry.count;
                  } else {
                    logger.warn(`[${logContext}] Chave de gênero inválida ou vazia em audience_gender_age: ${entry.value}`);
                  }

                  if (typeof ageRangeKey === 'string' && ageRangeKey.length > 0) {
                    ageMap[ageRangeKey] = (ageMap[ageRangeKey] || 0) + entry.count;
                  } else {
                     logger.warn(`[${logContext}] Chave de faixa etária inválida ou vazia em audience_gender_age: ${entry.value}`);
                  }
                } else {
                    logger.warn(`[${logContext}] Formato inesperado para entrada de audience_gender_age: ${entry.value}`);
                }
              });
            } else {
               logger.warn(`[${logContext}] Métrica demográfica inesperada '${item.name}' recebida.`);
            }
          }
        }
      } else {
        logger.warn(`[${logContext}] Item demográfico '${item.name}' para conta ${accountId} sem dados válidos ou em formato inesperado.`);
      }
    });

    if (demographics.follower_demographics) {
        if (Object.keys(ageMap).length > 0) {
            demographics.follower_demographics.age = Object.entries(ageMap).map(([value, count]) => ({ value, count }));
        }
        if (Object.keys(genderMap).length > 0) {
            demographics.follower_demographics.gender = Object.entries(genderMap).map(([value, count]) => ({ value, count }));
        }
    }

    const hasData = demographics.follower_demographics && 
                    (demographics.follower_demographics.city?.length || 
                     demographics.follower_demographics.country?.length || 
                     demographics.follower_demographics.age?.length || 
                     demographics.follower_demographics.gender?.length);

    logger.debug(`[${logContext}] Demografia processada para conta ${accountId}. ${hasData ? 'Dados OK.' : 'Dados não disponíveis.'}`);
    return { success: true, data: demographics as IAudienceDemographics, errorMessage: hasData ? undefined : 'Dados demográficos insuficientes ou indisponíveis.' };

  } catch (error: any) {
    logger.error(`[${logContext}] Erro final na busca de demografia para Conta ${accountId}:`, error);
    const message = error.message || String(error);
    if (message.startsWith('Demographics unavailable') || message.includes('non-JSON')) {
      return { success: true, data: {}, errorMessage: 'Dados demográficos insuficientes ou indisponíveis.' };
    }
    const permissionErrorKeywords = ['permissão', 'permission', '(#10)', '(#200)'];
    const isPermError = permissionErrorKeywords.some(keyword => message.toLowerCase().includes(keyword.toLowerCase()));

    if (isPermError || message.toLowerCase().includes('token') || message.toLowerCase().includes('falha') || message.toLowerCase().includes('métrica inválida')) {
        return { success: false, error: message };
    }
    return { success: false, error: `Erro interno ao buscar demografia da conta: ${message}` };
  }
}


/**
 * Busca dados básicos de uma conta Instagram (um único nó/objeto).
 *
 * @param accountId - O ID da conta Instagram.
 * @param accessToken - O token de acesso para a API.
 * @returns Uma promessa que resolve para FetchBasicAccountDataResult.
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
        } else {
          const knownUserFields: (keyof IUser)[] = ['username', 'name', 'biography', 'website', 'profile_picture_url', 'followers_count', 'follows_count', 'media_count'];
          if (knownUserFields.includes(field as keyof IUser)) {
            (accountData as any)[field] = apiFieldValue;
          }
        }
      }
    });

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
