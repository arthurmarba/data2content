// src/app/lib/instagramService.ts

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
import { logger } from "@/app/lib/logger";
import mongoose, { Types } from "mongoose";
// <<< Adicionar importação para retentativas >>>
import retry from 'async-retry';

// <<< Importar constantes globais >>>
import {
    API_VERSION, BASE_URL, BASIC_ACCOUNT_FIELDS, MEDIA_INSIGHTS_METRICS,
    STORY_INSIGHTS_METRICS, ACCOUNT_INSIGHTS_METRICS, DEMOGRAPHICS_METRICS,
    MEDIA_BREAKDOWNS, STORY_BREAKDOWNS, ACCOUNT_BREAKDOWNS,
    DEMOGRAPHICS_BREAKDOWNS, DEMOGRAPHICS_TIMEFRAME, DEFAULT_ACCOUNT_INSIGHTS_PERIOD
 } from '@/config/instagram.config';
// <<< Fim Importar constantes >>>

// --- Configurações de Retentativa ---
const RETRY_OPTIONS = {
    retries: 3,       // Número máximo de tentativas (além da inicial)
    factor: 2,        // Fator de backoff exponencial
    minTimeout: 500,  // Tempo mínimo de espera (ms)
    maxTimeout: 5000, // Tempo máximo de espera (ms)
    randomize: true,  // Adiciona um fator aleatório para evitar thundering herd
};

// --- Interfaces ---
// (Interfaces mantidas como na Parte 3)
interface InstagramConnectionDetails {
    accessToken: string | null;
    accountId: string | null;
}

interface InstagramMedia {
    id: string;
    media_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'STORY';
    timestamp?: string;
    caption?: string;
    permalink?: string;
    media_url?: string;
    children?: {
        id: string;
        media_type?: 'IMAGE' | 'VIDEO';
        media_url?: string;
        permalink?: string;
    }[];
    username?: string;
    is_published?: boolean;
    shopping_product_tag_eligibility?: boolean;
    owner?: { id: string };
}


interface FetchMediaResult {
    success: boolean;
    data?: InstagramMedia[];
    error?: string;
    nextPageUrl?: string | null;
}

interface InstagramApiInsightValue {
    value: number | { [key: string]: number };
    end_time: string;
}

interface InstagramApiInsightItem {
     name: string;
     period: string;
     values: InstagramApiInsightValue[];
     title: string;
     description: string;
     id: string;
}

interface InstagramApiDemographicValue {
     value: {
         [breakdownKey: string]: {
             [subBreakdownValue: string]: number;
         };
     };
     end_time: string;
}

interface InstagramApiDemographicItem {
     name: 'follower_demographics' | 'engaged_audience_demographics';
     period: string;
     values: InstagramApiDemographicValue[];
     title: string;
     description: string;
     id: string;
}


interface InstagramApiResponse<T = InstagramApiInsightItem> {
    data: T[];
    paging?: {
        next?: string;
        previous?: string;
    };
    error?: FacebookApiError['error'];
}


interface FacebookApiError {
    error?: {
        message: string;
        type: string;
        code: number;
        error_subcode?: number; // <<< Note: error_subcode is optional
        fbtrace_id: string;
    };
}


interface FetchInsightsResult<T = Record<string, any>> {
    success: boolean;
    data?: T;
    error?: string;
    errorMessage?: string;
}

interface FetchBasicAccountDataResult {
    success: boolean;
    data?: Partial<IUser>;
    error?: string;
}


// --- Funções ---

/**
 * Busca o token de acesso e o ID da conta do Instagram para um usuário no banco de dados.
 * (Sem alterações)
 */
export async function getInstagramConnectionDetails(userId: string | mongoose.Types.ObjectId): Promise<InstagramConnectionDetails | null> {
    // ... (código mantido) ...
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
 * ATUALIZADO v1.4: Adiciona lógica de retentativa com async-retry.
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
            const limit = 25;
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

        logger.info(`${logPrefix} Mídias buscadas com sucesso para User ${userId}. ${responseData!.data?.length || 0} itens retornados nesta página.`);
        return {
            success: true,
            data: responseData!.data || [],
            nextPageUrl: responseData!.paging?.next || null,
        };

    } catch (error: unknown) {
        logger.error(`${logPrefix} Erro final ao buscar mídias para User ${userId} após retentativas:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.startsWith('Token') || message.startsWith('Falha') ? message : `Erro interno ao buscar mídias: ${message}` };
    }
}


/**
 * Busca os Stories recentes de uma conta do Instagram.
 * <<< MARCADO PARA REMOÇÃO/DESATIVAÇÃO (Fase 3 do Plano) >>>
 */
export async function fetchInstagramStories(userId: string, pageUrl?: string): Promise<FetchMediaResult> {
    const TAG = '[fetchInstagramStories - DEPRECATED]';
    logger.warn(`${TAG} Esta função está obsoleta e será removida. A coleta de Stories agora é via Webhooks.`);
    return { success: true, data: [], nextPageUrl: null };
}


/**
 * Busca os insights para uma mídia específica (Post, Reel, Carrossel).
 * ATUALIZADO v1.4: Adiciona lógica de retentativa com async-retry.
 */
export async function fetchMediaInsights(mediaId: string, accessToken: string): Promise<FetchInsightsResult<IMetricStats>> {
    const TAG = '[fetchMediaInsights]';
    logger.debug(`${TAG} Buscando insights v19.0+ para Media ID: ${mediaId}...`);

    const metrics = MEDIA_INSIGHTS_METRICS;
    let urlBase = `${BASE_URL}/${mediaId}/insights?metric=${metrics}`;
    const requestedMetrics = metrics.split(',');
    if (requestedMetrics.includes('profile_activity') && MEDIA_BREAKDOWNS['profile_activity']) {
        urlBase += `&breakdown=${MEDIA_BREAKDOWNS['profile_activity']}`;
    }

    try {
        const responseData = await retry(async (bail, attempt) => {
            const currentUrl = `${urlBase}&access_token=${accessToken}`;
             if (attempt > 1) {
                 logger.warn(`${TAG} Tentativa ${attempt} para buscar insights da mídia ${mediaId}.`);
             } else {
                 logger.debug(`${TAG} URL da API de Insights (v1.2): ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`);
             }

            const response = await fetch(currentUrl);
            const data: InstagramApiResponse<InstagramApiInsightItem> & FacebookApiError = await response.json();

            if (!response.ok || data.error) {
                const error = data.error || { message: `Erro ${response.status} da API`, code: response.status };
                logger.error(`${TAG} Erro da API (Tentativa ${attempt}) ao buscar insights para Media ${mediaId}:`, error);

                const isTokenError = error.code === 190 ||
                                     ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));

                if (error.code === 10) {
                    bail(new Error(`Permissão insuficiente para buscar insights da mídia: ${error.message}`));
                    return;
                }
                 if (isTokenError) {
                     bail(new Error('Token de acesso inválido ou expirado ao buscar insights.'));
                     return;
                 }
                 if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                     bail(new Error(`Falha ao buscar insights da mídia (Erro ${response.status}): ${error.message}`));
                     return;
                 }
                throw new Error(`Erro temporário (${response.status}) ao buscar insights da mídia: ${error.message}`);
            }
            return data;

        }, RETRY_OPTIONS);

        const insights: Partial<IMetricStats> = {};
        if (responseData!.data) {
            responseData!.data.forEach(item => {
                const metricName = item.name;
                if (item.values && item.values.length > 0) {
                    const latestValue = item.values[item.values.length - 1]!.value;
                    if (typeof latestValue === 'number') {
                        insights[metricName as keyof IMetricStats] = latestValue;
                    } else if (typeof latestValue === 'object' && latestValue !== null) {
                        insights[metricName as keyof IMetricStats] = latestValue;
                    }
                } else {
                     logger.warn(`${TAG} Métrica '${metricName}' retornada sem valores para Media ${mediaId}.`);
                }
            });
        }

        logger.debug(`${TAG} Insights v19.0+ buscados com sucesso para Media ${mediaId} após retentativas.`, insights);
        return { success: true, data: insights as IMetricStats };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro final ao buscar insights v19.0+ para Media ${mediaId} após retentativas:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.includes('Permissão') || message.includes('Token') || message.includes('Falha') ? message : `Erro interno ao buscar insights da mídia: ${message}` };
    }
}


/**
 * Busca os insights para um Story específico.
 * <<< MARCADO PARA REMOÇÃO/DESATIVAÇÃO (Fase 3 do Plano) >>>
 */
export async function fetchStoryInsights(mediaId: string, accessToken: string): Promise<FetchInsightsResult> {
    const TAG = '[fetchStoryInsights - DEPRECATED]';
    logger.warn(`${TAG} Esta função está obsoleta e será removida. A coleta de Stories agora é via Webhooks.`);
    return { success: true, data: {}, errorMessage: 'Função obsoleta' };
}

/**
 * Busca os insights de nível de conta para um período específico.
 * ATUALIZADO v1.4: Adiciona lógica de retentativa com async-retry.
 */
export async function fetchAccountInsights(
    accountId: string,
    accessToken: string,
    period: string = DEFAULT_ACCOUNT_INSIGHTS_PERIOD
): Promise<FetchInsightsResult<IAccountInsightsPeriod>> {
    const TAG = '[fetchAccountInsights]';
    logger.debug(`${TAG} Buscando insights da conta ${accountId} (v1.2) para o período: ${period}...`);

    const metrics = ACCOUNT_INSIGHTS_METRICS;
    let urlBase = `${BASE_URL}/${accountId}/insights?metric=${metrics}&period=${period}`;
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
            } else {
                 logger.debug(`${TAG} URL da API de Insights (Conta v1.2): ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`);
            }

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
                    const valueData = item.values[0]!.value;
                    if (typeof valueData === 'number') {
                        insights[metricName as keyof IAccountInsightsPeriod] = valueData;
                    } else if (typeof valueData === 'object' && valueData !== null) {
                        insights[metricName as keyof IAccountInsightsPeriod] = valueData;
                    }
                } else {
                     logger.warn(`${TAG} Métrica de conta '${metricName}' retornada sem valores para ${accountId}.`);
                }
            });
        }

        logger.debug(`${TAG} Insights da conta (v1.2) buscados com sucesso para ${accountId} (${period}) após retentativas.`, insights);
        return { success: true, data: insights as IAccountInsightsPeriod };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro final ao buscar insights (v1.2) para Conta ${accountId} após retentativas:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.includes('Permissão') || message.includes('Token') || message.includes('Falha') ? message : `Erro interno ao buscar insights da conta: ${message}` };
    }
}


/**
 * Busca os dados demográficos da audiência (seguidores e engajados).
 * ATUALIZADO v1.4: Adiciona lógica de retentativa com async-retry.
 */
export async function fetchAudienceDemographics(
    accountId: string,
    accessToken: string
): Promise<FetchInsightsResult<IAudienceDemographics>> {
    const TAG = '[fetchAudienceDemographics]';
    logger.debug(`${TAG} Buscando dados demográficos (v1.2) da conta ${accountId}...`);

    const metrics = DEMOGRAPHICS_METRICS;
    const period = 'lifetime';
    const breakdown = DEMOGRAPHICS_BREAKDOWNS;
    const timeframe = DEMOGRAPHICS_TIMEFRAME;
    const urlBase = `${BASE_URL}/${accountId}/insights?metric=${metrics}&period=${period}&breakdown=${breakdown}&timeframe=${timeframe}`;

    try {
        const responseData = await retry(async (bail, attempt) => {
             const currentUrl = `${urlBase}&access_token=${accessToken}`;
             if (attempt > 1) {
                 logger.warn(`${TAG} Tentativa ${attempt} para buscar demografia da conta ${accountId}.`);
             } else {
                 logger.debug(`${TAG} URL da API de Demografia (v1.2): ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`);
             }

            const response = await fetch(currentUrl);
            const data: InstagramApiResponse<InstagramApiDemographicItem> & FacebookApiError = await response.json();

            if (!response.ok || data.error) {
                const error = data.error || { message: `Erro ${response.status} da API`, code: response.status };
                logger.error(`${TAG} Erro da API (Tentativa ${attempt}) ao buscar demografia (v1.2) da conta ${accountId}:`, error);

                const isTokenError = error.code === 190 ||
                                     ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));

                // Erros 10 ou 200 são tratados como sucesso sem dados abaixo
                if (isTokenError) { bail(new Error('Token de acesso inválido ou expirado ao buscar demografia.')); return; }
                if (response.status >= 400 && response.status < 500 && response.status !== 429 && error.code !== 10 && error.code !== 200) {
                     bail(new Error(`Falha ao buscar demografia (Erro ${response.status}): ${error.message}`)); return;
                 }
                if (error.code !== 10 && error.code !== 200) {
                     throw new Error(`Erro temporário (${response.status}) ao buscar demografia: ${error.message}`);
                }
            }

             if (data.error && (data.error.code === 10 || data.error.code === 200)) {
                  logger.warn(`${TAG} Permissão ausente, dados insuficientes ou erro (${data.error.code}) ao buscar demografia (v1.2) para ${accountId}.`);
                  return { data: [] };
             }
             if (response.ok && (!data.data || data.data.length === 0)) {
                 logger.warn(`${TAG} Demografia retornada com sucesso, mas sem dados para conta ${accountId}.`);
             }

            return data;

        }, RETRY_OPTIONS);

        const demographics: Partial<IAudienceDemographics> = {};
        if (responseData!.data) {
            responseData!.data.forEach(item => {
                const metricName = item.name;
                const targetKey = metricName as keyof IAudienceDemographics;
                if (item.values && item.values.length > 0 && item.values[0] && typeof item.values[0].value === 'object' && item.values[0].value !== null) {
                    const breakdownData = item.values[0]!.value;
                    const parsedBreakdowns: Partial<IAudienceDemographics[typeof targetKey]> = {};
                    for (const breakdownKey in breakdownData) {
                        if (Object.prototype.hasOwnProperty.call(breakdownData, breakdownKey)) {
                            const subBreakdownMap = breakdownData[breakdownKey];
                            if (typeof subBreakdownMap === 'object' && subBreakdownMap !== null) {
                                const breakdownArray: IDemographicBreakdown[] = Object.entries(subBreakdownMap)
                                    .filter(([_, count]) => typeof count === 'number')
                                    .map(([val, count]) => ({ value: val, count: count as number }));
                                if (breakdownArray.length > 0) {
                                    parsedBreakdowns[breakdownKey as keyof typeof parsedBreakdowns] = breakdownArray;
                                }
                            }
                        }
                    }
                    if (Object.keys(parsedBreakdowns).length > 0) {
                         demographics[targetKey] = parsedBreakdowns as any;
                    }
                } else {
                     if (responseData!.data.length > 0) {
                        logger.warn(`${TAG} Métrica demográfica '${metricName}' retornada sem valores ou formato inesperado.`);
                     }
                }
            });
        }

        const hasData = demographics.follower_demographics || demographics.engaged_audience_demographics;
        logger.debug(`${TAG} Dados demográficos (v1.2) buscados com sucesso para ${accountId} após retentativas. ${hasData ? 'Dados encontrados.' : 'Dados não disponíveis/insuficientes.'}`, hasData ? demographics : {});
        return { success: true, data: demographics as IAudienceDemographics, errorMessage: hasData ? undefined : 'Dados demográficos insuficientes ou indisponíveis.' };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro final ao buscar demografia (v1.2) para Conta ${accountId} após retentativas:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.includes('Token') || message.includes('Falha') ? message : `Erro interno ao buscar demografia da conta: ${message}` };
    }
}


/**
 * Busca dados básicos da conta do Instagram (IG User node).
 * ATUALIZADO v1.4: Adiciona lógica de retentativa com async-retry.
 */
export async function fetchBasicAccountData(
    accountId: string,
    accessToken: string
): Promise<FetchBasicAccountDataResult> {
    const TAG = '[fetchBasicAccountData]';
    logger.debug(`${TAG} Buscando dados básicos da conta ${accountId}...`);

    const fields = BASIC_ACCOUNT_FIELDS;
    const urlBase = `${BASE_URL}/${accountId}?fields=${fields}`;

    try {
        const responseData = await retry(async (bail, attempt) => {
            const currentUrl = `${urlBase}&access_token=${accessToken}`;
             if (attempt > 1) {
                 logger.warn(`${TAG} Tentativa ${attempt} para buscar dados básicos da conta ${accountId}.`);
             } else {
                 logger.debug(`${TAG} URL da API de Dados Básicos (v1.2): ${currentUrl.replace(accessToken, '[TOKEN_OCULTO]')}`);
             }

            const response = await fetch(currentUrl);
            const data: any & FacebookApiError = await response.json();

            if (!response.ok || data.error) {
                 const error = data.error || { message: `Erro ${response.status} da API`, code: response.status };
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
            instagramAccountId: responseData!.id,
            username: responseData!.username,
            name: responseData!.name,
            biography: responseData!.biography,
            website: responseData!.website,
            profile_picture_url: responseData!.profile_picture_url,
            followers_count: responseData!.followers_count,
            follows_count: responseData!.follows_count,
            media_count: responseData!.media_count,
            is_published: responseData!.is_published,
            shopping_product_tag_eligibility: responseData!.shopping_product_tag_eligibility,
        };
        Object.keys(accountData).forEach(key => accountData[key as keyof typeof accountData] === undefined && delete accountData[key as keyof typeof accountData]);

        logger.debug(`${TAG} Dados básicos da conta buscados com sucesso para ${accountId} após retentativas.`, accountData);
        return { success: true, data: accountData };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro final ao buscar dados básicos para Conta ${accountId} após retentativas:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.includes('Token') || message.includes('Falha') ? message : `Erro interno ao buscar dados básicos da conta: ${message}` };
    }
}


/**
 * Limpa os dados de conexão do Instagram para um usuário no banco de dados.
 * (Sem alterações)
 */
export async function clearInstagramConnection(userId: string | mongoose.Types.ObjectId): Promise<void> {
    // ... (código mantido) ...
    const TAG = '[clearInstagramConnection]';
    logger.warn(`${TAG} Limpando dados de conexão Instagram para User ${userId}...`);
    try {
        await connectToDatabase();
        await DbUser.findByIdAndUpdate(userId, {
            $set: {
                instagramAccessToken: null,
                instagramAccountId: null,
                isInstagramConnected: false,
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
 * (Sem alterações)
 */
function mapMediaTypeToFormat(mediaType?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'): string {
    // ... (código mantido) ...
    switch (mediaType) {
        case 'IMAGE': return 'Foto';
        case 'VIDEO': return 'Reel';
        case 'CAROUSEL_ALBUM': return 'Carrossel';
        default: return 'Desconhecido';
    }
}

/**
 * Salva ou atualiza os dados de uma mídia (Post/Reel/Carrossel) e seus insights no MetricModel.
 * (Sem alterações desde Parte 1)
 */
async function saveMetricData(
    userId: Types.ObjectId,
    media: InstagramMedia,
    insights: IMetricStats
): Promise<void> {
    // ... (código mantido) ...
    const TAG = '[saveMetricData]';
    if (!media.id) {
        logger.error(`${TAG} Tentativa de salvar métrica sem instagramMediaId.`);
        return;
    }
    if (media.media_type === 'STORY') {
        logger.warn(`${TAG} Tentativa de salvar um STORY no MetricModel. Ignorando mídia ${media.id}.`);
        return;
    }

    try {
        await connectToDatabase();

        const filter = {
            user: userId,
            instagramMediaId: media.id,
        };

        const format = mapMediaTypeToFormat(media.media_type === 'IMAGE' || media.media_type === 'VIDEO' || media.media_type === 'CAROUSEL_ALBUM' ? media.media_type : undefined);

        const updateData: Partial<IMetric> = {
            user: userId,
            instagramMediaId: media.id,
            source: 'api',
            postLink: media.permalink ?? '',
            description: media.caption ?? '',
            postDate: media.timestamp ? new Date(media.timestamp) : new Date(),
            format: format,
            stats: insights,
            rawData: [],
        };

        Object.keys(updateData).forEach(key => {
            if (key !== 'stats' && updateData[key as keyof typeof updateData] === undefined) {
                delete updateData[key as keyof typeof updateData];
            }
        });
        if (updateData.stats) {
             Object.keys(updateData.stats).forEach(key => {
                 if (updateData.stats![key] === undefined) {
                      delete updateData.stats![key];
                 }
             });
             if (Object.keys(updateData.stats).length === 0) {
                 delete updateData.stats;
             }
        }

        const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true };
        const savedMetric = await MetricModel.findOneAndUpdate(filter, { $set: updateData }, options);

        if (savedMetric) {
            logger.debug(`${TAG} Métrica v1.2 para mídia ${media.id} salva/atualizada com sucesso para User ${userId}.`);
        } else {
             logger.error(`${TAG} Falha ao salvar/atualizar métrica v1.2 para mídia ${media.id} (findOneAndUpdate retornou null). Filter:`, filter);
        }

    } catch (error) {
        logger.error(`${TAG} Erro ao salvar/atualizar métrica v1.2 para mídia ${media.id} no DB:`, error);
    }
}


/**
 * Salva ou atualiza os dados de um Story e seus insights no StoryMetricModel.
 * <<< MARCADO PARA REMOÇÃO/DESATIVAÇÃO (Fase 3 do Plano) >>>
 */
async function saveStoryData(userId: Types.ObjectId, accountId: string, story: InstagramMedia, insights: Record<string, number>): Promise<void> {
    const TAG = '[saveStoryData - DEPRECATED]';
    logger.warn(`${TAG} Esta função está obsoleta e será removida. O salvamento de Stories agora é via Webhooks.`);
    return;
}


/**
 * Salva um novo snapshot de insights de conta no AccountInsightModel.
 * (Sem alterações desde Parte 4 - Mapeamento v1.2)
 */
async function saveAccountInsightData(
    userId: Types.ObjectId,
    accountId: string,
    insights: IAccountInsightsPeriod | undefined,
    demographics: IAudienceDemographics | undefined,
    accountData: Partial<IUser> | undefined
): Promise<void> {
    // ... (código mantido) ...
    const TAG = '[saveAccountInsightData]';
    logger.debug(`${TAG} Iniciando salvamento de snapshot de conta (v1.2) para User ${userId}, Account ${accountId}`);

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

        // --- Limpeza de Campos Opcionais/Vazios ---
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
        } else {
            delete newInsightData.accountInsightsPeriod;
        }

        if (newInsightData.audienceDemographics) {
            let isEmpty = true;
            if (newInsightData.audienceDemographics.follower_demographics) {
                 Object.keys(newInsightData.audienceDemographics.follower_demographics).forEach(key => {
                     const demoKey = key as keyof NonNullable<IAudienceDemographics['follower_demographics']>;
                     if (newInsightData.audienceDemographics!.follower_demographics![demoKey] === undefined ||
                         (Array.isArray(newInsightData.audienceDemographics!.follower_demographics![demoKey]) && newInsightData.audienceDemographics!.follower_demographics![demoKey]!.length === 0)) {
                         delete newInsightData.audienceDemographics!.follower_demographics![demoKey];
                     } else { isEmpty = false; }
                 });
                 if (Object.keys(newInsightData.audienceDemographics.follower_demographics).length === 0) {
                     delete newInsightData.audienceDemographics.follower_demographics;
                 } else { isEmpty = false; }
            } else {
                 delete newInsightData.audienceDemographics.follower_demographics;
            }
            if (newInsightData.audienceDemographics.engaged_audience_demographics) {
                 Object.keys(newInsightData.audienceDemographics.engaged_audience_demographics).forEach(key => {
                     const demoKey = key as keyof NonNullable<IAudienceDemographics['engaged_audience_demographics']>;
                     if (newInsightData.audienceDemographics!.engaged_audience_demographics![demoKey] === undefined ||
                         (Array.isArray(newInsightData.audienceDemographics!.engaged_audience_demographics![demoKey]) && newInsightData.audienceDemographics!.engaged_audience_demographics![demoKey]!.length === 0)) {
                         delete newInsightData.audienceDemographics!.engaged_audience_demographics![demoKey];
                     } else { isEmpty = false; }
                 });
                 if (Object.keys(newInsightData.audienceDemographics.engaged_audience_demographics).length === 0) {
                     delete newInsightData.audienceDemographics.engaged_audience_demographics;
                 } else { isEmpty = false; }
            } else {
                 delete newInsightData.audienceDemographics.engaged_audience_demographics;
            }
            if (isEmpty) {
                delete newInsightData.audienceDemographics;
            }
        } else {
            delete newInsightData.audienceDemographics;
        }
        // --- Fim da Limpeza ---

        const savedAccountInsight = await AccountInsightModel.create(newInsightData);

        if (savedAccountInsight) {
            logger.debug(`${TAG} Snapshot de insights da conta (v1.2) para ${accountId} salvo com sucesso para User ${userId}. ID: ${savedAccountInsight._id}`);
        } else {
             logger.error(`${TAG} Falha ao salvar snapshot de insights da conta (v1.2) para ${accountId} (create retornou null/undefined). Dados:`, newInsightData);
        }

    } catch (error) {
        logger.error(`${TAG} Erro ao salvar snapshot de insights da conta (v1.2) para ${accountId} no DB:`, error);
    }
}


// --- Função de Orquestração ---

/**
 * Orquestra a coleta de dados do Instagram para um usuário.
 * (Sem alterações desde Parte 4)
 */
export async function triggerDataRefresh(userId: string): Promise<{ success: boolean; message: string; details?: any }> {
    // ... (código mantido) ...
    const TAG = '[triggerDataRefresh]';
    logger.info(`${TAG} Iniciando atualização de dados v1.2 do Instagram para User ${userId}...`);

    const connectionDetails = await getInstagramConnectionDetails(userId);
    if (!connectionDetails) {
        return { success: false, message: 'Usuário não conectado ao Instagram ou detalhes inválidos.' };
    }
    const { accessToken, accountId } = connectionDetails;
    if (!accessToken || !accountId) {
         return { success: false, message: 'Token de acesso ou ID da conta ausente nos detalhes de conexão.' };
    }
    const userObjectId = new Types.ObjectId(userId);

    let allMedia: InstagramMedia[] = [];
    let collectedMediaInsights = 0;
    let savedMediaMetrics = 0;
    let collectedAccountInsights = 0;
    let savedAccountInsights = 0;
    let collectedDemographics = false;
    let savedDemographics = false;
    let collectedBasicAccountData = false;
    let errors: string[] = [];
    const MAX_PAGES_MEDIA = 10;
    let currentPage = 0;
    const DELAY_MS = 250;

    try {
        // --- 1. Buscar Dados Básicos da Conta ---
        logger.info(`${TAG} Buscando dados básicos da conta...`);
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


        // --- 2. Buscar Mídias ---
        logger.info(`${TAG} Buscando mídias (Posts/Reels/Carrosséis)...`);
        let nextPageMediaUrl: string | null | undefined = undefined;
        currentPage = 0;
        do {
            currentPage++;
            logger.debug(`${TAG} Buscando página ${currentPage} de mídias...`);
            const mediaResult = await fetchInstagramMedia(userId, nextPageMediaUrl);
            if (!mediaResult.success) {
                logger.error(`${TAG} Falha ao buscar página ${currentPage} de mídias: ${mediaResult.error}`);
                errors.push(`Falha ao buscar mídias (página ${currentPage}): ${mediaResult.error}`);
                if (mediaResult.error?.includes('Token')) break;
            }
            if (mediaResult.data) allMedia = allMedia.concat(mediaResult.data);
            nextPageMediaUrl = mediaResult.nextPageUrl;
            logger.debug(`${TAG} Próxima página de mídia: ${nextPageMediaUrl ? 'Sim' : 'Não'}`);
            if (nextPageMediaUrl) await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        } while (nextPageMediaUrl && currentPage < MAX_PAGES_MEDIA);
        if (currentPage >= MAX_PAGES_MEDIA && nextPageMediaUrl) {
             logger.warn(`${TAG} Limite de ${MAX_PAGES_MEDIA} páginas atingido ao buscar mídias.`);
             errors.push(`Limite de ${MAX_PAGES_MEDIA} páginas atingido ao buscar mídias.`);
        }
        logger.info(`${TAG} Total de ${allMedia.length} mídias (Posts/Reels/Carrosséis) encontradas em ${currentPage} páginas.`);

        // --- 3. Processar Mídias ---
        logger.info(`${TAG} Processando ${allMedia.length} mídias para buscar e salvar insights v1.2...`);
        for (const media of allMedia) {
            if (!media.id || !accessToken) continue;
            const insightsResult = await fetchMediaInsights(media.id, accessToken);
            if (insightsResult.success && insightsResult.data) {
                collectedMediaInsights++;
                await saveMetricData(userObjectId, media, insightsResult.data);
                savedMediaMetrics++;
            } else {
                logger.warn(`${TAG} Falha ao obter insights v1.2 para mídia ${media.id}: ${insightsResult.error}`);
                errors.push(`Insights mídia ${media.id}: ${insightsResult.error ?? 'Erro desconhecido'}`);
            }
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }

        // --- 4. Buscar e Salvar Insights da Conta e Demografia ---
        let accountInsightData: IAccountInsightsPeriod | undefined;
        let audienceDemographicsData: IAudienceDemographics | undefined;

        if (accountId && accessToken) {
            logger.info(`${TAG} Buscando insights e demografia da conta (v1.2)...`);
            const insightPeriod = DEFAULT_ACCOUNT_INSIGHTS_PERIOD;

            const accountInsightsResult = await fetchAccountInsights(accountId, accessToken, insightPeriod);
            if (accountInsightsResult.success && accountInsightsResult.data) {
                 collectedAccountInsights++;
                 accountInsightData = accountInsightsResult.data;
                 logger.debug(`${TAG} Insights da conta (v1.2) obtidos.`);
            } else {
                 logger.warn(`${TAG} Falha ao obter insights da conta (v1.2): ${accountInsightsResult.error}`);
                 errors.push(`Insights da conta: ${accountInsightsResult.error ?? 'Erro desconhecido'}`);
            }
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));

            const demographicsResult = await fetchAudienceDemographics(accountId, accessToken);
            collectedDemographics = true;
            if (demographicsResult.success && demographicsResult.data && Object.keys(demographicsResult.data).length > 0) {
                 audienceDemographicsData = demographicsResult.data;
                 savedDemographics = true;
                 logger.debug(`${TAG} Dados demográficos (v1.2) obtidos.`);
            } else {
                 logger.warn(`${TAG} Falha ao obter dados demográficos (v1.2) ou dados insuficientes: ${demographicsResult.error || demographicsResult.errorMessage}`);
                 if(demographicsResult.error) {
                     errors.push(`Demografia conta: ${demographicsResult.error}`);
                 }
            }

            if (accountInsightData || audienceDemographicsData || basicAccountData) {
                 logger.info(`${TAG} Salvando snapshot de insights/demografia/dados básicos da conta (v1.2)...`);
                 await saveAccountInsightData(
                     userObjectId,
                     accountId,
                     accountInsightData,
                     audienceDemographicsData,
                     basicAccountData
                 );
                 savedAccountInsights++;
            } else {
                 logger.warn(`${TAG} Nenhum dado de insight/demografia/básico de conta (v1.2) para salvar.`);
            }
        }

        // --- Conclusão ---
        const successMessage = `Atualização v1.2 concluída para User ${userId}. ` +
                               `Mídias: ${savedMediaMetrics}/${allMedia.length} salvas. ` +
                               `Insights Conta: ${savedAccountInsights > 0 ? 'Sim' : 'Não'}. ` +
                               `Demografia: ${savedDemographics ? 'Sim' : 'Não/Insuficiente'}. ` +
                               `Dados Básicos: ${collectedBasicAccountData ? 'Sim' : 'Não'}.`;
        const finalMessage = errors.length > 0 ? `${successMessage} Erros: ${errors.length}` : successMessage;
        logger.info(`${TAG} ${finalMessage}`);
        if(errors.length > 0) logger.warn(`${TAG} Detalhes dos erros: ${errors.join('; ')}`);

        return {
            success: errors.length === 0,
            message: finalMessage,
            details: {
                 mediaFound: allMedia.length,
                 mediaInsightsCollected: collectedMediaInsights,
                 accountInsightsCollected: collectedAccountInsights > 0,
                 demographicsCollected: collectedDemographics,
                 demographicsSaved: savedDemographics,
                 basicAccountDataCollected: collectedBasicAccountData,
                 mediaMetricsSaved: savedMediaMetrics,
                 accountInsightsSaved: savedAccountInsights > 0,
                 errors: errors,
            }
        };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro crítico durante a atualização de dados v1.2 para User ${userId}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Erro interno no triggerDataRefresh: ${message}` };
    }
}

/**
 * Função auxiliar para obter LLAT e ID do Instagram.
 * ATUALIZADO v1.4: Adiciona lógica de retentativa com async-retry.
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

        logger.debug(`${TAG} Encontradas ${pagesData!.data.length} páginas.`);

        // 3. Encontrar Conta Instagram (Iteração com retentativa em cada chamada de página)
        let instagramAccountId: string | null = null;
        logger.debug(`${TAG} Procurando conta Instagram vinculada...`);
        for (const page of pagesData!.data) {
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
                         if (error.code === 100 || error.code === 10) {
                              bail(new Error(`Página ${pageId} sem conta IG ou permissão: ${error.message}`)); return;
                         }
                         if (error.code === 190) { bail(new Error('Token inválido ao buscar conta IG.')); return; }
                         if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha ao buscar conta IG (Erro ${response.status}): ${error.message}`)); return; }
                         throw new Error(error.message || `Erro temporário ${response.status} ao buscar conta IG.`);
                     }
                     return data;
                }, { ...RETRY_OPTIONS, retries: 1 });

                // <<< CORREÇÃO TS: Verifica se igData está definido antes de acessar >>>
                if (igData?.instagram_business_account) {
                    instagramAccountId = igData.instagram_business_account.id;
                    logger.info(`${TAG} Conta Instagram encontrada para User ${userId}: ${instagramAccountId} (vinculada à Página FB ${pageId})`);
                    break;
                }
            } catch (pageError: any) {
                 logger.warn(`${TAG} Erro final ao buscar conta IG para página ${pageId}: ${pageError.message}`);
            }
        } // Fim do loop for page

        if (!instagramAccountId) {
            logger.warn(`${TAG} Nenhuma conta comercial do Instagram encontrada vinculada às páginas do Facebook para User ${userId}.`);
        }

        // 4. Salvar no DB (Sem retentativa aqui, falha no DB é crítica)
        logger.debug(`${TAG} Atualizando usuário ${userId} no DB com LLAT e ID IG (se encontrado)...`);
        await connectToDatabase();
        const updateResult = await DbUser.findByIdAndUpdate(userId, {
            $set: {
               instagramAccessToken: longLivedToken,
               instagramAccountId: instagramAccountId,
               isInstagramConnected: !!instagramAccountId
            }
        }, { new: true });

        if (!updateResult) {
            logger.error(`${TAG} Usuário ${userId} não encontrado no DB para atualização.`);
            return { success: false, error: 'Usuário não encontrado no banco de dados.' };
         }

        logger.info(`${TAG} Usuário ${userId} atualizado com LLAT. Conexão IG ${instagramAccountId ? 'estabelecida' : 'não encontrada'}.`);
        return { success: true };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro inesperado ou falha final nas retentativas do processo:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.includes('Token') || message.includes('Falha') ? message : `Erro interno: ${message}` };
     }
}

// --- Funções Futuras ---
// async function fetchMediaComments(mediaId: string, accessToken: string): Promise<any> { ... }

/**
 * Processa o payload recebido do webhook 'story_insights'.
 * ATUALIZADO v1.4: Adiciona retentativa na busca de timestamp/owner.
 */
export async function processStoryWebhookPayload(
    mediaId: string,
    webhookAccountId: string | undefined,
    value: any // O objeto 'value' do payload do webhook
): Promise<{ success: boolean; error?: string }> {
    const TAG = '[processStoryWebhookPayload]';
    logger.info(`${TAG} Processando webhook v1.4 para Story Media ID: ${mediaId}. Account ID (webhook): ${webhookAccountId ?? 'N/A'}`);
    logger.debug(`${TAG} Payload 'value' recebido:`, value);

    // 1. Mapear dados do 'value' para IStoryStats
    const insightsData: Partial<IStoryStats> = {};
    insightsData.views = value.impressions;
    insightsData.reach = value.reach;
    insightsData.replies = value.replies;
    insightsData.shares = value.shares;
    insightsData.total_interactions = value.total_interactions;
    insightsData.profile_visits = value.profile_visits;
    insightsData.follows = value.follower_count; // Verificar nome correto

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

    // 2. Encontrar o Usuário, Conta e Timestamp associados
    let userId: Types.ObjectId | undefined;
    let accountId: string | undefined;
    let userAccessToken: string | null = null;
    let storyTimestamp: Date | undefined;
    let isNewStory = false;

    try {
        await connectToDatabase();

        // --- Estratégia para encontrar User/Account ID ---
        if (webhookAccountId) {
            accountId = webhookAccountId;
            const user = await DbUser.findOne({ instagramAccountId: accountId }).select('_id instagramAccessToken').lean();
            if (user) {
                userId = user._id;
                userAccessToken = user.instagramAccessToken ?? null; // Correção TS
                logger.debug(`${TAG} Usuário ${userId} e token encontrados via Account ID ${accountId} do webhook.`);
            } else {
                logger.warn(`${TAG} Account ID ${accountId} do webhook não encontrado em nenhum usuário no DB.`);
            }
        }

        if (!userId) {
            logger.debug(`${TAG} Tentando encontrar usuário/conta via StoryMetric existente para Media ID ${mediaId}...`);
            const storyDoc = await StoryMetricModel.findOne({ instagramMediaId: mediaId }).select('user instagramAccountId timestamp').lean();
            if (storyDoc) {
                userId = storyDoc.user;
                accountId = storyDoc.instagramAccountId;
                storyTimestamp = storyDoc.timestamp;
                logger.debug(`${TAG} Story existente encontrado. User: ${userId}, Account: ${accountId}, Timestamp: ${storyTimestamp}`);
                if (!userAccessToken && userId) {
                     const connectionDetails = await getInstagramConnectionDetails(userId);
                     userAccessToken = connectionDetails?.accessToken ?? null; // Correção TS
                }
            } else {
                 logger.warn(`${TAG} Story com Media ID ${mediaId} não encontrado no DB. Marcar como novo story.`);
                 isNewStory = true;
                 if (!accountId || !userId || !userAccessToken) {
                      logger.error(`${TAG} Story ${mediaId} é novo, mas não foi possível determinar o usuário/token via webhook Account ID (${webhookAccountId}). Não é possível buscar timestamp/owner.`);
                      return { success: false, error: `Usuário/Token não encontrado para buscar dados do novo Story ${mediaId}.` };
                 }
            }
        }
        // --- Fim da Estratégia ---

        if (!userId || !accountId) {
             logger.error(`${TAG} Falha final ao determinar o usuário/conta para Story ${mediaId}. Abortando.`);
             return { success: false, error: `Usuário/Conta não encontrado para Story ${mediaId}.` };
        }
        if (!userAccessToken) {
             logger.error(`${TAG} Não foi possível obter o Access Token para o usuário ${userId}. Abortando.`);
             return { success: false, error: `Access Token não encontrado para usuário ${userId}.` };
        }

        // 3. Buscar Timestamp/Owner via API se for um Story novo (com retentativa)
        if (isNewStory) {
            logger.info(`${TAG} Story ${mediaId} parece ser novo. Buscando timestamp e owner via API...`);
            let mediaData: (InstagramMedia & FacebookApiError) | undefined; // <<< Definido fora do try/catch >>>
            try {
                const fields = 'timestamp,owner';
                const apiUrlBase = `${BASE_URL}/${mediaId}?fields=${fields}`;

                mediaData = await retry(async (bail, attempt) => { // <<< Atribui a mediaData >>>
                    const apiUrl = `${apiUrlBase}&access_token=${userAccessToken!}`;
                    if(attempt > 1) logger.warn(`${TAG} Tentativa ${attempt} para buscar dados do novo story ${mediaId}.`);
                    const response = await fetch(apiUrl);
                    const data: InstagramMedia & FacebookApiError = await response.json();
                    if (!response.ok || data.error) {
                        const error = data.error || { message: `Erro ${response.status} ao buscar dados do novo story`, code: response.status };
                        logger.error(`${TAG} Erro API (Tentativa ${attempt}) ao buscar dados do novo story ${mediaId}:`, error);
                         const isTokenError = error.code === 190 ||
                                              ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));
                        if (isTokenError) { bail(new Error('Token inválido ao buscar dados do novo story.')); return;}
                        if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha ao buscar dados do novo story (Erro ${response.status}): ${error.message}`)); return; }
                        throw new Error(error.message || `Erro temporário ${response.status} ao buscar dados do novo story.`);
                    }
                    return data;
                }, RETRY_OPTIONS);

                // <<< CORREÇÃO TS: Verifica se mediaData foi definido com sucesso >>>
                if (mediaData) {
                    if (mediaData.timestamp) {
                        storyTimestamp = new Date(mediaData.timestamp);
                        logger.info(`${TAG} Timestamp real (${storyTimestamp.toISOString()}) obtido via API para Story ${mediaId}.`);
                    } else {
                         logger.warn(`${TAG} Timestamp não retornado pela API para Story ${mediaId}. Usando data atual como fallback.`);
                         storyTimestamp = new Date();
                    }
                    if (mediaData.owner?.id && mediaData.owner.id !== accountId) {
                        logger.error(`${TAG} DISCREPÂNCIA DE OWNER! Story ${mediaId} pertence a ${mediaData.owner.id}, mas associamos à conta ${accountId}.`);
                    } else if (mediaData.owner?.id) {
                         logger.debug(`${TAG} Owner ID (${mediaData.owner.id}) validado via API para Story ${mediaId}.`);
                    }
                } else {
                     // Se mediaData for undefined (o retry falhou e foi pego pelo catch abaixo)
                     logger.warn(`${TAG} mediaData indefinido após retentativas. Usando data atual como fallback para timestamp.`);
                     storyTimestamp = new Date();
                }


            } catch (apiError: any) {
                logger.error(`${TAG} Erro final após retentativas ao buscar timestamp/owner para Story ${mediaId}:`, apiError);
                logger.warn(`${TAG} Usando data atual como fallback para timestamp do Story ${mediaId} devido a erro na API.`);
                storyTimestamp = new Date();
            }
        }

        if (!storyTimestamp) {
             logger.error(`${TAG} Timestamp final não pôde ser determinado para Story ${mediaId}. Abortando.`);
             return { success: false, error: `Timestamp não determinado para Story ${mediaId}.` };
        }

        // 4. Preparar dados para salvar/atualizar
        const updateData: Partial<IStoryMetric> = {
            user: userId,
            instagramAccountId: accountId,
            instagramMediaId: mediaId,
            timestamp: storyTimestamp,
            stats: insightsData as IStoryStats,
        };
        Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);

        // 5. Salvar/Atualizar no Banco de Dados usando upsert (Sem retentativa no DB por padrão)
        const filter = { instagramMediaId: mediaId, user: userId };
        const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true };

        logger.debug(`${TAG} Executando findOneAndUpdate (upsert) para Story ${mediaId}, User ${userId}...`);
        const savedStoryMetric = await StoryMetricModel.findOneAndUpdate(filter, { $set: updateData }, options);

        if (savedStoryMetric) {
            logger.info(`${TAG} Métricas do Story ${mediaId} salvas/atualizadas via webhook com sucesso para User ${userId}.`);
            return { success: true };
        } else {
            logger.error(`${TAG} Falha ao salvar/atualizar métricas do Story ${mediaId} via webhook (findOneAndUpdate retornou null inesperadamente). Filter:`, filter);
            return { success: false, error: `Falha inesperada ao salvar/atualizar Story ${mediaId} no DB.` };
        }

    } catch (error) {
        logger.error(`${TAG} Erro GERAL ao processar webhook para Story ${mediaId}:`, error);
        return { success: false, error: `Erro interno ao processar webhook: ${error instanceof Error ? error.message : String(error)}` };
    }
}
