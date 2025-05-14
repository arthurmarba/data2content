// src/app/lib/instagramService.ts - v2.0.2 (Resolução Problemas Sincronização - Completo e Corrigido)
// - CORREÇÃO DE TIPO (fetchAudienceDemographics):
//    1. Dentro do retry, se API OK mas data.data vazio, retorna o objeto 'data' completo da API.
//    2. Após o retry, adicionada verificação explícita para !responseData antes de acessar responseData.data.
// - Mantém todas as outras funcionalidades e correções da v2.0.1.

import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User";
import MetricModel, { IMetric, IMetricStats } from "@/app/models/Metric";
import AccountInsightModel, {
    IAccountInsight,
    IAccountInsightsPeriod,
    IAudienceDemographics,
    IDemographicBreakdown
} from "@/app/models/AccountInsight";
import StoryMetricModel, { IStoryMetric, IStoryStats } from "@/app/models/StoryMetric";
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from "@/app/models/DailyMetricSnapshot";
import { logger } from "@/app/lib/logger";
import mongoose, { Types } from "mongoose";
import retry from 'async-retry';
import { Client } from "@upstash/qstash";
import pLimit from 'p-limit';
import fetch, { Response as FetchResponse } from 'node-fetch';

import {
    API_VERSION,
    BASE_URL, BASIC_ACCOUNT_FIELDS,
    MEDIA_INSIGHTS_METRICS,
    REEL_SAFE_GENERAL_METRICS,
    REEL_SPECIFIC_INSIGHTS_METRICS,
    ACCOUNT_INSIGHTS_METRICS, DEMOGRAPHICS_METRICS,
    MEDIA_BREAKDOWNS, ACCOUNT_BREAKDOWNS,
    DEMOGRAPHICS_BREAKDOWNS, DEMOGRAPHICS_TIMEFRAME, DEFAULT_ACCOUNT_INSIGHTS_PERIOD,
    ACCOUNT_INSIGHTS_REQUIRING_TOTAL_VALUE,
    DEMOGRAPHICS_REQUIRING_TOTAL_VALUE
} from '@/config/instagram.config';

const RETRY_OPTIONS = { retries: 3, factor: 2, minTimeout: 500, maxTimeout: 5000, randomize: true };
const INSIGHTS_CONCURRENCY_LIMIT = 5;
const MAX_PAGES_MEDIA = 10;
const DELAY_MS = 250;
const MAX_ACCOUNT_FETCH_PAGES = 30;
const ACCOUNT_FETCH_DELAY_MS = 100;
const INSIGHT_FETCH_CUTOFF_DAYS = 180;

interface InstagramConnectionDetails { accessToken: string | null; accountId: string | null; }
interface InstagramMedia {
    id: string;
    media_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'STORY';
    timestamp?: string; caption?: string; permalink?: string; media_url?: string;
    children?: { id: string; media_type?: 'IMAGE' | 'VIDEO'; media_url?: string; permalink?: string; }[];
    username?: string; is_published?: boolean; shopping_product_tag_eligibility?: boolean; owner?: { id: string };
}
interface FetchMediaResult { success: boolean; data?: InstagramMedia[]; error?: string; nextPageUrl?: string | null; }
interface InstagramApiInsightValue { value: number | { [key: string]: number }; end_time: string; }
interface InstagramApiInsightItem { name: string; period: string; values: InstagramApiInsightValue[]; title: string; description: string; id: string; }
interface InstagramApiDemographicValue { value: { [key: string]: { [key: string]: number; }; }; end_time: string; }
interface InstagramApiDemographicItem { name: 'follower_demographics' | 'engaged_audience_demographics'; period: string; values: InstagramApiDemographicValue[]; title: string; description: string; id: string; }
interface FacebookApiErrorStructure { message: string; type: string; code: number; error_subcode?: number; fbtrace_id: string; }
interface FacebookApiError { error?: FacebookApiErrorStructure; }
interface InstagramApiResponse<T = InstagramApiInsightItem> { data: T[]; paging?: { next?: string; previous?: string; }; error?: FacebookApiErrorStructure; }

interface FetchInsightsResult<T = Record<string, any>> { success: boolean; data?: T; error?: string; errorMessage?: string; }
interface FetchBasicAccountDataResult { success: boolean; data?: Partial<IUser>; error?: string; }

export interface AvailableInstagramAccount {
    igAccountId: string;
    pageId: string;
    pageName: string;
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

const qstashToken = process.env.QSTASH_TOKEN;
const qstashClient = qstashToken ? new Client({ token: qstashToken }) : null;
if (!qstashClient) { logger.error("[instagramService] QSTASH_TOKEN não definido ou cliente falhou ao inicializar."); }

const limitInsightsFetch = pLimit(INSIGHTS_CONCURRENCY_LIMIT);

function isTokenInvalidError(errorCode?: number, errorSubcode?: number, errorMessage?: string): boolean {
    if (errorCode === 190) return true;
    if (errorCode === 100 && errorSubcode === 33) return true;
    if (errorSubcode === 458 || errorSubcode === 459 || errorSubcode === 463 || errorSubcode === 467) {
        return true;
    }
    if (errorMessage) {
        const lowerMessage = errorMessage.toLowerCase();
        if (lowerMessage.includes("token is invalid") ||
            lowerMessage.includes("session has been invalidated") ||
            lowerMessage.includes("access token is invalid")) {
            return true;
        }
    }
    return false;
}

export async function getInstagramConnectionDetails(userId: string | mongoose.Types.ObjectId): Promise<InstagramConnectionDetails | null> {
    const TAG = '[getInstagramConnectionDetails v2.0]';
    logger.debug(`${TAG} Buscando detalhes de conexão IG para User ${userId}...`);
    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido: ${userId}`);
        return null;
    }
    try {
        await connectToDatabase();
        const user = await DbUser.findById(userId)
            .select('instagramAccessToken instagramAccountId isInstagramConnected')
            .lean<IUser>();
        if (!user) {
            logger.warn(`${TAG} Usuário ${userId} não encontrado no DB.`);
            return null;
        }
        if (!user.isInstagramConnected || !user.instagramAccountId) {
            logger.warn(`${TAG} Conexão Instagram inativa ou ID da conta ausente para User ${userId}. isConnected: ${user.isInstagramConnected}, accountId: ${user.instagramAccountId}`);
            return null;
        }
        logger.debug(`${TAG} Detalhes de conexão IG encontrados para User ${userId}. Token ${user.instagramAccessToken ? 'existe' : 'NÃO existe'}. AccountId: ${user.instagramAccountId}`);
        return { accessToken: user.instagramAccessToken ?? null, accountId: user.instagramAccountId };
    } catch (error) {
        logger.error(`${TAG} Erro ao buscar detalhes de conexão IG para User ${userId}:`, error);
        return null;
    }
}

export async function fetchInstagramMedia(
    accountId: string,
    accessToken: string,
    pageUrl?: string
): Promise<FetchMediaResult> {
    const TAG = '[fetchInstagramMedia v2.0]';
    const logPrefix = pageUrl ? `${TAG} (Paginação)` : TAG;
    logger.info(`${logPrefix} Iniciando busca de mídias para Conta IG ${accountId}...`);

    if (!accountId) return { success: false, error: 'ID da conta Instagram não fornecido.' };
    if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

    const getUrl = () => {
        if (pageUrl) {
            let url = pageUrl;
            if (!url.includes('access_token=')) {
                url += (url.includes('?') ? '&' : '?') + `access_token=${accessToken}`;
            }
            return url;
        } else {
            const fields = 'id,media_type,timestamp,caption,permalink,username,children{id,media_type,media_url,permalink}';
            const limit = 25;
            return `${BASE_URL}/${API_VERSION}/${accountId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`;
        }
    };

    try {
        const responseData = await retry(async (bail, attemptNum) => {
            const currentUrl = getUrl();
            if (attemptNum > 1) {
                logger.warn(`${logPrefix} Tentativa ${attemptNum} para buscar mídias. URL: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`);
            } else {
                logger.debug(`${logPrefix} URL da API: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`);
            }
            const response: FetchResponse = await fetch(currentUrl);
            const data: InstagramApiResponse<InstagramMedia> & FacebookApiError = await response.json();

            if (!response.ok || data.error) {
                const errorDetail = data.error || { message: `Erro ${response.status} da API`, code: response.status, fbtrace_id: 'N/A', type: 'HttpError' };
                logger.error(`${logPrefix} Erro da API (Tentativa ${attemptNum}) ao buscar mídias para Conta ${accountId}:`, JSON.stringify(errorDetail));

                if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) {
                    logger.warn(`${TAG} Erro de token (${errorDetail.code}/${errorDetail.error_subcode || 'N/A'}) detectado. Não tentar novamente.`);
                    bail(new Error(`Token de acesso inválido ou expirado ao buscar mídias: ${errorDetail.message}`));
                    return; // Para consistência de tipo do callback, mas bail() rejeitará.
                }
                if (response.status === 400 && !isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) {
                     logger.warn(`${TAG} Erro 400 (Client Error não relacionado a token) não recuperável. Não tentar novamente. Detalhe: ${errorDetail.message}`);
                     bail(new Error(`Falha ao buscar mídias (Erro 400): ${errorDetail.message}`));
                     return;
                }
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    logger.warn(`${TAG} Erro ${response.status} (Client Error) não recuperável. Não tentar novamente.`);
                    bail(new Error(`Falha ao buscar mídias (Erro ${response.status}): ${errorDetail.message}`));
                    return;
                }
                throw new Error(`Erro temporário (${response.status}) ao buscar mídias: ${errorDetail.message}`);
            }
            return data;
        }, RETRY_OPTIONS);
        logger.info(`${logPrefix} Mídias buscadas com sucesso para Conta ${accountId}. ${responseData?.data?.length || 0} itens retornados.`);
        return { success: true, data: responseData?.data || [], nextPageUrl: responseData?.paging?.next || null };
    } catch (error: unknown) {
        logger.error(`${logPrefix} Erro final ao buscar mídias para Conta ${accountId} após retentativas:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: (message.startsWith('Token') || message.startsWith('Falha')) ? message : `Erro interno ao buscar mídias: ${message}` };
    }
}

export async function fetchMediaInsights(
    mediaId: string,
    accessToken: string,
    metricsToFetch: string
): Promise<FetchInsightsResult<IMetricStats>> {
    const TAG = '[fetchMediaInsights v2.0]';
    logger.debug(`${TAG} Buscando insights para Media ID: ${mediaId} com métricas: ${metricsToFetch}...`);
    if (!mediaId) return { success: false, error: 'ID da mídia não fornecido.' };
    if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };
    if (!metricsToFetch || metricsToFetch.trim() === '') {
        return { success: false, error: 'Lista de métricas para buscar não fornecida ou vazia.' };
    }

    const urlBase = `${BASE_URL}/${API_VERSION}/${mediaId}/insights?metric=${metricsToFetch}`;
    try {
        const responseData = await retry(async (bail, attemptNum) => {
            const currentUrl = `${urlBase}&access_token=${accessToken}`;
            if (attemptNum > 1) { logger.warn(`${TAG} Tentativa ${attemptNum} insights mídia ${mediaId}. URL: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
            else { logger.debug(`${TAG} URL da API: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
            const response: FetchResponse = await fetch(currentUrl);
            const data: InstagramApiResponse<InstagramApiInsightItem> & FacebookApiError = await response.json();
            if (!response.ok || data.error) {
                const errorDetail = data.error || { message: `Erro ${response.status} API`, code: response.status, fbtrace_id: 'N/A', type: 'HttpError' };
                logger.error(`${TAG} Erro API (Tentativa ${attemptNum}) insights Media ${mediaId}:`, JSON.stringify(errorDetail));

                if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) {
                    bail(new Error(`Token inválido/expirado insights mídia: ${errorDetail.message}`)); return;
                }
                if (errorDetail.code === 100 && errorDetail.message.toLowerCase().includes('metric')) {
                    logger.error(`${TAG} Erro API (#100) - Métrica possivelmente inválida para Media ${mediaId} ou API ${API_VERSION}. Métricas pedidas: ${metricsToFetch}. Erro: ${errorDetail.message}`);
                    bail(new Error(`Métrica inválida para mídia ${mediaId} (API ${API_VERSION}): ${errorDetail.message}. Pedido: ${metricsToFetch}`)); return;
                }
                if (errorDetail.code === 10 || (errorDetail.code === 200 && errorDetail.message.toLowerCase().includes('permission'))) {
                    bail(new Error(`Permissão insuficiente insights mídia (${errorDetail.code}): ${errorDetail.message}`)); return;
                }
                if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha insights mídia (Erro ${response.status}): ${errorDetail.message}`)); return; }
                throw new Error(`Erro temp (${response.status}) insights mídia: ${errorDetail.message}`);
            } return data;
        }, RETRY_OPTIONS);

        const insights: Partial<IMetricStats> = {};
        if (responseData?.data) {
            responseData.data.forEach(item => {
                const metricName = item.name as keyof IMetricStats;
                if (item.values && item.values.length > 0) {
                    const latestValue = item.values[item.values.length - 1]?.value;
                    if (typeof latestValue === 'number') { insights[metricName] = latestValue; }
                    else if (typeof latestValue === 'object' && latestValue !== null) { insights[metricName] = latestValue as any; }
                }
            });
        }
        logger.debug(`${TAG} Insights mídia ${mediaId} OK.`);
        return { success: true, data: insights as IMetricStats };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`${TAG} Erro final insights Media ${mediaId}:`, error);
        const permissionErrorKeywords = ['permissão', 'permission', '(#10)', '(#200)'];
        const isPermError = permissionErrorKeywords.some(keyword => message.toLowerCase().includes(keyword.toLowerCase()));

        if (isPermError || message.toLowerCase().includes('token') || message.toLowerCase().includes('falha') || message.toLowerCase().includes('inválida')) {
            return { success: false, error: message };
        }
        return { success: false, error: `Erro interno insights mídia: ${message}` };
    }
}

// src/app/lib/instagramService.ts - v2.0.2 (Resolução Problemas Sincronização - Completo e Corrigido)
// Continuação da Parte 1...
// - CORREÇÃO DE TIPO (fetchAudienceDemographics):
//    1. Dentro do retry, se API OK mas data.data vazio, retorna o objeto 'data' completo da API.
//    2. Após o retry, adicionada verificação explícita para !responseData antes de acessar responseData.data.
// - Mantém todas as outras funcionalidades e correções da v2.0.1.


export async function fetchAccountInsights(
    accountId: string,
    accessToken: string,
    period: string = DEFAULT_ACCOUNT_INSIGHTS_PERIOD
): Promise<FetchInsightsResult<IAccountInsightsPeriod>> {
    const TAG = '[fetchAccountInsights v2.0]'; // Mantido v2.0 pois a lógica principal não mudou desde a v2.0.1
    logger.debug(`${TAG} Buscando insights da conta ${accountId} período: ${period}... (Token: ${accessToken === process.env.FB_SYSTEM_USER_TOKEN ? 'System User' : 'User LLAT'})`);
    if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
    if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

    const metricsCsv = ACCOUNT_INSIGHTS_METRICS;
    let urlBase = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${metricsCsv}&period=${period}`;
    const requestedMetricsArray = metricsCsv.split(',');

    for (const metric of requestedMetricsArray) {
        if (ACCOUNT_BREAKDOWNS[metric]) {
            urlBase += `&breakdown=${ACCOUNT_BREAKDOWNS[metric]}`;
        }
    }

    const isSystemToken = accessToken === process.env.FB_SYSTEM_USER_TOKEN;
    if (isSystemToken) {
        const hasTotalValueMetrics = requestedMetricsArray.some(metric =>
            ACCOUNT_INSIGHTS_REQUIRING_TOTAL_VALUE.includes(metric)
        );
        if (hasTotalValueMetrics) {
            urlBase += `&metric_type=total_value`;
            logger.debug(`${TAG} Adicionado '&metric_type=total_value' para System Token.`);
        }
    }

    try {
        const responseData = await retry(async (bail, attemptNum) => {
            const currentUrl = `${urlBase}&access_token=${accessToken}`;
            if (attemptNum > 1) { logger.warn(`${TAG} Tentativa ${attemptNum} insights conta ${accountId}. URL: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
            else { logger.debug(`${TAG} URL da API: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
            const response: FetchResponse = await fetch(currentUrl);
            const data: InstagramApiResponse<InstagramApiInsightItem> & FacebookApiError = await response.json();
            if (!response.ok || data.error) {
                const errorDetail = data.error || { message: `Erro ${response.status} API`, code: response.status, fbtrace_id: 'N/A', type: 'HttpError' };
                logger.error(`${TAG} Erro API (Tentativa ${attemptNum}) insights conta ${accountId}:`, JSON.stringify(errorDetail));

                if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) {
                    bail(new Error(`Token inválido/expirado insights conta: ${errorDetail.message}`)); return;
                }
                if (errorDetail.code === 10 || (errorDetail.code === 200 && errorDetail.message.toLowerCase().includes('permission'))) {
                    bail(new Error(`Permissão insuficiente insights conta (${errorDetail.code}): ${errorDetail.message}`)); return;
                }
                if (errorDetail.code === 100 && errorDetail.message.toLowerCase().includes('metric')) {
                    bail(new Error(`Métrica inválida solicitada para insights de conta: ${errorDetail.message}`)); return;
                }
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    bail(new Error(`Falha insights conta (Erro ${response.status}): ${errorDetail.message}`)); return;
                }
                throw new Error(`Erro temp (${response.status}) insights conta: ${errorDetail.message}`);
            } return data;
        }, RETRY_OPTIONS);

        const insights: Partial<IAccountInsightsPeriod> = { period: period };
        if (responseData?.data) {
            responseData.data.forEach(item => {
                const metricName = item.name as keyof IAccountInsightsPeriod;
                if (item.values && item.values.length > 0) {
                    const valueData = item.values[0]?.value;
                    if (typeof valueData === 'number') { insights[metricName] = valueData; }
                    else if (typeof valueData === 'object' && valueData !== null) { insights[metricName] = valueData as any; }
                }
            });
        }
        logger.debug(`${TAG} Insights conta ${accountId} (${period}) OK.`);
        return { success: true, data: insights as IAccountInsightsPeriod };
    } catch (error: unknown) {
        logger.error(`${TAG} Erro final insights Conta ${accountId}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        const permissionErrorKeywords = ['permissão', 'permission', '(#10)', '(#200)'];
        const isPermError = permissionErrorKeywords.some(keyword => message.toLowerCase().includes(keyword.toLowerCase()));

        if (isPermError || message.toLowerCase().includes('token') || message.toLowerCase().includes('falha') || message.toLowerCase().includes('métrica inválida')) {
            return { success: false, error: message };
        }
        return { success: false, error: `Erro interno insights conta: ${message}` };
    }
}

export async function fetchAudienceDemographics(
    accountId: string,
    accessToken: string
): Promise<FetchInsightsResult<IAudienceDemographics>> {
    const TAG = '[fetchAudienceDemographics v2.0.2]'; // Versão atualizada com correção
    logger.debug(`${TAG} Buscando dados demográficos da conta ${accountId}... (Token: ${accessToken === process.env.FB_SYSTEM_USER_TOKEN ? 'System User' : 'User LLAT'})`);
    if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
    if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

    const metricsCsv = DEMOGRAPHICS_METRICS;
    const period = 'lifetime';
    const breakdown = DEMOGRAPHICS_BREAKDOWNS;
    const timeframe = DEMOGRAPHICS_TIMEFRAME;
    let urlBase = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${metricsCsv}&period=${period}&breakdown=${breakdown}&timeframe=${timeframe}`;

    const isSystemToken = accessToken === process.env.FB_SYSTEM_USER_TOKEN;
    if (isSystemToken) {
        const requestedMetricsArray = metricsCsv.split(',');
        const hasTotalValueMetrics = requestedMetricsArray.some(metric =>
            DEMOGRAPHICS_REQUIRING_TOTAL_VALUE.includes(metric)
        );
        if (hasTotalValueMetrics) {
            urlBase += `&metric_type=total_value`;
            logger.debug(`${TAG} Adicionado '&metric_type=total_value' para System Token.`);
        }
    }

    try {
        const responseDataFromApi = await retry(async (bail, attemptNum): Promise<(InstagramApiResponse<InstagramApiDemographicItem> & FacebookApiError) | null> => {
            const currentUrl = `${urlBase}&access_token=${accessToken}`;
            if (attemptNum > 1) { logger.warn(`${TAG} Tentativa ${attemptNum} demografia conta ${accountId}. URL: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
            else { logger.debug(`${TAG} URL da API: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
            
            const response: FetchResponse = await fetch(currentUrl);
            
            if (!response.headers.get('content-type')?.includes('application/json')) {
                const responseText = await response.text().catch(() => 'Falha ao ler corpo da resposta não-JSON.');
                logger.error(`${TAG} Resposta não-JSON (Status: ${response.status}, Tentativa: ${attemptNum}) para demografia conta ${accountId}. Conteúdo: ${responseText}`);
                bail(new Error(`Resposta não-JSON da API (Status: ${response.status})`)); 
                return null;
            }

            const data: InstagramApiResponse<InstagramApiDemographicItem> & FacebookApiError = await response.json();
            
            if (!response.ok || data.error) {
                const errorDetail = data.error || { message: `Erro ${response.status} API`, code: response.status, fbtrace_id: 'N/A', type: 'HttpError' };
                logger.error(`${TAG} Erro API (Tentativa ${attemptNum}) demografia conta ${accountId}:`, JSON.stringify(errorDetail));

                if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) {
                    bail(new Error(`Token inválido/expirado demografia: ${errorDetail.message}`)); return null;
                }
                if (errorDetail.code === 10 || (errorDetail.code === 200 && errorDetail.message.toLowerCase().includes('permission')) || (errorDetail.code === 80004 && errorDetail.message.toLowerCase().includes('not enough data'))) {
                    logger.warn(`${TAG} Permissão/Dados insuficientes (${errorDetail.code}) para demografia da conta ${accountId}. Detalhe: ${errorDetail.message}`);
                    bail(new Error(`Demographics unavailable or insufficient data (${errorDetail.code}): ${errorDetail.message}`)); 
                    return null;
                }
                if (errorDetail.code === 100 && errorDetail.message.toLowerCase().includes('metric')) {
                    bail(new Error(`Métrica inválida solicitada para demografia: ${errorDetail.message}`)); return null;
                }
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    bail(new Error(`Falha demografia (Erro ${response.status}): ${errorDetail.message}`)); return null;
                }
                throw new Error(`Erro temp (${response.status}) demografia: ${errorDetail.message}`);
            }
            // Retorna o objeto 'data' completo da API, mesmo que data.data seja vazio.
            return data; 
        }, RETRY_OPTIONS);

        // Se retry chamou bail(new Error(...)) e retornou null
        if (responseDataFromApi === null) {
            logger.warn(`${TAG} Concluído sem dados demográficos para conta ${accountId} (provavelmente erro 10/200/80004 da API ou resposta não-JSON).`);
            return { success: true, data: {}, errorMessage: 'Dados demográficos insuficientes ou indisponíveis.' };
        }
        
        // Agora responseDataFromApi é do tipo (InstagramApiResponse<InstagramApiDemographicItem> & FacebookApiError)
        // e não é null.
        if (!responseDataFromApi.data || responseDataFromApi.data.length === 0) {
            logger.warn(`${TAG} Demografia OK, mas 'data' array estava vazio para conta ${accountId}.`);
            return { success: true, data: {}, errorMessage: 'Dados demográficos não encontrados para esta conta.' };
        }

        const demographics: Partial<IAudienceDemographics> = {};
        // A verificação de responseDataFromApi.data já foi feita acima.
        responseDataFromApi.data.forEach(item => {
            const metricName = item.name;
            const targetKey = metricName as keyof IAudienceDemographics;
            if (item.values?.[0]?.value && typeof item.values[0].value === 'object') {
                const breakdownData = item.values[0].value;
                const parsedBreakdowns: any = {};
                for (const breakdownKey in breakdownData) {
                    if (Object.prototype.hasOwnProperty.call(breakdownData, breakdownKey)) {
                        const subBreakdownMap = breakdownData[breakdownKey as keyof typeof breakdownData];
                        if (typeof subBreakdownMap === 'object' && subBreakdownMap !== null) {
                            const breakdownArray: IDemographicBreakdown[] = Object.entries(subBreakdownMap)
                                .filter(([_, count]) => typeof count === 'number')
                                .map(([val, count]) => ({ value: val, count: count as number }));
                            if (breakdownArray.length > 0) {
                                if (['city', 'country', 'age', 'gender'].includes(breakdownKey)) {
                                    parsedBreakdowns[breakdownKey] = breakdownArray;
                                } else {
                                    logger.warn(`${TAG} Chave de breakdown demográfico inesperada '${breakdownKey}' encontrada em '${metricName}'.`);
                                }
                            }
                        }
                    }
                }
                if (Object.keys(parsedBreakdowns).length > 0) {
                    demographics[targetKey] = parsedBreakdowns;
                }
            } else {
                logger.warn(`${TAG} Item demográfico '${metricName}' para conta ${accountId} sem dados válidos ou em formato inesperado.`);
            }
        });
        
        const hasData = demographics.follower_demographics || demographics.engaged_audience_demographics;
        logger.debug(`${TAG} Demografia processada para conta ${accountId}. ${hasData ? 'Dados OK.' : 'Dados não disponíveis.'}`);
        return { success: true, data: demographics as IAudienceDemographics, errorMessage: hasData ? undefined : 'Dados demográficos insuficientes ou indisponíveis.' };
    } catch (error: unknown) {
        logger.error(`${TAG} Erro final na busca de demografia para Conta ${accountId}:`, error);
        const message = error instanceof Error ? error.message : String(error);
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
    const TAG = '[fetchBasicAccountData v2.0]';
    logger.debug(`${TAG} Buscando dados básicos da conta ${accountId}...`);
    if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
    if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };
    const fields = BASIC_ACCOUNT_FIELDS;
    const urlBase = `${BASE_URL}/${API_VERSION}/${accountId}?fields=${fields}`;
    try {
        const responseData = await retry(async (bail, attemptNum) => {
            const currentUrl = `${urlBase}&access_token=${accessToken}`;
            if (attemptNum > 1) { logger.warn(`${TAG} Tentativa ${attemptNum} dados básicos conta ${accountId}. URL: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
            else { logger.debug(`${TAG} URL da API: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
            const response: FetchResponse = await fetch(currentUrl);
            const data: any & FacebookApiError = await response.json();
            if (!response.ok || data.error) {
                const errorDetail = data.error || { message: `Erro ${response.status} API`, code: response.status, fbtrace_id: 'N/A', type: 'HttpError' };
                logger.error(`${TAG} Erro API (Tentativa ${attemptNum}) dados básicos conta ${accountId}:`, JSON.stringify(errorDetail));

                if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) {
                    bail(new Error(`Token inválido/expirado dados básicos: ${errorDetail.message}`)); return;
                }
                if (errorDetail.code === 10 || (errorDetail.code === 200 && errorDetail.message.toLowerCase().includes('permission'))) {
                    bail(new Error(`Permissão insuficiente dados básicos (${errorDetail.code}): ${errorDetail.message}`)); return;
                }
                if (response.status === 400 && !isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) {
                     logger.warn(`${TAG} Erro 400 (Client Error não relacionado a token) não recuperável. Não tentar novamente. Detalhe: ${errorDetail.message}`);
                     bail(new Error(`Falha dados básicos (Erro 400): ${errorDetail.message}`));
                     return;
                }
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    bail(new Error(`Falha dados básicos (Erro ${response.status}): ${errorDetail.message}`)); return;
                }
                throw new Error(`Erro temp (${response.status}) dados básicos: ${errorDetail.message}`);
            } return data;
        }, RETRY_OPTIONS);

        const accountData: Partial<IUser> = {};
        const requestedFieldsArray = fields.split(',');
        requestedFieldsArray.forEach(field => {
            if (responseData && responseData[field] !== undefined) {
                if (field === 'id') {
                    accountData['instagramAccountId'] = responseData[field];
                } else {
                    const userSchemaFields = Object.keys(DbUser.schema.paths);
                    const knownBasicFields = ['username', 'name', 'biography', 'website', 'profile_picture_url', 'followers_count', 'follows_count', 'media_count'];
                    if (userSchemaFields.includes(field) || knownBasicFields.includes(field)) {
                        (accountData as any)[field] = responseData[field];
                    } else {
                        logger.debug(`${TAG} Campo '${field}' retornado pela API mas não mapeado diretamente na interface IUser ou campos básicos conhecidos.`);
                    }
                }
            }
        });
        logger.debug(`${TAG} Dados básicos conta ${accountId} OK.`, accountData);
        return { success: true, data: accountData };
    } catch (error: unknown) {
        logger.error(`${TAG} Erro final dados básicos Conta ${accountId}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        const permissionErrorKeywords = ['permissão', 'permission', '(#10)', '(#200)'];
        const isPermError = permissionErrorKeywords.some(keyword => message.toLowerCase().includes(keyword.toLowerCase()));

        if (isPermError || message.toLowerCase().includes('token') || message.toLowerCase().includes('falha') || message.startsWith('Falha dados básicos (Erro 400)')) {
            return { success: false, error: message };
        }
        return { success: false, error: `Erro interno dados básicos conta: ${message}` };
    }
}

export async function clearInstagramConnection(userId: string | mongoose.Types.ObjectId): Promise<void> {
    const TAG = '[clearInstagramConnection v2.0]';
    logger.warn(`${TAG} Limpando dados de conexão Instagram para User ${userId}...`);
    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido: ${userId}`);
        return;
    }
    try {
        await connectToDatabase();
        const updateFields = {
            $set: {
                isInstagramConnected: false,
                lastInstagramSyncAttempt: new Date(),
                lastInstagramSyncSuccess: false,
                instagramSyncErrorMsg: "A conexão com o Instagram foi desfeita ou o token tornou-se inválido. Por favor, reconecte.",
            },
            $unset: {
                instagramAccessToken: "",
                instagramAccountId: "",
                username: "",
                profile_picture_url: "",
                followers_count: "",
                media_count: "",
                biography: "",
                website: "",
            }
        };
        await DbUser.findByIdAndUpdate(userId, updateFields);
        logger.info(`${TAG} Dados de conexão Instagram limpos no DB para User ${userId}.`);
    } catch (error) {
        logger.error(`${TAG} Erro ao limpar dados de conexão Instagram no DB para User ${userId}:`, error);
    }
}

interface InsightTaskSkippedResult {
    mediaId: string;
    status: 'skipped';
    reason: string;
    media: InstagramMedia;
    insightsResult: { success: false; error: string; data?: undefined; errorMessage?: undefined };
    insightTokenSource?: undefined;
};

interface InsightTaskProcessedResult {
    mediaId: string;
    status: 'processed';
    reason?: undefined;
    media: InstagramMedia;
    insightsResult: FetchInsightsResult<IMetricStats>;
    insightTokenSource: string;
};
type InsightTaskInternalResult = InsightTaskSkippedResult | InsightTaskProcessedResult;

async function updateUserBasicInstagramProfile(
    userId: Types.ObjectId,
    accountId: string,
    basicProfileData: Partial<IUser>
): Promise<void> {
    const TAG = '[updateUserBasicInstagramProfile v2.0]';
    if (!basicProfileData || Object.keys(basicProfileData).length === 0) {
        logger.debug(`${TAG} Nenhum dado básico de perfil fornecido para User ${userId}. Pulando atualização.`);
        return;
    }

    const updatePayload: Partial<IUser> = {};
    if (basicProfileData.username !== undefined) updatePayload.username = basicProfileData.username;
    if (basicProfileData.name !== undefined) updatePayload.name = basicProfileData.name;
    if (basicProfileData.profile_picture_url !== undefined) updatePayload.profile_picture_url = basicProfileData.profile_picture_url;
    if (basicProfileData.followers_count !== undefined) updatePayload.followers_count = basicProfileData.followers_count;
    if (basicProfileData.media_count !== undefined) updatePayload.media_count = basicProfileData.media_count;
    if (basicProfileData.biography !== undefined) updatePayload.biography = basicProfileData.biography;
    if (basicProfileData.website !== undefined) updatePayload.website = basicProfileData.website;

    if (Object.keys(updatePayload).length === 0) {
        logger.debug(`${TAG} Nenhum campo mapeável de basicProfileData para User ${userId}. Pulando atualização.`);
        return;
    }
    (updatePayload as any).updatedAt = new Date();

    try {
        await connectToDatabase();
        logger.debug(`${TAG} Atualizando dados básicos do perfil IG para User ${userId}, Conta IG ${accountId} com payload:`, updatePayload);
        await DbUser.findByIdAndUpdate(userId, { $set: updatePayload });
        logger.info(`${TAG} Dados básicos do perfil Instagram para User ${userId} atualizados no DB.`);
    } catch (error) {
        logger.error(`${TAG} Erro ao atualizar dados básicos do perfil Instagram para User ${userId}:`, error);
    }
}

// src/app/lib/instagramService.ts - v2.0.3 (Resolução Problemas Sincronização - Completo e Corrigido)
// Parte 3: Função triggerDataRefresh completa e funções auxiliares restantes.
// - CORREÇÃO DE TIPO (triggerDataRefresh): Adicionada verificação para 'errorToReport' antes de acessar propriedades.
// - Mantém todas as outras funcionalidades e correções da v2.0.2.

// (Importações e constantes das Partes 1 e 2 são omitidas aqui para brevidade, mas fazem parte do arquivo completo)
// ... (Conteúdo das Partes 1 e 2 do instagramService.ts v2.0.2) ...
// As funções fetchAccountInsights, fetchAudienceDemographics, fetchBasicAccountData, clearInstagramConnection,
// updateUserBasicInstagramProfile, e os tipos InsightTaskInternalResult já foram definidos nas partes anteriores.

export async function triggerDataRefresh(userId: string): Promise<{ success: boolean; message: string; details?: any }> {
    const TAG = '[triggerDataRefresh v2.0.3]'; // Versão atualizada
    const startTime = Date.now();
    logger.info(`${TAG} Iniciando atualização de dados para User ${userId}...`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido: ${userId}`);
        return { success: false, message: 'ID de usuário inválido.' };
    }
    const userObjectId = new Types.ObjectId(userId);

    let userLlat: string | null = null;
    let systemToken: string | null = process.env.FB_SYSTEM_USER_TOKEN || null;
    let tokenInUse: string | null = null; 
    let tokenTypeForLog: string = 'N/A';
    let initialTokenTypeForLog: string = 'N/A';
    let userFacingErrorForTokenProblem: string | null = null;

    let accountId: string | null = null;

    try {
        await connectToDatabase();
        const connectionDetails = await getInstagramConnectionDetails(userObjectId);

        if (!connectionDetails?.accountId) {
            logger.error(`${TAG} Usuário ${userId} não conectado ou accountId ausente no DB. Abortando refresh.`);
            await DbUser.findByIdAndUpdate(userObjectId, {
                $set: {
                    lastInstagramSyncAttempt: new Date(),
                    lastInstagramSyncSuccess: false,
                    instagramSyncErrorMsg: "Usuário não conectado ou ID da conta Instagram não encontrado no sistema."
                }
            }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (conexão inválida) ${userId}:`, dbErr));
            return { success: false, message: 'Usuário não conectado ou ID da conta Instagram não encontrado.' };
        }
        accountId = connectionDetails.accountId;
        userLlat = connectionDetails.accessToken;

        if (userLlat) {
            tokenInUse = userLlat;
            tokenTypeForLog = 'User LLAT from DB';
        } else if (systemToken) {
            tokenInUse = systemToken;
            tokenTypeForLog = 'System User Token (User LLAT not in DB)';
            logger.warn(`${TAG} LLAT do usuário ${userId} não encontrado no DB; usando ${tokenTypeForLog} como fallback inicial.`);
        } else {
            tokenTypeForLog = 'No Token Available';
            logger.error(`${TAG} LLAT do usuário ${userId} E System Token não encontrados. Abortando refresh.`);
            await DbUser.findByIdAndUpdate(userObjectId, {
                $set: {
                    lastInstagramSyncAttempt: new Date(),
                    lastInstagramSyncSuccess: false,
                    instagramSyncErrorMsg: "Nenhum token de acesso (nem do usuário, nem do sistema) disponível para realizar a sincronização."
                }
            }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (token ausente) ${userId}:`, dbErr));
            return { success: false, message: 'Token de acesso necessário não encontrado (nem LLAT, nem System User).' };
        }
        initialTokenTypeForLog = tokenTypeForLog;
        logger.info(`${TAG} Token inicial para refresh: ${initialTokenTypeForLog} (User ID: ${userId}, Account ID: ${accountId})`);

    } catch (dbError) {
        logger.error(`${TAG} Erro ao buscar dados iniciais do usuário ${userId} no DB:`, dbError);
        return { success: false, message: 'Erro ao acessar dados do usuário no banco de dados.' };
    }

    await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncAttempt: new Date(), instagramSyncErrorMsg: null } })
        .catch(dbErr => logger.error(`${TAG} Falha ao atualizar início sync ${userId}:`, dbErr));

    let totalMediaFound = 0, totalMediaProcessed = 0, collectedMediaInsights = 0, savedMediaMetrics = 0, skippedOldMedia = 0;
    let collectedAccountInsights = false, savedAccountInsights = false, collectedDemographics = false;
    let savedDemographics = false, collectedBasicAccountData = false;
    let errors: { step: string; message: string; details?: any, tokenUsed?: string }[] = [];
    let mediaCurrentPage = 0; let hasMoreMediaPages = true; let overallSuccess = true;
    let criticalTokenErrorOccurred = false;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - INSIGHT_FETCH_CUTOFF_DAYS);
    logger.info(`${TAG} Buscará insights/atualizará métricas apenas para posts desde: ${cutoffDate.toISOString().split('T')[0]}`);

    const isPermissionError = (errorMessage?: string): boolean => {
        if (!errorMessage) return false;
        const lowerError = errorMessage.toLowerCase();
        const keywords = ['permission', '(#10)', '(#200)'];
        return keywords.some(kw => lowerError.includes(kw));
    };

    try {
        // STEP 1: Fetch Basic Account Data
        logger.info(`${TAG} [Step 1/3] Buscando dados básicos da conta ${accountId}... (Usando token inicial: ${initialTokenTypeForLog})`);
        let basicAccountData: Partial<IUser> | undefined;
        let currentFetchTokenForStep1 = tokenInUse;
        let currentFetchTokenTypeForStep1 = tokenTypeForLog;

        let basicDataResult = await fetchBasicAccountData(accountId!, currentFetchTokenForStep1!);
        let basicDataTokenSource = currentFetchTokenTypeForStep1;

        if (!basicDataResult.success && (isPermissionError(basicDataResult.error) || isTokenInvalidError(undefined, undefined, basicDataResult.error)) && currentFetchTokenForStep1 === userLlat && systemToken) {
            logger.warn(`${TAG} Falha ao buscar dados básicos com User LLAT (Erro: ${basicDataResult.error}). Tentando com System User Token...`);
            currentFetchTokenForStep1 = systemToken;
            basicDataResult = await fetchBasicAccountData(accountId!, currentFetchTokenForStep1);
            if (basicDataResult.success) {
                basicDataTokenSource = 'System User Token (fallback)';
                logger.info(`${TAG} Sucesso ao buscar dados básicos com ${basicDataTokenSource}.`);
            } else {
                logger.error(`${TAG} Falha ao buscar dados básicos mesmo com System User Token (fallback): ${basicDataResult.error}`);
            }
        }

        if (basicDataResult.success && basicDataResult.data) {
            collectedBasicAccountData = true;
            basicAccountData = basicDataResult.data;
            logger.info(`${TAG} Dados básicos obtidos com sucesso usando ${basicDataTokenSource}.`);
            await updateUserBasicInstagramProfile(userObjectId, accountId!, basicAccountData);
        } else {
            logger.error(`${TAG} Falha final ao obter dados básicos (Token usado: ${basicDataTokenSource}): ${basicDataResult.error}`);
            errors.push({ step: 'fetchBasicAccountData', message: basicDataResult.error ?? 'Erro desconhecido', tokenUsed: basicDataTokenSource });
            if (tokenInUse === userLlat && isTokenInvalidError(undefined, undefined, basicDataResult.error)) {
                logger.error(`${TAG} Erro crítico de token User LLAT ao buscar dados básicos: ${basicDataResult.error}. Limpando conexão.`);
                userFacingErrorForTokenProblem = "Seu token de acesso ao Instagram expirou ou foi revogado. Por favor, reconecte sua conta.";
                await clearInstagramConnection(userObjectId);
                criticalTokenErrorOccurred = true;
                overallSuccess = false;
            } else if (tokenInUse === userLlat && isPermissionError(basicDataResult.error) ) {
                 logger.error(`${TAG} Erro crítico de permissão com User LLAT ao buscar dados básicos: ${basicDataResult.error}.`);
                 userFacingErrorForTokenProblem = "Faltam permissões para acessar os dados básicos da sua conta Instagram. Por favor, reconecte e aprove todas as permissões.";
                 criticalTokenErrorOccurred = true;
                 overallSuccess = false;
            }
        }

        // STEP 2: Fetch Media
        logger.info(`${TAG} [Step 2/3] Iniciando busca de mídias (limite ${MAX_PAGES_MEDIA} pgs)...`);
        if (criticalTokenErrorOccurred || !userLlat) {
            logger.warn(`${TAG} Pulando busca de mídias devido a erro crítico anterior de token User LLAT ou ausência de User LLAT.`);
            hasMoreMediaPages = false;
            if (!criticalTokenErrorOccurred && !userLlat) {
                 errors.push({ step: 'fetchInstagramMedia', message: 'User LLAT não disponível para buscar mídias.', tokenUsed: 'N/A' });
            }
        } else {
            logger.info(`${TAG} fetchInstagramMedia utilizando exclusivamente User LLAT. Sem fallback para System Token para esta etapa.`);
            let mediaTokenForListing = userLlat;
            let mediaTokenListingTypeLog = 'User LLAT from DB';

            let nextPageMediaUrl: string | null | undefined = undefined;
            mediaCurrentPage = 0;
            do {
                mediaCurrentPage++;
                const pageStartTime = Date.now();
                logger.info(`${TAG} Processando pág ${mediaCurrentPage}/${MAX_PAGES_MEDIA} de mídias... (Token: ${mediaTokenListingTypeLog})`);
                
                const mediaResult = await fetchInstagramMedia(accountId!, mediaTokenForListing!, nextPageMediaUrl ?? undefined);

                if (!mediaResult.success) {
                    logger.error(`${TAG} Falha busca pág ${mediaCurrentPage} mídias (Token usado: ${mediaTokenListingTypeLog}): ${mediaResult.error}`);
                    errors.push({ step: 'fetchInstagramMedia', message: `Pág ${mediaCurrentPage}: ${mediaResult.error ?? 'Erro desconhecido'}`, tokenUsed: mediaTokenListingTypeLog });
                    if (isTokenInvalidError(undefined, undefined, mediaResult.error)) {
                        logger.error(`${TAG} Erro crítico de token User LLAT durante listagem de mídias: ${mediaResult.error}. Limpando conexão.`);
                        userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram expirou ou foi revogado durante a busca de mídias. Por favor, reconecte sua conta.";
                        await clearInstagramConnection(userObjectId);
                        criticalTokenErrorOccurred = true;
                        overallSuccess = false;
                    }
                    hasMoreMediaPages = false;
                    if (!criticalTokenErrorOccurred) overallSuccess = false;
                    break; 
                }

                const mediaInPage = mediaResult.data ?? [];
                totalMediaFound += mediaInPage.length;

                if (mediaInPage.length > 0 && !criticalTokenErrorOccurred) {
                    const processableMedia = mediaInPage.filter(m => m.media_type !== 'STORY');
                    logger.info(`${TAG} Pág ${mediaCurrentPage}: ${processableMedia.length} mídias processáveis (não-Story).`);

                    const recentProcessableMedia = processableMedia.filter(media => {
                        if (!media.timestamp) return false;
                        const postDate = new Date(media.timestamp);
                        if (postDate >= cutoffDate) { return true; }
                        else { skippedOldMedia++; logger.debug(`${TAG} Pulando insights/save para mídia antiga ${media.id} (Data: ${postDate.toISOString().split('T')[0]})`); return false; }
                    });
                    totalMediaProcessed += recentProcessableMedia.length;

                    if (recentProcessableMedia.length > 0) {
                        logger.info(`${TAG} Pág ${mediaCurrentPage}: ${recentProcessableMedia.length} mídias recentes para buscar insights...`);
                        
                        const insightTasks = recentProcessableMedia.map(media => limitInsightsFetch(async (): Promise<InsightTaskInternalResult> => {
                            if (!media.id) return { mediaId: media.id ?? '?', status: 'skipped', reason: 'ID da mídia ausente', media, insightsResult: { success: false, error: 'ID da mídia ausente' } };
                            
                            let insightTokenForThisMediaAttempt = userLlat;
                            let insightTokenSource = 'User LLAT from DB';
                            let usedSystemTokenForThisMedia = false;

                            if (!insightTokenForThisMediaAttempt) {
                                if (systemToken) {
                                    logger.warn(`${TAG} User LLAT indisponível para insights da mídia ${media.id}. Tentando com System User Token.`);
                                    insightTokenForThisMediaAttempt = systemToken;
                                    insightTokenSource = 'System User Token (User LLAT missing for media insight)';
                                    usedSystemTokenForThisMedia = true;
                                } else {
                                    return { mediaId: media.id, status: 'skipped', reason: 'Nenhum token disponível para insights da mídia', media, insightsResult: { success: false, error: 'Nenhum token disponível' } };
                                }
                            }

                            let currentMetricsToFetch: string;
                            if (media.media_type === 'VIDEO') {
                                const reelMetricsSet = new Set(REEL_SAFE_GENERAL_METRICS.split(',').map(s => s.trim()).filter(s => s));
                                REEL_SPECIFIC_INSIGHTS_METRICS.split(',').map(s => s.trim()).filter(s => s).forEach(metric => reelMetricsSet.add(metric));
                                currentMetricsToFetch = Array.from(reelMetricsSet).join(',');
                            } else {
                                currentMetricsToFetch = MEDIA_INSIGHTS_METRICS;
                            }
                            logger.debug(`${TAG} Mídia ${media.id} (tipo: ${media.media_type}) usando métricas: ${currentMetricsToFetch}. Token inicial para insights: ${insightTokenSource}`);

                            let insightsFetchAttempt = await fetchMediaInsights(media.id, insightTokenForThisMediaAttempt!, currentMetricsToFetch);

                            if (!insightsFetchAttempt.success && (isPermissionError(insightsFetchAttempt.error) || isTokenInvalidError(undefined,undefined,insightsFetchAttempt.error)) && insightTokenForThisMediaAttempt === userLlat && systemToken) {
                                logger.warn(`${TAG} Falha ao buscar insights para mídia ${media.id} com User LLAT (Erro: ${insightsFetchAttempt.error}). Tentando com System User Token...`);
                                insightsFetchAttempt = await fetchMediaInsights(media.id, systemToken, currentMetricsToFetch);
                                if (insightsFetchAttempt.success) {
                                    insightTokenSource = 'System User Token (fallback)';
                                    usedSystemTokenForThisMedia = true;
                                    logger.info(`${TAG} Sucesso ao buscar insights para mídia ${media.id} com ${insightTokenSource}.`);
                                } else {
                                    logger.error(`${TAG} Falha ao buscar insights para mídia ${media.id} mesmo com System User Token: ${insightsFetchAttempt.error}`);
                                }
                            }

                            if (!insightsFetchAttempt.success && insightsFetchAttempt.error) {
                                if (isTokenInvalidError(undefined,undefined,insightsFetchAttempt.error)) {
                                    if (insightTokenForThisMediaAttempt === userLlat && !usedSystemTokenForThisMedia) {
                                        logger.error(`${TAG} Erro crítico de token User LLAT para mídia ${media.id} com ${insightTokenSource}: ${insightsFetchAttempt.error}. Sinalizando para interromper.`);
                                        userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || `Seu token de acesso ao Instagram expirou ou se tornou inválido durante a busca de insights de mídias. Por favor, reconecte. (Mídia: ${media.id})`;
                                        throw new Error(`Token error on media ${media.id} with ${insightTokenSource}`);
                                    } else if (usedSystemTokenForThisMedia) {
                                        logger.error(`${TAG} System User Token falhou com erro de token para mídia ${media.id}: ${insightsFetchAttempt.error}. Isso é inesperado.`);
                                    }
                                }
                            }
                            return { mediaId: media.id, media, insightsResult: insightsFetchAttempt, insightTokenSource, status: 'processed' };
                        }));

                        const insightTaskResults = await Promise.allSettled(insightTasks);
                        for (const result of insightTaskResults) {
                            if (result.status === 'fulfilled') {
                                const taskValue = result.value;
                                if (taskValue.status === 'processed') {
                                    const { mediaId, media, insightsResult, insightTokenSource } = taskValue;
                                    if (insightsResult.success && insightsResult.data) {
                                        logger.info(`${TAG} Insights para mídia ${mediaId} obtidos com sucesso usando: ${insightTokenSource}.`);
                                        collectedMediaInsights++;
                                        try {
                                            await saveMetricData(userObjectId, media, insightsResult.data);
                                            savedMediaMetrics++;
                                        } catch (saveError: any) {
                                            logger.error(`${TAG} Erro ao salvar métrica ${mediaId}:`, saveError);
                                            errors.push({ step: 'saveMetricData', message: `Salvar métrica ${mediaId}: ${saveError.message}`, tokenUsed: insightTokenSource });
                                        }
                                    } else if (insightsResult.success) {
                                        logger.warn(`${TAG} Insights para mídia ${mediaId} obtidos (usando: ${insightTokenSource}), mas sem dados.`);
                                    } else {
                                        logger.warn(`${TAG} Falha ao buscar insights mídia ${mediaId} (Token usado: ${insightTokenSource}): ${insightsResult.error || 'Erro desconhecido'}`);
                                        errors.push({ step: 'fetchMediaInsights', message: `Insights mídia ${mediaId}: ${insightsResult.error || 'Erro desconhecido'}`, tokenUsed: insightTokenSource });
                                    }
                                } else if (taskValue.status === 'skipped') {
                                    logger.warn(`${TAG} Tarefa de insight para mídia ${taskValue.mediaId} pulada: ${taskValue.reason}`);
                                }
                            } else if (result.status === 'rejected') {
                                const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
                                if (errorMsg.includes('Token error on media')) {
                                    logger.error(`${TAG} Erro de token irrecuperável detectado nos insights de mídia: ${errorMsg}. Interrompendo sincronização.`);
                                    if (userLlat && !criticalTokenErrorOccurred) {
                                         await clearInstagramConnection(userObjectId);
                                    }
                                    criticalTokenErrorOccurred = true;
                                    overallSuccess = false; hasMoreMediaPages = false; break;
                                } else {
                                    logger.error(`${TAG} Erro não tratado em tarefa de insight de mídia: ${errorMsg}`);
                                    errors.push({ step: 'fetchMediaInsights', message: `Erro tarefa insight mídia: ${errorMsg}` });
                                }
                            }
                        }
                        if (criticalTokenErrorOccurred) break;
                    } else {
                        logger.info(`${TAG} Pág ${mediaCurrentPage}: Nenhuma mídia RECENTE para processar insights.`);
                    }
                } else if (criticalTokenErrorOccurred) {
                     logger.warn(`${TAG} Pulando processamento de insights da pág ${mediaCurrentPage} por erro crítico de token anterior.`);
                     break;
                } else {
                     logger.info(`${TAG} Pág ${mediaCurrentPage}: Nenhuma mídia encontrada.`);
                }
                nextPageMediaUrl = mediaResult.nextPageUrl;
                if (!nextPageMediaUrl) hasMoreMediaPages = false;
                logger.info(`${TAG} Pág ${mediaCurrentPage} mídias processada em ${Date.now() - pageStartTime}ms.`);
                if (hasMoreMediaPages && mediaCurrentPage < MAX_PAGES_MEDIA && !criticalTokenErrorOccurred) await new Promise(r => setTimeout(r, DELAY_MS));

            } while (hasMoreMediaPages && mediaCurrentPage < MAX_PAGES_MEDIA && !criticalTokenErrorOccurred);
        }

        if (!criticalTokenErrorOccurred && mediaCurrentPage >= MAX_PAGES_MEDIA && hasMoreMediaPages) {
            errors.push({ step: 'fetchInstagramMedia', message: `Limite de ${MAX_PAGES_MEDIA} páginas de mídia atingido.` });
        }
        logger.info(`${TAG} Processamento de mídias concluído. ${skippedOldMedia} mídias antigas puladas (não buscará insights).`);

        // STEP 3: Fetch Account Insights and Demographics
        if (!criticalTokenErrorOccurred) {
            logger.info(`${TAG} [Step 3/3] Buscando insights/demografia da conta ${accountId}...`);
            let accountInsightData: IAccountInsightsPeriod | undefined;
            let audienceDemographicsData: IAudienceDemographics | undefined;
            const insightPeriod = DEFAULT_ACCOUNT_INSIGHTS_PERIOD;

            let tokenForAccountStep = userLlat; 
            let tokenTypeForAccountStepLog = 'User LLAT from DB';

            if (!tokenForAccountStep && systemToken) { 
                tokenForAccountStep = systemToken;
                tokenTypeForAccountStepLog = 'System User Token (User LLAT not available for Step 3)';
                logger.info(`${TAG} User LLAT não disponível para Step 3. Usando System Token.`);
            } else if (!tokenForAccountStep && !systemToken) {
                logger.error(`${TAG} Nenhum token (User LLAT ou System) disponível para Step 3. Pulando.`);
                errors.push({ step: 'AccountInsights/DemographicsSetup', message: 'Nenhum token disponível.', tokenUsed: 'N/A' });
                if(overallSuccess) overallSuccess = false;
            }
            
            if (tokenForAccountStep) {
                logger.info(`${TAG} Token para Step 3 (Insights/Demografia da Conta): ${tokenTypeForAccountStepLog}`);
                let accountInsightsResult = await fetchAccountInsights(accountId!, tokenForAccountStep, insightPeriod);
                let accountInsightsTokenSource = tokenTypeForAccountStepLog;

                if (!accountInsightsResult.success && (isPermissionError(accountInsightsResult.error) || isTokenInvalidError(undefined, undefined, accountInsightsResult.error)) && tokenForAccountStep === userLlat && systemToken) {
                    logger.warn(`${TAG} Falha ao buscar insights da conta com User LLAT (Erro: ${accountInsightsResult.error}). Tentando com System User Token...`);
                    accountInsightsResult = await fetchAccountInsights(accountId!, systemToken, insightPeriod);
                    if (accountInsightsResult.success) {
                        accountInsightsTokenSource = 'System User Token (fallback)';
                        logger.info(`${TAG} Sucesso ao buscar insights da conta com ${accountInsightsTokenSource}.`);
                    } else {
                        logger.error(`${TAG} Falha ao buscar insights da conta mesmo com System User Token: ${accountInsightsResult.error}`);
                    }
                }

                if (accountInsightsResult.success && accountInsightsResult.data) {
                    collectedAccountInsights = true;
                    accountInsightData = accountInsightsResult.data;
                    logger.info(`${TAG} Insights da conta obtidos com sucesso usando ${accountInsightsTokenSource}.`);
                } else {
                    errors.push({ step: 'fetchAccountInsights', message: `Insights conta: ${accountInsightsResult.error ?? 'Erro desconhecido'}`, tokenUsed: accountInsightsTokenSource });
                    if (isTokenInvalidError(undefined, undefined, accountInsightsResult.error) && tokenForAccountStep === userLlat) {
                        logger.error(`${TAG} Erro crítico de token User LLAT ao buscar insights da conta (Token usado: ${accountInsightsTokenSource}). Limpando conexão.`);
                        userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram expirou ou foi revogado. Por favor, reconecte sua conta.";
                        await clearInstagramConnection(userObjectId);
                        criticalTokenErrorOccurred = true;
                    }
                    if (!criticalTokenErrorOccurred) overallSuccess = false;
                }

                if (!criticalTokenErrorOccurred) { 
                    await new Promise(r => setTimeout(r, DELAY_MS));
                    let demographicsResult = await fetchAudienceDemographics(accountId!, tokenForAccountStep);
                    let demographicsTokenSource = tokenTypeForAccountStepLog;

                    if (!demographicsResult.success && (isPermissionError(demographicsResult.error) || isTokenInvalidError(undefined, undefined, demographicsResult.error)) && tokenForAccountStep === userLlat && systemToken) {
                        logger.warn(`${TAG} Falha ao buscar demografia com User LLAT (Erro: ${demographicsResult.error}). Tentando com System User Token...`);
                        demographicsResult = await fetchAudienceDemographics(accountId!, systemToken);
                        if (demographicsResult.success) {
                            demographicsTokenSource = 'System User Token (fallback)';
                            logger.info(`${TAG} Sucesso ao buscar demografia com ${demographicsTokenSource}.`);
                        } else {
                            logger.error(`${TAG} Falha ao buscar demografia mesmo com System User Token: ${demographicsResult.error}`);
                        }
                    }

                    collectedDemographics = true;
                    if (demographicsResult.success && demographicsResult.data && (demographicsResult.data.follower_demographics || demographicsResult.data.engaged_audience_demographics)) {
                        audienceDemographicsData = demographicsResult.data;
                        savedDemographics = true;
                        logger.info(`${TAG} Demografia obtida com sucesso usando ${demographicsTokenSource}.`);
                    } else {
                        const demoErrorMsg = demographicsResult.error || demographicsResult.errorMessage || 'Dados insuficientes/indisponíveis';
                        logger.warn(`${TAG} Falha ou dados insuficientes para demografia (Token usado: ${demographicsTokenSource}): ${demoErrorMsg}`);
                        errors.push({ step: 'fetchAudienceDemographics', message: `Demografia: ${demoErrorMsg}`, tokenUsed: demographicsTokenSource });
                        if (isTokenInvalidError(undefined, undefined, demographicsResult.error) && tokenForAccountStep === userLlat) {
                            logger.error(`${TAG} Erro crítico de token User LLAT ao buscar demografia (Token usado: ${demographicsTokenSource}). Limpando conexão.`);
                            userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram expirou ou foi revogado. Por favor, reconecte sua conta.";
                            await clearInstagramConnection(userObjectId);
                            criticalTokenErrorOccurred = true;
                        }
                         if (!criticalTokenErrorOccurred && demographicsResult.error) overallSuccess = false;
                    }
                } else {
                     logger.warn(`${TAG} Pulando busca de demografia devido a erro crítico anterior de token User LLAT.`);
                }

                if (!criticalTokenErrorOccurred && (accountInsightData || audienceDemographicsData || basicAccountData)) {
                    logger.info(`${TAG} Salvando snapshot da conta...`);
                    await saveAccountInsightData(userObjectId, accountId!, accountInsightData, audienceDemographicsData, basicAccountData);
                    savedAccountInsights = !!accountInsightData;
                } else if (criticalTokenErrorOccurred) {
                    logger.warn(`${TAG} Pulando save snapshot conta por erro crítico de token User LLAT.`);
                } else {
                    logger.warn(`${TAG} Nenhum dado novo de insights/demografia/básico da conta para salvar no snapshot.`);
                }
            }
        } else {
            logger.warn(`${TAG} Pulando Step 3 (Insights/Demografia da Conta) devido a erro crítico anterior de token User LLAT.`);
        }

        const duration = Date.now() - startTime;
        const finalSuccessStatus = !criticalTokenErrorOccurred && overallSuccess;

        let statusMsg = finalSuccessStatus ? 'concluída com sucesso' :
            (criticalTokenErrorOccurred ? 'concluída com erro crítico de token/permissão. Requer reconexão.' :
                (overallSuccess ? 'concluída com alguns erros não fatais' : 'concluída com falhas'));

        const summary = `Mídias Recentes Salvas/Atualizadas: ${savedMediaMetrics}/${totalMediaProcessed}. Mídias Antigas Puladas: ${skippedOldMedia}. Insights Conta: ${savedAccountInsights ? 'Salvo' : 'Não'}. Demo: ${savedDemographics ? 'Salva' : 'Não'}. Básicos: ${collectedBasicAccountData ? 'OK' : 'Falha'}.`;
        const errorSummary = errors.length > 0 ? `Erros (${errors.length}): ${errors.map(e => `${e.step} (Token: ${e.tokenUsed || initialTokenTypeForLog}): ${e.message.substring(0,100)}`).slice(0, 3).join('; ')}...` : 'Nenhum erro específico reportado.';
        
        let finalMessage = `Atualização ${statusMsg} para User ${userId}. ${summary}`;
        if (errors.length > 0 && !criticalTokenErrorOccurred) {
            finalMessage += ` ${errorSummary}`;
        }
        if (userFacingErrorForTokenProblem) {
            finalMessage = `${userFacingErrorForTokenProblem} Detalhes da tentativa de sincronização: ${finalMessage}`;
        }

        logger.info(`${TAG} Finalizado. User: ${userId}. Sucesso Efetivo: ${finalSuccessStatus}. Duração: ${duration}ms. ${finalMessage}`);
        if (errors.length > 0) {
          logger.warn(`${TAG} Detalhes completos dos erros (${errors.length}):`, JSON.stringify(errors.map(e => ({step: e.step, message: e.message, token: e.tokenUsed})), null, 2));
        }
        
        const finalDbUpdate: any = { $set: { lastInstagramSyncSuccess: finalSuccessStatus } };
        if (userFacingErrorForTokenProblem) {
            finalDbUpdate.$set.instagramSyncErrorMsg = userFacingErrorForTokenProblem;
        } else if (finalSuccessStatus) {
            finalDbUpdate.$set.instagramSyncErrorMsg = null;
        } else if (!finalSuccessStatus && errors.length > 0) {
            const firstSignificantError = errors.find(e => !(e.message.toLowerCase().includes("token") || e.message.toLowerCase().includes("permiss")));
            const errorToReport = firstSignificantError || errors[0];
            // >>> CORREÇÃO APLICADA AQUI <<<
            if (errorToReport) { // Garante que errorToReport não é undefined
                finalDbUpdate.$set.instagramSyncErrorMsg = `A sincronização falhou. Detalhe: ${errorToReport.step} - ${errorToReport.message.substring(0,150)}`;
            } else {
                // Caso improvável se errors.length > 0, mas adiciona um fallback
                finalDbUpdate.$set.instagramSyncErrorMsg = `A sincronização falhou com erros não especificados.`;
                logger.error(`${TAG} errorToReport foi inesperadamente undefined, apesar de errors.length > 0. Errors:`, JSON.stringify(errors));
            }
        }

        await DbUser.findByIdAndUpdate(userObjectId, finalDbUpdate)
            .catch(dbErr => logger.error(`${TAG} Falha ao atualizar status final sync e msg de erro para ${userId}:`, dbErr));

        return {
            success: finalSuccessStatus,
            message: finalMessage,
            details: {
                errors,
                durationMs: duration,
                savedMediaMetrics,
                totalMediaProcessed,
                skippedOldMedia,
                collectedAccountInsights,
                savedAccountInsights,
                collectedDemographics,
                savedDemographics,
                collectedBasicAccountData,
                criticalTokenErrorOccurred,
                initialTokenType: initialTokenTypeForLog
            }
        };

    } catch (error: unknown) { 
        const duration = Date.now() - startTime;
        logger.error(`${TAG} Erro CRÍTICO NÃO TRATADO durante refresh para ${userId}. Duração: ${duration}ms`, error);
        const message = error instanceof Error ? error.message : String(error);
        
        const errorToSave = userFacingErrorForTokenProblem || `Erro interno crítico durante a atualização: ${message.substring(0,200)}`;
        await DbUser.findByIdAndUpdate(userObjectId, {
            $set: {
                lastInstagramSyncSuccess: false,
                instagramSyncErrorMsg: errorToSave
            }
        }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (erro crítico não tratado) ${userId}:`, dbErr));
        
        return { success: false, message: `Erro interno crítico durante a atualização: ${message}` };
    }
} // Fim de triggerDataRefresh

// src/app/lib/instagramService.ts - v2.0.2 (Resolução Problemas Sincronização - Completo e Corrigido)
// Parte 4: Funções auxiliares restantes (fetchAvailableInstagramAccounts, connectInstagramAccount, etc.)
// - Mantém todas as funcionalidades e correções da v2.0.1 e v2.0.2.

// (Importações e constantes das Partes 1, 2 e 3 são omitidas aqui para brevidade, mas fazem parte do arquivo completo)
// ... (Conteúdo das Partes 1, 2 e 3 do instagramService.ts v2.0.2) ...
// A função triggerDataRefresh já foi completamente definida na Parte 3.

export async function fetchAvailableInstagramAccounts(
    shortLivedToken: string,
    userId: string
): Promise<FetchInstagramAccountsResult | FetchInstagramAccountsError> {
    const TAG = '[fetchAvailableInstagramAccounts v2.0]';
    logger.info(`${TAG} Iniciando busca de contas IG e LLAT User para User ID: ${userId}.`);
    if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) { const errorMsg = "FACEBOOK_CLIENT_ID ou FACEBOOK_CLIENT_SECRET não definidos."; logger.error(`${TAG} ${errorMsg}`); return { success: false, error: errorMsg }; }
    if (!mongoose.isValidObjectId(userId)) { const errorMsg = `ID de usuário inválido fornecido: ${userId}`; logger.error(`${TAG} ${errorMsg}`); return { success: false, error: errorMsg }; }
    if (!shortLivedToken) { const errorMsg = `Token de curta duração (shortLivedToken) não fornecido.`; logger.error(`${TAG} ${errorMsg}`); return { success: false, error: errorMsg }; }
    
    let userLongLivedAccessToken: string | null = null;
    const businessId = process.env.FACEBOOK_BUSINESS_ID;
    const systemUserToken = process.env.FB_SYSTEM_USER_TOKEN;
    type PageAccountData = { id: string; name: string; access_token?: string; instagram_business_account?: { id: string; username?: string; } };

    try {
        logger.debug(`${TAG} Tentando obter LLAT do usuário ${userId}...`);
        const llatUrl = `${BASE_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${shortLivedToken}`;
        try {
            const llatData = await retry(async (bail, attemptNum) => {
                if (attemptNum > 1) logger.warn(`${TAG} Tentativa ${attemptNum} para obter LLAT do usuário.`);
                const response: FetchResponse = await fetch(llatUrl);
                const data: any & FacebookApiError = await response.json();
                if (!response.ok || !data.access_token) {
                    const errorDetail = data.error || { message: `Erro ${response.status} ao obter LLAT`, code: response.status, fbtrace_id: 'N/A', type: 'HttpError' };
                    logger.error(`${TAG} Erro API (Tentativa ${attemptNum}) ao obter LLAT do usuário:`, JSON.stringify(errorDetail));
                    if (response.status === 400 || isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) {
                        bail(new Error(errorDetail.message || 'Falha ao obter token de longa duração (SLT inválido/expirado?).')); return;
                    }
                    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                        bail(new Error(errorDetail.message || `Falha não recuperável (${response.status}) ao obter LLAT.`)); return;
                    }
                    throw new Error(errorDetail.message || `Erro temporário ${response.status} ao obter LLAT.`);
                } return data;
            }, RETRY_OPTIONS);
            userLongLivedAccessToken = llatData.access_token;
            logger.info(`${TAG} LLAT do usuário ${userId} obtido com sucesso.`);
        } catch (llatError: any) {
            logger.error(`${TAG} Falha CRÍTICA ao obter LLAT do usuário ${userId}:`, llatError);
            if (llatError.message && (llatError.message.toLowerCase().includes('token') || isTokenInvalidError(undefined, undefined, llatError.message))) {
                logger.warn(`${TAG} Erro de token ao obter LLAT. Limpando conexão IG existente para User ${userId}.`);
                await clearInstagramConnection(userId); // Usa a versão atualizada que seta instagramSyncErrorMsg
            }
            return { success: false, error: `Falha ao obter token de acesso necessário: ${llatError.message}` };
        }

        if (businessId && systemUserToken) {
            logger.info(`${TAG} Utilizando fluxo primário via System User Token para listar contas.`);
            const systemUserAccessToken = systemUserToken;
            const allPagesData: PageAccountData[] = [];
            let currentPageUrl: string | null = `${BASE_URL}/${API_VERSION}/${businessId}/owned_pages?fields=id,name,access_token,instagram_business_account{id,username}&limit=100&access_token=${systemUserAccessToken}`;
            let pageCount = 0; let fetchError: Error | null = null;
            logger.debug(`${TAG} Buscando páginas via /${businessId}/owned_pages...`);
            while (currentPageUrl && pageCount < MAX_ACCOUNT_FETCH_PAGES) {
                pageCount++; logger.debug(`${TAG} Buscando página ${pageCount}/${MAX_ACCOUNT_FETCH_PAGES} de /owned_pages...`);
                try {
                    const paginationRetryOptions = { ...RETRY_OPTIONS, retries: 2 };
                    const pageData = await retry(async (bail, attemptNum) => {
                        if (attemptNum > 1) logger.warn(`${TAG} Tentativa ${attemptNum} pág ${pageCount} /owned_pages.`);
                        logger.debug(`${TAG} [System User Flow] Chamando fetch para URL: ${currentPageUrl?.replace(systemUserAccessToken, '[SYSTEM_TOKEN_OCULTO]')}`);
                        const response: FetchResponse = await fetch(currentPageUrl!);
                        if (!response.headers.get('content-type')?.includes('application/json')) { logger.error(`${TAG} Resposta não-JSON (Status: ${response.status}) pág ${pageCount} /owned_pages`); bail(new Error(`Resposta não-JSON (Status: ${response.status})`)); return null; }
                        const data: InstagramApiResponse<PageAccountData> & FacebookApiError = await response.json();
                        if (!response.ok || data.error) {
                            const errorDetail = data.error || { message: `Erro ${response.status} pág ${pageCount}`, code: response.status, fbtrace_id: 'N/A', type: 'HttpError' };
                            logger.error(`${TAG} Erro API (System User) (Tentativa ${attemptNum}) pág ${pageCount}:`, JSON.stringify(errorDetail));
                            if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) { bail(new Error('System User Token inválido/expirado.')); return; }
                            if (errorDetail.code === 10 || errorDetail.code === 200) { bail(new Error('Permissão insuficiente para System User (business_management, pages_show_list, etc.).')); return; }
                            if (errorDetail.code === 100 && errorDetail.message.includes("Unsupported get request")) { bail(new Error(`Business ID (${businessId}) inválido ou não acessível pelo System User Token.`)); return; }
                            if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha pág ${pageCount} /owned_pages: ${errorDetail.message}`)); return; }
                            throw new Error(errorDetail.message || `Erro temp ${response.status} pág ${pageCount}.`);
                        } return data;
                    }, paginationRetryOptions);
                    if (pageData?.data) { allPagesData.push(...pageData.data); logger.debug(`${TAG} Pág ${pageCount}: ${pageData.data.length} itens. Total: ${allPagesData.length}`); }
                    else if (pageData === null) { logger.warn(`${TAG} Busca pág ${pageCount} /owned_pages falhou/interrompida.`); }
                    else { logger.warn(`${TAG} Pág ${pageCount} /owned_pages sem 'data'. Resp:`, pageData); }
                    currentPageUrl = pageData?.paging?.next ?? null;
                    if (currentPageUrl) await new Promise(r => setTimeout(r, ACCOUNT_FETCH_DELAY_MS));
                } catch (error) { fetchError = error instanceof Error ? error : new Error(String(error)); logger.error(`${TAG} Erro irrecuperável (System User) pág ${pageCount}:`, fetchError); currentPageUrl = null; }
            }
            if (pageCount >= MAX_ACCOUNT_FETCH_PAGES && currentPageUrl) logger.warn(`${TAG} Limite ${MAX_ACCOUNT_FETCH_PAGES} págs /owned_pages atingido.`);
            if (fetchError) { return { success: false, error: `Erro ao buscar páginas via System User: ${fetchError.message}`, errorCode: 500 }; }
            logger.info(`${TAG} Busca paginada /owned_pages concluída. ${allPagesData.length} itens em ${pageCount} págs API.`);
            const availableAccounts: AvailableInstagramAccount[] = [];
            for (const page of allPagesData) { if (page.instagram_business_account?.id) { availableAccounts.push({ igAccountId: page.instagram_business_account.id, pageId: page.id, pageName: page.name }); } }
            if (availableAccounts.length === 0) { const errorMsg = "Nenhuma conta IG Business/Creator encontrada vinculada às páginas do Business Manager acessíveis pelo System User."; logger.warn(`${TAG} ${errorMsg} BusinessID: ${businessId}. Págs processadas: ${allPagesData.length}`); return { success: false, error: errorMsg, errorCode: 404 }; }
            logger.info(`${TAG} (System User) Encontradas ${availableAccounts.length} contas IG vinculadas.`);
            logger.debug(`${TAG} (System User) Contas: ${JSON.stringify(availableAccounts)}`);
            return { success: true, accounts: availableAccounts, longLivedAccessToken: userLongLivedAccessToken };
        } else {
            logger.info(`${TAG} Utilizando fluxo de fallback via User Token (LLAT) e /me/accounts para listar contas.`);
            if (!userLongLivedAccessToken) {
                logger.error(`${TAG} (Fallback) LLAT do usuário não disponível para o fluxo de fallback. Isso indica um problema anterior na obtenção do LLAT.`);
                return { success: false, error: "Token de longa duração do usuário indisponível para listar contas." };
            }
            logger.debug(`${TAG} (Fallback) Buscando páginas FB (/me/accounts) com paginação para User ${userId}...`);
            const allPagesData: PageAccountData[] = [];
            let currentPageUrl: string | null = `${BASE_URL}/${API_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100&access_token=${userLongLivedAccessToken}`;
            let pageCount = 0; let fetchError: Error | null = null;
            while (currentPageUrl && pageCount < MAX_ACCOUNT_FETCH_PAGES) {
                pageCount++; logger.debug(`${TAG} (Fallback) Buscando página ${pageCount}/${MAX_ACCOUNT_FETCH_PAGES} de /me/accounts...`);
                try {
                    const paginationRetryOptions = { ...RETRY_OPTIONS, retries: 2 };
                    const pageData = await retry(async (bail, attemptNum) => {
                        if (attemptNum > 1) logger.warn(`${TAG} (Fallback) Tentativa ${attemptNum} pág ${pageCount} /me/accounts.`);
                        logger.debug(`${TAG} [Fallback Flow] Chamando fetch para URL: ${currentPageUrl?.replace(userLongLivedAccessToken!, '[USER_TOKEN_OCULTO]')}`);
                        const response: FetchResponse = await fetch(currentPageUrl!);
                        if (!response.headers.get('content-type')?.includes('application/json')) { bail(new Error(`Resposta não-JSON (Status: ${response.status})`)); return null; }
                        const data: InstagramApiResponse<PageAccountData> & FacebookApiError = await response.json();
                        if (!response.ok || data.error) {
                            const errorDetail = data.error || { message: `Erro ${response.status} pág ${pageCount}`, code: response.status, fbtrace_id: 'N/A', type: 'HttpError' };
                            logger.error(`${TAG} (Fallback) Erro API (Tentativa ${attemptNum}) pág ${pageCount}:`, JSON.stringify(errorDetail));
                            if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) { bail(new Error('Token de longa duração (LLAT) inválido/expirado.')); return; }
                            if (errorDetail.code === 10) { bail(new Error('Permissão `pages_show_list` ausente para o usuário.')); return; }
                            if (errorDetail.code === 100 && 'error_subcode' in errorDetail && errorDetail.error_subcode === 33) { bail(new Error('Erro ao acessar página (requer conta IG conectada ou outra permissão?).')); return; }
                            if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha pág ${pageCount}: ${errorDetail.message}`)); return; }
                            throw new Error(errorDetail.message || `Erro temp ${response.status} pág ${pageCount}.`);
                        } return data;
                    }, paginationRetryOptions);
                    if (pageData?.data) { allPagesData.push(...pageData.data); logger.debug(`${TAG} (Fallback) Pág ${pageCount}: ${pageData.data.length} itens. Total: ${allPagesData.length}`); }
                    else if (pageData === null) { logger.warn(`${TAG} (Fallback) Busca pág ${pageCount} falhou/interrompida (ver erro anterior).`); }
                    else { logger.warn(`${TAG} (Fallback) Pág ${pageCount} /me/accounts sem 'data'. Resp:`, pageData); }
                    currentPageUrl = pageData?.paging?.next ?? null;
                    if (currentPageUrl) await new Promise(r => setTimeout(r, ACCOUNT_FETCH_DELAY_MS));
                } catch (error) { fetchError = error instanceof Error ? error : new Error(String(error)); logger.error(`${TAG} (Fallback) Erro irrecuperável durante paginação /me/accounts (pág ${pageCount}):`, fetchError); currentPageUrl = null; }
            }
            if (pageCount >= MAX_ACCOUNT_FETCH_PAGES && currentPageUrl) logger.warn(`${TAG} (Fallback) Limite ${MAX_ACCOUNT_FETCH_PAGES} págs /me/accounts atingido.`);
            if (fetchError) {
                if (fetchError.message && (fetchError.message.toLowerCase().includes('token') || isTokenInvalidError(undefined, undefined, fetchError.message))) {
                    logger.warn(`${TAG} (Fallback) Erro de token ao listar contas. Limpando conexão IG para User ${userId}.`);
                    await clearInstagramConnection(userId);
                }
                return { success: false, error: `Erro ao buscar páginas via User Token: ${fetchError.message}` };
            }
            logger.info(`${TAG} (Fallback) Busca paginada /me/accounts concluída. ${allPagesData.length} itens em ${pageCount} págs API.`);
            const availableAccounts: AvailableInstagramAccount[] = [];
            for (const page of allPagesData) { if (page.instagram_business_account?.id) { availableAccounts.push({ igAccountId: page.instagram_business_account.id, pageId: page.id, pageName: page.name }); } }
            if (availableAccounts.length === 0) { const errorMsg = "Nenhuma conta IG Business/Creator vinculada encontrada (pós-paginação /me/accounts)."; logger.warn(`${TAG} (Fallback) ${errorMsg} User: ${userId}. Págs processadas: ${allPagesData.length}`); return { success: false, error: errorMsg, errorCode: 404 }; }
            logger.info(`${TAG} (Fallback) Encontradas ${availableAccounts.length} contas IG vinculadas para User ${userId}.`);
            logger.debug(`${TAG} (Fallback) Contas: ${JSON.stringify(availableAccounts)}`);
            return { success: true, accounts: availableAccounts, longLivedAccessToken: userLongLivedAccessToken };
        }
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`${TAG} Erro CRÍTICO GERAL durante busca de contas/LLAT para User ${userId}:`, error);
        if ((errorMsg.toLowerCase().includes('token') || isTokenInvalidError(undefined, undefined, errorMsg)) && mongoose.isValidObjectId(userId)) {
            logger.warn(`${TAG} Erro de token no fluxo geral de fetchAvailableInstagramAccounts. Limpando conexão antiga para User ${userId}.`);
            await clearInstagramConnection(userId);
        }
        return { success: false, error: (errorMsg.includes('Token') || errorMsg.includes('Permissão') || errorMsg.includes('Falha')) ? errorMsg : `Erro interno: ${errorMsg}` };
    }
}

export async function connectInstagramAccount(
    userId: string | Types.ObjectId,
    instagramAccountId: string,
    longLivedAccessToken: string | null
): Promise<{ success: boolean; error?: string }> {
    const TAG = '[connectInstagramAccount v2.0]';
    logger.info(`${TAG} Atualizando status de conexão para User ${userId}, Conta IG ${instagramAccountId}`);

    if (!mongoose.isValidObjectId(userId)) { const errorMsg = `ID de usuário inválido: ${userId}`; logger.error(`${TAG} ${errorMsg}`); return { success: false, error: errorMsg }; }
    if (!instagramAccountId) { const errorMsg = `ID da conta Instagram não fornecido.`; logger.error(`${TAG} ${errorMsg}`); return { success: false, error: errorMsg }; }

    try {
        await connectToDatabase();
        const updateData: Partial<IUser> & { $unset?: any } = {
            instagramAccountId: instagramAccountId,
            isInstagramConnected: true,
            lastInstagramSyncAttempt: new Date(), 
            lastInstagramSyncSuccess: null,      
            instagramSyncErrorMsg: null, // Limpa erro ao (re)conectar
        };

        if (longLivedAccessToken) {
            updateData.instagramAccessToken = longLivedAccessToken;
        } else {
            updateData.$unset = { instagramAccessToken: "" };
            logger.warn(`${TAG} Token de longa duração (LLAT) não fornecido para User ${userId}. O campo instagramAccessToken será removido se existir.`);
        }

        logger.debug(`${TAG} Atualizando usuário ${userId} no DB com dados de conexão... Token ${longLivedAccessToken ? 'presente' : 'ausente/será removido'}`);
        const updateResult = await DbUser.findByIdAndUpdate(userId, updateData);

        if (!updateResult) { const errorMsg = `Falha ao encontrar usuário ${userId} no DB para conectar conta IG.`; logger.error(`${TAG} ${errorMsg}`); return { success: false, error: errorMsg }; }

        logger.info(`${TAG} Usuário ${userId} atualizado. Conexão com IG ${instagramAccountId} marcada como ativa.`);

        const refreshWorkerUrl = process.env.REFRESH_WORKER_URL;
        logger.info(`${TAG} Verificando QStash. Cliente inicializado: ${!!qstashClient}. URL do Worker: ${refreshWorkerUrl}`);

        if (qstashClient && refreshWorkerUrl) {
            logger.info(`${TAG} Bloco IF para QStash alcançado.`);
            try {
                logger.info(`${TAG} Dentro do TRY, antes de publishJSON para User ${userId}.`);
                const publishResponse = await qstashClient.publishJSON({
                    url: refreshWorkerUrl,
                    body: { userId: userId.toString() },
                });
                logger.info(`${TAG} Tarefa de refresh enviada com sucesso para QStash para User ${userId}. Message ID: ${publishResponse.messageId}`);
            } catch (qstashError: any) {
                logger.error(`${TAG} ERRO ao enviar tarefa para QStash para User ${userId}:`, qstashError);
                if (qstashError.message) { logger.error(`${TAG} Mensagem de erro QStash: ${qstashError.message}`); }
            }
        } else {
            logger.warn(`${TAG} QStash Client ou REFRESH_WORKER_URL não configurado. Pulando agendamento de refresh automático para User ${userId}.`);
        }
        logger.info(`${TAG} Finalizando connectInstagramAccount para User ${userId}.`);
        return { success: true };
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`${TAG} Erro CRÍTICO GERAL ao conectar conta IG para User ${userId}:`, error);
        return { success: false, error: `Erro interno ao conectar conta: ${errorMsg}` };
    }
}

export async function finalizeInstagramConnection( userId: string, selectedIgAccountId: string, longLivedAccessToken: string ): Promise<{ success: boolean; message?: string; error?: string }> {
    const TAG = '[finalizeInstagramConnection - DEPRECATED v2.0]';
    logger.warn(`${TAG} Chamada obsoleta. Redirecionando para connectInstagramAccount.`);
    return connectInstagramAccount(userId, selectedIgAccountId, longLivedAccessToken);
}

export async function processStoryWebhookPayload( mediaId: string, webhookAccountId: string | undefined, value: any ): Promise<{ success: boolean; error?: string }> {
    const TAG = '[processStoryWebhookPayload v2.0]';
    logger.debug(`${TAG} Recebido webhook Story Media ${mediaId}, Conta ${webhookAccountId}.`);
    if (!webhookAccountId) return { success: false, error: 'ID da conta do webhook ausente.' };
    if (!value || typeof value !== 'object') return { success: false, error: 'Payload \'value\' inválido ou ausente.' };
    try {
        await connectToDatabase();
        const user = await DbUser.findOne({ instagramAccountId: webhookAccountId }).select('_id').lean<IUser>();
        if (!user) { logger.warn(`${TAG} Usuário não encontrado para instagramAccountId ${webhookAccountId} (Webhook). Ignorando.`); return { success: true }; }
        const userId = user._id;
        const stats: Partial<IStoryStats> = { impressions: value.impressions, reach: value.reach, taps_forward: value.taps_forward, taps_back: value.taps_back, exits: value.exits, replies: value.replies, };
        Object.keys(stats).forEach(key => (stats[key as keyof IStoryStats] == null) && delete stats[key as keyof IStoryStats]);
        if (Object.keys(stats).length === 0) { logger.warn(`${TAG} Nenhum insight válido encontrado no payload do webhook para Story ${mediaId}.`); return { success: true }; }
        
        const filter = { user: userId, instagramMediaId: mediaId };
        const updateData = { $set: { stats: stats as IStoryStats, lastWebhookAt: new Date() }, $setOnInsert: { user: userId, instagramMediaId: mediaId, createdAt: new Date() } };
        const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true };
        const savedStoryMetric = await StoryMetricModel.findOneAndUpdate(filter, updateData, options);
        
        if (!savedStoryMetric) { logger.error(`${TAG} Falha ao salvar/atualizar métrica de Story via webhook ${mediaId}.`); return { success: false, error: 'Falha ao salvar dados do webhook de Story no DB.' }; }
        logger.info(`${TAG} Insights de Story ${mediaId} (Webhook) processados com sucesso para User ${userId}.`);
        return { success: true };
    } catch (error) {
        logger.error(`${TAG} Erro ao processar webhook de Story ${mediaId}, Conta ${webhookAccountId}:`, error);
        return { success: false, error: 'Erro interno ao processar webhook de Story.' };
    }
}

function mapMediaTypeToFormat(mediaType?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'STORY'): string {
    switch (mediaType) {
        case 'IMAGE': return 'Foto';
        case 'VIDEO': return 'Reel';
        case 'CAROUSEL_ALBUM': return 'Carrossel';
        default: return 'Desconhecido';
    }
}

async function saveMetricData(
    userId: Types.ObjectId,
    media: InstagramMedia,
    insights: IMetricStats
): Promise<void> {
    const TAG = '[saveMetricData v2.0]';
    const startTime = Date.now();
    logger.debug(`${TAG} Iniciando save/update User: ${userId}, Media: ${media.id}`);

    if (!media.id) {
        logger.error(`${TAG} Tentativa de salvar métrica sem instagramMediaId para User ${userId}.`);
        throw new Error("instagramMediaId ausente, não é possível salvar a métrica.");
    }
    if (media.media_type === 'STORY') {
        logger.debug(`${TAG} Ignorando salvamento de STORY ${media.id} via saveMetricData (tratado por webhook).`);
        return;
    }

    let savedMetric: IMetric | null = null;
    try {
        await connectToDatabase();
        const filter = { user: userId, instagramMediaId: media.id };
        const format = mapMediaTypeToFormat(media.media_type);

        const statsUpdate: { [key: string]: number | object } = {};
        if (insights) {
            Object.entries(insights).forEach(([key, value]) => {
                if (value !== undefined && value !== null && (typeof value === 'number' || typeof value === 'object')) {
                    statsUpdate[`stats.${key}`] = value;
                }
            });
        }

        const finalUpdateOperation = {
            $set: {
                user: userId,
                instagramMediaId: media.id,
                source: 'api',
                postLink: media.permalink ?? '',
                description: media.caption ?? '',
                postDate: media.timestamp ? new Date(media.timestamp) : new Date(),
                format: format,
                updatedAt: new Date(),
                ...statsUpdate
            },
            $setOnInsert: {
                createdAt: new Date(),
                classificationStatus: 'pending'
            }
        };

        const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true };
        savedMetric = await MetricModel.findOneAndUpdate(filter, finalUpdateOperation, options);

        if (!savedMetric) {
            logger.error(`${TAG} Falha CRÍTICA ao salvar/atualizar métrica ${media.id} para User ${userId}. Filter:`, filter, 'Update:', finalUpdateOperation);
            throw new Error(`Falha crítica ao salvar/atualizar métrica ${media.id}.`);
        }
        logger.debug(`${TAG} Métrica ${savedMetric._id} (Media IG: ${media.id}) salva/atualizada com sucesso para User ${userId}. Formato: ${format}.`);

        const workerUrl = process.env.CLASSIFICATION_WORKER_URL;
        if (qstashClient && workerUrl) {
            if (savedMetric.classificationStatus === 'pending' && savedMetric.description && savedMetric.description.trim() !== '') {
                try {
                    await qstashClient.publishJSON({
                        url: workerUrl,
                        body: { metricId: savedMetric._id.toString() }
                    });
                    logger.info(`${TAG} Tarefa de classificação enviada para QStash para Metric ${savedMetric._id}.`);
                } catch (qstashError) {
                    logger.error(`${TAG} ERRO ao enviar tarefa de classificação para QStash para Metric ${savedMetric._id}.`, qstashError);
                }
            }
        } else if (!workerUrl && qstashClient) {
            logger.warn(`${TAG} CLASSIFICATION_WORKER_URL não definido. Classificação automática de conteúdo não será agendada.`);
        }

        await createOrUpdateDailySnapshot(savedMetric);

    } catch (error) {
        logger.error(`${TAG} Erro CRÍTICO durante save/update da métrica ${media.id} para User ${userId}:`, error);
        throw error;
    } finally {
        const duration = Date.now() - startTime;
        logger.debug(`${TAG} Concluído save/update para Media ${media.id}, User ${userId}. Duração: ${duration}ms`);
    }
}

async function createOrUpdateDailySnapshot(metric: IMetric): Promise<void> {
    const SNAPSHOT_TAG = '[DailySnapshot v2.0]';
    if (metric.source !== 'api') {
        logger.debug(`${SNAPSHOT_TAG} Pulando snapshot para métrica não-API ${metric._id}.`);
        return;
    }
    if (!metric.postDate) {
        logger.warn(`${SNAPSHOT_TAG} Métrica ${metric._id} sem postDate, não é possível criar snapshot.`);
        return;
    }

    try {
        const postDate = new Date(metric.postDate);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const cutoffDaysForSnapshot = 30;
        const cutoffDateForThisMetric = new Date(postDate);
        cutoffDateForThisMetric.setUTCDate(cutoffDateForThisMetric.getUTCDate() + cutoffDaysForSnapshot);
        cutoffDateForThisMetric.setUTCHours(0, 0, 0, 0);

        if (today > cutoffDateForThisMetric) {
            logger.debug(`${SNAPSHOT_TAG} Métrica ${metric._id} (postada em ${postDate.toISOString().split('T')[0]}) passou da data de corte de ${cutoffDaysForSnapshot} dias para snapshots (hoje é ${today.toISOString().split('T')[0]}). Nenhum snapshot será criado/atualizado.`);
            return;
        }

        const snapshotDate = today;
        logger.debug(`${SNAPSHOT_TAG} Calculando snapshot para Métrica ${metric._id} na data ${snapshotDate.toISOString().split('T')[0]}.`);

        const lastSnapshot: IDailyMetricSnapshot | null = await DailyMetricSnapshotModel.findOne({
            metric: metric._id,
            date: { $lt: snapshotDate }
        }).sort({ date: -1 }).lean<IDailyMetricSnapshot>();

        const previousCumulativeStats: Partial<Record<keyof IMetricStats | 'reelsVideoViewTotalTime', number>> = {
            views: 0, likes: 0, comments: 0, shares: 0, saved: 0, reach: 0, follows: 0, profile_visits: 0, total_interactions: 0,
            reelsVideoViewTotalTime: 0,
        };

        if (lastSnapshot) {
            Object.assign(previousCumulativeStats, {
                views: lastSnapshot.cumulativeViews ?? 0,
                likes: lastSnapshot.cumulativeLikes ?? 0,
                comments: lastSnapshot.cumulativeComments ?? 0,
                shares: lastSnapshot.cumulativeShares ?? 0,
                saved: lastSnapshot.cumulativeSaved ?? 0,
                reach: lastSnapshot.cumulativeReach ?? 0,
                follows: lastSnapshot.cumulativeFollows ?? 0,
                profile_visits: lastSnapshot.cumulativeProfileVisits ?? 0,
                total_interactions: lastSnapshot.cumulativeTotalInteractions ?? 0,
                reelsVideoViewTotalTime: lastSnapshot.cumulativeReelsVideoViewTotalTime ?? 0,
            });
        }

        const currentMetricStats = metric.stats as IMetricStats;
        if (!currentMetricStats) {
            logger.warn(`${SNAPSHOT_TAG} Métrica ${metric._id} sem 'stats' atuais para criar snapshot.`);
            return;
        }

        const dailyStats: Partial<Record<keyof IDailyMetricSnapshot, number>> = {};
        const metricsToCalculateDelta: (keyof IMetricStats)[] = [
            'views', 'likes', 'comments', 'shares', 'saved', 'reach', 'follows', 'profile_visits'
        ];

        for (const metricName of metricsToCalculateDelta) {
            const currentVal = Number(currentMetricStats[metricName] ?? 0);
            if (isNaN(currentVal)) {
                logger.warn(`${SNAPSHOT_TAG} Valor inválido para '${metricName}' na Métrica ${metric._id}. Valor: ${currentMetricStats[metricName]}`);
                continue;
            }
            const previousVal = previousCumulativeStats[metricName] ?? 0;
            const metricNameStr = String(metricName);
            const dailyKey = `daily${metricNameStr.charAt(0).toUpperCase() + metricNameStr.slice(1)}` as keyof IDailyMetricSnapshot;
            dailyStats[dailyKey] = Math.max(0, currentVal - previousVal);
            if (currentVal < previousVal && previousVal > 0) {
                logger.warn(`${SNAPSHOT_TAG} Valor cumulativo '${metricNameStr}' diminuiu para Métrica ${metric._id}. Atual: ${currentVal}, Anterior Cumulativo: ${previousVal}. Delta diário setado para 0.`);
            }
        }

        const currentReelsVideoViewTotalTime = Number(currentMetricStats.ig_reels_video_view_total_time ?? 0);
        if (!isNaN(currentReelsVideoViewTotalTime)) {
            const previousReelsVideoViewTotalTime = previousCumulativeStats.reelsVideoViewTotalTime ?? 0;
            dailyStats.dailyReelsVideoViewTotalTime = Math.max(0, currentReelsVideoViewTotalTime - previousReelsVideoViewTotalTime);
            if (currentReelsVideoViewTotalTime < previousReelsVideoViewTotalTime && previousReelsVideoViewTotalTime > 0) {
                logger.warn(`${SNAPSHOT_TAG} Valor cumulativo 'ig_reels_video_view_total_time' diminuiu para Métrica ${metric._id}. Atual: ${currentReelsVideoViewTotalTime}, Anterior: ${previousReelsVideoViewTotalTime}. Delta diário setado para 0.`);
            }
        } else {
            dailyStats.dailyReelsVideoViewTotalTime = 0;
        }

        const currentReelsAvgWatchTime = Number(currentMetricStats.ig_reels_avg_watch_time ?? 0);

        type SnapshotUpdateDataType = Omit<Partial<IDailyMetricSnapshot>, '_id' | 'metric' | 'date'> & { metric: Types.ObjectId; date: Date; };
        const snapshotData: SnapshotUpdateDataType = {
            metric: metric._id,
            date: snapshotDate,
            dailyViews: dailyStats.dailyViews,
            dailyLikes: dailyStats.dailyLikes,
            dailyComments: dailyStats.dailyComments,
            dailyShares: dailyStats.dailyShares,
            dailySaved: dailyStats.dailySaved,
            dailyReach: dailyStats.dailyReach,
            dailyFollows: dailyStats.dailyFollows,
            dailyProfileVisits: dailyStats.dailyProfileVisits,
            dailyReelsVideoViewTotalTime: dailyStats.dailyReelsVideoViewTotalTime,
            cumulativeViews: Number(currentMetricStats.views ?? 0),
            cumulativeLikes: Number(currentMetricStats.likes ?? 0),
            cumulativeComments: Number(currentMetricStats.comments ?? 0),
            cumulativeShares: Number(currentMetricStats.shares ?? 0),
            cumulativeSaved: Number(currentMetricStats.saved ?? 0),
            cumulativeReach: Number(currentMetricStats.reach ?? 0),
            cumulativeFollows: Number(currentMetricStats.follows ?? 0),
            cumulativeProfileVisits: Number(currentMetricStats.profile_visits ?? 0),
            cumulativeTotalInteractions: Number(currentMetricStats.total_interactions ?? 0),
            cumulativeReelsVideoViewTotalTime: !isNaN(currentReelsVideoViewTotalTime) ? currentReelsVideoViewTotalTime : 0,
            currentReelsAvgWatchTime: !isNaN(currentReelsAvgWatchTime) ? currentReelsAvgWatchTime : 0,
        };

        await DailyMetricSnapshotModel.updateOne(
            { metric: metric._id, date: snapshotDate },
            { $set: snapshotData },
            { upsert: true }
        );
        logger.debug(`${SNAPSHOT_TAG} Snapshot salvo/atualizado para Métrica ${metric._id} na data ${snapshotDate.toISOString().split('T')[0]}.`);

    } catch (snapError) {
        logger.error(`${SNAPSHOT_TAG} Erro NÃO FATAL ao criar/atualizar snapshot para Métrica ${metric._id}:`, snapError);
    }
}

async function saveAccountInsightData(
    userId: Types.ObjectId,
    accountId: string,
    insights: IAccountInsightsPeriod | undefined,
    demographics: IAudienceDemographics | undefined,
    accountData: Partial<IUser> | undefined
): Promise<void> {
    const TAG = '[saveAccountInsightData v2.0]';
    logger.debug(`${TAG} Preparando snapshot da conta para User ${userId}, IG Account ${accountId}...`);
    try {
        const snapshot: Partial<IAccountInsight> = {
            user: userId,
            instagramAccountId: accountId,
            recordedAt: new Date(),
        };

        if (insights && Object.keys(insights).length > 1) {
            snapshot.accountInsightsPeriod = insights;
        }
        if (demographics && (demographics.follower_demographics || demographics.engaged_audience_demographics)) {
            snapshot.audienceDemographics = demographics;
        }
        if (accountData && Object.keys(accountData).filter(k => k !== 'instagramAccountId').length > 0) {
                 snapshot.accountDetails = { 
                     username: accountData.username,
                     name: accountData.name,
                     biography: accountData.biography,
                     website: accountData.website,
                     profile_picture_url: accountData.profile_picture_url,
                     followers_count: accountData.followers_count,
                     follows_count: accountData.follows_count,
                     media_count: accountData.media_count,
                 };
        }

        const hasDataToSave = !!snapshot.accountInsightsPeriod || !!snapshot.audienceDemographics || !!snapshot.accountDetails;

        if (hasDataToSave) {
            await connectToDatabase();
            await AccountInsightModel.create(snapshot);
            logger.info(`${TAG} Snapshot de dados da conta salvo com sucesso para User ${userId}. Insights: ${!!snapshot.accountInsightsPeriod}, Demo: ${!!snapshot.audienceDemographics}, Details: ${!!snapshot.accountDetails}`);
        } else {
            logger.warn(`${TAG} Nenhum dado novo de insights, demografia ou detalhes da conta para salvar no snapshot para User ${userId}.`);
        }
    } catch (error) {
        logger.error(`${TAG} Erro ao salvar snapshot de dados da conta para User ${userId}:`, error);
    }
}
