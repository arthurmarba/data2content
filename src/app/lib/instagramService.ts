// src/app/lib/instagramService.ts - v1.9.1 (Adiciona Log Debug System Token)
// - Adiciona logger.debug para verificar o FB_SYSTEM_USER_TOKEN antes da chamada /owned_pages.
// - Mantém fluxo System User / Fallback e outras funcionalidades.

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

// Importar constantes globais
import {
    API_VERSION, // <<< GARANTIR QUE ESTÁ DEFINIDA (ex: 'v22.0')
    BASE_URL, BASIC_ACCOUNT_FIELDS, MEDIA_INSIGHTS_METRICS,
    ACCOUNT_INSIGHTS_METRICS, DEMOGRAPHICS_METRICS,
    MEDIA_BREAKDOWNS, ACCOUNT_BREAKDOWNS,
    DEMOGRAPHICS_BREAKDOWNS, DEMOGRAPHICS_TIMEFRAME, DEFAULT_ACCOUNT_INSIGHTS_PERIOD
} from '@/config/instagram.config'; // Garanta que este caminho esteja correto

// --- Configurações ---
const RETRY_OPTIONS = { retries: 3, factor: 2, minTimeout: 500, maxTimeout: 5000, randomize: true };
const INSIGHTS_CONCURRENCY_LIMIT = 5;
const MAX_PAGES_MEDIA = 10; // Limite para busca de *mídias* (posts)
const DELAY_MS = 250;
// --- Constantes para paginação de contas ---
const MAX_ACCOUNT_FETCH_PAGES = 30; // Limite de segurança para páginas de /me/accounts ou /owned_pages
const ACCOUNT_FETCH_DELAY_MS = 100; // Pequeno delay entre buscas de página de contas

// --- Interfaces ---
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

// Interface de retorno para busca de contas (agora inclui LLAT opcional)
export interface FetchInstagramAccountsResult {
    success: true;
    accounts: AvailableInstagramAccount[];
    longLivedAccessToken: string; // Mantido para compatibilidade, será '' no fluxo System User
}

export interface FetchInstagramAccountsError {
    success: false;
    error: string;
    errorCode?: number;
}
// --- FIM DAS INTERFACES ---


// Inicializa cliente QStash
const qstashClient = process.env.QSTASH_TOKEN ? new Client({ token: process.env.QSTASH_TOKEN }) : null;
if (!qstashClient) { logger.error("[instagramService] QSTASH_TOKEN não definido."); }

// Inicializa limitador de concorrência
const limitInsightsFetch = pLimit(INSIGHTS_CONCURRENCY_LIMIT);

// --- Funções ---

/**
 * Busca detalhes da conexão Instagram (token, ID da conta) para um usuário no banco de dados.
 * @param userId - ID do usuário (string ou ObjectId).
 * @returns Detalhes da conexão ou null se não encontrado/inválido.
 */
export async function getInstagramConnectionDetails(userId: string | mongoose.Types.ObjectId): Promise<InstagramConnectionDetails | null> {
    const TAG = '[getInstagramConnectionDetails]';
    // ... (código inalterado) ...
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
        if (!user.isInstagramConnected || !user.instagramAccessToken || !user.instagramAccountId) {
             logger.warn(`${TAG} Conexão Instagram inativa ou incompleta para User ${userId}. isConnected: ${user.isInstagramConnected}`);
             return null;
        }
        logger.debug(`${TAG} Detalhes de conexão IG encontrados e válidos para User ${userId}.`);
        return { accessToken: user.instagramAccessToken, accountId: user.instagramAccountId };
    } catch (error) {
        logger.error(`${TAG} Erro ao buscar detalhes de conexão IG para User ${userId}:`, error);
        return null;
    }
}

/**
 * Busca mídias (posts) de uma conta do Instagram, com suporte a paginação.
 * @param userId - ID do usuário proprietário da conta.
 * @param pageUrl - URL da página específica a ser buscada (para paginação). Se omitido, busca a primeira página.
 * @returns Resultado da busca, incluindo dados da mídia e URL da próxima página.
 */
export async function fetchInstagramMedia(userId: string, pageUrl?: string): Promise<FetchMediaResult> {
    const TAG = '[fetchInstagramMedia]';
    // ... (código inalterado, mas com API_VERSION adicionada na URL base) ...
    const logPrefix = pageUrl ? `${TAG} (Paginação)` : TAG;
    logger.info(`${logPrefix} Iniciando busca de mídias para User ${userId}...`);

    const connectionDetails = await getInstagramConnectionDetails(userId);
    if (!connectionDetails?.accessToken || !connectionDetails?.accountId) {
        return { success: false, error: 'Usuário não conectado ao Instagram ou detalhes inválidos.' };
    }
    const { accessToken, accountId } = connectionDetails;

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
                logger.error(`${logPrefix} Erro da API (Tentativa ${attempt}) ao buscar mídias para User ${userId}:`, error);

                const isTokenError = error.code === 190 ||
                                     ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));

                if (isTokenError) {
                    logger.warn(`${TAG} Erro de token (${error.code}/${'error_subcode' in error ? error.error_subcode : 'N/A'}) detectado. Não tentar novamente.`);
                    await clearInstagramConnection(userId);
                    bail(new Error('Token de acesso inválido ou expirado. Por favor, reconecte sua conta.'));
                    return;
                }
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    logger.warn(`${TAG} Erro ${response.status} (Client Error) não recuperável. Não tentar novamente.`);
                    bail(new Error(`Falha ao buscar mídias (Erro ${response.status}): ${error.message}`));
                    return;
                }
                throw new Error(`Erro temporário (${response.status}) ao buscar mídias: ${error.message}`);
            }
            return data;

        }, RETRY_OPTIONS);

        logger.info(`${logPrefix} Mídias buscadas com sucesso para User ${userId}. ${responseData?.data?.length || 0} itens retornados nesta página.`);
        return {
            success: true,
            data: responseData?.data || [],
            nextPageUrl: responseData?.paging?.next || null,
        };

    } catch (error: unknown) {
        logger.error(`${logPrefix} Erro final ao buscar mídias para User ${userId} após retentativas:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.startsWith('Token') || message.startsWith('Falha') ? message : `Erro interno ao buscar mídias: ${message}` };
    }
}

/**
 * Busca insights para uma mídia específica do Instagram.
 * @param mediaId - ID da mídia do Instagram.
 * @param accessToken - Token de acesso válido.
 * @returns Resultado da busca de insights.
 */
export async function fetchMediaInsights(mediaId: string, accessToken: string): Promise<FetchInsightsResult<IMetricStats>> {
    const TAG = '[fetchMediaInsights]';
     // ... (código inalterado, mas com API_VERSION adicionada na URL base) ...
    logger.debug(`${TAG} Buscando insights para Media ID: ${mediaId}...`);

    const metrics = MEDIA_INSIGHTS_METRICS;
    let urlBase = `${BASE_URL}/${API_VERSION}/${mediaId}/insights?metric=${metrics}`;
    const requestedMetrics = metrics.split(',');
    if (requestedMetrics.includes('profile_activity') && MEDIA_BREAKDOWNS['profile_activity']) {
        urlBase += `&breakdown=${MEDIA_BREAKDOWNS['profile_activity']}`;
    }

    try {
        const responseData = await retry(async (bail, attempt) => {
            const currentUrl = `${urlBase}&access_token=${accessToken}`;
             if (attempt > 1) {
                  logger.warn(`${TAG} Tentativa ${attempt} para buscar insights da mídia ${mediaId}.`);
             }

            const response = await fetch(currentUrl);
            const data: InstagramApiResponse<InstagramApiInsightItem> & FacebookApiError = await response.json();

            if (!response.ok || data.error) {
                type ErrorType = FacebookApiErrorStructure | { message: string; code: number; };
                const error: ErrorType = data.error || { message: `Erro ${response.status} da API`, code: response.status };
                logger.error(`${TAG} Erro da API (Tentativa ${attempt}) ao buscar insights para Media ${mediaId}:`, error);

                const isTokenError = error.code === 190 ||
                                     ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));

                if (error.code === 10) {
                    bail(new Error(`Permissão insuficiente para buscar insights da mídia: ${error.message}`)); return;
                }
                 if (isTokenError) {
                     bail(new Error('Token de acesso inválido ou expirado ao buscar insights.')); return;
                 }
                 if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                     bail(new Error(`Falha ao buscar insights da mídia (Erro ${response.status}): ${error.message}`)); return;
                 }
                throw new Error(`Erro temporário (${response.status}) ao buscar insights da mídia: ${error.message}`);
            }
            return data;

        }, RETRY_OPTIONS);

        const insights: Partial<IMetricStats> = {};
        if (responseData?.data) {
            responseData.data.forEach(item => {
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
        return { success: true, data: insights as IMetricStats };

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`${TAG} Erro final ao buscar insights para Media ${mediaId}:`, error);
        return { success: false, error: message.includes('Permissão') || message.includes('Token') || message.includes('Falha') ? message : `Erro interno ao buscar insights da mídia: ${message}` };
    }
}

/**
 * Busca insights agregados para uma conta do Instagram em um período específico.
 * @param accountId - ID da conta do Instagram.
 * @param accessToken - Token de acesso válido.
 * @param period - Período dos insights (ex: 'day', 'week', 'days_28').
 * @returns Resultado da busca de insights da conta.
 */
export async function fetchAccountInsights(
    accountId: string,
    accessToken: string,
    period: string = DEFAULT_ACCOUNT_INSIGHTS_PERIOD
): Promise<FetchInsightsResult<IAccountInsightsPeriod>> {
    const TAG = '[fetchAccountInsights]';
     // ... (código inalterado, mas com API_VERSION adicionada na URL base) ...
    logger.debug(`${TAG} Buscando insights da conta ${accountId} para o período: ${period}...`);

    const metrics = ACCOUNT_INSIGHTS_METRICS;
    let urlBase = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${metrics}&period=${period}`;
    const requestedMetrics = metrics.split(',');
    for (const metric of requestedMetrics) {
        if (ACCOUNT_BREAKDOWNS[metric]) {
            urlBase += `&breakdown=${ACCOUNT_BREAKDOWNS[metric]}`;
        }
    }

    try {
        const responseData = await retry(async (bail, attempt) => {
            const currentUrl = `${urlBase}&access_token=${accessToken}`;
            if (attempt > 1) {
                 logger.warn(`${TAG} Tentativa ${attempt} para buscar insights da conta ${accountId}.`);
            }

            const response = await fetch(currentUrl);
            const data: InstagramApiResponse<InstagramApiInsightItem> & FacebookApiError = await response.json();

            if (!response.ok || data.error) {
                type ErrorType = FacebookApiErrorStructure | { message: string; code: number; };
                const error: ErrorType = data.error || { message: `Erro ${response.status} da API`, code: response.status };
                logger.error(`${TAG} Erro da API (Tentativa ${attempt}) ao buscar insights da conta ${accountId}:`, error);

                const isTokenError = error.code === 190 ||
                                     ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));

                if (error.code === 10) { bail(new Error(`Permissão insuficiente para buscar insights da conta: ${error.message}`)); return; }
                if (isTokenError) { bail(new Error('Token de acesso inválido ou expirado ao buscar insights da conta.')); return; }
                if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha ao buscar insights da conta (Erro ${response.status}): ${error.message}`)); return; }
                throw new Error(`Erro temporário (${response.status}) ao buscar insights da conta: ${error.message}`);
            }
            return data;

        }, RETRY_OPTIONS);

        const insights: Partial<IAccountInsightsPeriod> = { period: period };
        if (responseData?.data) {
            responseData.data.forEach(item => {
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

        logger.debug(`${TAG} Insights da conta buscados com sucesso para ${accountId} (${period}).`, insights);
        return { success: true, data: insights as IAccountInsightsPeriod };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro final ao buscar insights para Conta ${accountId}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.includes('Permissão') || message.includes('Token') || message.includes('Falha') ? message : `Erro interno ao buscar insights da conta: ${message}` };
    }
}

/**
 * Busca dados demográficos da audiência de uma conta do Instagram.
 * @param accountId - ID da conta do Instagram.
 * @param accessToken - Token de acesso válido.
 * @returns Resultado da busca de dados demográficos.
 */
export async function fetchAudienceDemographics(
    accountId: string,
    accessToken: string
): Promise<FetchInsightsResult<IAudienceDemographics>> {
    const TAG = '[fetchAudienceDemographics]';
     // ... (código inalterado, mas com API_VERSION adicionada na URL base) ...
    logger.debug(`${TAG} Buscando dados demográficos da conta ${accountId}...`);

    const metrics = DEMOGRAPHICS_METRICS;
    const period = 'lifetime';
    const breakdown = DEMOGRAPHICS_BREAKDOWNS;
    const timeframe = DEMOGRAPHICS_TIMEFRAME;
    const urlBase = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${metrics}&period=${period}&breakdown=${breakdown}&timeframe=${timeframe}`;

    try {
        const responseData = await retry(async (bail, attempt) => {
              const currentUrl = `${urlBase}&access_token=${accessToken}`;
              if (attempt > 1) {
                   logger.warn(`${TAG} Tentativa ${attempt} para buscar demografia da conta ${accountId}.`);
              }

            const response = await fetch(currentUrl);
            if (!response.headers.get('content-type')?.includes('application/json')) {
                 logger.error(`${TAG} Resposta inesperada não-JSON da API (Status: ${response.status})`);
                 bail(new Error(`Resposta inesperada não-JSON da API (Status: ${response.status})`));
                 return null;
            }

            const data: InstagramApiResponse<InstagramApiDemographicItem> & FacebookApiError = await response.json();

            if (!response.ok || data.error) {
                type ErrorType = FacebookApiErrorStructure | { message: string; code: number; };
                const error: ErrorType = data.error || { message: `Erro ${response.status} da API`, code: response.status };
                logger.error(`${TAG} Erro da API (Tentativa ${attempt}) ao buscar demografia da conta ${accountId}:`, error);

                const isTokenError = error.code === 190 ||
                                     ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));

                if (error.code === 10 || error.code === 200) {
                     logger.warn(`${TAG} Permissão ausente, dados insuficientes ou erro (${error.code}) ao buscar demografia para ${accountId}.`);
                     bail(new Error(`Demographics unavailable (${error.code}): ${error.message}`));
                     return null;
                }
                if (isTokenError) { bail(new Error('Token de acesso inválido ou expirado ao buscar demografia.')); return; }
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                     bail(new Error(`Falha ao buscar demografia (Erro ${response.status}): ${error.message}`)); return;
                 }
                throw new Error(`Erro temporário (${response.status}) ao buscar demografia: ${error.message}`);
            }
            if (!data.data || data.data.length === 0) {
                 logger.warn(`${TAG} Demografia retornada com sucesso, mas sem dados ('data' array vazio) para conta ${accountId}.`);
                 return { data: [] };
            }
            return data;

        }, RETRY_OPTIONS);

        if (!responseData) {
             logger.warn(`${TAG} Concluído sem dados demográficos para ${accountId} devido a erro (10, 200) ou falha na API.`);
             return { success: true, data: {}, errorMessage: 'Dados demográficos insuficientes ou indisponíveis.' };
        }

        const demographics: Partial<IAudienceDemographics> = {};
        if (responseData.data) {
            responseData.data.forEach(item => {
                const metricName = item.name;
                const targetKey = metricName as keyof IAudienceDemographics;
                if (item.values?.[0]?.value && typeof item.values[0].value === 'object') {
                    const breakdownData = item.values[0].value;
                    const parsedBreakdowns: Partial<IAudienceDemographics[typeof targetKey]> = {};

                    for (const breakdownKey in breakdownData) {
                        if (Object.prototype.hasOwnProperty.call(breakdownData, breakdownKey)) {
                            const subBreakdownMap = breakdownData[breakdownKey];
                            if (typeof subBreakdownMap === 'object' && subBreakdownMap !== null) {
                                const breakdownArray: IDemographicBreakdown[] = Object.entries(subBreakdownMap)
                                    .filter(([_, count]) => typeof count === 'number')
                                    .map(([val, count]) => ({ value: val, count: count as number }));

                                if (breakdownArray.length > 0) {
                                    if (['gender_age', 'city', 'country'].includes(breakdownKey)) {
                                       parsedBreakdowns[breakdownKey as keyof typeof parsedBreakdowns] = breakdownArray;
                                    } else {
                                       logger.warn(`${TAG} Chave de breakdown inesperada '${breakdownKey}' encontrada em ${metricName}.`);
                                    }
                                }
                            }
                        }
                    }
                    if (Object.keys(parsedBreakdowns).length > 0) {
                         demographics[targetKey] = parsedBreakdowns as any;
                    }
                } else {
                     logger.warn(`${TAG} Item demográfico '${metricName}' sem dados válidos em 'values'.`);
                }
            });
        }

        const hasData = demographics.follower_demographics || demographics.engaged_audience_demographics;
        logger.debug(`${TAG} Dados demográficos processados para ${accountId}. ${hasData ? 'Dados encontrados.' : 'Dados não disponíveis/insuficientes.'}`, hasData ? demographics : {});
        return { success: true, data: demographics as IAudienceDemographics, errorMessage: hasData ? undefined : 'Dados demográficos insuficientes ou indisponíveis.' };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro final ao buscar demografia para Conta ${accountId}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith('Demographics unavailable') || message.includes('non-JSON')) {
            return { success: true, data: {}, errorMessage: 'Dados demográficos insuficientes ou indisponíveis.' };
        }
        return { success: false, error: message.includes('Token') || message.includes('Falha') ? message : `Erro interno ao buscar demografia da conta: ${message}` };
    }
}

/**
 * Busca dados básicos do perfil de uma conta do Instagram.
 * @param accountId - ID da conta do Instagram.
 * @param accessToken - Token de acesso válido.
 * @returns Resultado da busca dos dados básicos.
 */
export async function fetchBasicAccountData(
    accountId: string,
    accessToken: string
): Promise<FetchBasicAccountDataResult> {
    const TAG = '[fetchBasicAccountData]';
     // ... (código inalterado, mas com API_VERSION adicionada na URL base) ...
    logger.debug(`${TAG} Buscando dados básicos da conta ${accountId}...`);

    const fields = BASIC_ACCOUNT_FIELDS;
    const urlBase = `${BASE_URL}/${API_VERSION}/${accountId}?fields=${fields}`;

    try {
        const responseData = await retry(async (bail, attempt) => {
            const currentUrl = `${urlBase}&access_token=${accessToken}`;
             if (attempt > 1) {
                  logger.warn(`${TAG} Tentativa ${attempt} para buscar dados básicos da conta ${accountId}.`);
             }

            const response = await fetch(currentUrl);
            const data: any & FacebookApiError = await response.json();

            if (!response.ok || data.error) {
                 type ErrorType = FacebookApiErrorStructure | { message: string; code: number; };
                 const error: ErrorType = data.error || { message: `Erro ${response.status} da API`, code: response.status };
                 logger.error(`${TAG} Erro da API (Tentativa ${attempt}) ao buscar dados básicos da conta ${accountId}:`, error);

                 const isTokenError = error.code === 190 ||
                                      ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));

                 if (isTokenError) { bail(new Error('Token de acesso inválido ou expirado ao buscar dados básicos.')); return; }
                 if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha ao buscar dados básicos (Erro ${response.status}): ${error.message}`)); return; }
                 throw new Error(`Erro temporário (${response.status}) ao buscar dados básicos: ${error.message}`);
            }
            return data;

        }, RETRY_OPTIONS);

        const accountData: Partial<IUser> = {
            instagramAccountId: responseData?.id,
            username: responseData?.username,
            name: responseData?.name,
            biography: responseData?.biography,
            website: responseData?.website,
            profile_picture_url: responseData?.profile_picture_url,
            followers_count: responseData?.followers_count,
            follows_count: responseData?.follows_count,
            media_count: responseData?.media_count,
        };
        Object.keys(accountData).forEach(key => {
            if (accountData[key as keyof typeof accountData] === undefined) {
                delete accountData[key as keyof typeof accountData];
            }
        });

        logger.debug(`${TAG} Dados básicos da conta buscados com sucesso para ${accountId}.`, accountData);
        return { success: true, data: accountData };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro final ao buscar dados básicos para Conta ${accountId}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.includes('Token') || message.includes('Falha') ? message : `Erro interno ao buscar dados básicos da conta: ${message}` };
    }
}

/**
 * Limpa os dados de conexão do Instagram (token, ID) de um usuário no banco de dados.
 * @param userId - ID do usuário (string ou ObjectId).
 */
export async function clearInstagramConnection(userId: string | mongoose.Types.ObjectId): Promise<void> {
    const TAG = '[clearInstagramConnection]';
     // ... (código inalterado) ...
    logger.warn(`${TAG} Limpando dados de conexão Instagram para User ${userId}...`);
    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido fornecido para limpar conexão: ${userId}`);
        return;
    }
    try {
        await connectToDatabase();
        await DbUser.findByIdAndUpdate(userId, {
            $set: {
                instagramAccessToken: null,
                instagramAccountId: null,
                isInstagramConnected: false,
            },
             $unset: {
                 // instagramUsername: "" // Example
             }
        });
        logger.info(`${TAG} Dados de conexão Instagram limpos no DB para User ${userId}.`);
    } catch (error) {
        logger.error(`${TAG} Erro ao limpar dados de conexão Instagram no DB para User ${userId}:`, error);
    }
}

// --- Funções para Salvar Dados ---

/**
 * Mapeia o tipo de mídia da API para um formato legível.
 * @param mediaType - Tipo de mídia da API.
 * @returns String formatada do tipo de mídia.
 */
function mapMediaTypeToFormat(mediaType?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'): string {
    // ... (código inalterado) ...
    switch (mediaType) {
        case 'IMAGE': return 'Foto';
        case 'VIDEO': return 'Reel';
        case 'CAROUSEL_ALBUM': return 'Carrossel';
        default: return 'Desconhecido';
    }
}

/**
 * Salva ou atualiza os dados e insights de uma mídia no banco de dados.
 * Também lida com snapshots diários e enfileiramento de classificação.
 * @param userId - ObjectId do usuário.
 * @param media - Objeto da mídia do Instagram.
 * @param insights - Objeto de insights da mídia.
 */
async function saveMetricData(
    userId: Types.ObjectId,
    media: InstagramMedia,
    insights: IMetricStats
): Promise<void> {
    const TAG = '[saveMetricData]';
     // ... (código inalterado) ...
    const startTime = Date.now();
    logger.info(`${TAG} Iniciando salvamento/atualização para User: ${userId}, Media: ${media.id}`);

    if (!media.id) {
        logger.error(`${TAG} Tentativa de salvar métrica sem instagramMediaId.`);
        throw new Error("Tentativa de salvar métrica sem instagramMediaId.");
    }
    if (media.media_type === 'STORY') {
        logger.debug(`${TAG} Ignorando mídia do tipo STORY ${media.id}.`);
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
                 createdAt: new Date()
            }
        };

        const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true };
        savedMetric = await MetricModel.findOneAndUpdate(filter, finalUpdateOperation, options);

        if (!savedMetric) {
             logger.error(`${TAG} Falha CRÍTICA ao salvar/atualizar métrica ${media.id} (findOneAndUpdate retornou null). Filter:`, filter, 'Update:', finalUpdateOperation);
             throw new Error(`Falha crítica ao salvar métrica ${media.id} no DB.`);
        }
        logger.debug(`${TAG} Métrica ${savedMetric._id} (Media ${media.id}) salva/atualizada com sucesso.`);

        // --- QStash Trigger for Classification ---
        const workerUrl = process.env.CLASSIFICATION_WORKER_URL;
        if (qstashClient && workerUrl) {
            if (savedMetric.classificationStatus === 'pending' && savedMetric.description && savedMetric.description.trim() !== '') {
                try {
                    await qstashClient.publishJSON({ url: workerUrl, body: { metricId: savedMetric._id.toString() } });
                    logger.info(`${TAG} Tarefa de classificação enviada para QStash para Metric ID: ${savedMetric._id}.`);
                } catch (qstashError) {
                    logger.error(`${TAG} ERRO ao enviar tarefa para QStash para Metric ID: ${savedMetric._id}.`, qstashError);
                }
            }
        } else if (!qstashClient) {
             // logger.debug(`${TAG} QStash client não configurado.`);
        } else if (!workerUrl) {
             logger.warn(`${TAG} CLASSIFICATION_WORKER_URL não definido.`);
        }

        // --- Daily Snapshot Logic ---
        await createOrUpdateDailySnapshot(savedMetric);

    } catch (error) {
        logger.error(`${TAG} Erro CRÍTICO durante o salvamento/atualização da métrica ${media.id} no DB:`, error);
        throw error;
    } finally {
        const duration = Date.now() - startTime;
        logger.info(`${TAG} Concluído salvamento/atualização. User: ${userId}, Media: ${media.id}. Duração: ${duration}ms`);
    }
}

/**
 * Creates or updates the daily performance snapshot for a given metric.
 * @param metric - The saved/updated IMetric document.
 */
async function createOrUpdateDailySnapshot(metric: IMetric): Promise<void> {
    const SNAPSHOT_TAG = '[DailySnapshot]';
     // ... (código inalterado) ...
    if (metric.source !== 'api') { return; }
    if (!metric.postDate) {
        logger.warn(`${SNAPSHOT_TAG} Metric ${metric._id} não possui postDate. Impossível calcular snapshot.`);
        return;
    }

    try {
        const postDate = new Date(metric.postDate);
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const cutoffDate = new Date(postDate); cutoffDate.setUTCDate(cutoffDate.getUTCDate() + 30); cutoffDate.setUTCHours(0, 0, 0, 0);

        if (today > cutoffDate) { return; }

        const snapshotDate = today;
        logger.debug(`${SNAPSHOT_TAG} Calculando snapshot para Metric ${metric._id} na data ${snapshotDate.toISOString().split('T')[0]}.`);

        const lastSnapshot: IDailyMetricSnapshot | null = await DailyMetricSnapshotModel.findOne({ metric: metric._id, date: { $lt: snapshotDate } }).sort({ date: -1 }).lean();

        const previousCumulativeStats: Partial<Record<keyof IMetricStats, number>> = { views: 0, likes: 0, comments: 0, shares: 0, saved: 0, reach: 0, follows: 0, profile_visits: 0, total_interactions: 0 };
        if (lastSnapshot) {
            previousCumulativeStats.views = lastSnapshot.cumulativeViews ?? 0;
            previousCumulativeStats.likes = lastSnapshot.cumulativeLikes ?? 0;
            previousCumulativeStats.comments = lastSnapshot.cumulativeComments ?? 0;
            previousCumulativeStats.shares = lastSnapshot.cumulativeShares ?? 0;
            previousCumulativeStats.saved = lastSnapshot.cumulativeSaved ?? 0;
            previousCumulativeStats.reach = lastSnapshot.cumulativeReach ?? 0;
            previousCumulativeStats.follows = lastSnapshot.cumulativeFollows ?? 0;
            previousCumulativeStats.profile_visits = lastSnapshot.cumulativeProfileVisits ?? 0;
            previousCumulativeStats.total_interactions = lastSnapshot.cumulativeTotalInteractions ?? 0;
        }

        const currentCumulativeStats = metric.stats;
        if (!currentCumulativeStats) { logger.warn(`${SNAPSHOT_TAG} Metric ${metric._id} sem 'stats' atuais.`); return; }

        const dailyStats: Partial<Record<keyof IDailyMetricSnapshot, number>> = {};
        const metricsToCalculateDelta: (keyof IMetricStats)[] = [ 'views', 'likes', 'comments', 'shares', 'saved', 'reach', 'follows', 'profile_visits' ];

        for (const metricName of metricsToCalculateDelta) {
            const currentVal = Number(currentCumulativeStats[metricName] ?? 0);
            if (isNaN(currentVal)) { logger.warn(`${SNAPSHOT_TAG} Valor inválido para '${metricName}' em Metric ${metric._id}.`); continue; }
            const previousVal = previousCumulativeStats[metricName] ?? 0;
            const metricNameStr = String(metricName);
            const dailyKey = `daily${metricNameStr.charAt(0).toUpperCase() + metricNameStr.slice(1)}` as keyof IDailyMetricSnapshot;
            dailyStats[dailyKey] = Math.max(0, currentVal - previousVal);
            if (currentVal < previousVal) { logger.warn(`${SNAPSHOT_TAG} Valor cumulativo de '${metricNameStr}' diminuiu (${metric._id}). Atual: ${currentVal}, Anterior: ${previousVal}.`); }
        }

        type SnapshotUpdateData = {
            metric: Types.ObjectId; date: Date;
            dailyViews?: number; dailyLikes?: number; dailyComments?: number; dailyShares?: number; dailySaved?: number;
            dailyReach?: number; dailyFollows?: number; dailyProfileVisits?: number;
            cumulativeViews?: number; cumulativeLikes?: number; cumulativeComments?: number; cumulativeShares?: number; cumulativeSaved?: number;
            cumulativeReach?: number; cumulativeFollows?: number; cumulativeProfileVisits?: number; cumulativeTotalInteractions?: number;
        };

        const snapshotData: SnapshotUpdateData = {
             metric: metric._id, date: snapshotDate,
             dailyViews: dailyStats.dailyViews, dailyLikes: dailyStats.dailyLikes, dailyComments: dailyStats.dailyComments,
             dailyShares: dailyStats.dailyShares, dailySaved: dailyStats.dailySaved, dailyReach: dailyStats.dailyReach,
             dailyFollows: dailyStats.dailyFollows, dailyProfileVisits: dailyStats.dailyProfileVisits,
             cumulativeViews: Number(currentCumulativeStats.views ?? 0), cumulativeLikes: Number(currentCumulativeStats.likes ?? 0),
             cumulativeComments: Number(currentCumulativeStats.comments ?? 0), cumulativeShares: Number(currentCumulativeStats.shares ?? 0),
             cumulativeSaved: Number(currentCumulativeStats.saved ?? 0), cumulativeReach: Number(currentCumulativeStats.reach ?? 0),
             cumulativeFollows: Number(currentCumulativeStats.follows ?? 0), cumulativeProfileVisits: Number(currentCumulativeStats.profile_visits ?? 0),
             cumulativeTotalInteractions: Number(currentCumulativeStats.total_interactions ?? 0),
         };

        await DailyMetricSnapshotModel.updateOne({ metric: metric._id, date: snapshotDate }, { $set: snapshotData }, { upsert: true });
        logger.debug(`${SNAPSHOT_TAG} Snapshot salvo/atualizado para Metric ${metric._id} em ${snapshotDate.toISOString().split('T')[0]}.`);

    } catch (snapError) {
        logger.error(`${SNAPSHOT_TAG} Erro NÃO FATAL ao processar/salvar snapshot para Metric ${metric._id}:`, snapError);
    }
}


/**
 * Salva um snapshot dos insights da conta, demografia e dados básicos do perfil.
 * @param userId - ObjectId do usuário.
 * @param accountId - ID da conta do Instagram.
 * @param insights - Insights do período da conta.
 * @param demographics - Dados demográficos da audiência.
 * @param accountData - Dados básicos do perfil da conta.
 */
export async function saveAccountInsightData(
    userId: Types.ObjectId,
    accountId: string,
    insights: IAccountInsightsPeriod | undefined,
    demographics: IAudienceDemographics | undefined,
    accountData: Partial<IUser> | undefined
): Promise<void> {
    const TAG = '[saveAccountInsightData]';
     // ... (código inalterado) ...
    logger.debug(`${TAG} Preparando snapshot de insights/demografia/dados básicos para User ${userId}, Conta IG ${accountId}...`);
    try {
        const snapshot: Partial<IAccountInsight> = {
            user: userId, instagramAccountId: accountId, recordedAt: new Date(),
            ...(insights && Object.keys(insights).length > 1 && { accountInsightsPeriod: insights }),
            ...(demographics && (demographics.follower_demographics || demographics.engaged_audience_demographics) && { audienceDemographics: demographics }),
            ...(accountData && Object.keys(accountData).length > 1 && {
                accountDetails: {
                    username: accountData.username, name: accountData.name, biography: accountData.biography,
                    website: accountData.website, profile_picture_url: accountData.profile_picture_url,
                    followers_count: accountData.followers_count, follows_count: accountData.follows_count,
                    media_count: accountData.media_count,
                }
            }),
        };

        const hasDataToSave = !!snapshot.accountInsightsPeriod || !!snapshot.audienceDemographics || !!snapshot.accountDetails;

        if (hasDataToSave) {
            await connectToDatabase();
            await AccountInsightModel.create(snapshot);
            logger.info(`${TAG} Snapshot de conta salvo com sucesso para User ${userId}.`);
        } else {
            logger.warn(`${TAG} Nenhum dado novo de conta para salvar no snapshot para User ${userId}.`);
        }
    } catch (error) {
        logger.error(`${TAG} Erro ao salvar snapshot de conta para User ${userId}:`, error);
    }
}

/**
 * Dispara o processo completo de atualização de dados do Instagram para um usuário.
 * @param userId - ID (string) do usuário.
 * @returns Objeto com status de sucesso, mensagem e detalhes da operação.
 */
export async function triggerDataRefresh(userId: string): Promise<{ success: boolean; message: string; details?: any }> {
    const TAG = '[triggerDataRefresh]';
     // ... (código inalterado) ...
    const startTime = Date.now();
    logger.info(`${TAG} Iniciando atualização de dados para User ${userId}...`);

    if (!mongoose.isValidObjectId(userId)) {
         logger.error(`${TAG} ID de usuário inválido: ${userId}`);
         return { success: false, message: 'ID de usuário inválido.' };
    }
    const userObjectId = new Types.ObjectId(userId);

    const connectionDetails = await getInstagramConnectionDetails(userObjectId);
    if (!connectionDetails?.accessToken || !connectionDetails?.accountId) {
        await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncSuccess: false, lastInstagramSyncAttempt: new Date() } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (conexão inválida) ${userId}:`, dbErr));
        return { success: false, message: 'Usuário não conectado ou detalhes inválidos.' };
    }
    const { accessToken, accountId } = connectionDetails;

    await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncAttempt: new Date() } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar início sync ${userId}:`, dbErr));

    let totalMediaFound = 0, totalMediaProcessed = 0, collectedMediaInsights = 0, savedMediaMetrics = 0;
    let collectedAccountInsights = false, savedAccountInsights = false, collectedDemographics = false;
    let savedDemographics = false, collectedBasicAccountData = false;
    let errors: string[] = [];
    let mediaCurrentPage = 0;
    let hasMoreMediaPages = true;
    let overallSuccess = true;

    try {
        // --- 1. Fetch Basic Account Data ---
        logger.info(`${TAG} Buscando dados básicos da conta ${accountId}...`);
        let basicAccountData: Partial<IUser> | undefined;
        const basicDataResult = await fetchBasicAccountData(accountId, accessToken);
        if (basicDataResult.success && basicDataResult.data) {
             collectedBasicAccountData = true; basicAccountData = basicDataResult.data; logger.debug(`${TAG} Dados básicos obtidos.`);
        } else { logger.warn(`${TAG} Falha ao obter dados básicos: ${basicDataResult.error}`); errors.push(`Dados básicos: ${basicDataResult.error ?? 'Erro'}`); if (basicDataResult.error?.includes('Token')) overallSuccess = false; }

        // --- 2. Fetch and Process Media Pages ---
        if (overallSuccess) {
            logger.info(`${TAG} Iniciando busca de mídias (limite ${MAX_PAGES_MEDIA} pgs)...`);
            let nextPageMediaUrl: string | null | undefined = undefined; mediaCurrentPage = 0;
            do {
                mediaCurrentPage++; const pageStartTime = Date.now(); logger.info(`${TAG} Processando pág ${mediaCurrentPage}/${MAX_PAGES_MEDIA} de mídias...`);
                const mediaResult = await fetchInstagramMedia(userId, nextPageMediaUrl ?? undefined);
                if (!mediaResult.success) {
                    logger.error(`${TAG} Falha busca pág ${mediaCurrentPage} mídias: ${mediaResult.error}`); errors.push(`Busca mídia pág ${mediaCurrentPage}: ${mediaResult.error ?? 'Erro'}`);
                    if (mediaResult.error?.includes('Token')) { logger.warn(`${TAG} Erro de token, interrompendo busca de mídias.`); hasMoreMediaPages = false; overallSuccess = false; }
                }
                const mediaInPage = mediaResult.data ?? []; totalMediaFound += mediaInPage.length;
                if (mediaInPage.length > 0 && overallSuccess) {
                    const processableMedia = mediaInPage.filter(m => m.media_type !== 'STORY'); totalMediaProcessed += processableMedia.length;
                    logger.info(`${TAG} Pág ${mediaCurrentPage}: ${processableMedia.length} mídias processáveis. Buscando insights...`);
                    const insightTasks = processableMedia.map(media => limitInsightsFetch(async () => {
                        if (!media.id || !accessToken) return { mediaId: media.id ?? '?', status: 'skipped', reason: 'ID/Token ausente' };
                        const insightsResult = await fetchMediaInsights(media.id, accessToken);
                        if (!insightsResult.success && insightsResult.error?.includes('Token')) throw new Error('Token error');
                        return { mediaId: media.id, media, insightsResult };
                    }));
                    const insightTaskResults = await Promise.allSettled(insightTasks);
                    for (const result of insightTaskResults) {
                        if (result.status === 'fulfilled' && result.value) {
                            const { mediaId, media, insightsResult } = result.value;
                            if (insightsResult?.success && insightsResult.data) { collectedMediaInsights++; try { await saveMetricData(userObjectId, media, insightsResult.data); savedMediaMetrics++; } catch (saveError: any) { errors.push(`Salvar métrica ${mediaId}: ${saveError.message}`); } }
                            else if (insightsResult) { errors.push(`Insights mídia ${mediaId}: ${insightsResult.error || result.value.reason}`); }
                        } else if (result.status === 'rejected') {
                            const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
                            if (errorMsg.includes('Token error')) { logger.error(`${TAG} Erro de token nos insights. Interrompendo.`); errors.push('Erro de token nos insights.'); overallSuccess = false; hasMoreMediaPages = false; break; }
                            else { errors.push(`Erro tarefa insight: ${errorMsg}`); }
                        }
                    } if (!overallSuccess) break;
                } else if (!overallSuccess) logger.info(`${TAG} Pulando pág ${mediaCurrentPage} por erro anterior.`); else logger.info(`${TAG} Pág ${mediaCurrentPage}: Nenhuma mídia.`);
                nextPageMediaUrl = mediaResult.nextPageUrl; if (!nextPageMediaUrl) hasMoreMediaPages = false;
                logger.info(`${TAG} Pág ${mediaCurrentPage} mídias processada em ${Date.now() - pageStartTime}ms.`);
                if (hasMoreMediaPages && mediaCurrentPage < MAX_PAGES_MEDIA && overallSuccess) await new Promise(r => setTimeout(r, DELAY_MS));
            } while (hasMoreMediaPages && mediaCurrentPage < MAX_PAGES_MEDIA && overallSuccess);
            if (mediaCurrentPage >= MAX_PAGES_MEDIA && hasMoreMediaPages) errors.push(`Limite ${MAX_PAGES_MEDIA} pgs mídia atingido.`);
            logger.info(`${TAG} Processamento de mídias concluído.`);
        }

        // --- 3. Fetch and Save Account Insights & Demographics ---
        if (overallSuccess) {
            logger.info(`${TAG} Buscando insights/demografia da conta ${accountId}...`);
            let accountInsightData: IAccountInsightsPeriod | undefined; let audienceDemographicsData: IAudienceDemographics | undefined;
            const insightPeriod = DEFAULT_ACCOUNT_INSIGHTS_PERIOD;
            const accountInsightsResult = await fetchAccountInsights(accountId, accessToken, insightPeriod);
            if (accountInsightsResult.success && accountInsightsResult.data) { collectedAccountInsights = true; accountInsightData = accountInsightsResult.data; }
            else { errors.push(`Insights conta: ${accountInsightsResult.error ?? 'Erro'}`); if (accountInsightsResult.error?.includes('Token')) overallSuccess = false; }
            if (overallSuccess) {
                await new Promise(r => setTimeout(r, DELAY_MS));
                const demographicsResult = await fetchAudienceDemographics(accountId, accessToken); collectedDemographics = true;
                if (demographicsResult.success && demographicsResult.data && (demographicsResult.data.follower_demographics || demographicsResult.data.engaged_audience_demographics)) { audienceDemographicsData = demographicsResult.data; savedDemographics = true; }
                else { logger.warn(`${TAG} Falha/Dados insuficientes demografia: ${demographicsResult.error || demographicsResult.errorMessage}`); if(demographicsResult.error) errors.push(`Demografia: ${demographicsResult.error}`); if (demographicsResult.error?.includes('Token')) overallSuccess = false; }
            }
            if (overallSuccess && (accountInsightData || audienceDemographicsData || basicAccountData)) { logger.info(`${TAG} Salvando snapshot conta...`); await saveAccountInsightData( userObjectId, accountId, accountInsightData, audienceDemographicsData, basicAccountData ); savedAccountInsights = true; }
            else if (!overallSuccess) logger.warn(`${TAG} Pulando save snapshot conta por erro token.`); else logger.warn(`${TAG} Nenhum dado novo conta para salvar.`);
        } else logger.warn(`${TAG} Pulando insights/demografia conta por erro anterior.`);

        // --- Conclusion ---
        const duration = Date.now() - startTime; const finalSuccessStatus = overallSuccess;
        const statusMsg = finalSuccessStatus ? 'concluída com sucesso' : 'concluída com erros/falha';
        const summary = `Mídias: ${savedMediaMetrics}/${totalMediaProcessed}. Insights Conta: ${savedAccountInsights ? 'Salvo' : 'Não'}. Demo: ${savedDemographics ? 'Salva' : 'Não'}. Básicos: ${collectedBasicAccountData ? 'OK' : 'Não'}.`;
        const finalMessage = `Atualização ${statusMsg} para User ${userId}. ${summary} ${errors.length > 0 ? `Erros: ${errors.length}` : ''}`;
        logger.info(`${TAG} Finalizado. User: ${userId}. Sucesso Geral: ${overallSuccess}. Duração: ${duration}ms. ${finalMessage}`);
        if(errors.length > 0) logger.warn(`${TAG} Detalhes dos erros: ${errors.join('; ')}`);
        await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncSuccess: overallSuccess } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status final sync ${userId}:`, dbErr));
        return { success: overallSuccess, message: finalMessage, details: { errors, durationMs: duration, /* add other counters */ } };

    } catch (error: unknown) {
        const duration = Date.now() - startTime; logger.error(`${TAG} Erro crítico NÃO TRATADO ${userId}. Duração: ${duration}ms`, error);
        const message = error instanceof Error ? error.message : String(error);
        await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncSuccess: false } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (erro crítico) ${userId}:`, dbErr));
        return { success: false, message: `Erro interno crítico: ${message}` };
    }
}

// =========================================================================
// == Função fetchAvailableInstagramAccounts ATUALIZADA com Fluxo System User ===
// =========================================================================
export async function fetchAvailableInstagramAccounts(
    shortLivedToken: string, // Usado apenas no fluxo de fallback
    userId: string // Usado apenas no fluxo de fallback para obter LLAT
): Promise<FetchInstagramAccountsResult | FetchInstagramAccountsError> {
    const TAG = '[fetchAvailableInstagramAccounts vSystemUser]';
    logger.info(`${TAG} Iniciando busca de contas IG disponíveis...`);

    const businessId = process.env.FACEBOOK_BUSINESS_ID;
    const systemUserToken = process.env.FB_SYSTEM_USER_TOKEN;

    // --- Fluxo Primário: System User Token ---
    if (businessId && systemUserToken) {
        logger.info(`${TAG} Utilizando fluxo primário via System User Token e Business ID.`);
        const systemUserAccessToken = systemUserToken;
        type PageAccountData = { id: string; name: string; instagram_business_account?: { id: string; } };
        const allPagesData: PageAccountData[] = [];
        let currentPageUrl: string | null = `${BASE_URL}/${API_VERSION}/${businessId}/owned_pages?fields=id,name,instagram_business_account{id}&limit=100&access_token=${systemUserAccessToken}`;
        let pageCount = 0;
        let fetchError: Error | null = null;

        logger.debug(`${TAG} Buscando páginas via /owned_pages...`);
        while (currentPageUrl && pageCount < MAX_ACCOUNT_FETCH_PAGES) {
            pageCount++;
            logger.debug(`${TAG} Buscando página ${pageCount}/${MAX_ACCOUNT_FETCH_PAGES} de /owned_pages...`);
            try {
                const paginationRetryOptions = { ...RETRY_OPTIONS, retries: 2 };
                const pageData = await retry(async (bail, attempt) => {
                    if (attempt > 1) logger.warn(`${TAG} Tentativa ${attempt} pág ${pageCount} /owned_pages.`);

                    // <<< ADICIONADO LOG DE DEBUG AQUI >>>
                    logger.debug(`${TAG} [System User Flow] Chamando fetch para URL: ${currentPageUrl?.replace(systemUserAccessToken, '[SYSTEM_TOKEN_OCULTO]')}`);
                    // <<< FIM DO LOG DE DEBUG >>>

                    const response = await fetch(currentPageUrl!);
                    if (!response.headers.get('content-type')?.includes('application/json')) {
                        logger.error(`${TAG} Resposta não-JSON (Status: ${response.status}) pág ${pageCount} /owned_pages`);
                        bail(new Error(`Resposta não-JSON (Status: ${response.status})`)); return null;
                    }
                    const data: InstagramApiResponse<PageAccountData> & FacebookApiError = await response.json();
                    if (!response.ok || data.error) {
                        type ErrorType = FacebookApiErrorStructure | { message: string; code: number; };
                        const error: ErrorType = data.error || { message: `Erro ${response.status} pág ${pageCount}`, code: response.status };
                        logger.error(`${TAG} Erro API (System User) (Tentativa ${attempt}) pág ${pageCount}:`, error);
                        if (error.code === 190) { bail(new Error('System User Token inválido/expirado.')); return; }
                        if (error.code === 10 || error.code === 200) { bail(new Error('Permissão insuficiente para System User (business_management, pages_show_list, etc.).')); return; }
                        if (error.code === 100 && error.message.includes("Unsupported get request")) { bail(new Error(`Business ID (${businessId}) inválido ou não acessível pelo System User Token.`)); return; }
                        if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha pág ${pageCount} /owned_pages: ${error.message}`)); return; }
                        throw new Error(error.message || `Erro temp ${response.status} pág ${pageCount}.`);
                    } return data;
                }, paginationRetryOptions);

                if (pageData?.data) { allPagesData.push(...pageData.data); logger.debug(`${TAG} Pág ${pageCount}: ${pageData.data.length} itens. Total: ${allPagesData.length}`); }
                else if (pageData === null) { logger.warn(`${TAG} Busca pág ${pageCount} /owned_pages falhou/interrompida.`); }
                else { logger.warn(`${TAG} Pág ${pageCount} /owned_pages sem 'data'. Resp:`, pageData); }
                currentPageUrl = pageData?.paging?.next ?? null;
                if (currentPageUrl) await new Promise(r => setTimeout(r, ACCOUNT_FETCH_DELAY_MS));
            } catch (error) {
                fetchError = error instanceof Error ? error : new Error(String(error));
                logger.error(`${TAG} Erro irrecuperável (System User) pág ${pageCount}:`, fetchError);
                currentPageUrl = null; // Stop pagination
            }
        } // End while

        if (pageCount >= MAX_ACCOUNT_FETCH_PAGES && currentPageUrl) logger.warn(`${TAG} Limite ${MAX_ACCOUNT_FETCH_PAGES} págs /owned_pages atingido.`);
        if (fetchError) {
            return { success: false, error: `Erro ao buscar páginas via System User: ${fetchError.message}`, errorCode: 500 };
        }

        logger.info(`${TAG} Busca paginada /owned_pages concluída. ${allPagesData.length} itens em ${pageCount} págs API.`);
        const availableAccounts: AvailableInstagramAccount[] = [];
        for (const page of allPagesData) {
            if (page.instagram_business_account?.id) {
                availableAccounts.push({ igAccountId: page.instagram_business_account.id, pageId: page.id, pageName: page.name });
            }
        }

        if (availableAccounts.length === 0) {
            const errorMsg = "Nenhuma conta IG Business/Creator encontrada vinculada às páginas do Business Manager acessíveis pelo System User.";
            logger.warn(`${TAG} ${errorMsg} BusinessID: ${businessId}. Págs processadas: ${allPagesData.length}`);
            return { success: false, error: errorMsg, errorCode: 404 };
        }

        logger.info(`${TAG} (System User) Encontradas ${availableAccounts.length} contas IG vinculadas.`);
        logger.debug(`${TAG} (System User) Contas (Nomes): ${availableAccounts.map(a => a.pageName).join(', ')}`);
        return { success: true, accounts: availableAccounts, longLivedAccessToken: '' };

    }
    // --- Fluxo de Fallback: Token de Usuário ---
    else {
        // ... (Código do Fallback inalterado) ...
        logger.info(`${TAG} Utilizando fluxo de fallback via User Token (LLAT) e /me/accounts.`);
        if (!mongoose.isValidObjectId(userId)) {
            const errorMsg = `ID de usuário inválido fornecido para o fluxo de fallback: ${userId}`;
            logger.error(`${TAG} ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
        if (!shortLivedToken) {
             const errorMsg = `Token de curta duração (shortLivedToken) não fornecido para o fluxo de fallback.`;
             logger.error(`${TAG} ${errorMsg}`);
             return { success: false, error: errorMsg };
        }

        let userLongLivedAccessToken: string | null = null;
        type PageAccountData = { id: string; name: string; instagram_business_account?: { id: string; } };

        try {
            // 1. Trocar SLT por LLAT
            logger.debug(`${TAG} (Fallback) Tentando obter LLAT para User ${userId}...`);
            const llatUrl = `${BASE_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${shortLivedToken}`;
            const llatData = await retry(async (bail, attempt) => {
                if (attempt > 1) logger.warn(`${TAG} (Fallback) Tentativa ${attempt} para obter LLAT.`);
                const response = await fetch(llatUrl); const data: any & FacebookApiError = await response.json();
                if (!response.ok || !data.access_token) {
                    type ErrorType = FacebookApiErrorStructure | { message: string; code: number; };
                    const error: ErrorType = data.error || { message: `Erro ${response.status} ao obter LLAT`, code: response.status };
                    logger.error(`${TAG} (Fallback) Erro API (Tentativa ${attempt}) ao obter LLAT:`, error);
                    if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(error.message || 'Falha ao obter token de longa duração.')); return; }
                    throw new Error(error.message || `Erro temporário ${response.status} ao obter LLAT.`);
                } return data;
            }, RETRY_OPTIONS);
            userLongLivedAccessToken = llatData.access_token;
            logger.info(`${TAG} (Fallback) LLAT obtido com sucesso para User ${userId}.`);

            // 2. Buscar Páginas via /me/accounts com paginação
            logger.debug(`${TAG} (Fallback) Buscando páginas FB (/me/accounts) com paginação para User ${userId}...`);
            const allPagesData: PageAccountData[] = [];
            let currentPageUrl: string | null = `${BASE_URL}/${API_VERSION}/me/accounts?fields=id,name,instagram_business_account{id}&limit=100&access_token=${userLongLivedAccessToken}`;
            let pageCount = 0; let fetchError: Error | null = null;
            while (currentPageUrl && pageCount < MAX_ACCOUNT_FETCH_PAGES) {
                pageCount++; logger.debug(`${TAG} (Fallback) Buscando página ${pageCount}/${MAX_ACCOUNT_FETCH_PAGES} de /me/accounts...`);
                try {
                    const paginationRetryOptions = { ...RETRY_OPTIONS, retries: 2 };
                    const pageData = await retry(async (bail, attempt) => {
                        if (attempt > 1) logger.warn(`${TAG} (Fallback) Tentativa ${attempt} pág ${pageCount} /me/accounts.`);
                        // <<< ADICIONADO LOG DE DEBUG AQUI (Fallback) >>>
                        logger.debug(`${TAG} [Fallback Flow] Chamando fetch para URL: ${currentPageUrl?.replace(userLongLivedAccessToken!, '[USER_TOKEN_OCULTO]')}`);
                        // <<< FIM DO LOG DE DEBUG >>>
                        const response = await fetch(currentPageUrl!); if (!response.headers.get('content-type')?.includes('application/json')) { bail(new Error(`Resposta não-JSON (Status: ${response.status})`)); return null; }
                        const data: InstagramApiResponse<PageAccountData> & FacebookApiError = await response.json();
                        if (!response.ok || data.error) {
                            type ErrorType = FacebookApiErrorStructure | { message: string; code: number; }; const error: ErrorType = data.error || { message: `Erro ${response.status} pág ${pageCount}`, code: response.status }; logger.error(`${TAG} (Fallback) Erro API (Tentativa ${attempt}) pág ${pageCount}:`, error);
                            if (error.code === 190) { bail(new Error('Token inválido/expirado.')); return; } if (error.code === 10) { bail(new Error('Permissão `pages_show_list` ausente.')); return; } if (error.code === 100 && 'error_subcode' in error && error.error_subcode === 33) { bail(new Error('Página requer conta IG conectada.')); return; } if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha pág ${pageCount}: ${error.message}`)); return; } throw new Error(error.message || `Erro temp ${response.status} pág ${pageCount}.`);
                        } return data;
                    }, paginationRetryOptions);
                    if (pageData?.data) { allPagesData.push(...pageData.data); logger.debug(`${TAG} (Fallback) Pág ${pageCount}: ${pageData.data.length} itens. Total: ${allPagesData.length}`); }
                    else if (pageData === null) { logger.warn(`${TAG} (Fallback) Busca pág ${pageCount} falhou/interrompida.`); }
                    else { logger.warn(`${TAG} (Fallback) Pág ${pageCount} /me/accounts sem 'data'. Resp:`, pageData); }
                    currentPageUrl = pageData?.paging?.next ?? null; if (currentPageUrl) await new Promise(r => setTimeout(r, ACCOUNT_FETCH_DELAY_MS));
                } catch (error) { fetchError = error instanceof Error ? error : new Error(String(error)); logger.error(`${TAG} (Fallback) Erro irrecuperável pág ${pageCount}:`, fetchError); currentPageUrl = null; }
            } // End while
            if (pageCount >= MAX_ACCOUNT_FETCH_PAGES && currentPageUrl) logger.warn(`${TAG} (Fallback) Limite ${MAX_ACCOUNT_FETCH_PAGES} págs /me/accounts atingido.`);
            if (fetchError) { if (fetchError.message.toLowerCase().includes('token')) { await clearInstagramConnection(userId); } throw fetchError; }
            logger.info(`${TAG} (Fallback) Busca paginada /me/accounts concluída. ${allPagesData.length} itens em ${pageCount} págs API.`);

            // 3. Filtrar e Mapear Contas
            const availableAccounts: AvailableInstagramAccount[] = [];
            for (const page of allPagesData) { if (page.instagram_business_account?.id) { availableAccounts.push({ igAccountId: page.instagram_business_account.id, pageId: page.id, pageName: page.name }); } }
            if (availableAccounts.length === 0) { const errorMsg = "Nenhuma conta IG Business/Creator vinculada encontrada (pós-paginação /me/accounts)."; logger.warn(`${TAG} (Fallback) ${errorMsg} User: ${userId}. Págs processadas: ${allPagesData.length}`); return { success: false, error: errorMsg, errorCode: 404 }; }
            logger.info(`${TAG} (Fallback) Encontradas ${availableAccounts.length} contas IG vinculadas para User ${userId}.`);
            logger.debug(`${TAG} (Fallback) Contas (Nomes): ${availableAccounts.map(a => a.pageName).join(', ')}`);

            // 4. Retornar Lista e LLAT do Usuário
            if (!userLongLivedAccessToken) { throw new Error("LLAT (usuário) nulo inesperadamente."); }
            return { success: true, accounts: availableAccounts, longLivedAccessToken: userLongLivedAccessToken };

        } catch (error: unknown) { // Catch para o fluxo de fallback
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`${TAG} (Fallback) Erro CRÍTICO ${userId}:`, error);
            if (userLongLivedAccessToken && errorMsg.toLowerCase().includes('token')) { await clearInstagramConnection(userId); }
            return { success: false, error: errorMsg.includes('Token') || errorMsg.includes('Permissão') || errorMsg.includes('Falha') ? errorMsg : `Erro interno (Fallback): ${errorMsg}` };
        }
    } // Fim do else (Fallback)
}
// =========================================================================
// == FIM DA FUNÇÃO ATUALIZADA fetchAvailableInstagramAccounts         ===
// =========================================================================


/**
 * Finaliza a conexão com o Instagram salvando o token e ID selecionado no DB.
 * @param userId - ID (string) do usuário.
 * @param selectedIgAccountId - ID da conta Instagram selecionada.
 * @param longLivedAccessToken - Token de acesso de longa duração (do usuário, fluxo fallback).
 * @returns Objeto indicando sucesso ou falha.
 */
export async function finalizeInstagramConnection(
    userId: string,
    selectedIgAccountId: string,
    longLivedAccessToken: string // Este token vem do fluxo de fallback
): Promise<{ success: boolean; message?: string; error?: string }> {
    const TAG = '[finalizeInstagramConnection]';
    // ... (código inalterado) ...
    logger.info(`${TAG} (Fallback) Finalizando conexão User ${userId}, Conta IG ${selectedIgAccountId}`);

    if (!mongoose.isValidObjectId(userId)) return { success: false, error: `ID usuário inválido: ${userId}` };
    if (!selectedIgAccountId) return { success: false, error: `ID conta IG não fornecido.` };
    if (!longLivedAccessToken) return { success: false, error: `LLAT (usuário) não fornecido.` };

    try {
        await connectToDatabase();
        const updateData = {
            instagramAccessToken: longLivedAccessToken,
            instagramAccountId: selectedIgAccountId,
            isInstagramConnected: true,
            lastInstagramSyncAttempt: new Date(),
            lastInstagramSyncSuccess: null,
        };
        const updateResult = await DbUser.findByIdAndUpdate(userId, { $set: updateData });

        if (!updateResult) return { success: false, error: `Usuário ${userId} não encontrado no DB.` };

        logger.info(`${TAG} (Fallback) Usuário ${userId} atualizado. Conexão IG ${selectedIgAccountId} OK.`);

        triggerDataRefresh(userId).then(res => {
            logger.info(`${TAG} (Fallback) triggerDataRefresh async ${userId}. Sucesso: ${res.success}. Msg: ${res.message}`);
            DbUser.findByIdAndUpdate(userId, { $set: { lastInstagramSyncSuccess: res.success } })
                  .catch(err => logger.error(`${TAG} (Fallback) Erro update lastSyncSuccess ${userId}:`, err));
        }).catch(err => {
            logger.error(`${TAG} (Fallback) Erro triggerDataRefresh async ${userId}:`, err);
            DbUser.findByIdAndUpdate(userId, { $set: { lastInstagramSyncSuccess: false } })
                  .catch(dbErr => logger.error(`${TAG} (Fallback) Erro update lastSyncSuccess (fail) ${userId}:`, dbErr));
        });

        return { success: true, message: "Conta Instagram conectada (via fallback)!" };

    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`${TAG} (Fallback) Erro CRÍTICO ${userId}:`, error);
        return { success: false, error: `Erro interno (Fallback): ${errorMsg}` };
    }
}

/**
 * Processa um payload de webhook para insights de Story.
 * @param mediaId - ID da mídia (Story) do webhook.
 * @param webhookAccountId - ID da conta Instagram que recebeu o webhook.
 * @param value - Objeto 'value' do payload do webhook.
 * @returns Objeto indicando sucesso ou falha no processamento.
 */
export async function processStoryWebhookPayload(
    mediaId: string,
    webhookAccountId: string | undefined,
    value: any
): Promise<{ success: boolean; error?: string }> {
    const TAG = '[processStoryWebhookPayload]';
     // ... (código inalterado) ...
    logger.debug(`${TAG} Payload Media ${mediaId}, Conta ${webhookAccountId}.`);

    if (!webhookAccountId) return { success: false, error: 'ID conta webhook ausente.' };
    if (!value || typeof value !== 'object') return { success: false, error: 'Payload value inválido.' };

    try {
        await connectToDatabase();
        const user = await DbUser.findOne({ instagramAccountId: webhookAccountId }).select('_id').lean();

        if (!user) { logger.warn(`${TAG} Usuário não encontrado ${webhookAccountId} (Webhook). Ignorando.`); return { success: true }; }
        const userId = user._id;

        const stats: Partial<IStoryStats> = {
            impressions: value.impressions, reach: value.reach, taps_forward: value.taps_forward,
            taps_back: value.taps_back, exits: value.exits, replies: value.replies,
        };
         Object.keys(stats).forEach(key => (stats[key as keyof IStoryStats] == null) && delete stats[key as keyof IStoryStats]);

        if (Object.keys(stats).length === 0) { logger.warn(`${TAG} Nenhum insight válido ${mediaId}.`); return { success: true }; }

        const filter = { user: userId, instagramMediaId: mediaId };
        const updateData = {
            $set: { stats: stats as IStoryStats, lastWebhookAt: new Date() },
            $setOnInsert: { user: userId, instagramMediaId: mediaId, createdAt: new Date() }
        };
        const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true };
        const savedStoryMetric = await StoryMetricModel.findOneAndUpdate(filter, updateData, options);

        if (!savedStoryMetric) { logger.error(`${TAG} Falha upsert Story ${mediaId}.`); return { success: false, error: 'Falha DB save Story.' }; }

        logger.info(`${TAG} Insights Story ${mediaId} (Webhook) OK User ${userId}.`);
        return { success: true };

    } catch (error) {
        logger.error(`${TAG} Erro webhook Story ${mediaId}, Conta ${webhookAccountId}:`, error);
        return { success: false, error: 'Erro interno webhook Story.' };
    }
}
