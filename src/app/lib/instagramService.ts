// src/app/lib/instagramService.ts - v1.6.0 (Implementa Otimizações Imediatas)
// - Ação 1: Adiciona comentário sobre UTC.
// - Ação 2: Simplifica catch externo em saveMetricData.
// - Ação 3: Adiciona logs de duração em saveMetricData e triggerDataRefresh.
// - Ação 4: Adiciona validação de tipo para métricas cumulativas.

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
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from "@/app/models/DailyMetricSnapshot"; // Import do modelo de Snapshot
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
// Interfaces da API do Instagram (mantidas como no original)
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
 * (Sem alterações da v1.4)
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
 * (Sem alterações da v1.4)
 */
export async function fetchInstagramMedia(userId: string, pageUrl?: string): Promise<FetchMediaResult> {
    const TAG = '[fetchInstagramMedia]';
    const logPrefix = pageUrl ? `${TAG} (Paginação)` : TAG;
    logger.info(`${logPrefix} Iniciando busca de mídias para User ${userId}...`);

    const connectionDetails = await getInstagramConnectionDetails(userId);
    if (!connectionDetails) return { success: false, error: 'Usuário não conectado ao Instagram ou detalhes inválidos.' };
    const { accessToken } = connectionDetails;

    const getUrl = () => {
        if (pageUrl) {
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
            nextPageUrl: responseData!.paging?.next || null,
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
 * (Sem alterações da v1.4)
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
 * (Sem alterações da v1.4)
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
 * (Sem alterações da v1.4)
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
 * (Sem alterações da v1.4)
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
 * (Sem alterações da v1.4)
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
 * (Sem alterações da v1.4)
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
 * ATUALIZADO v1.6.0 (Otimizações): Adiciona lógica de snapshot, logs de duração e validações.
 * Lança erro em caso de falha no DB para MetricModel.
 */
async function saveMetricData(
    userId: Types.ObjectId,
    media: InstagramMedia,
    insights: IMetricStats
): Promise<void> {
    const TAG = '[saveMetricData v1.6.0 Optimizations]'; // <<< TAG ATUALIZADA >>>
    const startTime = Date.now(); // <<< Ação 3.1: Início da medição
    logger.info(`${TAG} Iniciando... User: ${userId}, Media: ${media.id}`); // <<< Ação 3.1: Log de início

    if (!media.id) {
        logger.error(`${TAG} Tentativa de salvar métrica sem instagramMediaId.`);
        throw new Error("Tentativa de salvar métrica sem instagramMediaId.");
    }
    if (media.media_type === 'STORY') {
        logger.debug(`${TAG} Ignorando mídia do tipo STORY ${media.id}.`);
        return; // Ignora stories
    }

    let savedMetric: IMetric | null = null;

    try {
        await connectToDatabase();

        // --- Lógica Original de Salvar/Atualizar MetricModel ---
        const filter = {
            user: userId,
            instagramMediaId: media.id,
        };

        const format = mapMediaTypeToFormat(media.media_type);

        const updateData: Partial<IMetric> = {
            user: userId,
            instagramMediaId: media.id,
            source: 'api', // Fonte API para esta lógica
            postLink: media.permalink ?? '',
            description: media.caption ?? '',
            // Ação 1.1: Assume-se que media.timestamp é uma string ISO 8601 ou similar que new Date() parseia corretamente para UTC
            postDate: media.timestamp ? new Date(media.timestamp) : new Date(),
            format: format,
            stats: insights,
            // classificationStatus e classificationError usarão defaults do schema
        };

        // Limpeza de undefined (mantida)
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
             if (Object.keys(updateData.stats).length === 0) {
                 delete updateData.stats;
             }
        } else {
             delete updateData.stats;
        }

        const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true };

        savedMetric = await MetricModel.findOneAndUpdate(filter, { $set: updateData }, options);

        if (!savedMetric) {
             logger.error(`${TAG} Falha CRÍTICA ao salvar/atualizar métrica ${media.id} (findOneAndUpdate retornou null). Filter:`, filter, 'Update:', updateData);
             throw new Error(`Falha crítica ao salvar métrica ${media.id} no DB.`);
        }

        logger.debug(`${TAG} Métrica ${savedMetric._id} (Media ${media.id}) salva/atualizada com sucesso.`);

        // --- Lógica Original de Disparar Tarefa QStash ---
        const workerUrl = process.env.CLASSIFICATION_WORKER_URL;
        if (qstashClient && workerUrl) {
            if (savedMetric.classificationStatus === 'pending' && savedMetric.description && savedMetric.description.trim() !== '') {
                try {
                    await qstashClient.publishJSON({
                        url: workerUrl,
                        body: { metricId: savedMetric._id.toString() },
                    });
                } catch (qstashError) {
                    logger.error(`${TAG} ERRO ao enviar tarefa para QStash para Metric ID: ${savedMetric._id}.`, qstashError);
                }
            }
        }
        // --- Fim Lógica QStash ---


        // <<< INÍCIO DA LÓGICA DE SNAPSHOT DIÁRIO (Com Otimizações) >>>
        if (savedMetric && savedMetric.source === 'api') {
            const SNAPSHOT_TAG = '[DailySnapshot]';
            try {
                // 1. Verificar Data Limite (30 dias)
                if (!savedMetric.postDate) {
                    logger.warn(`${SNAPSHOT_TAG} Metric ${savedMetric._id} não possui postDate. Impossível calcular snapshot diário.`);
                    return;
                }
                const postDate = new Date(savedMetric.postDate); // Assume que já está em UTC ou será tratado como tal
                const today = new Date();
                // Ação 1.3: Usar UTC consistentemente
                today.setUTCHours(0, 0, 0, 0);

                const cutoffDate = new Date(postDate);
                cutoffDate.setDate(cutoffDate.getDate() + 30);
                cutoffDate.setUTCHours(0, 0, 0, 0);

                if (today > cutoffDate) {
                    logger.debug(`${SNAPSHOT_TAG} Post ${savedMetric._id} (publicado em ${postDate.toISOString().split('T')[0]}) tem mais de 30 dias (${today.toISOString().split('T')[0]} > ${cutoffDate.toISOString().split('T')[0]}). Snapshot diário não será gerado/atualizado.`);
                    return;
                }

                const snapshotDate = today;
                logger.debug(`${SNAPSHOT_TAG} Calculando snapshot para Metric ${savedMetric._id} na data ${snapshotDate.toISOString().split('T')[0]}.`);

                const lastSnapshot: IDailyMetricSnapshot | null = await DailyMetricSnapshotModel.findOne({ metric: savedMetric._id })
                    .sort({ date: -1 })
                    .lean();

                const previousCumulativeStats: Partial<Record<keyof IDailyMetricSnapshot, number>> = {
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

                    // Ação 4.1: Validação adicional de tipo
                    if (typeof currentVal !== 'number') {
                        logger.warn(`${SNAPSHOT_TAG} Valor inesperado não numérico para '${metricName as string}' em Metric ${savedMetric._id}: Recebido ${typeof currentVal}, valor: ${currentVal}. Pulando cálculo de delta para esta métrica.`);
                        continue; // Pula para a próxima métrica
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
                    { $set: snapshotData },
                    { upsert: true }
                );
                logger.debug(`${SNAPSHOT_TAG} Snapshot salvo/atualizado com sucesso para Metric ${savedMetric._id} em ${snapshotDate.toISOString().split('T')[0]}.`);

            } catch (snapError) {
                // Ação 2.2 / 2.3: Erro de snapshot é logado mas não relançado
                logger.error(`${SNAPSHOT_TAG} Erro NÃO FATAL ao processar/salvar snapshot para Metric ${savedMetric._id}:`, snapError);
            }
        }
        // <<< FIM DA LÓGICA DE SNAPSHOT DIÁRIO >>>

    } catch (error) {
        // Ação 2.3: Catch externo simplificado. Só captura erros do MetricModel.findOneAndUpdate ou outros inesperados.
        logger.error(`${TAG} Erro CRÍTICO durante o salvamento/atualização da métrica ${media.id} no DB:`, error);
        throw error; // Relança o erro crítico para ser tratado por triggerDataRefresh
    } finally {
        // Ação 3.1: Log de fim e duração
        const duration = Date.now() - startTime;
        logger.info(`${TAG} Concluído. User: ${userId}, Media: ${media.id}. Duração: ${duration}ms`);
    }
}


/**
 * Salva um novo snapshot de insights de conta no AccountInsightModel.
 * (Sem alterações da v1.4)
 */
export async function saveAccountInsightData(
    userId: Types.ObjectId,
    accountId: string,
    insights: IAccountInsightsPeriod | undefined,
    demographics: IAudienceDemographics | undefined,
    accountData: Partial<IUser> | undefined
): Promise<void> {
    const TAG = '[saveAccountInsightData]';
    logger.debug(`${TAG} Iniciando salvamento de snapshot de conta para User ${userId}, Account ${accountId}`);

    if (!insights && !demographics && !accountData) {
        logger.warn(`${TAG} Nenhum dado (insights, demografia, básico) fornecido para salvar. Abortando.`);
        return;
    }

    try {
        await connectToDatabase();
        const newInsightData: Partial<IAccountInsight> = {
            user: userId,
            instagramAccountId: accountId,
            fetchDate: new Date(),
            followersCount: accountData?.followers_count,
            followsCount: accountData?.follows_count,
            mediaCount: accountData?.media_count,
            accountInsightsPeriod: insights,
            audienceDemographics: demographics,
        };

        // Limpeza de Campos Opcionais/Vazios (mantida)
        if (newInsightData.followersCount === undefined) delete newInsightData.followersCount;
        if (newInsightData.followsCount === undefined) delete newInsightData.followsCount;
        if (newInsightData.mediaCount === undefined) delete newInsightData.mediaCount;
        if (newInsightData.accountInsightsPeriod) {
            Object.keys(newInsightData.accountInsightsPeriod).forEach(key => {
                const typedKey = key as keyof IAccountInsightsPeriod;
                if (newInsightData.accountInsightsPeriod![typedKey] === undefined) {
                    delete newInsightData.accountInsightsPeriod![typedKey];
                }
            });
            const keys = Object.keys(newInsightData.accountInsightsPeriod);
            if (keys.length === 0 || (keys.length === 1 && keys[0] === 'period')) {
                delete newInsightData.accountInsightsPeriod;
            }
        } else { delete newInsightData.accountInsightsPeriod; }
        if (newInsightData.audienceDemographics) {
            let isEmpty = true;
            if (newInsightData.audienceDemographics.follower_demographics) {
                Object.keys(newInsightData.audienceDemographics.follower_demographics).forEach(key => {
                    const demoKey = key as keyof NonNullable<IAudienceDemographics['follower_demographics']>;
                    if (newInsightData.audienceDemographics!.follower_demographics![demoKey] === undefined || (Array.isArray(newInsightData.audienceDemographics!.follower_demographics![demoKey]) && newInsightData.audienceDemographics!.follower_demographics![demoKey]!.length === 0)) { delete newInsightData.audienceDemographics!.follower_demographics![demoKey]; } else { isEmpty = false; }
                });
                if (Object.keys(newInsightData.audienceDemographics.follower_demographics).length === 0) { delete newInsightData.audienceDemographics.follower_demographics; } else { isEmpty = false; }
            } else { delete newInsightData.audienceDemographics.follower_demographics; }
            if (newInsightData.audienceDemographics.engaged_audience_demographics) {
                Object.keys(newInsightData.audienceDemographics.engaged_audience_demographics).forEach(key => {
                    const demoKey = key as keyof NonNullable<IAudienceDemographics['engaged_audience_demographics']>;
                    if (newInsightData.audienceDemographics!.engaged_audience_demographics![demoKey] === undefined || (Array.isArray(newInsightData.audienceDemographics!.engaged_audience_demographics![demoKey]) && newInsightData.audienceDemographics!.engaged_audience_demographics![demoKey]!.length === 0)) { delete newInsightData.audienceDemographics!.engaged_audience_demographics![demoKey]; } else { isEmpty = false; }
                });
                if (Object.keys(newInsightData.audienceDemographics.engaged_audience_demographics).length === 0) { delete newInsightData.audienceDemographics.engaged_audience_demographics; } else { isEmpty = false; }
            } else { delete newInsightData.audienceDemographics.engaged_audience_demographics; }
            if (isEmpty) { delete newInsightData.audienceDemographics; }
        } else { delete newInsightData.audienceDemographics; }

        const savedAccountInsight = await AccountInsightModel.create(newInsightData);

        if (savedAccountInsight) {
            logger.debug(`${TAG} Snapshot de insights da conta para ${accountId} salvo com sucesso. ID: ${savedAccountInsight._id}`);
        } else {
             logger.error(`${TAG} Falha ao salvar snapshot de insights da conta para ${accountId} (create retornou null/undefined). Dados:`, newInsightData);
        }

    } catch (error) {
        logger.error(`${TAG} Erro ao salvar snapshot de insights da conta para ${accountId} no DB:`, error);
    }
}


// --- Função de Orquestração ---

/**
 * Orquestra a coleta de dados do Instagram para um usuário.
 * ATUALIZADO v1.6.0: Chama saveMetricData v1.6.0 otimizada. Adiciona logs de duração.
 */
export async function triggerDataRefresh(userId: string): Promise<{ success: boolean; message: string; details?: any }> {
    const TAG = '[triggerDataRefresh v1.6.0]'; // <<< TAG ATUALIZADA >>>
    const startTime = Date.now(); // <<< Ação 3.1: Início da medição
    logger.info(`${TAG} Iniciando atualização de dados v1.6.0 (com snapshot otimizado) do Instagram para User ${userId}...`); // <<< Ação 3.1: Log de início

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

    // Variáveis de resumo
    let allMedia: InstagramMedia[] = [];
    let collectedMediaInsights = 0;
    let savedMediaMetrics = 0;
    let collectedAccountInsights = 0;
    let savedAccountInsights = 0;
    let collectedDemographics = false;
    let savedDemographics = false;
    let collectedBasicAccountData = false;
    let errors: string[] = [];
    let currentPage = 0;

    try {
        // --- 1. Buscar Dados Básicos da Conta ---
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


        // --- 2. Buscar Mídias (Paginação Sequencial) ---
        logger.info(`${TAG} Buscando mídias (Posts/Reels/Carrosséis)...`);
        let nextPageMediaUrl: string | null | undefined = undefined;
        currentPage = 0;
        do {
            currentPage++;
            logger.debug(`${TAG} Buscando página ${currentPage} de mídias...`);
            const mediaResult = await fetchInstagramMedia(userId, nextPageMediaUrl);
            if (!mediaResult.success) {
                logger.error(`${TAG} Falha ao buscar página ${currentPage} de mídias: ${mediaResult.error}`);
                errors.push(`Busca mídias (pág ${currentPage}): ${mediaResult.error ?? 'Erro desconhecido'}`);
                if (mediaResult.error?.includes('Token')) {
                    logger.warn(`${TAG} Interrompendo busca de mídia devido a erro de token.`);
                    break;
                }
            }
            if (mediaResult.data) { allMedia = allMedia.concat(mediaResult.data); }
            nextPageMediaUrl = mediaResult.nextPageUrl;
            logger.debug(`${TAG} Página ${currentPage} processada. Próxima página: ${nextPageMediaUrl ? 'Sim' : 'Não'}`);
            if (nextPageMediaUrl) await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        } while (nextPageMediaUrl && currentPage < MAX_PAGES_MEDIA);
        if (currentPage >= MAX_PAGES_MEDIA && nextPageMediaUrl) {
             logger.warn(`${TAG} Limite de ${MAX_PAGES_MEDIA} páginas atingido ao buscar mídias.`);
             errors.push(`Limite de ${MAX_PAGES_MEDIA} páginas atingido ao buscar mídias.`);
        }
        logger.info(`${TAG} Total de ${allMedia.length} mídias (Posts/Reels/Carrosséis) encontradas em ${currentPage} páginas.`);


        // --- 3. Processar Mídias (Busca de Insights Paralelizada) ---
        logger.info(`${TAG} Iniciando busca PARALELIZADA de insights para ${allMedia.length} mídias (concorrência: ${INSIGHTS_CONCURRENCY_LIMIT})...`);
        const insightTasks = allMedia
            .filter(media => media.media_type !== 'STORY')
            .map(media => {
                return limitInsightsFetch(async () => {
                    if (!media.id || !accessToken) {
                        logger.warn(`${TAG} Mídia sem ID ou token ausente encontrada: ${media.id}`);
                        return { mediaId: media.id ?? 'unknown', status: 'skipped', reason: 'ID ou Token ausente' };
                    }
                    const insightsResult = await fetchMediaInsights(media.id, accessToken);
                    return { mediaId: media.id, media, insightsResult };
                });
            });
        const insightTaskResults = await Promise.allSettled(insightTasks);
        logger.info(`${TAG} Busca paralela de insights concluída. Processando ${insightTaskResults.length} resultados...`);

        for (const result of insightTaskResults) {
            if (result.status === 'fulfilled' && result.value) {
                const { mediaId, media, insightsResult } = result.value;
                if (insightsResult?.success && insightsResult.data) {
                    collectedMediaInsights++;
                    try {
                        // Chama saveMetricData (v1.6.0) otimizada
                        await saveMetricData(userObjectId, media, insightsResult.data);
                        savedMediaMetrics++;
                    } catch (saveError: unknown) {
                         const errorMsg = saveError instanceof Error ? saveError.message : String(saveError);
                         logger.error(`${TAG} Falha CRÍTICA ao SALVAR métrica para mídia ${mediaId}: ${errorMsg}`);
                         errors.push(`Salvar métrica ${mediaId}: ${errorMsg}`);
                    }
                } else if (insightsResult) {
                    logger.warn(`${TAG} Falha ao OBTER insights para mídia ${mediaId}: ${insightsResult.error}`);
                    errors.push(`Insights mídia ${mediaId}: ${insightsResult.error ?? 'Erro desconhecido'}`);
                } else if (result.value.status === 'skipped') {
                     logger.warn(`${TAG} Tarefa de insight pulada para mídia ${mediaId}: ${result.value.reason}`);
                }
            } else if (result.status === 'rejected') {
                const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
                logger.error(`${TAG} Erro inesperado na execução da tarefa de insight: ${errorMsg}`);
                errors.push(`Erro tarefa insight: ${errorMsg}`);
            }
        }
        logger.info(`${TAG} Processamento e salvamento de insights de mídia concluído. ${savedMediaMetrics}/${collectedMediaInsights} métricas salvas (de ${allMedia.filter(m=>m.media_type !== 'STORY').length} posts/reels/carrosséis).`);


        // --- 4. Buscar e Salvar Insights da Conta e Demografia (Sequencial) ---
        let accountInsightData: IAccountInsightsPeriod | undefined;
        let audienceDemographicsData: IAudienceDemographics | undefined;
        if (accountId && accessToken) {
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
                 await saveAccountInsightData( userObjectId, accountId, accountInsightData, audienceDemographicsData, basicAccountData );
                 savedAccountInsights++;
            } else {
                 logger.warn(`${TAG} Nenhum dado novo de insight/demografia/básico de conta para salvar.`);
            }
        } else {
            logger.warn(`${TAG} Pulando busca de insights de conta/demografia devido a accountId/accessToken ausente.`);
        }

        // --- Conclusão ---
        const duration = Date.now() - startTime; // <<< Ação 3.1: Fim da medição
        const successMessage = `Atualização v1.6.0 concluída para User ${userId}. ` +
                               `Mídias: ${savedMediaMetrics}/${allMedia.filter(m=>m.media_type !== 'STORY').length} processadas. ` +
                               `Insights Conta: ${savedAccountInsights > 0 ? 'Salvo' : 'Não salvo/Sem dados'}. ` +
                               `Demografia: ${savedDemographics ? 'Salva' : 'Não salva/Insuficiente'}. ` +
                               `Dados Básicos: ${collectedBasicAccountData ? 'Coletados' : 'Falha/Não coletados'}.`;
        const finalMessage = errors.length > 0 ? `${successMessage} Erros: ${errors.length}` : successMessage;
        // <<< Ação 3.1: Log de fim e duração >>>
        logger.info(`${TAG} Concluído. User: ${userId}. Duração: ${duration}ms. ${finalMessage}`);
        if(errors.length > 0) logger.warn(`${TAG} Detalhes dos erros: ${errors.join('; ')}`);

        return {
            success: errors.length === 0,
            message: finalMessage,
            details: {
                 mediaFound: allMedia.length,
                 mediaProcessed: allMedia.filter(m=>m.media_type !== 'STORY').length,
                 mediaInsightsCollected: collectedMediaInsights,
                 mediaMetricsSaved: savedMediaMetrics,
                 accountInsightsCollected: collectedAccountInsights > 0,
                 accountInsightsSaved: savedAccountInsights > 0,
                 demographicsCollected: collectedDemographics,
                 demographicsSaved: savedDemographics,
                 basicAccountDataCollected: collectedBasicAccountData,
                 errors: errors,
                 durationMs: duration // <<< Opcional: retornar duração nos detalhes
            }
        };

    } catch (error: unknown) {
        const duration = Date.now() - startTime; // <<< Ação 3.1: Medição em caso de erro crítico
        logger.error(`${TAG} Erro crítico durante a atualização de dados para User ${userId}. Duração até erro: ${duration}ms`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Erro interno no triggerDataRefresh: ${message}` };
    }
}

/**
 * Função auxiliar para obter LLAT e ID do Instagram.
 * (Sem alterações da v1.4)
 */
export async function getFacebookLongLivedTokenAndIgId(
    shortLivedToken: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const TAG = '[getFacebookLongLivedTokenAndIgId]';
    const FB_APP_ID = process.env.FACEBOOK_CLIENT_ID;
    const FB_APP_SECRET = process.env.FACEBOOK_CLIENT_SECRET;

    if (!FB_APP_ID || !FB_APP_SECRET) {
        logger.error(`${TAG} Variáveis de ambiente FACEBOOK_CLIENT_ID ou FACEBOOK_CLIENT_SECRET não definidas.`);
        return { success: false, error: 'Configuração do servidor incompleta.' };
    }
     if (!mongoose.isValidObjectId(userId)) {
         logger.error(`${TAG} ID de usuário inválido fornecido: ${userId}`);
         return { success: false, error: 'ID de usuário inválido.' };
     }

    try {
        // 1. Trocar SLAT por LLAT (com retentativa)
        logger.debug(`${TAG} Trocando SLAT por LLAT para User ${userId}...`);
        const llatUrl = `https://graph.facebook.com/${API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${shortLivedToken}`;

        const llatData = await retry(async (bail, attempt) => {
            if (attempt > 1) logger.warn(`${TAG} Tentativa ${attempt} para obter LLAT.`);
            const response = await fetch(llatUrl);
            const data: any & FacebookApiError = await response.json();
            if (!response.ok || !data.access_token) {
                const error = data.error || { message: `Erro ${response.status} ao obter LLAT`, code: response.status };
                logger.error(`${TAG} Erro API (Tentativa ${attempt}) ao obter LLAT:`, error);
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    bail(new Error(error.message || 'Falha ao obter token de longa duração.'));
                    return;
                }
                throw new Error(error.message || `Erro temporário ${response.status} ao obter LLAT.`);
            }
            return data;
        }, RETRY_OPTIONS);

        const longLivedToken = llatData.access_token;
        logger.debug(`${TAG} LLAT obtido com sucesso para User ${userId}.`);

        // 2. Buscar Páginas do Facebook (com retentativa)
        logger.debug(`${TAG} Buscando páginas do Facebook para User ${userId}...`);
        const pagesUrl = `${BASE_URL}/me/accounts?access_token=${longLivedToken}`;

        const pagesData = await retry(async (bail, attempt) => {
             if (attempt > 1) logger.warn(`${TAG} Tentativa ${attempt} para buscar páginas FB.`);
             const response = await fetch(pagesUrl);
             const data: InstagramApiResponse<{id: string, name: string}> & FacebookApiError = await response.json();
             if (!response.ok || !data.data) {
                 const error = data.error || { message: `Erro ${response.status} ao buscar páginas FB`, code: response.status };
                 logger.error(`${TAG} Erro API (Tentativa ${attempt}) ao buscar páginas FB:`, error);
                 if (error.code === 190) { bail(new Error('Token inválido ao buscar páginas FB.')); return; }
                 if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(error.message || 'Falha ao buscar páginas do Facebook.')); return; }
                 throw new Error(error.message || `Erro temporário ${response.status} ao buscar páginas FB.`);
             }
             return data;
        }, RETRY_OPTIONS);

        if (!pagesData || !pagesData.data || pagesData.data.length === 0) {
             logger.warn(`${TAG} Nenhuma página do Facebook encontrada para User ${userId}. Não é possível buscar ID do Instagram.`);
             await connectToDatabase();
             await DbUser.findByIdAndUpdate(userId, {
                 $set: { instagramAccessToken: longLivedToken, instagramAccountId: null, isInstagramConnected: false }
             });
             return { success: false, error: 'Nenhuma página do Facebook encontrada.' };
        }
        logger.debug(`${TAG} Encontradas ${pagesData.data.length} páginas.`);

        // 3. Encontrar Conta Instagram vinculada (Itera sobre as páginas)
        let instagramAccountId: string | null = null;
        logger.debug(`${TAG} Procurando conta Instagram vinculada...`);
        for (const page of pagesData.data) {
            const pageId = page.id;
            let igData: ({ instagram_business_account?: { id: string } } & FacebookApiError) | undefined;
            try {
                const igUrl = `${BASE_URL}/${pageId}?fields=instagram_business_account&access_token=${longLivedToken}`;
                igData = await retry(async (bail, attempt) => {
                     if (attempt > 1) logger.warn(`${TAG} Tentativa ${attempt} para buscar conta IG na página ${pageId}.`);
                     const response = await fetch(igUrl);
                     const data: { instagram_business_account?: { id: string } } & FacebookApiError = await response.json();
                     if (!response.ok) {
                         const error = data.error || { message: `Erro ${response.status} ao buscar conta IG`, code: response.status };
                         logger.warn(`${TAG} Erro API (Tentativa ${attempt}) ao buscar conta IG para página ${pageId}:`, error);
                         if (error.code === 100 || error.code === 10 || error.code === 200) {
                             bail(new Error(`Página ${pageId} sem conta IG ou permissão: ${error.message}`)); return;
                         }
                         if (error.code === 190) { bail(new Error('Token inválido ao buscar conta IG.')); return; }
                         if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha ao buscar conta IG (Erro ${response.status}): ${error.message}`)); return; }
                         throw new Error(error.message || `Erro temporário ${response.status} ao buscar conta IG.`);
                     }
                     return data;
                }, { ...RETRY_OPTIONS, retries: 1 });

                if (igData?.instagram_business_account?.id) {
                    instagramAccountId = igData.instagram_business_account.id;
                    logger.info(`${TAG} Conta Instagram encontrada para User ${userId}: ${instagramAccountId} (vinculada à Página FB ${pageId})`);
                    break;
                }
            } catch (pageError: any) {
                 logger.warn(`${TAG} Erro final ao buscar conta IG para página ${pageId}: ${pageError.message}`);
            }
        }

        if (!instagramAccountId) {
            logger.warn(`${TAG} Nenhuma conta comercial do Instagram encontrada vinculada às páginas do Facebook para User ${userId}.`);
            await connectToDatabase();
             await DbUser.findByIdAndUpdate(userId, {
                 $set: { instagramAccessToken: longLivedToken, instagramAccountId: null, isInstagramConnected: false }
             });
            return { success: false, error: 'Nenhuma conta do Instagram encontrada vinculada às páginas.' };
        }

        // 4. Salvar LLAT e ID da Conta IG no DB
        logger.debug(`${TAG} Atualizando usuário ${userId} no DB com LLAT e ID IG: ${instagramAccountId}...`);
        await connectToDatabase();
        const updateResult = await DbUser.findByIdAndUpdate(userId, {
            $set: {
               instagramAccessToken: longLivedToken,
               instagramAccountId: instagramAccountId,
               isInstagramConnected: true
            }
        }, { new: true });

        if (!updateResult) {
            logger.error(`${TAG} Usuário ${userId} não encontrado no DB para atualização final.`);
            return { success: false, error: 'Usuário não encontrado no banco de dados para atualização.' };
         }

        logger.info(`${TAG} Usuário ${userId} atualizado com LLAT e ID da conta Instagram ${instagramAccountId}. Conexão estabelecida.`);
        return { success: true };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro inesperado ou falha final nas retentativas do processo getFacebookLongLivedTokenAndIgId:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.includes('Token') || message.includes('Falha') || message.includes('página') ? message : `Erro interno: ${message}` };
     }
}

// --- Funções Futuras ---
// async function fetchMediaComments(mediaId: string, accessToken: string): Promise<any> { ... }

/**
 * Processa o payload recebido do webhook 'story_insights'.
 * (Sem alterações da v1.4)
 */
export async function processStoryWebhookPayload(
    mediaId: string,
    webhookAccountId: string | undefined,
    value: any // O objeto 'value' do payload do webhook
): Promise<{ success: boolean; error?: string }> {
    const TAG = '[processStoryWebhookPayload v1.4]';
    logger.info(`${TAG} Processando webhook para Story Media ID: ${mediaId}. Account ID (webhook): ${webhookAccountId ?? 'N/A'}`);
    logger.debug(`${TAG} Payload 'value' recebido:`, value);

    // 1. Mapear dados do 'value' para IStoryStats
    const insightsData: Partial<IStoryStats> = {};
    if (value.impressions !== undefined) insightsData.views = value.impressions;
    if (value.reach !== undefined) insightsData.reach = value.reach;
    if (value.replies !== undefined) insightsData.replies = value.replies;
    if (value.shares !== undefined) insightsData.shares = value.shares;
    if (value.total_interactions !== undefined) insightsData.total_interactions = value.total_interactions;
    if (value.profile_visits !== undefined) insightsData.profile_visits = value.profile_visits;
    if (value.follower_count !== undefined) insightsData.follows = value.follower_count;

    const navigation: { [key: string]: number } = {};
    if (value.taps_forward !== undefined) navigation.taps_forward = value.taps_forward;
    if (value.taps_back !== undefined) navigation.taps_back = value.taps_back;
    if (value.exits !== undefined) navigation.exits = value.exits;
    if (Object.keys(navigation).length > 0) insightsData.navigation = navigation;

    if (typeof value.profile_activity === 'object' && value.profile_activity !== null && Object.keys(value.profile_activity).length > 0) {
        insightsData.profile_activity = value.profile_activity;
    }

    Object.keys(insightsData).forEach(key => insightsData[key as keyof typeof insightsData] === undefined && delete insightsData[key as keyof typeof insightsData]);
    if (insightsData.navigation && Object.keys(insightsData.navigation).length === 0) delete insightsData.navigation;
    if (insightsData.profile_activity && Object.keys(insightsData.profile_activity).length === 0) delete insightsData.profile_activity;

    if (Object.keys(insightsData).length === 0) {
        logger.warn(`${TAG} Nenhum dado de insight válido encontrado no payload 'value' para Story ${mediaId}. Ignorando.`);
        return { success: true, error: 'Nenhum dado de insight válido no payload.' };
    }
    logger.debug(`${TAG} Insights parseados do webhook para Story ${mediaId}:`, insightsData);

    // 2. Encontrar o Usuário e Conta associados
    let userId: Types.ObjectId | undefined;
    let accountId: string | undefined;
    try {
        await connectToDatabase();
        if (webhookAccountId) {
            accountId = webhookAccountId;
            const user = await DbUser.findOne({ instagramAccountId: accountId }).select('_id').lean();
            if (user) {
                userId = user._id;
                logger.debug(`${TAG} Usuário ${userId} encontrado via Account ID ${accountId} do webhook.`);
            } else {
                logger.error(`${TAG} Account ID ${accountId} do webhook não corresponde a nenhum usuário no DB.`);
                return { success: false, error: `Usuário não encontrado para Account ID ${accountId}` };
            }
        } else {
            logger.warn(`${TAG} Account ID não fornecido no webhook para Story ${mediaId}. Tentando encontrar via StoryMetric existente...`);
            const existingStory = await StoryMetricModel.findOne({ instagramMediaId: mediaId }).select('user instagramAccountId').lean();
            if (existingStory) {
                userId = existingStory.user;
                accountId = existingStory.instagramAccountId;
                logger.debug(`${TAG} Usuário ${userId} e Conta ${accountId} encontrados via StoryMetric existente.`);
            } else {
                logger.error(`${TAG} Não foi possível determinar o usuário/conta para Story ${mediaId}.`);
                return { success: false, error: `Usuário/Conta não determinado para Story ${mediaId}` };
            }
        }

        if (!userId || !accountId) {
             logger.error(`${TAG} Falha ao determinar userId ou accountId para Story ${mediaId}.`);
             return { success: false, error: `Falha interna ao determinar usuário/conta para Story ${mediaId}` };
        }

        // 3. Preparar dados para salvar/atualizar
        const storyTimestamp = new Date();
        logger.warn(`${TAG} Usando data/hora atual (${storyTimestamp.toISOString()}) como timestamp para Story ${mediaId}.`);
        const updateData: Partial<IStoryMetric> = {
            user: userId,
            instagramAccountId: accountId,
            instagramMediaId: mediaId,
            timestamp: storyTimestamp,
            stats: insightsData as IStoryStats,
        };
        Object.keys(updateData).forEach(key => {
             if (key !== 'stats' && updateData[key as keyof typeof updateData] === undefined) {
                 delete updateData[key as keyof typeof updateData];
             }
        });

        // 4. Salvar/Atualizar no Banco de Dados
        const filter = { instagramMediaId: mediaId, user: userId };
        const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true };
        logger.debug(`${TAG} Executando findOneAndUpdate (upsert) para Story ${mediaId}, User ${userId}...`);
        const savedStoryMetric = await StoryMetricModel.findOneAndUpdate(filter, { $set: updateData }, options);

        if (savedStoryMetric) {
            logger.info(`${TAG} Métricas do Story ${mediaId} salvas/atualizadas via webhook com sucesso. ID: ${savedStoryMetric._id}`);
            return { success: true };
        } else {
             logger.error(`${TAG} Falha INESPERADA ao salvar/atualizar métricas do Story ${mediaId} via webhook (findOneAndUpdate retornou null).`);
             return { success: false, error: `Falha inesperada ao salvar/atualizar Story ${mediaId} no DB.` };
        }

    } catch (error) {
        logger.error(`${TAG} Erro GERAL ao processar webhook para Story ${mediaId}:`, error);
        return { success: false, error: `Erro interno ao processar webhook: ${error instanceof Error ? error.message : String(error)}` };
    }
}
