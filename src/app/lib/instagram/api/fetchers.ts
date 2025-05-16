// src/app/lib/instagram/api/fetchers.ts
import { logger } from '@/app/lib/logger';
import { IUser } from '@/app/models/User';
import { IMetricStats } from '@/app/models/Metric';
import { IAccountInsightsPeriod, IAudienceDemographics, IDemographicBreakdown } from '@/app/models/AccountInsight';
import {
  API_VERSION,
  BASE_URL,
  BASIC_ACCOUNT_FIELDS,
  MEDIA_INSIGHTS_METRICS, // Usado para posts/carrosséis
  REEL_SAFE_GENERAL_METRICS, // Para Reels
  REEL_SPECIFIC_INSIGHTS_METRICS, // Para Reels
  ACCOUNT_INSIGHTS_METRICS, // Métricas de conta revisadas
  DEMOGRAPHICS_METRICS,      // Agora 'follower_demographics,engaged_audience_demographics'
  DEMOGRAPHICS_BREAKDOWNS, // 'age,gender,country,city'
  DEMOGRAPHICS_PERIOD,       // 'lifetime'
  DEMOGRAPHICS_TIMEFRAME_RECENT, // ex: 'last_30_days'
  DEFAULT_ACCOUNT_INSIGHTS_PERIOD,
  ACCOUNT_INSIGHTS_REQUIRING_TOTAL_VALUE,
  DEMOGRAPHICS_REQUIRING_TOTAL_VALUE,
  ACCOUNT_BREAKDOWNS, // Para breakdowns de métricas de conta
} from '../config/instagramApiConfig';
import {
  FetchMediaResult,
  InstagramMedia,
  FetchInsightsResult,
  FetchBasicAccountDataResult,
  InstagramApiInsightItem,
  // InstagramApiDemographicItem, // A resposta de demografia com breakdown é um InstagramApiInsightItem
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
  metricsToFetch: string // Esta string já deve ser a correta (ex: 'views,reach...' para Reels)
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
  const logContext = 'fetchAccountInsights';
  const isSystemToken = accessToken === process.env.FB_SYSTEM_USER_TOKEN;
  const tokenTypeForLog = isSystemToken ? 'System User' : 'User LLAT';
  logger.debug(`[${logContext}] Buscando insights da conta ${accountId} período: ${period}... (Token: ${tokenTypeForLog})`);

  if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
  if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

  const metricsCsv = ACCOUNT_INSIGHTS_METRICS; // Usa a lista revisada
  let url = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${metricsCsv}&period=${period}`;
  
  const requestedMetricsArray = metricsCsv.split(',');
  let breakdownParams = '';
  // Adiciona breakdowns se configurados para as métricas solicitadas
  for (const metric of requestedMetricsArray) {
      if (ACCOUNT_BREAKDOWNS[metric]) {
          // A API espera múltiplos breakdowns como uma lista separada por vírgula para o parâmetro 'breakdown'
          // ou, para algumas métricas, o próprio nome da métrica já implica o breakdown.
          // Se ACCOUNT_BREAKDOWNS[metric] já é uma string formatada (ex: 'type1,type2'), está OK.
          // Se for para adicionar múltiplos parâmetros &breakdown=type1&breakdown=type2, a lógica muda.
          // O relatório sugere que 'views' aceita 'follower_type,media_product_type' como breakdown.
          // Vamos assumir que o valor em ACCOUNT_BREAKDOWNS é a string correta para o parâmetro.
          breakdownParams += `&breakdown=${ACCOUNT_BREAKDOWNS[metric]}`; // Isso pode adicionar múltiplos &breakdown= se várias métricas tiverem breakdown
                                                                      // O correto seria um único parâmetro &breakdown=type1,type2 OU
                                                                      // a métrica já vir com o breakdown (ex: views.breakdown(follower_type))
                                                                      // Por agora, vamos manter simples, mas isso pode precisar de ajuste fino.
                                                                      // A API geralmente aceita UMA métrica com UM conjunto de breakdowns.
                                                                      // Se for pedir múltiplas métricas, cada uma pode ter seu próprio conjunto de breakdowns,
                                                                      // ou os breakdowns são aplicados a todas.
                                                                      // O mais seguro é pedir uma métrica de cada vez se os breakdowns forem complexos e diferentes.
                                                                      // Para simplificar, e dado que ACCOUNT_INSIGHTS_METRICS é uma string CSV,
                                                                      // vamos assumir que os breakdowns em ACCOUNT_BREAKDOWNS são para métricas específicas
                                                                      // e que a API aceita múltiplos &breakdown= se necessário (o que é incomum).
                                                                      // Uma abordagem mais segura seria construir a URL por métrica se os breakdowns forem diferentes.
                                                                      // Por agora, o código original adicionava múltiplos &breakdown=, o que não é padrão.
                                                                      // A API /insights geralmente toma UMA métrica e UM parâmetro breakdown com valores CSV.
                                                                      // Vamos construir um único parâmetro breakdown com todos os valores únicos.
      }
  }
  // Construir um único parâmetro breakdown com valores únicos
  const uniqueBreakdowns = new Set<string>();
  for (const metric of requestedMetricsArray) {
      if (ACCOUNT_BREAKDOWNS[metric]) {
          ACCOUNT_BREAKDOWNS[metric].split(',').forEach(b => uniqueBreakdowns.add(b.trim()));
      }
  }
  if (uniqueBreakdowns.size > 0) {
      url += `&breakdown=${Array.from(uniqueBreakdowns).join(',')}`;
  }


  if (isSystemToken) {
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
    if (response.data) { 
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

export async function fetchAudienceDemographics(
  accountId: string,
  accessToken: string,
  timeframe: string = DEMOGRAPHICS_TIMEFRAME_RECENT // Usa o timeframe recente por padrão
): Promise<FetchInsightsResult<IAudienceDemographics>> {
  const logContext = 'fetchAudienceDemographics';
  const isSystemToken = accessToken === process.env.FB_SYSTEM_USER_TOKEN;
  const tokenTypeForLog = isSystemToken ? 'System User' : 'User LLAT';
  logger.debug(`[${logContext}] Buscando dados demográficos da conta ${accountId} (Timeframe: ${timeframe})... (Token: ${tokenTypeForLog})`);

  if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
  if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

  // Vamos buscar 'follower_demographics' e 'engaged_audience_demographics' separadamente se necessário,
  // ou combiná-los se a API permitir. O relatório sugere que são métricas distintas.
  // Por agora, focaremos em 'follower_demographics' como exemplo principal e adaptaremos o parsing.
  const primaryDemographicMetric = DEMOGRAPHICS_METRICS.split(',')[0] || 'follower_demographics'; // Ex: 'follower_demographics'
  const period = DEMOGRAPHICS_PERIOD; // 'lifetime'
  const breakdown = DEMOGRAPHICS_BREAKDOWNS; // 'age,gender,country,city'
  
  let url = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${primaryDemographicMetric}&period=${period}&breakdown=${breakdown}&timeframe=${timeframe}`;

  if (isSystemToken) {
    if (DEMOGRAPHICS_REQUIRING_TOTAL_VALUE.includes(primaryDemographicMetric)) {
      url += `&metric_type=total_value`;
      logger.debug(`[${logContext}] Adicionado '&metric_type=total_value' para System Token (Demografia).`);
    }
  }
  url += `&access_token=${accessToken}`;

  try {
    // A resposta para /insights com breakdown é um array de objetos,
    // onde cada objeto tem 'name', 'period', 'values'. O 'values[0].value' contém os breakdowns.
    const response = await graphApiRequest<InstagramApiInsightItem>(url, undefined, logContext, accessToken);

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
        // Inicializa a estrutura esperada. Se for 'engaged_audience_demographics', ajuste aqui.
        follower_demographics: { city: [], country: [], age: [], gender: [] } 
    };
    
    // A API retorna um item no array 'data' para a métrica principal (ex: follower_demographics).
    // O valor desse item contém os breakdowns.
    const demographicItem = response.data[0]; 

    if (demographicItem && demographicItem.values && demographicItem.values.length > 0) {
        const firstValEntry = demographicItem.values[0];
        if (firstValEntry && typeof firstValEntry.value === 'object' && firstValEntry.value !== null) {
            // O 'value' aqui é um objeto onde as chaves são os tipos de breakdown (city, country, etc.)
            // e os valores são mapas de {chave_especifica: contagem}.
            // Ex: { "city": {"Sao Paulo": 10, "Rio": 20}, "country": {"BR": 100}, "age": {"18-24": 50}, "gender": {"F": 60} }
            const breakdownValues = firstValEntry.value as { [breakdownType: string]: { [key:string]: number }};

            if (demographics.follower_demographics) { // Ou engaged_audience_demographics
                if (breakdownValues.city) {
                    demographics.follower_demographics.city = Object.entries(breakdownValues.city).map(([v, c]) => ({ value: v, count: c }));
                }
                if (breakdownValues.country) {
                    demographics.follower_demographics.country = Object.entries(breakdownValues.country).map(([v, c]) => ({ value: v, count: c }));
                }
                if (breakdownValues.age) { 
                    demographics.follower_demographics.age = Object.entries(breakdownValues.age).map(([v, c]) => ({ value: v, count: c }));
                }
                if (breakdownValues.gender) { 
                    demographics.follower_demographics.gender = Object.entries(breakdownValues.gender).map(([v, c]) => ({ value: v, count: c }));
                }
                // Se a API retornar age e gender combinados (ex: "gender_age" como chave em breakdownValues),
                // a lógica de split e agregação seria necessária aqui, como na tentativa anterior.
                // Mas o relatório sugere que breakdowns 'age' e 'gender' são separados.
            }
        } else {
             logger.warn(`[${logContext}] Item demográfico '${demographicItem.name}' para conta ${accountId} sem dados válidos (values[0].value não é objeto) ou em formato inesperado.`);
        }
    } else {
        logger.warn(`[${logContext}] Nenhum item de dados ou valores encontrados na resposta de demografia para conta ${accountId}.`);
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
