// src/app/lib/instagramService.ts - v1.7.6 (Corrige erro tipo 'lastWebhookUpdate' e mantém logs DEBUG)
// - Remove a chave 'lastWebhookUpdate' do updateData em processStoryWebhookPayload.
// - Mantém correções anteriores ('recordedAt', 'insights', 'demographics', 'format').
// - Mantém implementação real e logs de depuração em getFacebookLongLivedTokenAndIgId.
// - Mantém refatoração e otimizações anteriores.

import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User";
import MetricModel, { IMetric, IMetricStats } from "@/app/models/Metric";
import AccountInsightModel, {
    IAccountInsight,
    IAccountInsightsPeriod,
    IAudienceDemographics,
    IDemographicBreakdown
} from "@/app/models/AccountInsight"; // Presume que este model foi atualizado com 'recordedAt'
import StoryMetricModel, { IStoryMetric, IStoryStats } from "@/app/models/StoryMetric"; // Presume que este model NÃO tem 'format' nem 'lastWebhookUpdate'
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from "@/app/models/DailyMetricSnapshot";
import { logger } from "@/app/lib/logger";
import mongoose, { Types, Document } from "mongoose";
import retry from 'async-retry';
import { Client } from "@upstash/qstash";
import pLimit from 'p-limit';

// Importar constantes globais
import {
    API_VERSION, BASE_URL, BASIC_ACCOUNT_FIELDS, MEDIA_INSIGHTS_METRICS,
    ACCOUNT_INSIGHTS_METRICS, DEMOGRAPHICS_METRICS,
    MEDIA_BREAKDOWNS, ACCOUNT_BREAKDOWNS,
    DEMOGRAPHICS_BREAKDOWNS, DEMOGRAPHICS_TIMEFRAME, DEFAULT_ACCOUNT_INSIGHTS_PERIOD
} from '@/config/instagram.config';

// --- Configurações ---
const RETRY_OPTIONS = { retries: 3, factor: 2, minTimeout: 500, maxTimeout: 5000, randomize: true };
const INSIGHTS_CONCURRENCY_LIMIT = 5;
const MAX_PAGES_MEDIA = 10;
const DELAY_MS = 250;

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
interface InstagramApiResponse<T = InstagramApiInsightItem> { data: T[]; paging?: { next?: string; previous?: string; }; error?: FacebookApiError['error']; }
interface FacebookApiError { error?: { message: string; type: string; code: number; error_subcode?: number; fbtrace_id: string; }; }
interface FetchInsightsResult<T = Record<string, any>> { success: boolean; data?: T; error?: string; errorMessage?: string; }
interface FetchBasicAccountDataResult { success: boolean; data?: Partial<IUser>; error?: string; }

// Inicializa cliente QStash
const qstashClient = process.env.QSTASH_TOKEN ? new Client({ token: process.env.QSTASH_TOKEN }) : null;
if (!qstashClient) { logger.error("[instagramService] QSTASH_TOKEN não definido."); }

// Inicializa limitador de concorrência
const limitInsightsFetch = pLimit(INSIGHTS_CONCURRENCY_LIMIT);

// --- Funções ---

/**
 * Busca o token de acesso e o ID da conta do Instagram para um usuário.
 */
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
 * Busca as mídias (Posts, Reels, Carrosséis) de uma conta do Instagram.
 */
export async function fetchInstagramMedia(userId: string, pageUrl?: string): Promise<FetchMediaResult> { // pageUrl é string | undefined
    const TAG = '[fetchInstagramMedia]';
    const logPrefix = pageUrl ? `${TAG} (Paginação)` : TAG;
    logger.info(`${logPrefix} Iniciando busca de mídias para User ${userId}...`);

    const connectionDetails = await getInstagramConnectionDetails(userId);
    if (!connectionDetails) return { success: false, error: 'Usuário não conectado ao Instagram ou detalhes inválidos.' };
    const { accessToken } = connectionDetails;

    const getUrl = () => {
        if (pageUrl) { // pageUrl aqui é string ou undefined
            let url = pageUrl;
            if (accessToken && !url.includes('access_token=')) {
                url += `&access_token=${accessToken}`;
            }
            return url;
        } else {
            const accountId = connectionDetails.accountId;
            const fields = 'id,media_type,timestamp,caption,permalink,username,children{id,media_type,media_url,permalink}';
            const limit = 25; // Limite padrão da API, pode ser ajustado se necessário
            return `${BASE_URL}/${accountId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`;
        }
    };

    try {
        const responseData = await retry(async (bail, attempt) => {
            const currentUrl = getUrl();
            if (attempt > 1) {
                 logger.warn(`${logPrefix} Tentativa ${attempt} para buscar mídias. URL: ${currentUrl.replace(accessToken!, '[TOKEN_OCULTO]')}`);
            } else {
                 logger.debug(`${logPrefix} URL da API: ${currentUrl.replace(accessToken!, '[TOKEN_OCULTO]')}`);
            }

            const response = await fetch(currentUrl);
            const data: InstagramApiResponse<InstagramMedia> & FacebookApiError = await response.json();

            if (!response.ok || data.error) {
                const error = data.error || { message: `Erro ${response.status} da API`, code: response.status };
                logger.error(`${logPrefix} Erro da API (Tentativa ${attempt}) ao buscar mídias para User ${userId}:`, error);

                const isTokenError = error.code === 190 ||
                                     ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));

                if (isTokenError) {
                    logger.warn(`${TAG} Erro de token (${error.code}/${'error_subcode' in error ? error.error_subcode : 'N/A'}) detectado. Não tentar novamente.`);
                    await clearInstagramConnection(userId); // Limpa conexão inválida
                    bail(new Error('Token de acesso inválido ou expirado. Por favor, reconecte sua conta.'));
                    return;
                }
                // Erros 4xx (exceto 429 - rate limit) geralmente não são recuperáveis com retry
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    logger.warn(`${TAG} Erro ${response.status} (Client Error) não recuperável. Não tentar novamente.`);
                    bail(new Error(`Falha ao buscar mídias (Erro ${response.status}): ${error.message}`));
                    return;
                }
                // Outros erros (5xx, 429, network errors) podem ser tentados novamente
                throw new Error(`Erro temporário (${response.status}) ao buscar mídias: ${error.message}`);
            }
            return data;

        }, RETRY_OPTIONS);

        logger.info(`${logPrefix} Mídias buscadas com sucesso para User ${userId}. ${responseData!.data?.length || 0} itens retornados nesta página.`);
        return {
            success: true,
            data: responseData!.data || [],
            nextPageUrl: responseData!.paging?.next || null, // nextPageUrl pode ser string ou null
        };

    } catch (error: unknown) {
        logger.error(`${logPrefix} Erro final ao buscar mídias para User ${userId} após retentativas:`, error);
        const message = error instanceof Error ? error.message : String(error);
        // Retorna mensagens específicas para erros de token/falha ou uma genérica
        return { success: false, error: message.startsWith('Token') || message.startsWith('Falha') ? message : `Erro interno ao buscar mídias: ${message}` };
    }
}

/**
 * Busca os insights para uma mídia específica (Post, Reel, Carrossel).
 */
export async function fetchMediaInsights(mediaId: string, accessToken: string): Promise<FetchInsightsResult<IMetricStats>> {
    const TAG = '[fetchMediaInsights]';
    logger.debug(`${TAG} Buscando insights v19.0+ para Media ID: ${mediaId}...`);

    const metrics = MEDIA_INSIGHTS_METRICS;
    let urlBase = `${BASE_URL}/${mediaId}/insights?metric=${metrics}`;
    // Adiciona breakdown se necessário para métricas específicas (ex: profile_activity)
    const requestedMetrics = metrics.split(',');
    if (requestedMetrics.includes('profile_activity') && MEDIA_BREAKDOWNS['profile_activity']) {
        urlBase += `&breakdown=${MEDIA_BREAKDOWNS['profile_activity']}`;
    }
    // Adicionar outros breakdowns se necessário

    try {
        const responseData = await retry(async (bail, attempt) => {
            const currentUrl = `${urlBase}&access_token=${accessToken}`;
             if (attempt > 1) {
                 logger.warn(`${TAG} Tentativa ${attempt} para buscar insights da mídia ${mediaId}.`);
             } // else { logger.debug(`${TAG} URL API Insights: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }

            const response = await fetch(currentUrl);
            const data: InstagramApiResponse<InstagramApiInsightItem> & FacebookApiError = await response.json();

            if (!response.ok || data.error) {
                const error = data.error || { message: `Erro ${response.status} da API`, code: response.status };
                logger.error(`${TAG} Erro da API (Tentativa ${attempt}) ao buscar insights para Media ${mediaId}:`, error);

                const isTokenError = error.code === 190 ||
                                     ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));

                // Erro de permissão (Code 10) - não tentar novamente
                if (error.code === 10) {
                    bail(new Error(`Permissão insuficiente para buscar insights da mídia: ${error.message}`));
                    return;
                }
                 // Erro de token - não tentar novamente
                 if (isTokenError) {
                     bail(new Error('Token de acesso inválido ou expirado ao buscar insights.'));
                     return;
                 }
                 // Outros erros 4xx (exceto 429) - não tentar novamente
                 if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                     bail(new Error(`Falha ao buscar insights da mídia (Erro ${response.status}): ${error.message}`));
                     return;
                 }
                // Outros erros (5xx, 429, network) - tentar novamente
                throw new Error(`Erro temporário (${response.status}) ao buscar insights da mídia: ${error.message}`);
            }
            return data;

        }, RETRY_OPTIONS);

        // Processa os insights recebidos
        const insights: Partial<IMetricStats> = {};
        if (responseData!.data) {
            responseData!.data.forEach(item => {
                const metricName = item.name;
                if (item.values && item.values.length > 0) {
                    // Pega o valor mais recente (geralmente só tem um para métricas de mídia)
                    const latestValue = item.values[item.values.length - 1]!.value;
                    if (typeof latestValue === 'number') {
                        insights[metricName as keyof IMetricStats] = latestValue;
                    } else if (typeof latestValue === 'object' && latestValue !== null) {
                        // Para métricas com breakdown (ex: profile_activity)
                        insights[metricName as keyof IMetricStats] = latestValue;
                    }
                } // else { logger.warn(`${TAG} Métrica '${metricName}' retornada sem valores para Media ${mediaId}.`); }
            });
        }

        // logger.debug(`${TAG} Insights v19.0+ buscados com sucesso para Media ${mediaId}.`, insights);
        return { success: true, data: insights as IMetricStats };

    } catch (error: unknown) {
        // logger.error(`${TAG} Erro final ao buscar insights v19.0+ para Media ${mediaId}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.includes('Permissão') || message.includes('Token') || message.includes('Falha') ? message : `Erro interno ao buscar insights da mídia: ${message}` };
    }
}

/**
 * Busca os insights de nível de conta para um período específico.
 */
export async function fetchAccountInsights(
    accountId: string,
    accessToken: string,
    period: string = DEFAULT_ACCOUNT_INSIGHTS_PERIOD
): Promise<FetchInsightsResult<IAccountInsightsPeriod>> {
    const TAG = '[fetchAccountInsights]';
    logger.debug(`${TAG} Buscando insights da conta ${accountId} para o período: ${period}...`);

    const metrics = ACCOUNT_INSIGHTS_METRICS;
    let urlBase = `${BASE_URL}/${accountId}/insights?metric=${metrics}&period=${period}`;
    // Adiciona breakdowns necessários para métricas de conta
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
            } // else { logger.debug(`${TAG} URL API Insights Conta: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }

            const response = await fetch(currentUrl);
            const data: InstagramApiResponse<InstagramApiInsightItem> & FacebookApiError = await response.json();

            if (!response.ok || data.error) {
                const error = data.error || { message: `Erro ${response.status} da API`, code: response.status };
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
        if (responseData!.data) {
            responseData!.data.forEach(item => {
                const metricName = item.name;
                if (item.values && item.values.length > 0) {
                    // Para insights de conta, geralmente o valor é o primeiro do array
                    const valueData = item.values[0]!.value;
                    if (typeof valueData === 'number') {
                        insights[metricName as keyof IAccountInsightsPeriod] = valueData;
                    } else if (typeof valueData === 'object' && valueData !== null) {
                        insights[metricName as keyof IAccountInsightsPeriod] = valueData; // Para breakdowns
                    }
                } // else { logger.warn(`${TAG} Métrica de conta '${metricName}' retornada sem valores para ${accountId}.`); }
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
 * Busca os dados demográficos da audiência (seguidores e engajados).
 */
export async function fetchAudienceDemographics(
    accountId: string,
    accessToken: string
): Promise<FetchInsightsResult<IAudienceDemographics>> {
    const TAG = '[fetchAudienceDemographics]';
    logger.debug(`${TAG} Buscando dados demográficos da conta ${accountId}...`);

    const metrics = DEMOGRAPHICS_METRICS;
    const period = 'lifetime'; // Demografia geralmente é 'lifetime'
    const breakdown = DEMOGRAPHICS_BREAKDOWNS; // Ex: 'gender,age,city,country'
    const timeframe = DEMOGRAPHICS_TIMEFRAME; // Ex: 'last_90_days' (para audiência engajada)
    const urlBase = `${BASE_URL}/${accountId}/insights?metric=${metrics}&period=${period}&breakdown=${breakdown}&timeframe=${timeframe}`;

    try {
        const responseData = await retry(async (bail, attempt) => {
             const currentUrl = `${urlBase}&access_token=${accessToken}`;
             if (attempt > 1) {
                 logger.warn(`${TAG} Tentativa ${attempt} para buscar demografia da conta ${accountId}.`);
             } // else { logger.debug(`${TAG} URL API Demografia: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }

            const response = await fetch(currentUrl);
            // A resposta de demografia tem um formato ligeiramente diferente
            const data: InstagramApiResponse<InstagramApiDemographicItem> & FacebookApiError = await response.json();

            if (!response.ok || data.error) {
                const error = data.error || { message: `Erro ${response.status} da API`, code: response.status };
                logger.error(`${TAG} Erro da API (Tentativa ${attempt}) ao buscar demografia da conta ${accountId}:`, error);

                const isTokenError = error.code === 190 ||
                                     ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));

                if (isTokenError) { bail(new Error('Token de acesso inválido ou expirado ao buscar demografia.')); return; }
                // Erros 10 (Permissão) ou 200 (OK, mas dados insuficientes) são tratados como "sem dados"
                if (response.status >= 400 && response.status < 500 && response.status !== 429 && error.code !== 10 && error.code !== 200) {
                     bail(new Error(`Falha ao buscar demografia (Erro ${response.status}): ${error.message}`)); return;
                 }
                 // Se for erro 10 ou 200, ou outros erros temporários, permite retry ou trata como sem dados
                 if (error.code !== 10 && error.code !== 200) {
                     throw new Error(`Erro temporário (${response.status}) ao buscar demografia: ${error.message}`);
                 }
            }

            // Trata caso de erro 10/200 ou resposta OK sem dados como sucesso, mas sem dados
             if (data.error && (data.error.code === 10 || data.error.code === 200)) {
                  logger.warn(`${TAG} Permissão ausente, dados insuficientes ou erro (${data.error.code}) ao buscar demografia para ${accountId}.`);
                  return { data: [] }; // Retorna sucesso com array vazio
             }
             if (response.ok && (!data.data || data.data.length === 0)) {
                 logger.warn(`${TAG} Demografia retornada com sucesso, mas sem dados para conta ${accountId}.`);
             }

            return data;

        }, RETRY_OPTIONS);

        // Processa a estrutura de dados demográficos
        const demographics: Partial<IAudienceDemographics> = {};
        if (responseData!.data) {
            responseData!.data.forEach(item => {
                const metricName = item.name; // 'follower_demographics' ou 'engaged_audience_demographics'
                const targetKey = metricName as keyof IAudienceDemographics;
                // A estrutura do valor é { breakdown_key: { sub_breakdown_value: count } }
                if (item.values && item.values.length > 0 && item.values[0] && typeof item.values[0].value === 'object' && item.values[0].value !== null) {
                    const breakdownData = item.values[0]!.value; // Ex: { "gender": { "F": 100, "M": 80 }, "age": { ... } }
                    const parsedBreakdowns: Partial<IAudienceDemographics[typeof targetKey]> = {};

                    for (const breakdownKey in breakdownData) { // Itera sobre 'gender', 'age', 'city', 'country'
                        if (Object.prototype.hasOwnProperty.call(breakdownData, breakdownKey)) {
                            const subBreakdownMap = breakdownData[breakdownKey]; // Ex: { "F": 100, "M": 80 }
                            if (typeof subBreakdownMap === 'object' && subBreakdownMap !== null) {
                                // Converte o mapa { value: count } para array [{ value: 'F', count: 100 }, { value: 'M', count: 80 }]
                                const breakdownArray: IDemographicBreakdown[] = Object.entries(subBreakdownMap)
                                    .filter(([_, count]) => typeof count === 'number') // Garante que o count é número
                                    .map(([val, count]) => ({ value: val, count: count as number }));
                                if (breakdownArray.length > 0) {
                                    // Associa o array ao tipo de breakdown (gender, age, etc.)
                                    parsedBreakdowns[breakdownKey as keyof typeof parsedBreakdowns] = breakdownArray;
                                }
                            }
                        }
                    }
                    // Se algum breakdown foi parseado com sucesso, adiciona ao resultado final
                    if (Object.keys(parsedBreakdowns).length > 0) {
                         demographics[targetKey] = parsedBreakdowns as any;
                    }
                } // else { if (responseData!.data.length > 0) { logger.warn(`${TAG} Métrica demográfica '${metricName}' retornada sem valores ou formato inesperado.`); } }
            });
        }

        const hasData = demographics.follower_demographics || demographics.engaged_audience_demographics;
        logger.debug(`${TAG} Dados demográficos buscados com sucesso para ${accountId}. ${hasData ? 'Dados encontrados.' : 'Dados não disponíveis/insuficientes.'}`, hasData ? demographics : {});
        // Retorna sucesso mesmo sem dados, mas inclui errorMessage
        return { success: true, data: demographics as IAudienceDemographics, errorMessage: hasData ? undefined : 'Dados demográficos insuficientes ou indisponíveis.' };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro final ao buscar demografia para Conta ${accountId}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.includes('Token') || message.includes('Falha') ? message : `Erro interno ao buscar demografia da conta: ${message}` };
    }
}

/**
 * Busca dados básicos da conta do Instagram (IG User node).
 */
export async function fetchBasicAccountData(
    accountId: string,
    accessToken: string
): Promise<FetchBasicAccountDataResult> {
    const TAG = '[fetchBasicAccountData]';
    logger.debug(`${TAG} Buscando dados básicos da conta ${accountId}...`);

    const fields = BASIC_ACCOUNT_FIELDS; // Ex: 'id,username,name,profile_picture_url,followers_count,...'
    const urlBase = `${BASE_URL}/${accountId}?fields=${fields}`;

    try {
        const responseData = await retry(async (bail, attempt) => {
            const currentUrl = `${urlBase}&access_token=${accessToken}`;
             if (attempt > 1) {
                 logger.warn(`${TAG} Tentativa ${attempt} para buscar dados básicos da conta ${accountId}.`);
             } // else { logger.debug(`${TAG} URL API Dados Básicos: ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`); }

            const response = await fetch(currentUrl);
            const data: any & FacebookApiError = await response.json(); // A resposta aqui não segue o padrão 'data[]'

            if (!response.ok || data.error) {
                 const error = data.error || { message: `Erro ${response.status} da API`, code: response.status };
                 logger.error(`${TAG} Erro da API (Tentativa ${attempt}) ao buscar dados básicos da conta ${accountId}:`, error);

                 const isTokenError = error.code === 190 ||
                                      ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));

                 if (isTokenError) { bail(new Error('Token de acesso inválido ou expirado ao buscar dados básicos.')); return; }
                 if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha ao buscar dados básicos (Erro ${response.status}): ${error.message}`)); return; }
                 throw new Error(`Erro temporário (${response.status}) ao buscar dados básicos: ${error.message}`);
            }
            return data; // Retorna o objeto direto com os campos solicitados

        }, RETRY_OPTIONS);

        // Mapeia os campos da resposta para a interface parcial IUser
        const accountData: Partial<IUser> = {
            instagramAccountId: responseData!.id,
            username: responseData!.username,
            name: responseData!.name,
            biography: responseData!.biography,
            website: responseData!.website,
            profile_picture_url: responseData!.profile_picture_url,
            followers_count: responseData!.followers_count,
            follows_count: responseData!.follows_count,
            media_count: responseData!.media_count,
            // Adicionar outros campos se estiverem em BASIC_ACCOUNT_FIELDS
        };
        // Remove chaves com valor undefined
        Object.keys(accountData).forEach(key => accountData[key as keyof typeof accountData] === undefined && delete accountData[key as keyof typeof accountData]);

        logger.debug(`${TAG} Dados básicos da conta buscados com sucesso para ${accountId}.`, accountData);
        return { success: true, data: accountData };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro final ao buscar dados básicos para Conta ${accountId}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.includes('Token') || message.includes('Falha') ? message : `Erro interno ao buscar dados básicos da conta: ${message}` };
    }
}

/**
 * Limpa os dados de conexão do Instagram para um usuário no banco de dados.
 */
export async function clearInstagramConnection(userId: string | mongoose.Types.ObjectId): Promise<void> {
    const TAG = '[clearInstagramConnection]';
    logger.warn(`${TAG} Limpando dados de conexão Instagram para User ${userId}...`);
    try {
        await connectToDatabase();
        await DbUser.findByIdAndUpdate(userId, {
            $set: {
                instagramAccessToken: null,
                instagramAccountId: null,
                isInstagramConnected: false,
                // Opcional: Adicionar data de desconexão ou status
                // instagramConnectionStatus: 'disconnected_token_error',
                // instagramLastDisconnectedAt: new Date(),
            }
        });
        logger.info(`${TAG} Dados de conexão Instagram limpos no DB para User ${userId}.`);
    } catch (error) {
        logger.error(`${TAG} Erro ao limpar dados de conexão Instagram no DB para User ${userId}:`, error);
    }
}

// --- Funções para Salvar Dados ---

/**
 * Mapeia o media_type da API do Instagram para o campo 'format' do nosso modelo.
 */
function mapMediaTypeToFormat(mediaType?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'): string {
    switch (mediaType) {
        case 'IMAGE': return 'Foto';
        case 'VIDEO': return 'Reel'; // Assumindo que VIDEO sempre mapeia para Reel
        case 'CAROUSEL_ALBUM': return 'Carrossel';
        default: return 'Desconhecido';
    }
}

/**
 * Salva ou atualiza os dados de uma mídia (Post/Reel/Carrossel) e seus insights no MetricModel.
 */
async function saveMetricData(
    userId: Types.ObjectId,
    media: InstagramMedia,
    insights: IMetricStats
): Promise<void> {
    const TAG = '[saveMetricData v1.6.0 Optimizations]';
    const startTime = Date.now();
    logger.info(`${TAG} Iniciando... User: ${userId}, Media: ${media.id}`);

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
        const updateData: Partial<IMetric> = {
            user: userId, instagramMediaId: media.id, source: 'api',
            postLink: media.permalink ?? '', description: media.caption ?? '',
            postDate: media.timestamp ? new Date(media.timestamp) : new Date(),
            format: format, stats: insights,
        };

        Object.keys(updateData).forEach(key => {
            if (key !== 'stats' && updateData[key as keyof typeof updateData] === undefined) {
                delete updateData[key as keyof typeof updateData];
            }
        });
        if (updateData.stats) {
             Object.keys(updateData.stats).forEach(key => {
                 if (updateData.stats![key as keyof IMetricStats] === undefined) {
                     delete updateData.stats![key as keyof IMetricStats];
                 }
             });
             if (Object.keys(updateData.stats).length === 0) delete updateData.stats;
        } else { delete updateData.stats; }

        const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true };
        savedMetric = await MetricModel.findOneAndUpdate(filter, { $set: updateData }, options);

        if (!savedMetric) {
             logger.error(`${TAG} Falha CRÍTICA ao salvar/atualizar métrica ${media.id} (findOneAndUpdate retornou null). Filter:`, filter, 'Update:', updateData);
             throw new Error(`Falha crítica ao salvar métrica ${media.id} no DB.`);
        }
        logger.debug(`${TAG} Métrica ${savedMetric._id} (Media ${media.id}) salva/atualizada com sucesso.`);

        const workerUrl = process.env.CLASSIFICATION_WORKER_URL;
        if (qstashClient && workerUrl) {
            if (savedMetric.classificationStatus === 'pending' && savedMetric.description && savedMetric.description.trim() !== '') {
                try {
                    await qstashClient.publishJSON({ url: workerUrl, body: { metricId: savedMetric._id.toString() } });
                } catch (qstashError) {
                    logger.error(`${TAG} ERRO ao enviar tarefa para QStash para Metric ID: ${savedMetric._id}.`, qstashError);
                }
            }
        }

        // <<< INÍCIO DA LÓGICA DE SNAPSHOT DIÁRIO (Com Otimizações) >>>
        if (savedMetric && savedMetric.source === 'api') {
            const SNAPSHOT_TAG = '[DailySnapshot]';
            try {
                if (!savedMetric.postDate) {
                    logger.warn(`${SNAPSHOT_TAG} Metric ${savedMetric._id} não possui postDate. Impossível calcular snapshot diário.`);
                    return;
                }
                const postDate = new Date(savedMetric.postDate);
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);
                const cutoffDate = new Date(postDate);
                cutoffDate.setDate(cutoffDate.getDate() + 30);
                cutoffDate.setUTCHours(0, 0, 0, 0);

                if (today > cutoffDate) {
                    logger.debug(`${SNAPSHOT_TAG} Post ${savedMetric._id} (publicado em ${postDate.toISOString().split('T')[0]}) tem mais de 30 dias. Snapshot diário não será gerado.`);
                    return;
                }

                const snapshotDate = today;
                logger.debug(`${SNAPSHOT_TAG} Calculando snapshot para Metric ${savedMetric._id} na data ${snapshotDate.toISOString().split('T')[0]}.`);

                const lastSnapshot: IDailyMetricSnapshot | null = await DailyMetricSnapshotModel.findOne({ metric: savedMetric._id })
                    .sort({ date: -1 }).lean();

                const previousCumulativeStats: Partial<Record<keyof IDailyMetricSnapshot, number>> = { /* ... inicializa com zeros ... */
                    cumulativeViews: 0, cumulativeLikes: 0, cumulativeComments: 0, cumulativeShares: 0,
                    cumulativeSaved: 0, cumulativeReach: 0, cumulativeFollows: 0, cumulativeProfileVisits: 0,
                    cumulativeTotalInteractions: 0,
                 };
                if (lastSnapshot) {
                    logger.debug(`${SNAPSHOT_TAG} Último snapshot encontrado para Metric ${savedMetric._id} data ${lastSnapshot.date.toISOString().split('T')[0]}.`);
                    previousCumulativeStats.cumulativeViews = lastSnapshot.cumulativeViews ?? 0;
                    previousCumulativeStats.cumulativeLikes = lastSnapshot.cumulativeLikes ?? 0;
                    previousCumulativeStats.cumulativeComments = lastSnapshot.cumulativeComments ?? 0;
                    previousCumulativeStats.cumulativeShares = lastSnapshot.cumulativeShares ?? 0;
                    previousCumulativeStats.cumulativeSaved = lastSnapshot.cumulativeSaved ?? 0;
                    previousCumulativeStats.cumulativeReach = lastSnapshot.cumulativeReach ?? 0;
                    previousCumulativeStats.cumulativeFollows = lastSnapshot.cumulativeFollows ?? 0;
                    previousCumulativeStats.cumulativeProfileVisits = lastSnapshot.cumulativeProfileVisits ?? 0;
                    previousCumulativeStats.cumulativeTotalInteractions = lastSnapshot.cumulativeTotalInteractions ?? 0;
                } else {
                    logger.debug(`${SNAPSHOT_TAG} Nenhum snapshot anterior encontrado para Metric ${savedMetric._id}. Este será o primeiro.`);
                }

                const currentCumulativeStats = savedMetric.stats;
                if (!currentCumulativeStats) {
                     logger.warn(`${SNAPSHOT_TAG} Metric ${savedMetric._id} não possui 'stats' atuais. Impossível calcular deltas.`);
                     return;
                }

                const dailyStats: Partial<Record<keyof IDailyMetricSnapshot, number>> = {};
                const metricsToCalculateDelta: (keyof IMetricStats)[] = [
                    'views', 'likes', 'comments', 'shares', 'saved', 'reach', 'follows', 'profile_visits'
                ];

                for (const metricName of metricsToCalculateDelta) {
                    const currentVal = (currentCumulativeStats[metricName] as number) ?? 0;
                    if (typeof currentVal !== 'number') {
                        logger.warn(`${SNAPSHOT_TAG} Valor inesperado não numérico para '${metricName as string}' em Metric ${savedMetric._id}: Recebido ${typeof currentVal}. Pulando.`);
                        continue;
                    }
                    const metricNameStr = metricName as string;
                    const prevCumulativeKey = `cumulative${metricNameStr.charAt(0).toUpperCase() + metricNameStr.slice(1)}` as keyof typeof previousCumulativeStats;
                    const previousVal = previousCumulativeStats[prevCumulativeKey] ?? 0;
                    const dailyKey = `daily${metricNameStr.charAt(0).toUpperCase() + metricNameStr.slice(1)}` as keyof typeof dailyStats;
                    if (currentVal < previousVal) {
                        logger.warn(`${SNAPSHOT_TAG} Valor cumulativo de '${metricNameStr}' diminuiu para Metric ${savedMetric._id}. Atual: ${currentVal}, Anterior: ${previousVal}. Usando delta 0.`);
                        dailyStats[dailyKey] = 0;
                    } else {
                        dailyStats[dailyKey] = currentVal - previousVal;
                    }
                }
                logger.debug(`${SNAPSHOT_TAG} Deltas calculados para Metric ${savedMetric._id}:`, dailyStats);

                type SnapshotDataType = {
                    metric: Types.ObjectId;
                    date: Date;
                    dailyViews?: number; dailyLikes?: number; dailyComments?: number; dailyShares?: number;
                    dailySaved?: number; dailyReach?: number; dailyFollows?: number; dailyProfileVisits?: number;
                    cumulativeViews?: number; cumulativeLikes?: number; cumulativeComments?: number; cumulativeShares?: number;
                    cumulativeSaved?: number; cumulativeReach?: number; cumulativeFollows?: number; cumulativeProfileVisits?: number;
                    cumulativeTotalInteractions?: number;
                };

                const snapshotData: SnapshotDataType = {
                    metric: savedMetric._id,
                    date: snapshotDate,
                    dailyViews: dailyStats.dailyViews, dailyLikes: dailyStats.dailyLikes, dailyComments: dailyStats.dailyComments,
                    dailyShares: dailyStats.dailyShares, dailySaved: dailyStats.dailySaved, dailyReach: dailyStats.dailyReach,
                    dailyFollows: dailyStats.dailyFollows, dailyProfileVisits: dailyStats.dailyProfileVisits,
                    cumulativeViews: currentCumulativeStats.views ?? 0, cumulativeLikes: currentCumulativeStats.likes ?? 0,
                    cumulativeComments: currentCumulativeStats.comments ?? 0, cumulativeShares: currentCumulativeStats.shares ?? 0,
                    cumulativeSaved: currentCumulativeStats.saved ?? 0, cumulativeReach: currentCumulativeStats.reach ?? 0,
                    cumulativeFollows: currentCumulativeStats.follows ?? 0, cumulativeProfileVisits: currentCumulativeStats.profile_visits ?? 0,
                    cumulativeTotalInteractions: currentCumulativeStats.total_interactions ?? 0,
                };

                await DailyMetricSnapshotModel.updateOne(
                    { metric: savedMetric._id, date: snapshotDate },
                    { $set: snapshotData }, { upsert: true }
                );
                logger.debug(`${SNAPSHOT_TAG} Snapshot salvo/atualizado com sucesso para Metric ${savedMetric._id} em ${snapshotDate.toISOString().split('T')[0]}.`);
            } catch (snapError) {
                logger.error(`${SNAPSHOT_TAG} Erro NÃO FATAL ao processar/salvar snapshot para Metric ${savedMetric._id}:`, snapError);
            }
        }
        // <<< FIM DA LÓGICA DE SNAPSHOT DIÁRIO >>>

    } catch (error) {
        logger.error(`${TAG} Erro CRÍTICO durante o salvamento/atualização da métrica ${media.id} no DB:`, error);
        throw error; // Relança o erro crítico para ser tratado por triggerDataRefresh
    } finally {
        const duration = Date.now() - startTime;
        logger.info(`${TAG} Concluído. User: ${userId}, Media: ${media.id}. Duração: ${duration}ms`);
    }
}


/**
 * Salva um novo snapshot de insights de conta no AccountInsightModel.
 */
export async function saveAccountInsightData(
    userId: Types.ObjectId,
    accountId: string,
    insights: IAccountInsightsPeriod | undefined,
    demographics: IAudienceDemographics | undefined,
    accountData: Partial<IUser> | undefined
): Promise<void> {
    const TAG = '[saveAccountInsightData v1.7.4]'; // Tag atualizada
    logger.debug(`${TAG} Salvando snapshot de insights/demografia/dados básicos para User ${userId}, Conta IG ${accountId}...`);
    try {
        await connectToDatabase();
        // A interface IAccountInsight agora deve ter 'recordedAt', 'accountInsightsPeriod' e 'audienceDemographics'
        const snapshot: Partial<IAccountInsight> = {
            user: userId,
            instagramAccountId: accountId,
            recordedAt: new Date(), // Presume que AccountInsight.ts foi atualizado
            accountInsightsPeriod: insights, // Chave correta da interface
            audienceDemographics: demographics, // Chave correta da interface
            // Inclui dados básicos da conta se disponíveis
            accountDetails: accountData ? {
                username: accountData.username,
                name: accountData.name,
                biography: accountData.biography,
                website: accountData.website,
                profile_picture_url: accountData.profile_picture_url,
                followers_count: accountData.followers_count,
                follows_count: accountData.follows_count,
                media_count: accountData.media_count,
            } : undefined,
        };

        // Remove chaves undefined do snapshot antes de salvar
        Object.keys(snapshot).forEach(key => snapshot[key as keyof typeof snapshot] === undefined && delete snapshot[key as keyof typeof snapshot]);
        if (snapshot.accountInsightsPeriod && Object.keys(snapshot.accountInsightsPeriod).length === 0) delete snapshot.accountInsightsPeriod;
        if (snapshot.audienceDemographics && Object.keys(snapshot.audienceDemographics).length === 0) delete snapshot.audienceDemographics;
        if (snapshot.accountDetails && Object.keys(snapshot.accountDetails).length === 0) delete snapshot.accountDetails;

        // Verifica se há dados além dos identificadores antes de criar
        const hasInsights = snapshot.accountInsightsPeriod && Object.keys(snapshot.accountInsightsPeriod).length > 0;
        const hasDemographics = snapshot.audienceDemographics && Object.keys(snapshot.audienceDemographics).length > 0;
        const hasAccountDetails = snapshot.accountDetails && Object.keys(snapshot.accountDetails).length > 0;

        // Ajuste na condição para incluir 'recordedAt' como campo válido mínimo
        if (Object.keys(snapshot).length > 3 || (hasInsights || hasDemographics || hasAccountDetails)) {
            await AccountInsightModel.create(snapshot);
            logger.info(`${TAG} Snapshot de insights/demografia/dados básicos salvo com sucesso para User ${userId}.`);
        } else {
            logger.warn(`${TAG} Nenhum dado novo de insight/demografia/básico de conta para salvar no snapshot para User ${userId}.`);
        }
    } catch (error) {
        logger.error(`${TAG} Erro ao salvar snapshot de insights/demografia/dados básicos para User ${userId}:`, error);
    }
}


// --- Função de Orquestração ---

/**
 * Orquestra a coleta de dados do Instagram para um usuário.
 */
export async function triggerDataRefresh(userId: string): Promise<{ success: boolean; message: string; details?: any }> {
    const TAG = '[triggerDataRefresh v1.7.1 Incremental]'; // Mantém tag da lógica principal
    const startTime = Date.now();
    logger.info(`${TAG} Iniciando atualização de dados v1.7.1 (incremental) do Instagram para User ${userId}...`);

    const connectionDetails = await getInstagramConnectionDetails(userId);
    if (!connectionDetails) {
        return { success: false, message: 'Usuário não conectado ao Instagram ou detalhes inválidos.' };
    }
    const { accessToken, accountId } = connectionDetails;
    if (!accessToken || !accountId) {
         return { success: false, message: 'Token de acesso ou ID da conta ausente nos detalhes de conexão.' };
    }
     if (!mongoose.isValidObjectId(userId)) {
         logger.error(`${TAG} ID de usuário inválido fornecido: ${userId}`);
         return { success: false, message: 'ID de usuário inválido.' };
     }
    const userObjectId = new Types.ObjectId(userId);

    // Variáveis de resumo (acumuladas ao longo das páginas)
    let totalMediaFound = 0;
    let totalMediaProcessed = 0; // Posts/Reels/Carrosséis
    let collectedMediaInsights = 0;
    let savedMediaMetrics = 0;
    let collectedAccountInsights = 0;
    let savedAccountInsights = 0;
    let collectedDemographics = false;
    let savedDemographics = false;
    let collectedBasicAccountData = false;
    let errors: string[] = [];
    let currentPage = 0;
    let hasMoreMediaPages = true; // Flag para controlar o loop

    try {
        // --- 1. Buscar Dados Básicos da Conta (Continua sendo feito primeiro) ---
        logger.info(`${TAG} Buscando dados básicos da conta ${accountId}...`);
        let basicAccountData: Partial<IUser> | undefined;
        const basicDataResult = await fetchBasicAccountData(accountId, accessToken);
        if (basicDataResult.success && basicDataResult.data) {
             collectedBasicAccountData = true;
             basicAccountData = basicDataResult.data;
             logger.debug(`${TAG} Dados básicos da conta obtidos.`);
        } else {
             logger.warn(`${TAG} Falha ao obter dados básicos da conta: ${basicDataResult.error}`);
             errors.push(`Dados básicos conta: ${basicDataResult.error ?? 'Erro desconhecido'}`);
        }
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));


        // --- 2. Buscar e Processar Mídias POR PÁGINA ---
        logger.info(`${TAG} Iniciando busca e processamento incremental de mídias...`);
        let nextPageMediaUrl: string | null | undefined = undefined;
        currentPage = 0;

        do {
            currentPage++;
            const pageStartTime = Date.now();
            logger.info(`${TAG} Processando página ${currentPage} de mídias...`);

            // 2.1 Buscar Mídias da Página Atual
            logger.debug(`${TAG} Chamando fetchInstagramMedia para página ${currentPage}...`);
            const mediaResult = await fetchInstagramMedia(userId, nextPageMediaUrl ?? undefined);
            logger.debug(`${TAG} fetchInstagramMedia para página ${currentPage} concluído. Sucesso: ${mediaResult.success}`);

            if (!mediaResult.success) {
                logger.error(`${TAG} Falha ao buscar página ${currentPage} de mídias: ${mediaResult.error}`);
                errors.push(`Busca mídias (pág ${currentPage}): ${mediaResult.error ?? 'Erro desconhecido'}`);
                if (mediaResult.error?.includes('Token')) {
                    logger.warn(`${TAG} Interrompendo busca devido a erro de token na página ${currentPage}.`);
                    hasMoreMediaPages = false; // Para o loop principal
                }
            }

            // 2.2 Processar Mídias da Página Atual (se houver dados)
            const mediaInPage = mediaResult.data ?? [];
            totalMediaFound += mediaInPage.length; // Acumula total encontrado

            if (mediaInPage.length > 0) {
                const processableMedia = mediaInPage.filter(m => m.media_type !== 'STORY');
                totalMediaProcessed += processableMedia.length; // Acumula total processável
                logger.info(`${TAG} Página ${currentPage}: ${mediaInPage.length} mídias encontradas (${processableMedia.length} processáveis). Buscando insights...`);

                // 2.2.1 Buscar Insights em Paralelo (para a página atual)
                const insightTasks = processableMedia.map(media => {
                    return limitInsightsFetch(async () => {
                        if (!media.id || !accessToken) {
                            logger.warn(`${TAG} Mídia sem ID ou token ausente encontrada na página ${currentPage}: ${media.id}`);
                            return { mediaId: media.id ?? 'unknown', status: 'skipped', reason: 'ID ou Token ausente' };
                        }
                        const insightsResult = await fetchMediaInsights(media.id, accessToken);
                        return { mediaId: media.id, media, insightsResult };
                    });
                });
                const insightTaskResults = await Promise.allSettled(insightTasks);
                logger.debug(`${TAG} Busca paralela de insights para página ${currentPage} concluída.`);

                // 2.2.2 Salvar Dados Sequencialmente (para a página atual)
                logger.debug(`${TAG} Salvando dados para ${insightTaskResults.length} resultados da página ${currentPage}...`);
                for (const result of insightTaskResults) {
                    if (result.status === 'fulfilled' && result.value) {
                        const { mediaId, media, insightsResult } = result.value;
                        if (insightsResult?.success && insightsResult.data) {
                            collectedMediaInsights++;
                            try {
                                await saveMetricData(userObjectId, media, insightsResult.data);
                                savedMediaMetrics++;
                            } catch (saveError: unknown) {
                                const errorMsg = saveError instanceof Error ? saveError.message : String(saveError);
                                logger.error(`${TAG} Falha CRÍTICA ao SALVAR métrica (pág ${currentPage}) para mídia ${mediaId}: ${errorMsg}`);
                                errors.push(`Salvar métrica ${mediaId}: ${errorMsg}`);
                            }
                        } else if (insightsResult) {
                            logger.warn(`${TAG} Falha ao OBTER insights (pág ${currentPage}) para mídia ${mediaId}: ${insightsResult.error}`);
                            errors.push(`Insights mídia ${mediaId}: ${insightsResult.error ?? 'Erro desconhecido'}`);
                        } else if (result.value.status === 'skipped') {
                            logger.warn(`${TAG} Tarefa de insight pulada (pág ${currentPage}) para mídia ${mediaId}: ${result.value.reason}`);
                        }
                    } else if (result.status === 'rejected') {
                        const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
                        logger.error(`${TAG} Erro inesperado na execução da tarefa de insight (pág ${currentPage}): ${errorMsg}`);
                        errors.push(`Erro tarefa insight: ${errorMsg}`);
                    }
                }
                logger.info(`${TAG} Página ${currentPage}: Loop de salvamento concluído.`);
            } else {
                logger.info(`${TAG} Página ${currentPage}: Nenhuma mídia encontrada.`);
            }

            // 2.3 Preparar para Próxima Página
            nextPageMediaUrl = mediaResult.nextPageUrl; // Pode ser string ou null
            if (!nextPageMediaUrl) {
                hasMoreMediaPages = false; // Fim da paginação
                logger.info(`${TAG} Fim da busca de mídias. Última página processada: ${currentPage}.`);
            } else {
                logger.debug(`${TAG} Preparando para buscar próxima página (${currentPage + 1}). Próxima URL existe.`);
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }

            const pageDuration = Date.now() - pageStartTime;
            logger.info(`${TAG} Página ${currentPage} processada em ${pageDuration}ms.`);

        } while (hasMoreMediaPages && currentPage < MAX_PAGES_MEDIA); // Continua se houver próxima página e não atingiu limite

        if (currentPage >= MAX_PAGES_MEDIA && hasMoreMediaPages) {
             logger.warn(`${TAG} Limite de ${MAX_PAGES_MEDIA} páginas atingido ao buscar/processar mídias.`);
             errors.push(`Limite de ${MAX_PAGES_MEDIA} páginas atingido ao buscar mídias.`);
        }
        logger.info(`${TAG} Processamento incremental de mídias concluído. Total de ${totalMediaFound} mídias encontradas, ${totalMediaProcessed} processadas, ${savedMediaMetrics} salvas.`);


        // --- 3. Buscar e Salvar Insights da Conta e Demografia (Após processar mídias) ---
        let accountInsightData: IAccountInsightsPeriod | undefined;
        let audienceDemographicsData: IAudienceDemographics | undefined;
        if (accountId && accessToken) { // Verifica novamente se temos os dados necessários
            logger.info(`${TAG} Buscando insights e demografia da conta ${accountId}...`);
            const insightPeriod = DEFAULT_ACCOUNT_INSIGHTS_PERIOD;
            const accountInsightsResult = await fetchAccountInsights(accountId, accessToken, insightPeriod);
            if (accountInsightsResult.success && accountInsightsResult.data) {
                 collectedAccountInsights++;
                 accountInsightData = accountInsightsResult.data;
                 logger.debug(`${TAG} Insights da conta obtidos.`);
            } else {
                 logger.warn(`${TAG} Falha ao obter insights da conta: ${accountInsightsResult.error}`);
                 errors.push(`Insights da conta: ${accountInsightsResult.error ?? 'Erro desconhecido'}`);
            }
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            const demographicsResult = await fetchAudienceDemographics(accountId, accessToken);
            collectedDemographics = true;
            if (demographicsResult.success && demographicsResult.data && Object.keys(demographicsResult.data).length > 0) {
                 audienceDemographicsData = demographicsResult.data;
                 savedDemographics = true;
                 logger.debug(`${TAG} Dados demográficos obtidos.`);
            } else {
                 logger.warn(`${TAG} Falha ao obter dados demográficos ou dados insuficientes: ${demographicsResult.error || demographicsResult.errorMessage}`);
                 if(demographicsResult.error) { errors.push(`Demografia conta: ${demographicsResult.error}`); }
            }
            if (accountInsightData || audienceDemographicsData || basicAccountData) {
                 logger.info(`${TAG} Salvando snapshot de insights/demografia/dados básicos da conta...`);
                 // Passa a variável local 'accountInsightData' (renomeada para 'insights' na chamada)
                 // e 'audienceDemographicsData' (renomeada para 'demographics' na chamada)
                 await saveAccountInsightData( userObjectId, accountId, accountInsightData, audienceDemographicsData, basicAccountData );
                 savedAccountInsights++;
            } else {
                 logger.warn(`${TAG} Nenhum dado novo de insight/demografia/básico de conta para salvar.`);
            }
        } else {
            logger.warn(`${TAG} Pulando busca de insights de conta/demografia devido a accountId/accessToken ausente ou erro anterior.`);
        }

        // --- Conclusão ---
        const duration = Date.now() - startTime;
        const successMessage = `Atualização v1.7.1 concluída para User ${userId}. ` +
                               `Mídias: ${savedMediaMetrics}/${totalMediaProcessed} processadas (${totalMediaFound} encontradas em ${currentPage} pág.). ` +
                               `Insights Conta: ${savedAccountInsights > 0 ? 'Salvo' : 'Não salvo/Sem dados'}. ` +
                               `Demografia: ${savedDemographics ? 'Salva' : 'Não salva/Insuficiente'}. ` +
                               `Dados Básicos: ${collectedBasicAccountData ? 'Coletados' : 'Falha/Não coletados'}.`;
        const finalMessage = errors.length > 0 ? `${successMessage} Erros: ${errors.length}` : successMessage;
        logger.info(`${TAG} Concluído. User: ${userId}. Duração: ${duration}ms. ${finalMessage}`);
        if(errors.length > 0) logger.warn(`${TAG} Detalhes dos erros: ${errors.join('; ')}`);

        return {
            success: errors.length === 0,
            message: finalMessage,
            details: {
                 mediaFound: totalMediaFound,
                 mediaProcessed: totalMediaProcessed,
                 mediaInsightsCollected: collectedMediaInsights,
                 mediaMetricsSaved: savedMediaMetrics,
                 accountInsightsCollected: collectedAccountInsights > 0,
                 accountInsightsSaved: savedAccountInsights > 0,
                 demographicsCollected: collectedDemographics,
                 demographicsSaved: savedDemographics,
                 basicAccountDataCollected: collectedBasicAccountData,
                 errors: errors,
                 durationMs: duration
            }
        };

    } catch (error: unknown) {
        const duration = Date.now() - startTime;
        logger.error(`${TAG} Erro crítico durante a atualização de dados para User ${userId}. Duração até erro: ${duration}ms`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Erro interno no triggerDataRefresh: ${message}` };
    }
}

// ==========================================================================
// == NOVA IMPLEMENTAÇÃO de getFacebookLongLivedTokenAndIgId com LOGS DEBUG ==
// ==========================================================================
/**
 * Troca um token de acesso de curta duração do Facebook por um de longa duração (LLAT),
 * busca as páginas do Facebook gerenciadas pelo usuário, identifica a conta do Instagram
 * vinculada e atualiza os dados do usuário no banco de dados.
 * Inclui logging detalhado para diagnóstico (Fase 1).
 */
export async function getFacebookLongLivedTokenAndIgId(
    shortLivedToken: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const TAG = '[getFacebookLongLivedTokenAndIgId_vDEBUG]'; // Tag atualizada para depuração
    logger.info(`${TAG} Iniciando para User ID: ${userId}.`);
    console.log(`***** ${TAG} Iniciando para User ID: ${userId} *****`); // Log de console adicional
    console.log(`***** ${TAG} Recebido Short-Lived Token (parcial): ${shortLivedToken?.substring(0, 10)}... *****`);

    if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) {
        const errorMsg = "FACEBOOK_CLIENT_ID ou FACEBOOK_CLIENT_SECRET não definidos nas variáveis de ambiente.";
        logger.error(`${TAG} ${errorMsg}`);
        console.error(`***** ${TAG} ${errorMsg} *****`);
        return { success: false, error: errorMsg };
    }

    if (!mongoose.isValidObjectId(userId)) {
        const errorMsg = `ID de usuário inválido fornecido: ${userId}`;
        logger.error(`${TAG} ${errorMsg}`);
        console.error(`***** ${TAG} ${errorMsg} *****`);
        return { success: false, error: errorMsg };
    }

    let longLivedAccessToken: string | null = null;
    let pagesData: any[] = [];
    let selectedPage: any = null;
    let instagramAccountId: string | null = null;

    try {
        // --- 1. Trocar Short-Lived Token por Long-Lived Access Token (LLAT) ---
        logger.debug(`${TAG} Tentando obter LLAT para User ${userId}...`);
        console.log(`***** ${TAG} Tentando obter LLAT para User ${userId}... *****`);
        const llatUrl = `${BASE_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${shortLivedToken}`;
        console.log(`***** ${TAG} URL Troca Token (sem segredos): ${llatUrl.replace(process.env.FACEBOOK_CLIENT_SECRET, '***SECRET***').replace(shortLivedToken, '***SLT***')} *****`);

        const llatResponse = await fetch(llatUrl);
        const llatResponseText = await llatResponse.text(); // Lê como texto primeiro
        console.log(`***** ${TAG} Status Resposta Troca Token: ${llatResponse.status} *****`);
        console.log(`***** ${TAG} Corpo Resposta Troca Token (raw): ${llatResponseText} *****`);

        let llatData;
        try {
            llatData = JSON.parse(llatResponseText);
            console.log(`***** ${TAG} Corpo Resposta Troca Token (parsed JSON):`, llatData);
        } catch (parseError) {
            logger.error(`${TAG} Erro ao parsear resposta JSON da troca de token:`, parseError);
            console.error(`***** ${TAG} Erro ao parsear resposta JSON da troca de token: ${parseError instanceof Error ? parseError.message : String(parseError)} *****`);
            return { success: false, error: `Falha ao processar resposta da troca de token: ${llatResponseText}` };
        }


        if (!llatResponse.ok || llatData.error || !llatData.access_token) {
            const error = llatData.error || { message: `Erro ${llatResponse.status} ao obter LLAT`, code: llatResponse.status };
            logger.error(`${TAG} Erro da API ao obter LLAT para User ${userId}:`, error);
            console.error(`***** ${TAG} Erro da API ao obter LLAT: ${JSON.stringify(error)} *****`);
            return { success: false, error: `Falha ao obter token de longa duração: ${error.message}` };
        }

        longLivedAccessToken = llatData.access_token;
        logger.info(`${TAG} LLAT obtido com sucesso para User ${userId}.`);
        console.log(`***** ${TAG} LLAT OBTIDO COM SUCESSO (parcial): ${longLivedAccessToken?.substring(0, 10)}...${longLivedAccessToken?.slice(-5)} *****`);


        // --- 2. Buscar Páginas do Facebook (/me/accounts) usando o LLAT ---
        logger.debug(`${TAG} Buscando páginas do Facebook (/me/accounts) para User ${userId}...`);
        console.log(`***** ${TAG} Buscando páginas do Facebook (/me/accounts) para User ${userId}... *****`);
        // Solicita ID, nome, token de acesso da página e o ID da conta Instagram vinculada
        const meAccountsUrl = `${BASE_URL}/${API_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id}&access_token=${longLivedAccessToken}`;
        console.log(`***** ${TAG} URL /me/accounts (sem token): ${meAccountsUrl.split('?')[0]}?fields=id,name,access_token,instagram_business_account{id} *****`);
        console.log(`***** ${TAG} Usando LLAT (parcial): ${longLivedAccessToken?.substring(0, 5)}...${longLivedAccessToken?.slice(-5)} *****`);

        const meAccountsResponse = await fetch(meAccountsUrl);
        const meAccountsResponseText = await meAccountsResponse.text(); // Lê como texto primeiro
        console.log(`***** ${TAG} Status Resposta /me/accounts: ${meAccountsResponse.status} *****`);
        console.log(`***** ${TAG} Corpo Resposta /me/accounts (raw): ${meAccountsResponseText} *****`);

        let meAccountsData;
        try {
            meAccountsData = JSON.parse(meAccountsResponseText);
            console.log(`***** ${TAG} Corpo Resposta /me/accounts (parsed JSON):`, meAccountsData);
        } catch (parseError) {
            logger.error(`${TAG} Erro ao parsear resposta JSON de /me/accounts:`, parseError);
            console.error(`***** ${TAG} Erro ao parsear resposta JSON de /me/accounts: ${parseError instanceof Error ? parseError.message : String(parseError)} *****`);
            return { success: false, error: `Falha ao processar resposta de /me/accounts: ${meAccountsResponseText}` };
        }

        if (!meAccountsResponse.ok || meAccountsData.error) {
            const error = meAccountsData.error || { message: `Erro ${meAccountsResponse.status} ao buscar /me/accounts`, code: meAccountsResponse.status };
            logger.error(`${TAG} Erro da API ao buscar /me/accounts para User ${userId}:`, error);
            console.error(`***** ${TAG} Erro na API /me/accounts: ${JSON.stringify(error)} *****`);
            // Tentar dar uma mensagem mais útil para erros comuns
            if (error.code === 190) return { success: false, error: 'Token de acesso inválido ou expirado ao buscar páginas.' };
            if (error.code === 10) return { success: false, error: 'Permissão `pages_show_list` ausente ou negada ao buscar páginas.' };
            if (error.code === 100 && error.error_subcode === 33) return { success: false, error: 'Esta ação requer uma Página conectada a uma conta do Instagram.' }; // Comum se a página não tem IG
            return { success: false, error: `Falha ao buscar páginas do Facebook: ${error.message}` };
        }

        if (!meAccountsData.data || meAccountsData.data.length === 0) {
            const errorMsg = "Nenhuma página do Facebook encontrada para este usuário ou permissão não concedida para páginas específicas.";
            logger.warn(`${TAG} ${errorMsg} User: ${userId}`);
            console.warn(`***** ${TAG} /me/accounts retornou um array de dados vazio ou ausente. Nenhuma página encontrada! *****`);
            return { success: false, error: errorMsg };
        }

        pagesData = meAccountsData.data;
        logger.info(`${TAG} ${pagesData.length} página(s) do Facebook encontrada(s) para User ${userId}.`);
        console.log(`***** ${TAG} Páginas encontradas:`, pagesData.map((p: any) => ({ id: p.id, name: p.name, hasIg: !!p.instagram_business_account })));


        // --- 3. Encontrar a Página Correta e o ID do Instagram ---
        // Lógica para selecionar a página: Por enquanto, pega a PRIMEIRA que tiver um instagram_business_account.
        // Idealmente, você pode querer permitir que o usuário escolha qual página/conta IG usar se houver múltiplas.
        selectedPage = pagesData.find(page => page.instagram_business_account && page.instagram_business_account.id);

        if (!selectedPage) {
            const errorMsg = "Nenhuma das páginas encontradas possui uma conta do Instagram Business/Creator vinculada.";
            logger.warn(`${TAG} ${errorMsg} User: ${userId}`);
            console.warn(`***** ${TAG} Nenhuma página com instagram_business_account encontrado na lista. *****`);
            return { success: false, error: errorMsg };
        }

        instagramAccountId = selectedPage.instagram_business_account.id;
        const pageAccessToken = selectedPage.access_token; // Token específico da página (geralmente não necessário se o LLAT do usuário tem permissões suficientes)
        logger.info(`${TAG} Conta Instagram encontrada (ID: ${instagramAccountId}) na Página ${selectedPage.id} (${selectedPage.name}) para User ${userId}.`);
        console.log(`***** ${TAG} Conta Instagram ID: ${instagramAccountId} | Página FB ID: ${selectedPage.id} (${selectedPage.name}) *****`);
        // console.log(`***** ${TAG} Page Access Token (parcial): ${pageAccessToken?.substring(0, 10)}... *****`); // Opcional logar

        // --- 4. Atualizar Usuário no Banco de Dados ---
        logger.debug(`${TAG} Tentando atualizar usuário ${userId} no DB com LLAT e IG ID...`);
        const updateData = {
            instagramAccessToken: longLivedAccessToken, // Salva o LLAT
            instagramAccountId: instagramAccountId,    // Salva o ID da conta IG
            isInstagramConnected: true,                // Marca como conectado
            // Opcional: Salvar ID e nome da página FB conectada
            // facebookPageId: selectedPage.id,
            // facebookPageName: selectedPage.name,
            lastInstagramSyncAttempt: new Date(),
            lastInstagramSyncSuccess: true // Marca como sucesso inicial
        };
        console.log(`***** ${TAG} Dados para atualizar no DB User ${userId}:`, {
            instagramAccessToken: `LLAT(${longLivedAccessToken?.length})`, // Loga apenas o tamanho
            instagramAccountId: updateData.instagramAccountId,
            isInstagramConnected: updateData.isInstagramConnected,
            // facebookPageId: updateData.facebookPageId,
            // facebookPageName: updateData.facebookPageName,
        });

        await connectToDatabase();
        const updateResult = await DbUser.findByIdAndUpdate(userId, { $set: updateData });

        if (!updateResult) {
            // Isso é improvável se o userId era válido, mas é bom verificar
            const errorMsg = `Falha ao encontrar usuário ${userId} no DB para atualização final.`;
            logger.error(`${TAG} ${errorMsg}`);
            console.error(`***** ${TAG} ${errorMsg} *****`);
            // Não necessariamente falha a conexão, mas o DB não foi atualizado
            return { success: false, error: errorMsg };
        }

        logger.info(`${TAG} Usuário ${userId} atualizado com sucesso no DB com dados de conexão Instagram.`);
        console.log(`***** ${TAG} Usuário ${userId} atualizado com sucesso no DB. *****`);

        // --- 5. Retornar Sucesso ---
        logger.info(`${TAG} Processo concluído com sucesso para User ${userId}.`);
        console.log(`***** ${TAG} Processo concluído com sucesso para User ${userId}. *****`);
        return { success: true };

    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`${TAG} Erro CRÍTICO inesperado durante o processo para User ${userId}:`, error);
        console.error(`***** ${TAG} Erro CRÍTICO inesperado: ${errorMsg} *****`, error);
        // Tentar limpar a conexão se algo deu muito errado e temos um LLAT
        if (longLivedAccessToken && errorMsg.includes('Token de acesso inválido')) {
             // Chama a função clearInstagramConnection que já deve estar definida neste arquivo
             await clearInstagramConnection(userId);
        }
        return { success: false, error: `Erro interno: ${errorMsg}` };
    }
}
// ==========================================================================
// == FIM DA NOVA IMPLEMENTAÇÃO                                            ==
// ==========================================================================

/**
 * Processa o payload recebido do webhook 'story_insights'.
 * CORRIGIDO v1.7.6: Remove 'lastWebhookUpdate'.
 */
export async function processStoryWebhookPayload(
    mediaId: string,
    webhookAccountId: string | undefined,
    value: any
): Promise<{ success: boolean; error?: string }> {
    const TAG = '[processStoryWebhookPayload v1.7.6]'; // Tag atualizada
    logger.debug(`${TAG} Recebido payload para Media ${mediaId}, Conta Webhook ${webhookAccountId}.`);

    if (!webhookAccountId) {
        logger.warn(`${TAG} ID da conta do Instagram ausente no payload do webhook.`);
        return { success: false, error: 'ID da conta ausente no webhook.' };
    }
    if (!value || typeof value !== 'object') {
        logger.warn(`${TAG} Payload 'value' inválido ou ausente para Media ${mediaId}.`);
        return { success: false, error: 'Payload value inválido.' };
    }

    try {
        await connectToDatabase();
        // Encontra o usuário pelo ID da conta do Instagram recebido no webhook
        const user = await DbUser.findOne({ instagramAccountId: webhookAccountId }).select('_id').lean();
        if (!user) {
            logger.warn(`${TAG} Usuário não encontrado no DB para Instagram Account ID ${webhookAccountId} (Webhook).`);
            // Considerar retornar sucesso para não reenviar o webhook, mas logar o aviso.
            return { success: true }; // Ou false se quiser forçar retry
        }
        const userId = user._id;

        // Extrai e mapeia os insights do story do objeto 'value'
        const stats: Partial<IStoryStats> = {
            impressions: value.impressions,
            reach: value.reach,
            taps_forward: value.taps_forward,
            taps_back: value.taps_back,
            exits: value.exits,
            replies: value.replies,
            // Adicionar outros campos se disponíveis e relevantes (ex: profile_activity, navigation)
        };
         // Remove chaves com valor undefined ou null
         Object.keys(stats).forEach(key => (stats[key as keyof IStoryStats] === undefined || stats[key as keyof IStoryStats] === null) && delete stats[key as keyof IStoryStats]);

        if (Object.keys(stats).length === 0) {
            logger.warn(`${TAG} Nenhum insight válido extraído do payload do webhook para Media ${mediaId}.`);
            return { success: false, error: 'Nenhum insight válido no payload.' };
        }

        const filter = { user: userId, instagramMediaId: mediaId };
        const updateData: Partial<IStoryMetric> = {
            user: userId,
            instagramMediaId: mediaId,
            // format: 'Story', // Removido anteriormente
            stats: stats as IStoryStats,
            // lastWebhookUpdate: new Date(), // <<< CORREÇÃO AQUI: Removido pois não existe em IStoryMetric >>>
        };

        // Remove chaves undefined antes do update
        Object.keys(updateData).forEach(key => updateData[key as keyof IStoryMetric] === undefined && delete updateData[key as keyof IStoryMetric]);
        if (updateData.stats && Object.keys(updateData.stats).length === 0) delete updateData.stats;

        const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true };
        const savedStoryMetric = await StoryMetricModel.findOneAndUpdate(filter, { $set: updateData }, options);

        if (!savedStoryMetric) {
            logger.error(`${TAG} Falha ao salvar/atualizar métrica de Story ${mediaId} via webhook (findOneAndUpdate retornou null).`);
            return { success: false, error: 'Falha ao salvar dados do Story no DB.' };
        }

        logger.info(`${TAG} Insights do Story ${mediaId} (Webhook) salvos/atualizados com sucesso para User ${userId}.`);
        return { success: true };

    } catch (error) {
        logger.error(`${TAG} Erro ao processar webhook de Story para Media ${mediaId}, Conta ${webhookAccountId}:`, error);
        return { success: false, error: 'Erro interno ao processar webhook de Story.' };
    }
}

