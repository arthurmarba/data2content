// src/app/lib/instagramService.ts - v1.9.11 (Teste Bloco QStash)
// - Comentado publishJSON e fetch de teste. Adicionado logs simples dentro do bloco if.
// - Mantém correções anteriores.

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
import fetch from 'node-fetch'; // Mantido caso precise descomentar

// Importar constantes globais
import {
    API_VERSION,
    BASE_URL, BASIC_ACCOUNT_FIELDS, MEDIA_INSIGHTS_METRICS,
    ACCOUNT_INSIGHTS_METRICS, DEMOGRAPHICS_METRICS,
    MEDIA_BREAKDOWNS, ACCOUNT_BREAKDOWNS,
    DEMOGRAPHICS_BREAKDOWNS, DEMOGRAPHICS_TIMEFRAME, DEFAULT_ACCOUNT_INSIGHTS_PERIOD
} from '@/config/instagram.config'; // Usando v1.9.8 do config

// --- Configurações ---
const RETRY_OPTIONS = { retries: 3, factor: 2, minTimeout: 500, maxTimeout: 5000, randomize: true };
const INSIGHTS_CONCURRENCY_LIMIT = 5;
const MAX_PAGES_MEDIA = 10;
const DELAY_MS = 250;
const MAX_ACCOUNT_FETCH_PAGES = 30;
const ACCOUNT_FETCH_DELAY_MS = 100;

// --- Interfaces ---
// ... (Interfaces mantidas) ...
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
// --- FIM DAS INTERFACES ---

// Inicializa cliente QStash
const qstashToken = process.env.QSTASH_TOKEN;
const qstashClient = qstashToken ? new Client({ token: qstashToken }) : null;
if (!qstashClient) { logger.error("[instagramService] QSTASH_TOKEN não definido ou cliente falhou ao inicializar."); }

// Inicializa limitador de concorrência
const limitInsightsFetch = pLimit(INSIGHTS_CONCURRENCY_LIMIT);

// --- Funções ---

// ... (getInstagramConnectionDetails, fetchInstagramMedia, fetchMediaInsights, fetchAccountInsights, fetchAudienceDemographics, fetchBasicAccountData, clearInstagramConnection, mapMediaTypeToFormat, saveMetricData, createOrUpdateDailySnapshot, saveAccountInsightData, triggerDataRefresh - MANTIDAS COMO NA v1.9.7) ...
export async function getInstagramConnectionDetails(userId: string | mongoose.Types.ObjectId): Promise<InstagramConnectionDetails | null> {
    const TAG = '[getInstagramConnectionDetails]';
    logger.debug(`${TAG} Buscando detalhes de conexão IG para User ${userId}...`);
    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido: ${userId}`);
        return null;
    }
    try {
        await connectToDatabase();
        const user = await DbUser.findById(userId)
            .select('instagramAccessToken instagramAccountId isInstagramConnected')
            .lean();
        if (!user) {
            logger.warn(`${TAG} Usuário ${userId} não encontrado no DB.`);
            return null;
        }
        if (!user.isInstagramConnected || !user.instagramAccountId) {
             logger.warn(`${TAG} Conexão Instagram inativa ou ID da conta ausente para User ${userId}. isConnected: ${user.isInstagramConnected}`);
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
    const TAG = '[fetchInstagramMedia]';
    const logPrefix = pageUrl ? `${TAG} (Paginação)` : TAG;
    logger.info(`${logPrefix} Iniciando busca de mídias para Conta IG ${accountId}...`);

    if (!accountId) return { success: false, error: 'ID da conta Instagram não fornecido.' };
    if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };

    const getUrl = () => {
        if (pageUrl) {
            let url = pageUrl;
            if (!url.includes('access_token=')) {
                url += `&access_token=${accessToken}`;
            }
            return url;
        } else {
            const fields = 'id,media_type,timestamp,caption,permalink,username,children{id,media_type,media_url,permalink}';
            const limit = 25;
            return `${BASE_URL}/${API_VERSION}/${accountId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`;
        }
    };

    try {
        const responseData = await retry(async (bail, attempt) => {
            const currentUrl = getUrl();
            if (attempt > 1) {
                 logger.warn(`${logPrefix} Tentativa ${attempt} para buscar mídias. URL: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`);
            } else {
                 logger.debug(`${logPrefix} URL da API: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`);
            }
            const response = await fetch(currentUrl);
            const data: InstagramApiResponse<InstagramMedia> & FacebookApiError = await response.json();
            if (!response.ok || data.error) {
                type ErrorType = FacebookApiErrorStructure | { message: string; code: number; };
                const error: ErrorType = data.error || { message: `Erro ${response.status} da API`, code: response.status };
                logger.error(`${logPrefix} Erro da API (Tentativa ${attempt}) ao buscar mídias para Conta ${accountId}:`, error);
                const isTokenError = error.code === 190 || ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));
                if (isTokenError) {
                    logger.warn(`${TAG} Erro de token (${error.code}/${'error_subcode' in error ? error.error_subcode : 'N/A'}) detectado. Não tentar novamente.`);
                    bail(new Error('Token de acesso inválido ou expirado ao buscar mídias.')); return;
                }
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    logger.warn(`${TAG} Erro ${response.status} (Client Error) não recuperável. Não tentar novamente.`);
                    bail(new Error(`Falha ao buscar mídias (Erro ${response.status}): ${error.message}`)); return;
                }
                throw new Error(`Erro temporário (${response.status}) ao buscar mídias: ${error.message}`);
            }
            return data;
        }, RETRY_OPTIONS);
        logger.info(`${logPrefix} Mídias buscadas com sucesso para Conta ${accountId}. ${responseData?.data?.length || 0} itens retornados.`);
        return { success: true, data: responseData?.data || [], nextPageUrl: responseData?.paging?.next || null };
    } catch (error: unknown) {
        logger.error(`${logPrefix} Erro final ao buscar mídias para Conta ${accountId} após retentativas:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.startsWith('Token') || message.startsWith('Falha') ? message : `Erro interno ao buscar mídias: ${message}` };
    }
}

export async function fetchMediaInsights(
    mediaId: string,
    accessToken: string
): Promise<FetchInsightsResult<IMetricStats>> {
    const TAG = '[fetchMediaInsights v1.9.6]';
    logger.debug(`${TAG} Buscando insights para Media ID: ${mediaId}...`);
    if (!mediaId) return { success: false, error: 'ID da mídia não fornecido.' };
    if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };
    const metrics = MEDIA_INSIGHTS_METRICS;
    const urlBase = `${BASE_URL}/${API_VERSION}/${mediaId}/insights?metric=${metrics}`;
    try {
        const responseData = await retry(async (bail, attempt) => {
            const currentUrl = `${urlBase}&access_token=${accessToken}`;
             if (attempt > 1) { logger.warn(`${TAG} Tentativa ${attempt} insights mídia ${mediaId}. URL: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
             else { logger.debug(`${TAG} URL da API: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
            const response = await fetch(currentUrl);
            const data: InstagramApiResponse<InstagramApiInsightItem> & FacebookApiError = await response.json();
            if (!response.ok || data.error) {
                type ErrorType = FacebookApiErrorStructure | { message: string; code: number; };
                const error: ErrorType = data.error || { message: `Erro ${response.status} API`, code: response.status };
                logger.error(`${TAG} Erro API (Tentativa ${attempt}) insights Media ${mediaId}:`, error);
                const isTokenError = error.code === 190 || ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));
                if (error.code === 10) { bail(new Error(`Permissão insuficiente insights mídia: ${error.message}`)); return; }
                if (error.code === 100 && error.message.includes('metric') || error.message.includes('breakdown')) { bail(new Error(`Métrica/Breakdown inválido: ${error.message}`)); return;}
                if (isTokenError) { bail(new Error('Token inválido/expirado insights mídia.')); return; }
                if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha insights mídia (Erro ${response.status}): ${error.message}`)); return; }
                throw new Error(`Erro temp (${response.status}) insights mídia: ${error.message}`);
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
        return { success: false, error: message.includes('Permissão') || message.includes('Token') || message.includes('Falha') || message.includes('inválido') ? message : `Erro interno insights mídia: ${message}` };
    }
}

export async function fetchAccountInsights(
    accountId: string,
    accessToken: string,
    period: string = DEFAULT_ACCOUNT_INSIGHTS_PERIOD
): Promise<FetchInsightsResult<IAccountInsightsPeriod>> {
    const TAG = '[fetchAccountInsights]';
    logger.debug(`${TAG} Buscando insights da conta ${accountId} período: ${period}...`);
    if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
    if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };
    const metrics = ACCOUNT_INSIGHTS_METRICS;
    let urlBase = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${metrics}&period=${period}`;
    const requestedMetrics = metrics.split(',');
    for (const metric of requestedMetrics) { if (ACCOUNT_BREAKDOWNS[metric]) { urlBase += `&breakdown=${ACCOUNT_BREAKDOWNS[metric]}`; } }
    try {
        const responseData = await retry(async (bail, attempt) => {
            const currentUrl = `${urlBase}&access_token=${accessToken}`;
             if (attempt > 1) { logger.warn(`${TAG} Tentativa ${attempt} insights conta ${accountId}. URL: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
             else { logger.debug(`${TAG} URL da API: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
            const response = await fetch(currentUrl);
            const data: InstagramApiResponse<InstagramApiInsightItem> & FacebookApiError = await response.json();
            if (!response.ok || data.error) {
                type ErrorType = FacebookApiErrorStructure | { message: string; code: number; };
                const error: ErrorType = data.error || { message: `Erro ${response.status} API`, code: response.status };
                logger.error(`${TAG} Erro API (Tentativa ${attempt}) insights conta ${accountId}:`, error);
                const isTokenError = error.code === 190 || ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));
                if (error.code === 10) { bail(new Error(`Permissão insuficiente insights conta: ${error.message}`)); return; }
                if (error.code === 100 && error.message.includes('metric')) { bail(new Error(`Métrica inválida solicitada para insights de conta: ${error.message}`)); return;}
                if (isTokenError) { bail(new Error('Token inválido/expirado insights conta.')); return; }
                if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha insights conta (Erro ${response.status}): ${error.message}`)); return; }
                throw new Error(`Erro temp (${response.status}) insights conta: ${error.message}`);
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
        return { success: false, error: message.includes('Permissão') || message.includes('Token') || message.includes('Falha') || message.includes('Métrica inválida') ? message : `Erro interno insights conta: ${message}` };
    }
}

export async function fetchAudienceDemographics(
    accountId: string,
    accessToken: string
): Promise<FetchInsightsResult<IAudienceDemographics>> {
    const TAG = '[fetchAudienceDemographics]';
    logger.debug(`${TAG} Buscando dados demográficos da conta ${accountId}...`);
    if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
    if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };
    const metrics = DEMOGRAPHICS_METRICS; const period = 'lifetime';
    const breakdown = DEMOGRAPHICS_BREAKDOWNS; const timeframe = DEMOGRAPHICS_TIMEFRAME;
    const urlBase = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${metrics}&period=${period}&breakdown=${breakdown}&timeframe=${timeframe}`;
    try {
        const responseData = await retry(async (bail, attempt) => {
             const currentUrl = `${urlBase}&access_token=${accessToken}`;
             if (attempt > 1) { logger.warn(`${TAG} Tentativa ${attempt} demografia conta ${accountId}. URL: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
             else { logger.debug(`${TAG} URL da API: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
             const response = await fetch(currentUrl);
             if (!response.headers.get('content-type')?.includes('application/json')) { logger.error(`${TAG} Resposta não-JSON (Status: ${response.status})`); bail(new Error(`Resposta não-JSON (Status: ${response.status})`)); return null; }
             const data: InstagramApiResponse<InstagramApiDemographicItem> & FacebookApiError = await response.json();
             if (!response.ok || data.error) {
                 type ErrorType = FacebookApiErrorStructure | { message: string; code: number; }; const error: ErrorType = data.error || { message: `Erro ${response.status} API`, code: response.status }; logger.error(`${TAG} Erro API (Tentativa ${attempt}) demografia conta ${accountId}:`, error);
                 const isTokenError = error.code === 190 || ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));
                 if (error.code === 10 || error.code === 200) { logger.warn(`${TAG} Permissão/Dados insuficientes (${error.code}) demografia ${accountId}.`); bail(new Error(`Demographics unavailable (${error.code}): ${error.message}`)); return null; }
                 if (isTokenError) { bail(new Error('Token inválido/expirado demografia.')); return; }
                 if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha demografia (Erro ${response.status}): ${error.message}`)); return; }
                 throw new Error(`Erro temp (${response.status}) demografia: ${error.message}`);
             } if (!data.data || data.data.length === 0) { logger.warn(`${TAG} Demografia OK, mas sem dados ('data' vazio) ${accountId}.`); return { data: [] }; }
             return data;
        }, RETRY_OPTIONS);
        if (!responseData) { logger.warn(`${TAG} Concluído sem dados demográficos ${accountId} (erro 10/200 ou API).`); return { success: true, data: {}, errorMessage: 'Dados demográficos insuficientes ou indisponíveis.' }; }
        if (responseData.data.length === 0) { logger.warn(`${TAG} Demografia OK, mas 'data' vazio ${accountId}.`); return { success: true, data: {}, errorMessage: 'Dados demográficos não encontrados.' }; }
        const demographics: Partial<IAudienceDemographics> = {};
        if (responseData.data) {
            responseData.data.forEach(item => {
                const metricName = item.name; const targetKey = metricName as keyof IAudienceDemographics;
                if (item.values?.[0]?.value && typeof item.values[0].value === 'object') {
                    const breakdownData = item.values[0].value; const parsedBreakdowns: any = {};
                    for (const breakdownKey in breakdownData) {
                        if (Object.prototype.hasOwnProperty.call(breakdownData, breakdownKey)) {
                            const subBreakdownMap = breakdownData[breakdownKey as keyof typeof breakdownData];
                            if (typeof subBreakdownMap === 'object' && subBreakdownMap !== null) {
                                const breakdownArray: IDemographicBreakdown[] = Object.entries(subBreakdownMap).filter(([_, count]) => typeof count === 'number').map(([val, count]) => ({ value: val, count: count as number }));
                                if (breakdownArray.length > 0) { if (['city', 'country', 'age', 'gender'].includes(breakdownKey)) { parsedBreakdowns[breakdownKey] = breakdownArray; } else { logger.warn(`${TAG} Chave breakdown demográfico inesperada '${breakdownKey}' em ${metricName}.`); } }
                            }
                        }
                    }
                    if (Object.keys(parsedBreakdowns).length > 0) { demographics[targetKey] = parsedBreakdowns; }
                } else { logger.warn(`${TAG} Item demográfico '${metricName}' sem dados válidos ou formato inesperado.`); }
            });
        }
        const hasData = demographics.follower_demographics || demographics.engaged_audience_demographics;
        logger.debug(`${TAG} Demografia processada ${accountId}. ${hasData ? 'Dados OK.' : 'Dados não disponíveis.'}`);
        return { success: true, data: demographics as IAudienceDemographics, errorMessage: hasData ? undefined : 'Dados demográficos insuficientes ou indisponíveis.' };
    } catch (error: unknown) {
        logger.error(`${TAG} Erro final demografia Conta ${accountId}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith('Demographics unavailable') || message.includes('non-JSON')) { return { success: true, data: {}, errorMessage: 'Dados demográficos insuficientes ou indisponíveis.' }; }
        return { success: false, error: message.includes('Token') || message.includes('Falha') ? message : `Erro interno demografia conta: ${message}` };
    }
}

export async function fetchBasicAccountData(
    accountId: string,
    accessToken: string
): Promise<FetchBasicAccountDataResult> {
    const TAG = '[fetchBasicAccountData]';
    logger.debug(`${TAG} Buscando dados básicos da conta ${accountId}...`);
    if (!accountId) return { success: false, error: 'ID da conta não fornecido.' };
    if (!accessToken) return { success: false, error: 'Token de acesso não fornecido.' };
    const fields = BASIC_ACCOUNT_FIELDS;
    const urlBase = `${BASE_URL}/${API_VERSION}/${accountId}?fields=${fields}`;
    try {
        const responseData = await retry(async (bail, attempt) => {
            const currentUrl = `${urlBase}&access_token=${accessToken}`;
             if (attempt > 1) { logger.warn(`${TAG} Tentativa ${attempt} dados básicos conta ${accountId}. URL: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
             else { logger.debug(`${TAG} URL da API: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }
            const response = await fetch(currentUrl);
            const data: any & FacebookApiError = await response.json();
            if (!response.ok || data.error) {
                type ErrorType = FacebookApiErrorStructure | { message: string; code: number; };
                const error: ErrorType = data.error || { message: `Erro ${response.status} API`, code: response.status };
                logger.error(`${TAG} Erro API (Tentativa ${attempt}) dados básicos conta ${accountId}:`, error);
                const isTokenError = error.code === 190 || ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));
                if (isTokenError) { bail(new Error('Token inválido/expirado dados básicos.')); return; }
                if (error.code === 10) { bail(new Error(`Permissão insuficiente dados básicos: ${error.message}`)); return; }
                if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha dados básicos (Erro ${response.status}): ${error.message}`)); return; }
                throw new Error(`Erro temp (${response.status}) dados básicos: ${error.message}`);
            } return data;
        }, RETRY_OPTIONS);
        const accountData: Partial<IUser> = {};
        const requestedFields = fields.split(',');
        requestedFields.forEach(field => {
            if (responseData && responseData[field] !== undefined) {
                if (field === 'id') { accountData['instagramAccountId'] = responseData[field]; }
                else { if (Object.prototype.hasOwnProperty.call(DbUser.schema.paths, field) || ['username', 'name', 'biography', 'website', 'profile_picture_url', 'followers_count', 'follows_count', 'media_count'].includes(field)) { (accountData as any)[field] = responseData[field]; }
                    else { logger.debug(`${TAG} Campo '${field}' retornado pela API mas não mapeado diretamente na interface IUser.`); }
                }
            }
        });
        logger.debug(`${TAG} Dados básicos conta ${accountId} OK.`, accountData);
        return { success: true, data: accountData };
    } catch (error: unknown) {
        logger.error(`${TAG} Erro final dados básicos Conta ${accountId}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.includes('Token') || message.includes('Falha') || message.includes('Permissão') ? message : `Erro interno dados básicos conta: ${message}` };
    }
}

export async function clearInstagramConnection(userId: string | mongoose.Types.ObjectId): Promise<void> {
    const TAG = '[clearInstagramConnection]';
    logger.warn(`${TAG} Limpando dados de conexão Instagram para User ${userId}...`);
    if (!mongoose.isValidObjectId(userId)) { logger.error(`${TAG} ID de usuário inválido: ${userId}`); return; }
    try {
        await connectToDatabase();
        await DbUser.findByIdAndUpdate(userId, {
            $set: { isInstagramConnected: false, lastInstagramSyncAttempt: null, lastInstagramSyncSuccess: null, },
            $unset: { instagramAccessToken: "", instagramAccountId: "", username: "", }
        });
        logger.info(`${TAG} Dados de conexão Instagram limpos no DB para User ${userId}.`);
    } catch (error) { logger.error(`${TAG} Erro ao limpar dados de conexão Instagram no DB para User ${userId}:`, error); }
}

function mapMediaTypeToFormat(mediaType?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'): string {
    switch (mediaType) { case 'IMAGE': return 'Foto'; case 'VIDEO': return 'Reel'; case 'CAROUSEL_ALBUM': return 'Carrossel'; default: return 'Desconhecido'; }
}

async function saveMetricData( userId: Types.ObjectId, media: InstagramMedia, insights: IMetricStats ): Promise<void> {
    const TAG = '[saveMetricData]';
    const startTime = Date.now(); logger.debug(`${TAG} Iniciando save/update User: ${userId}, Media: ${media.id}`);
    if (!media.id) { logger.error(`${TAG} Sem instagramMediaId.`); throw new Error("Sem instagramMediaId."); }
    if (media.media_type === 'STORY') { logger.debug(`${TAG} Ignorando STORY ${media.id}.`); return; }
    let savedMetric: IMetric | null = null;
    try {
        await connectToDatabase(); const filter = { user: userId, instagramMediaId: media.id }; const format = mapMediaTypeToFormat(media.media_type);
        const statsUpdate: { [key: string]: number | object } = {}; if (insights) { Object.entries(insights).forEach(([key, value]) => { if (value !== undefined && value !== null && (typeof value === 'number' || typeof value === 'object')) { statsUpdate[`stats.${key}`] = value; } }); }
        const finalUpdateOperation = { $set: { user: userId, instagramMediaId: media.id, source: 'api', postLink: media.permalink ?? '', description: media.caption ?? '', postDate: media.timestamp ? new Date(media.timestamp) : new Date(), format: format, updatedAt: new Date(), ...statsUpdate }, $setOnInsert: { createdAt: new Date(), classificationStatus: 'pending' } };
        const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true };
        savedMetric = await MetricModel.findOneAndUpdate(filter, finalUpdateOperation, options);
        if (!savedMetric) { logger.error(`${TAG} Falha CRÍTICA save/update métrica ${media.id}. Filter:`, filter, 'Update:', finalUpdateOperation); throw new Error(`Falha crítica save métrica ${media.id}.`); }
        logger.debug(`${TAG} Métrica ${savedMetric._id} (Media ${media.id}) salva/atualizada.`);
        const workerUrl = process.env.CLASSIFICATION_WORKER_URL; if (qstashClient && workerUrl) { if (savedMetric.classificationStatus === 'pending' && savedMetric.description && savedMetric.description.trim() !== '') { try { await qstashClient.publishJSON({ url: workerUrl, body: { metricId: savedMetric._id.toString() } }); logger.info(`${TAG} Tarefa classificação QStash OK: ${savedMetric._id}.`); } catch (qstashError) { logger.error(`${TAG} ERRO QStash ${savedMetric._id}.`, qstashError); } } } else if (!workerUrl && qstashClient) { logger.warn(`${TAG} CLASSIFICATION_WORKER_URL não definido, classificação não será enviada.`); }
        await createOrUpdateDailySnapshot(savedMetric);
    } catch (error) { logger.error(`${TAG} Erro CRÍTICO save/update métrica ${media.id}:`, error); throw error;
    } finally { const duration = Date.now() - startTime; logger.debug(`${TAG} Concluído save/update. User: ${userId}, Media: ${media.id}. Duração: ${duration}ms`); }
}

async function createOrUpdateDailySnapshot(metric: IMetric): Promise<void> {
    const SNAPSHOT_TAG = '[DailySnapshot v1.9.7]';
    if (metric.source !== 'api') { logger.debug(`${SNAPSHOT_TAG} Pulando snapshot para métrica não-API ${metric._id}.`); return; }
    if (!metric.postDate) { logger.warn(`${SNAPSHOT_TAG} Metric ${metric._id} sem postDate, não é possível criar snapshot.`); return; }
    try {
        const postDate = new Date(metric.postDate); const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const cutoffDate = new Date(postDate); cutoffDate.setUTCDate(cutoffDate.getUTCDate() + 30); cutoffDate.setUTCHours(0, 0, 0, 0);
        if (today > cutoffDate) { logger.debug(`${SNAPSHOT_TAG} Metric ${metric._id} passou da data de corte para snapshots.`); return; }
        const snapshotDate = today;
        logger.debug(`${SNAPSHOT_TAG} Calculando snapshot Metric ${metric._id} data ${snapshotDate.toISOString().split('T')[0]}.`);
        const lastSnapshot: IDailyMetricSnapshot | null = await DailyMetricSnapshotModel.findOne({ metric: metric._id, date: { $lt: snapshotDate } }).sort({ date: -1 }).lean();
        const previousCumulativeStats: Partial<Record<keyof IMetricStats, number>> = { views: 0, likes: 0, comments: 0, shares: 0, saved: 0, reach: 0, follows: 0, profile_visits: 0, total_interactions: 0 };
        if (lastSnapshot) { Object.assign(previousCumulativeStats, { views: lastSnapshot.cumulativeViews ?? 0, likes: lastSnapshot.cumulativeLikes ?? 0, comments: lastSnapshot.cumulativeComments ?? 0, shares: lastSnapshot.cumulativeShares ?? 0, saved: lastSnapshot.cumulativeSaved ?? 0, reach: lastSnapshot.cumulativeReach ?? 0, follows: lastSnapshot.cumulativeFollows ?? 0, profile_visits: lastSnapshot.cumulativeProfileVisits ?? 0, total_interactions: lastSnapshot.cumulativeTotalInteractions ?? 0 }); }
        const currentCumulativeStats = metric.stats; if (!currentCumulativeStats) { logger.warn(`${SNAPSHOT_TAG} Metric ${metric._id} sem 'stats' atuais para snapshot.`); return; }
        const dailyStats: Partial<Record<keyof IDailyMetricSnapshot, number>> = {}; const metricsToCalculateDelta: (keyof IMetricStats)[] = [ 'views', 'likes', 'comments', 'shares', 'saved', 'reach', 'follows', 'profile_visits' ];
        for (const metricName of metricsToCalculateDelta) { const currentVal = Number(currentCumulativeStats[metricName] ?? 0); if (isNaN(currentVal)) { logger.warn(`${SNAPSHOT_TAG} Valor inválido '${metricName}' Metric ${metric._id}.`); continue; } const previousVal = previousCumulativeStats[metricName] ?? 0; const metricNameStr = String(metricName); const dailyKey = `daily${metricNameStr.charAt(0).toUpperCase() + metricNameStr.slice(1)}` as keyof IDailyMetricSnapshot; dailyStats[dailyKey] = Math.max(0, currentVal - previousVal); if (currentVal < previousVal) { logger.warn(`${SNAPSHOT_TAG} Valor cumulativo '${metricNameStr}' diminuiu (${metric._id}). Atual: ${currentVal}, Ant: ${previousVal}.`); } }
        type SnapshotUpdateDataType = Omit<Partial<IDailyMetricSnapshot>, '_id' | 'metric' | 'date'> & { metric: Types.ObjectId; date: Date; };
        const snapshotData: SnapshotUpdateDataType = {
            metric: metric._id,
            date: snapshotDate,
            dailyViews: dailyStats.dailyViews, dailyLikes: dailyStats.dailyLikes, dailyComments: dailyStats.dailyComments, dailyShares: dailyStats.dailyShares, dailySaved: dailyStats.dailySaved, dailyReach: dailyStats.dailyReach, dailyFollows: dailyStats.dailyFollows, dailyProfileVisits: dailyStats.dailyProfileVisits,
            cumulativeViews: Number(currentCumulativeStats.views ?? 0), cumulativeLikes: Number(currentCumulativeStats.likes ?? 0), cumulativeComments: Number(currentCumulativeStats.comments ?? 0), cumulativeShares: Number(currentCumulativeStats.shares ?? 0), cumulativeSaved: Number(currentCumulativeStats.saved ?? 0), cumulativeReach: Number(currentCumulativeStats.reach ?? 0), cumulativeFollows: Number(currentCumulativeStats.follows ?? 0), cumulativeProfileVisits: Number(currentCumulativeStats.profile_visits ?? 0), cumulativeTotalInteractions: Number(currentCumulativeStats.total_interactions ?? 0),
        };
        await DailyMetricSnapshotModel.updateOne({ metric: metric._id, date: snapshotDate }, { $set: snapshotData }, { upsert: true });
        logger.debug(`${SNAPSHOT_TAG} Snapshot salvo/atualizado Metric ${metric._id} data ${snapshotDate.toISOString().split('T')[0]}.`);
    } catch (snapError) { logger.error(`${SNAPSHOT_TAG} Erro NÃO FATAL ao criar/atualizar snapshot para Metric ${metric._id}:`, snapError); }
}

export async function saveAccountInsightData( userId: Types.ObjectId, accountId: string, insights: IAccountInsightsPeriod | undefined, demographics: IAudienceDemographics | undefined, accountData: Partial<IUser> | undefined ): Promise<void> {
    const TAG = '[saveAccountInsightData]';
    logger.debug(`${TAG} Preparando snapshot conta User ${userId}, IG ${accountId}...`);
    try {
        const snapshot: Partial<IAccountInsight> = {
            user: userId, instagramAccountId: accountId, recordedAt: new Date(),
            ...(insights && Object.keys(insights).length > 1 && { accountInsightsPeriod: insights }),
            ...(demographics && (demographics.follower_demographics || demographics.engaged_audience_demographics) && { audienceDemographics: demographics }),
            ...(accountData && Object.keys(accountData).filter(k => k !== 'instagramAccountId').length > 0 && {
                accountDetails: { username: accountData.username, name: accountData.name, biography: accountData.biography, website: accountData.website, profile_picture_url: accountData.profile_picture_url, followers_count: accountData.followers_count, follows_count: accountData.follows_count, media_count: accountData.media_count, }
            }),
        };
        const hasDataToSave = !!snapshot.accountInsightsPeriod || !!snapshot.audienceDemographics || !!snapshot.accountDetails;
        if (hasDataToSave) { await connectToDatabase(); await AccountInsightModel.create(snapshot); logger.info(`${TAG} Snapshot de insights/demografia da conta salvo para User ${userId}.`); }
        else { logger.warn(`${TAG} Nenhum dado novo de insights/demografia da conta para salvar no snapshot para User ${userId}.`); }
    } catch (error) { logger.error(`${TAG} Erro ao salvar snapshot de insights da conta para User ${userId}:`, error); }
}

export async function triggerDataRefresh(userId: string): Promise<{ success: boolean; message: string; details?: any }> {
    const TAG = '[triggerDataRefresh v1.9.7]';
    const startTime = Date.now();
    logger.info(`${TAG} Iniciando atualização de dados para User ${userId}...`);
    if (!mongoose.isValidObjectId(userId)) { logger.error(`${TAG} ID de usuário inválido: ${userId}`); return { success: false, message: 'ID de usuário inválido.' }; }
    const userObjectId = new Types.ObjectId(userId);
    let accessToken: string | null = null; let accountId: string | null = null; let usingSystemToken = false; const systemTokenEnv = process.env.FB_SYSTEM_USER_TOKEN;
    try {
        await connectToDatabase();
        const connectionDetails = await getInstagramConnectionDetails(userObjectId);
        if (!connectionDetails?.accountId) { logger.error(`${TAG} Usuário ${userId} não conectado ou accountId ausente no DB. Abortando refresh.`); await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncAttempt: new Date(), lastInstagramSyncSuccess: false } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (conexão inválida) ${userId}:`, dbErr)); return { success: false, message: 'Usuário não conectado ou ID da conta Instagram não encontrado.' }; }
        accountId = connectionDetails.accountId;
        if (connectionDetails.accessToken) { accessToken = connectionDetails.accessToken; usingSystemToken = false; logger.info(`${TAG} Utilizando LLAT do usuário (${userId}) para o refresh.`); }
        else if (systemTokenEnv) { accessToken = systemTokenEnv; usingSystemToken = true; logger.warn(`${TAG} LLAT do usuário ${userId} não encontrado no DB; usando System User Token como fallback para o refresh.`); }
        else { logger.error(`${TAG} LLAT do usuário ${userId} E System Token não encontrados. Abortando refresh.`); await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncAttempt: new Date(), lastInstagramSyncSuccess: false } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (token ausente) ${userId}:`, dbErr)); return { success: false, message: 'Token de acesso necessário não encontrado (nem LLAT, nem System User).' }; }
    } catch (dbError) { logger.error(`${TAG} Erro ao buscar dados iniciais do usuário ${userId} no DB:`, dbError); return { success: false, message: 'Erro ao acessar dados do usuário no banco de dados.' }; }
    await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncAttempt: new Date() } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar início sync ${userId}:`, dbErr));
    let totalMediaFound = 0, totalMediaProcessed = 0, collectedMediaInsights = 0, savedMediaMetrics = 0;
    let collectedAccountInsights = false, savedAccountInsights = false, collectedDemographics = false;
    let savedDemographics = false, collectedBasicAccountData = false;
    let errors: { step: string; message: string; details?: any }[] = [];
    let mediaCurrentPage = 0; let hasMoreMediaPages = true; let overallSuccess = true;
    try {
        logger.info(`${TAG} [Step 1/3] Buscando dados básicos da conta ${accountId}...`);
        let basicAccountData: Partial<IUser> | undefined;
        const basicDataResult = await fetchBasicAccountData(accountId!, accessToken!);
        if (basicDataResult.success && basicDataResult.data) { collectedBasicAccountData = true; basicAccountData = basicDataResult.data; logger.debug(`${TAG} Dados básicos obtidos.`); }
        else { logger.warn(`${TAG} Falha ao obter dados básicos: ${basicDataResult.error}`); errors.push({ step: 'fetchBasicAccountData', message: basicDataResult.error ?? 'Erro desconhecido' }); if (basicDataResult.error?.includes('Token') || basicDataResult.error?.includes('Permissão')) { overallSuccess = false; throw new Error(`Erro crítico (Token/Permissão) ao buscar dados básicos: ${basicDataResult.error}`); } }
        logger.info(`${TAG} [Step 2/3] Iniciando busca de mídias (limite ${MAX_PAGES_MEDIA} pgs)...`);
        let nextPageMediaUrl: string | null | undefined = undefined; mediaCurrentPage = 0;
        do {
            mediaCurrentPage++; const pageStartTime = Date.now(); logger.info(`${TAG} Processando pág ${mediaCurrentPage}/${MAX_PAGES_MEDIA} de mídias...`);
            const mediaResult = await fetchInstagramMedia(accountId!, accessToken!, nextPageMediaUrl ?? undefined);
            if (!mediaResult.success) { logger.error(`${TAG} Falha busca pág ${mediaCurrentPage} mídias: ${mediaResult.error}`); errors.push({ step: 'fetchInstagramMedia', message: `Pág ${mediaCurrentPage}: ${mediaResult.error ?? 'Erro desconhecido'}` }); if (mediaResult.error?.includes('Token')) { logger.warn(`${TAG} Erro de token, interrompendo busca de mídias.`); hasMoreMediaPages = false; overallSuccess = false; break; } }
            const mediaInPage = mediaResult.data ?? []; totalMediaFound += mediaInPage.length;
            if (mediaInPage.length > 0 && overallSuccess) {
                const processableMedia = mediaInPage.filter(m => m.media_type !== 'STORY'); totalMediaProcessed += processableMedia.length;
                logger.info(`${TAG} Pág ${mediaCurrentPage}: ${processableMedia.length} mídias processáveis. Buscando insights...`);
                const insightTasks = processableMedia.map(media => limitInsightsFetch(async () => { if (!media.id || !accessToken) return { mediaId: media.id ?? '?', status: 'skipped', reason: 'ID/Token ausente' }; const insightsResult = await fetchMediaInsights(media.id, accessToken!); if (!insightsResult.success && insightsResult.error?.includes('Token')) throw new Error(`Token error on media ${media.id}`); return { mediaId: media.id, media, insightsResult }; }));
                const insightTaskResults = await Promise.allSettled(insightTasks);
                for (const result of insightTaskResults) {
                    if (result.status === 'fulfilled' && result.value) { const { mediaId, media, insightsResult } = result.value; if (insightsResult?.success && insightsResult.data) { collectedMediaInsights++; try { await saveMetricData(userObjectId, media, insightsResult.data); savedMediaMetrics++; } catch (saveError: any) { logger.error(`${TAG} Erro ao salvar métrica ${mediaId}:`, saveError); errors.push({ step: 'saveMetricData', message: `Salvar métrica ${mediaId}: ${saveError.message}` }); } } else if (insightsResult) { logger.warn(`${TAG} Falha ao buscar insights mídia ${mediaId}: ${insightsResult.error || result.value.reason}`); errors.push({ step: 'fetchMediaInsights', message: `Insights mídia ${mediaId}: ${insightsResult.error || result.value.reason || 'Erro desconhecido'}` }); } }
                    else if (result.status === 'rejected') { const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason); if (errorMsg.includes('Token error')) { logger.error(`${TAG} Erro de token detectado nos insights de mídia. Interrompendo busca de mídias.`); errors.push({ step: 'fetchMediaInsights', message: 'Erro de token durante busca de insights de mídia.' }); overallSuccess = false; hasMoreMediaPages = false; break; } else { logger.error(`${TAG} Erro não tratado em tarefa de insight de mídia: ${errorMsg}`); errors.push({ step: 'fetchMediaInsights', message: `Erro tarefa insight mídia: ${errorMsg}` }); } }
                } if (!overallSuccess) break;
            } else if (!overallSuccess) logger.info(`${TAG} Pulando processamento de insights da pág ${mediaCurrentPage} por erro anterior.`); else logger.info(`${TAG} Pág ${mediaCurrentPage}: Nenhuma mídia encontrada.`);
            nextPageMediaUrl = mediaResult.nextPageUrl; if (!nextPageMediaUrl) hasMoreMediaPages = false;
            logger.info(`${TAG} Pág ${mediaCurrentPage} mídias processada em ${Date.now() - pageStartTime}ms.`);
            if (hasMoreMediaPages && mediaCurrentPage < MAX_PAGES_MEDIA && overallSuccess) await new Promise(r => setTimeout(r, DELAY_MS));
        } while (hasMoreMediaPages && mediaCurrentPage < MAX_PAGES_MEDIA && overallSuccess);
        if (mediaCurrentPage >= MAX_PAGES_MEDIA && hasMoreMediaPages) errors.push({ step: 'fetchInstagramMedia', message: `Limite de ${MAX_PAGES_MEDIA} páginas de mídia atingido.` });
        logger.info(`${TAG} Processamento de mídias concluído.`);
        if (overallSuccess) {
            logger.info(`${TAG} [Step 3/3] Buscando insights/demografia da conta ${accountId}...`);
            let accountInsightData: IAccountInsightsPeriod | undefined; let audienceDemographicsData: IAudienceDemographics | undefined;
            const insightPeriod = DEFAULT_ACCOUNT_INSIGHTS_PERIOD;
            const accountInsightsResult = await fetchAccountInsights(accountId!, accessToken!, insightPeriod);
            if (accountInsightsResult.success && accountInsightsResult.data) { collectedAccountInsights = true; accountInsightData = accountInsightsResult.data; }
            else { errors.push({ step: 'fetchAccountInsights', message: `Insights conta: ${accountInsightsResult.error ?? 'Erro desconhecido'}` }); if (accountInsightsResult.error?.includes('Token')) { overallSuccess = false; logger.error(`${TAG} Erro de token ao buscar insights da conta.`); } }
            if (overallSuccess) {
                await new Promise(r => setTimeout(r, DELAY_MS));
                const demographicsResult = await fetchAudienceDemographics(accountId!, accessToken!);
                collectedDemographics = true;
                if (demographicsResult.success && demographicsResult.data && (demographicsResult.data.follower_demographics || demographicsResult.data.engaged_audience_demographics)) { audienceDemographicsData = demographicsResult.data; savedDemographics = true; }
                else { logger.warn(`${TAG} Falha ou dados insuficientes para demografia: ${demographicsResult.error || demographicsResult.errorMessage}`); if(demographicsResult.error) errors.push({ step: 'fetchAudienceDemographics', message: `Demografia: ${demographicsResult.error}` }); else if(demographicsResult.errorMessage) errors.push({ step: 'fetchAudienceDemographics', message: `Demografia: ${demographicsResult.errorMessage}` }); if (demographicsResult.error?.includes('Token')) { overallSuccess = false; logger.error(`${TAG} Erro de token ao buscar demografia.`); } }
            }
            if (overallSuccess && (accountInsightData || audienceDemographicsData || basicAccountData)) { logger.info(`${TAG} Salvando snapshot da conta...`); await saveAccountInsightData( userObjectId, accountId!, accountInsightData, audienceDemographicsData, basicAccountData ); savedAccountInsights = true; }
            else if (!overallSuccess) logger.warn(`${TAG} Pulando save snapshot conta por erro anterior de token/permissão.`); else logger.warn(`${TAG} Nenhum dado novo de insights/demografia/básico da conta para salvar no snapshot.`);
        } else logger.warn(`${TAG} Pulando insights/demografia da conta por erro anterior.`);
        const duration = Date.now() - startTime; const finalSuccessStatus = overallSuccess;
        const statusMsg = finalSuccessStatus ? 'concluída com sucesso' : 'concluída com erros (verificar token/permissões ou erros não fatais)';
        const summary = `Mídias Salvas: ${savedMediaMetrics}/${totalMediaProcessed}. Insights Conta: ${savedAccountInsights ? 'Salvo' : 'Não'}. Demo: ${savedDemographics ? 'Salva' : 'Não'}. Básicos: ${collectedBasicAccountData ? 'OK' : 'Falha'}.`;
        const errorSummary = errors.length > 0 ? `Erros (${errors.length}): ${errors.map(e => `${e.step}: ${e.message}`).slice(0, 3).join('; ')}...` : 'Nenhum erro reportado.';
        const finalMessage = `Atualização ${statusMsg} para User ${userId}. ${summary} ${errorSummary}`;
        logger.info(`${TAG} Finalizado. User: ${userId}. Sucesso Geral: ${finalSuccessStatus}. Duração: ${duration}ms. ${finalMessage}`);
        if(errors.length > 0) logger.warn(`${TAG} Detalhes dos erros (${errors.length}):`, errors);
        await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncSuccess: finalSuccessStatus } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status final sync ${userId}:`, dbErr));
        return { success: finalSuccessStatus, message: finalMessage, details: { errors, durationMs: duration, savedMediaMetrics, totalMediaProcessed, collectedAccountInsights, savedAccountInsights, collectedDemographics, savedDemographics, collectedBasicAccountData } };
    } catch (error: unknown) {
        const duration = Date.now() - startTime; logger.error(`${TAG} Erro crítico NÃO TRATADO durante refresh para ${userId}. Duração: ${duration}ms`, error);
        const message = error instanceof Error ? error.message : String(error);
        await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncSuccess: false } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (erro crítico) ${userId}:`, dbErr));
        return { success: false, message: `Erro interno crítico durante a atualização: ${message}` };
    }
}

export async function fetchAvailableInstagramAccounts(
    shortLivedToken: string,
    userId: string
): Promise<FetchInstagramAccountsResult | FetchInstagramAccountsError> {
    const TAG = '[fetchAvailableInstagramAccounts vSystemUser+LLAT]';
    logger.info(`${TAG} Iniciando busca de contas IG e LLAT User para User ID: ${userId}.`);
    if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) { const errorMsg = "FACEBOOK_CLIENT_ID ou FACEBOOK_CLIENT_SECRET não definidos."; logger.error(`${TAG} ${errorMsg}`); return { success: false, error: errorMsg }; }
    if (!mongoose.isValidObjectId(userId)) { const errorMsg = `ID de usuário inválido fornecido: ${userId}`; logger.error(`${TAG} ${errorMsg}`); return { success: false, error: errorMsg }; }
    if (!shortLivedToken) { const errorMsg = `Token de curta duração (shortLivedToken) não fornecido.`; logger.error(`${TAG} ${errorMsg}`); return { success: false, error: errorMsg }; }
    let userLongLivedAccessToken: string | null = null;
    const businessId = process.env.FACEBOOK_BUSINESS_ID;
    const systemUserToken = process.env.FB_SYSTEM_USER_TOKEN;
    type PageAccountData = { id: string; name: string; instagram_business_account?: { id: string; } };
    try {
        logger.debug(`${TAG} Tentando obter LLAT do usuário ${userId}...`);
        const llatUrl = `${BASE_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${shortLivedToken}`;
        try {
            const llatData = await retry(async (bail, attempt) => { if (attempt > 1) logger.warn(`${TAG} Tentativa ${attempt} para obter LLAT do usuário.`); const response = await fetch(llatUrl); const data: any & FacebookApiError = await response.json(); if (!response.ok || !data.access_token) { type ErrorType = FacebookApiErrorStructure | { message: string; code: number; }; const error: ErrorType = data.error || { message: `Erro ${response.status} ao obter LLAT`, code: response.status }; logger.error(`${TAG} Erro API (Tentativa ${attempt}) ao obter LLAT do usuário:`, error); if (response.status === 400 || error.code === 190) { bail(new Error(error.message || 'Falha ao obter token de longa duração (SLT inválido/expirado?).')); return; } if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(error.message || `Falha não recuperável (${response.status}) ao obter LLAT.`)); return; } throw new Error(error.message || `Erro temporário ${response.status} ao obter LLAT.`); } return data; }, RETRY_OPTIONS);
            userLongLivedAccessToken = llatData.access_token; logger.info(`${TAG} LLAT do usuário ${userId} obtido com sucesso.`);
        } catch (llatError: any) { logger.error(`${TAG} Falha CRÍTICA ao obter LLAT do usuário ${userId}:`, llatError); if (llatError.message.toLowerCase().includes('token')) { await clearInstagramConnection(userId); } return { success: false, error: `Falha ao obter token de acesso necessário: ${llatError.message}` }; }
        if (businessId && systemUserToken) {
            logger.info(`${TAG} Utilizando fluxo primário via System User Token para listar contas.`);
            const systemUserAccessToken = systemUserToken; const allPagesData: PageAccountData[] = []; let currentPageUrl: string | null = `${BASE_URL}/${API_VERSION}/${businessId}/owned_pages?fields=id,name,instagram_business_account{id}&limit=100&access_token=${systemUserAccessToken}`; let pageCount = 0; let fetchError: Error | null = null; logger.debug(`${TAG} Buscando páginas via /${businessId}/owned_pages...`);
            while (currentPageUrl && pageCount < MAX_ACCOUNT_FETCH_PAGES) {
                pageCount++; logger.debug(`${TAG} Buscando página ${pageCount}/${MAX_ACCOUNT_FETCH_PAGES} de /owned_pages...`);
                try {
                    const paginationRetryOptions = { ...RETRY_OPTIONS, retries: 2 };
                    const pageData = await retry(async (bail, attempt) => { if (attempt > 1) logger.warn(`${TAG} Tentativa ${attempt} pág ${pageCount} /owned_pages.`); logger.debug(`${TAG} [System User Flow] Chamando fetch para URL: ${currentPageUrl?.replace(systemUserAccessToken, '[SYSTEM_TOKEN_OCULTO]')}`); const response = await fetch(currentPageUrl!); if (!response.headers.get('content-type')?.includes('application/json')) { logger.error(`${TAG} Resposta não-JSON (Status: ${response.status}) pág ${pageCount} /owned_pages`); bail(new Error(`Resposta não-JSON (Status: ${response.status})`)); return null; } const data: InstagramApiResponse<PageAccountData> & FacebookApiError = await response.json(); if (!response.ok || data.error) { type ErrorType = FacebookApiErrorStructure | { message: string; code: number; }; const error: ErrorType = data.error || { message: `Erro ${response.status} pág ${pageCount}`, code: response.status }; logger.error(`${TAG} Erro API (System User) (Tentativa ${attempt}) pág ${pageCount}:`, error); if (error.code === 190) { bail(new Error('System User Token inválido/expirado.')); return; } if (error.code === 10 || error.code === 200) { bail(new Error('Permissão insuficiente para System User (business_management, pages_show_list, etc.).')); return; } if (error.code === 100 && error.message.includes("Unsupported get request")) { bail(new Error(`Business ID (${businessId}) inválido ou não acessível pelo System User Token.`)); return; } if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha pág ${pageCount} /owned_pages: ${error.message}`)); return; } throw new Error(error.message || `Erro temp ${response.status} pág ${pageCount}.`); } return data; }, paginationRetryOptions);
                    if (pageData?.data) { allPagesData.push(...pageData.data); logger.debug(`${TAG} Pág ${pageCount}: ${pageData.data.length} itens. Total: ${allPagesData.length}`); } else if (pageData === null) { logger.warn(`${TAG} Busca pág ${pageCount} /owned_pages falhou/interrompida.`); } else { logger.warn(`${TAG} Pág ${pageCount} /owned_pages sem 'data'. Resp:`, pageData); } currentPageUrl = pageData?.paging?.next ?? null; if (currentPageUrl) await new Promise(r => setTimeout(r, ACCOUNT_FETCH_DELAY_MS));
                } catch (error) { fetchError = error instanceof Error ? error : new Error(String(error)); logger.error(`${TAG} Erro irrecuperável (System User) pág ${pageCount}:`, fetchError); currentPageUrl = null; }
            }
            if (pageCount >= MAX_ACCOUNT_FETCH_PAGES && currentPageUrl) logger.warn(`${TAG} Limite ${MAX_ACCOUNT_FETCH_PAGES} págs /owned_pages atingido.`); if (fetchError) { return { success: false, error: `Erro ao buscar páginas via System User: ${fetchError.message}`, errorCode: 500 }; }
            logger.info(`${TAG} Busca paginada /owned_pages concluída. ${allPagesData.length} itens em ${pageCount} págs API.`); const availableAccounts: AvailableInstagramAccount[] = []; for (const page of allPagesData) { if (page.instagram_business_account?.id) { availableAccounts.push({ igAccountId: page.instagram_business_account.id, pageId: page.id, pageName: page.name }); } } if (availableAccounts.length === 0) { const errorMsg = "Nenhuma conta IG Business/Creator encontrada vinculada às páginas do Business Manager acessíveis pelo System User."; logger.warn(`${TAG} ${errorMsg} BusinessID: ${businessId}. Págs processadas: ${allPagesData.length}`); return { success: false, error: errorMsg, errorCode: 404 }; }
            logger.info(`${TAG} (System User) Encontradas ${availableAccounts.length} contas IG vinculadas.`); logger.debug(`${TAG} (System User) Contas: ${JSON.stringify(availableAccounts)}`); return { success: true, accounts: availableAccounts, longLivedAccessToken: userLongLivedAccessToken };
        } else {
            logger.info(`${TAG} Utilizando fluxo de fallback via User Token (LLAT) e /me/accounts para listar contas.`); if (!userLongLivedAccessToken) { throw new Error("LLAT do usuário não obtido na etapa comum (Fallback)."); }
            logger.debug(`${TAG} (Fallback) Buscando páginas FB (/me/accounts) com paginação para User ${userId}...`); const allPagesData: PageAccountData[] = []; let currentPageUrl: string | null = `${BASE_URL}/${API_VERSION}/me/accounts?fields=id,name,instagram_business_account{id}&limit=100&access_token=${userLongLivedAccessToken}`; let pageCount = 0; let fetchError: Error | null = null;
            while (currentPageUrl && pageCount < MAX_ACCOUNT_FETCH_PAGES) {
                pageCount++; logger.debug(`${TAG} (Fallback) Buscando página ${pageCount}/${MAX_ACCOUNT_FETCH_PAGES} de /me/accounts...`);
                try {
                    const paginationRetryOptions = { ...RETRY_OPTIONS, retries: 2 };
                    const pageData = await retry(async (bail, attempt) => { if (attempt > 1) logger.warn(`${TAG} (Fallback) Tentativa ${attempt} pág ${pageCount} /me/accounts.`); logger.debug(`${TAG} [Fallback Flow] Chamando fetch para URL: ${currentPageUrl?.replace(userLongLivedAccessToken!, '[USER_TOKEN_OCULTO]')}`); const response = await fetch(currentPageUrl!); if (!response.headers.get('content-type')?.includes('application/json')) { bail(new Error(`Resposta não-JSON (Status: ${response.status})`)); return null; } const data: InstagramApiResponse<PageAccountData> & FacebookApiError = await response.json(); if (!response.ok || data.error) { type ErrorType = FacebookApiErrorStructure | { message: string; code: number; }; const error: ErrorType = data.error || { message: `Erro ${response.status} pág ${pageCount}`, code: response.status }; logger.error(`${TAG} (Fallback) Erro API (Tentativa ${attempt}) pág ${pageCount}:`, error); if (error.code === 190) { bail(new Error('Token de longa duração (LLAT) inválido/expirado.')); return; } if (error.code === 10) { bail(new Error('Permissão `pages_show_list` ausente para o usuário.')); return; } if (error.code === 100 && 'error_subcode' in error && error.error_subcode === 33) { bail(new Error('Erro ao acessar página (requer conta IG conectada ou outra permissão?).')); return; } if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha pág ${pageCount}: ${error.message}`)); return; } throw new Error(error.message || `Erro temp ${response.status} pág ${pageCount}.`); } return data; }, paginationRetryOptions);
                    if (pageData?.data) { allPagesData.push(...pageData.data); logger.debug(`${TAG} (Fallback) Pág ${pageCount}: ${pageData.data.length} itens. Total: ${allPagesData.length}`); } else if (pageData === null) { logger.warn(`${TAG} (Fallback) Busca pág ${pageCount} falhou/interrompida (ver erro anterior).`); } else { logger.warn(`${TAG} (Fallback) Pág ${pageCount} /me/accounts sem 'data'. Resp:`, pageData); } currentPageUrl = pageData?.paging?.next ?? null; if (currentPageUrl) await new Promise(r => setTimeout(r, ACCOUNT_FETCH_DELAY_MS));
                } catch (error) { fetchError = error instanceof Error ? error : new Error(String(error)); logger.error(`${TAG} (Fallback) Erro irrecuperável durante paginação /me/accounts (pág ${pageCount}):`, fetchError); currentPageUrl = null; }
            }
            if (pageCount >= MAX_ACCOUNT_FETCH_PAGES && currentPageUrl) logger.warn(`${TAG} (Fallback) Limite ${MAX_ACCOUNT_FETCH_PAGES} págs /me/accounts atingido.`); if (fetchError) { if (fetchError.message.toLowerCase().includes('token')) { await clearInstagramConnection(userId); } throw fetchError; } logger.info(`${TAG} (Fallback) Busca paginada /me/accounts concluída. ${allPagesData.length} itens em ${pageCount} págs API.`);
            const availableAccounts: AvailableInstagramAccount[] = []; for (const page of allPagesData) { if (page.instagram_business_account?.id) { availableAccounts.push({ igAccountId: page.instagram_business_account.id, pageId: page.id, pageName: page.name }); } } if (availableAccounts.length === 0) { const errorMsg = "Nenhuma conta IG Business/Creator vinculada encontrada (pós-paginação /me/accounts)."; logger.warn(`${TAG} (Fallback) ${errorMsg} User: ${userId}. Págs processadas: ${allPagesData.length}`); return { success: false, error: errorMsg, errorCode: 404 }; } logger.info(`${TAG} (Fallback) Encontradas ${availableAccounts.length} contas IG vinculadas para User ${userId}.`); logger.debug(`${TAG} (Fallback) Contas: ${JSON.stringify(availableAccounts)}`);
            return { success: true, accounts: availableAccounts, longLivedAccessToken: userLongLivedAccessToken };
        }
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error); logger.error(`${TAG} Erro CRÍTICO durante busca de contas/LLAT para User ${userId}:`, error); if (errorMsg.toLowerCase().includes('token') && mongoose.isValidObjectId(userId)) { logger.warn(`${TAG} Erro de token no fluxo geral. Limpando conexão antiga para User ${userId}.`); await clearInstagramConnection(userId); } return { success: false, error: errorMsg.includes('Token') || errorMsg.includes('Permissão') || errorMsg.includes('Falha') ? errorMsg : `Erro interno: ${errorMsg}` };
    }
}


/**
 * Atualiza o status de conexão do Instagram para um usuário no DB.
 * Salva o ID da conta e o LLAT do usuário (se disponível).
 * Dispara a atualização de dados em segundo plano.
 * @param userId - ID do usuário (string ou ObjectId).
 * @param instagramAccountId - ID da conta Instagram a ser conectada.
 * @param longLivedAccessToken - O LLAT do *usuário* (pode ser null se a troca falhar).
 */
export async function connectInstagramAccount(
    userId: string | Types.ObjectId,
    instagramAccountId: string,
    longLivedAccessToken: string | null // <<< Aceita LLAT (pode ser null)
): Promise<{ success: boolean; error?: string }> {
    const TAG = '[connectInstagramAccount v1.9.11]'; // <<< Versão Atualizada
    logger.info(`${TAG} Atualizando status de conexão para User ${userId}, Conta IG ${instagramAccountId}`);

    if (!mongoose.isValidObjectId(userId)) { const errorMsg = `ID de usuário inválido: ${userId}`; logger.error(`${TAG} ${errorMsg}`); return { success: false, error: errorMsg }; }
    if (!instagramAccountId) { const errorMsg = `ID da conta Instagram não fornecido.`; logger.error(`${TAG} ${errorMsg}`); return { success: false, error: errorMsg }; }

    try {
        await connectToDatabase();
        const updateData: Partial<IUser> & { $unset?: any } = { // Define tipo explícito
            instagramAccessToken: longLivedAccessToken ?? undefined, // Salva LLAT ou undefined
            instagramAccountId: instagramAccountId,
            isInstagramConnected: true,
            lastInstagramSyncAttempt: new Date(), // Marca a tentativa inicial
            lastInstagramSyncSuccess: null, // Define como null inicialmente
        };

        // Se o LLAT for null, remove o campo do DB em vez de salvar null
        if (longLivedAccessToken === null) {
            updateData.$unset = { instagramAccessToken: "" };
            delete updateData.instagramAccessToken; // Remove do $set
        }

        logger.debug(`${TAG} Atualizando usuário ${userId} no DB com dados de conexão... Token ${longLivedAccessToken ? 'presente' : 'ausente/será removido'}`);
        const updateResult = await DbUser.findByIdAndUpdate(userId, updateData); // Usa updateData que pode conter $set e $unset

        if (!updateResult) { const errorMsg = `Falha ao encontrar usuário ${userId} no DB para conectar conta IG.`; logger.error(`${TAG} ${errorMsg}`); return { success: false, error: errorMsg }; }

        logger.info(`${TAG} Usuário ${userId} atualizado. Conexão com IG ${instagramAccountId} marcada como ativa.`);

        // Dispara a atualização de dados em segundo plano via QStash se configurado
        const refreshWorkerUrl = process.env.REFRESH_WORKER_URL; // Lê a URL da env var
        logger.info(`${TAG} Verificando QStash. Cliente inicializado: ${!!qstashClient}. URL do Worker: ${refreshWorkerUrl}`);

        if (qstashClient && refreshWorkerUrl) {
            logger.info(`${TAG} Bloco IF para QStash alcançado.`); // <<< LOG TESTE 1 >>>
            try {
                logger.info(`${TAG} Dentro do TRY, antes de publishJSON.`); // <<< LOG TESTE 2 >>>

                // --- TEMPORARIAMENTE COMENTADO PARA TESTE ---
                // const publishResponse = await qstashClient.publishJSON({
                //     url: refreshWorkerUrl,
                //     body: { userId: userId.toString() },
                // });
                // logger.info(`${TAG} Tarefa de refresh enviada com sucesso para QStash para User ${userId}. Message ID: ${publishResponse.messageId}`);
                // --- FIM DO COMENTÁRIO ---

                logger.info(`${TAG} Dentro do TRY, APÓS publishJSON (comentado).`); // <<< LOG TESTE 3 >>>

            } catch (qstashError: any) {
                logger.error(`${TAG} DENTRO DO CATCH do publishJSON! Erro:`, qstashError); // <<< LOG TESTE 4 >>>
                if (qstashError.message) {
                     logger.error(`${TAG} Mensagem de erro QStash: ${qstashError.message}`);
                }
                await DbUser.findByIdAndUpdate(userId, { $set: { lastInstagramSyncSuccess: false } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (erro QStash) ${userId}:`, dbErr));
            }
             logger.info(`${TAG} Fora do TRY/CATCH do publishJSON.`); // <<< LOG TESTE 5 >>>
        } else {
            logger.warn(`${TAG} QStash Client ou REFRESH_WORKER_URL não configurado corretamente. Pulando agendamento de refresh automático via worker.`);
             await DbUser.findByIdAndUpdate(userId, { $set: { lastInstagramSyncSuccess: false } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (sem worker) ${userId}:`, dbErr));
        }
        logger.info(`${TAG} Finalizando connectInstagramAccount.`); // <<< LOG TESTE 6 >>>
        return { success: true };

    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`${TAG} Erro CRÍTICO GERAL ao conectar conta IG para User ${userId}:`, error);
        return { success: false, error: `Erro interno ao conectar conta: ${errorMsg}` };
    }
}


/**
 * Finaliza a conexão com o Instagram salvando o token e ID selecionado no DB.
 * @deprecated Esta função não é mais necessária com a lógica movida para connectInstagramAccount.
 */
export async function finalizeInstagramConnection( userId: string, selectedIgAccountId: string, longLivedAccessToken: string ): Promise<{ success: boolean; message?: string; error?: string }> {
    const TAG = '[finalizeInstagramConnection - DEPRECATED]';
    logger.warn(`${TAG} Chamada obsoleta. Redirecionando para connectInstagramAccount.`);
    return connectInstagramAccount(userId, selectedIgAccountId, longLivedAccessToken);
}

/**
 * Processa um payload de webhook para insights de Story.
 */
export async function processStoryWebhookPayload( mediaId: string, webhookAccountId: string | undefined, value: any ): Promise<{ success: boolean; error?: string }> {
    const TAG = '[processStoryWebhookPayload]';
    logger.debug(`${TAG} Recebido webhook Story Media ${mediaId}, Conta ${webhookAccountId}.`);
    if (!webhookAccountId) return { success: false, error: 'ID da conta do webhook ausente.' };
    if (!value || typeof value !== 'object') return { success: false, error: 'Payload \'value\' inválido ou ausente.' };
    try {
        await connectToDatabase();
        const user = await DbUser.findOne({ instagramAccountId: webhookAccountId }).select('_id').lean();
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
    } catch (error) { logger.error(`${TAG} Erro ao processar webhook de Story ${mediaId}, Conta ${webhookAccountId}:`, error); return { success: false, error: 'Erro interno ao processar webhook de Story.' }; }
}

