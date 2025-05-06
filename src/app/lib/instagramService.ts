// src/app/lib/instagramService.ts - v1.9.2 (Adiciona connectInstagramAccount)
// - Adiciona a função connectInstagramAccount para lidar com a conexão pós-fetch (System User/Fallback).
// - Mantém fluxo System User / Fallback e outras funcionalidades.

import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; // Certifique-se que IUser inclui os novos campos de sync
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
import mongoose, { Types } from "mongoose"; // Importa Types e mongoose
import retry from 'async-retry';
import { Client } from "@upstash/qstash";
import pLimit from 'p-limit';

// Importar constantes globais
import {
    API_VERSION,
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
 * IMPORTANTE: Esta função busca o token do *usuário* (usado no fluxo antigo/fallback).
 * A nova lógica pode não depender mais deste token específico se usar System User.
 * @param userId - ID do usuário (string ou ObjectId).
 * @returns Detalhes da conexão ou null se não encontrado/inválido.
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
            .select('instagramAccessToken instagramAccountId isInstagramConnected') // Seleciona os campos relevantes
            .lean();
        if (!user) {
            logger.warn(`${TAG} Usuário ${userId} não encontrado no DB.`);
            return null;
        }
        // Verifica se está conectado e se tem os dados necessários (accountId é crucial)
        // Nota: A presença de instagramAccessToken pode não ser mais um requisito absoluto com o System User
        if (!user.isInstagramConnected || !user.instagramAccountId) {
             logger.warn(`${TAG} Conexão Instagram inativa ou incompleta para User ${userId}. isConnected: ${user.isInstagramConnected}, accountId: ${user.instagramAccountId}`);
             return null; // Retorna null se não estiver conectado ou não tiver accountId
        }

        // Retorna os detalhes, incluindo o token (pode ser null se não existir mais)
        logger.debug(`${TAG} Detalhes de conexão IG encontrados para User ${userId}. AccountId: ${user.instagramAccountId}`);
        return { accessToken: user.instagramAccessToken ?? null, accountId: user.instagramAccountId };

    } catch (error) {
        logger.error(`${TAG} Erro ao buscar detalhes de conexão IG para User ${userId}:`, error);
        return null;
    }
}

/**
 * Busca mídias (posts) de uma conta do Instagram, com suporte a paginação.
 * Utiliza o token de acesso do usuário (obtido via getInstagramConnectionDetails).
 * @param userId - ID do usuário proprietário da conta.
 * @param pageUrl - URL da página específica a ser buscada (para paginação). Se omitido, busca a primeira página.
 * @returns Resultado da busca, incluindo dados da mídia e URL da próxima página.
 */
export async function fetchInstagramMedia(userId: string, pageUrl?: string): Promise<FetchMediaResult> {
    const TAG = '[fetchInstagramMedia]';
    const logPrefix = pageUrl ? `${TAG} (Paginação)` : TAG;
    logger.info(`${logPrefix} Iniciando busca de mídias para User ${userId}...`);

    const connectionDetails = await getInstagramConnectionDetails(userId);
    // Validação crucial: Precisa do accountId. O token pode vir do System User ou LLAT do usuário.
    // A lógica atual ainda assume que o token está no DB via getInstagramConnectionDetails.
    // TODO: Refatorar futuramente para aceitar token como parâmetro se necessário.
    if (!connectionDetails?.accessToken || !connectionDetails?.accountId) {
        logger.error(`${logPrefix} Usuário ${userId} não conectado ou detalhes inválidos (token/accountId ausente no DB).`);
        return { success: false, error: 'Usuário não conectado ao Instagram ou detalhes inválidos.' };
    }
    const { accessToken, accountId } = connectionDetails;

    const getUrl = () => {
        if (pageUrl) {
            let url = pageUrl;
            // Garante que o token seja adicionado se não estiver na URL de paginação
            if (!url.includes('access_token=')) {
                url += `&access_token=${accessToken}`;
            }
            return url;
        } else {
            const fields = 'id,media_type,timestamp,caption,permalink,username,children{id,media_type,media_url,permalink}';
            const limit = 25; // Limite padrão da API
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
                    logger.warn(`${TAG} Erro de token (${error.code}/${'error_subcode' in error ? error.error_subcode : 'N/A'}) detectado. Limpando conexão e não tentando novamente.`);
                    await clearInstagramConnection(userId); // Limpa a conexão no DB
                    bail(new Error('Token de acesso inválido ou expirado. Por favor, reconecte sua conta.'));
                    return; // Não retorna nada, bail interrompe
                }
                // Erros 4xx (exceto 429 - rate limit) geralmente não são recuperáveis
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    logger.warn(`${TAG} Erro ${response.status} (Client Error) não recuperável. Não tentar novamente.`);
                    bail(new Error(`Falha ao buscar mídias (Erro ${response.status}): ${error.message}`));
                    return;
                }
                // Outros erros (5xx, 429) são considerados temporários e acionam retentativa
                throw new Error(`Erro temporário (${response.status}) ao buscar mídias: ${error.message}`);
            }
            return data; // Retorna os dados em caso de sucesso

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
        // Retorna a mensagem específica se for erro de token/falha não recuperável
        return { success: false, error: message.startsWith('Token') || message.startsWith('Falha') ? message : `Erro interno ao buscar mídias: ${message}` };
    }
}


/**
 * Busca insights para uma mídia específica do Instagram.
 * @param mediaId - ID da mídia do Instagram.
 * @param accessToken - Token de acesso válido (pode ser System User ou LLAT do usuário).
 * @returns Resultado da busca de insights.
 */
export async function fetchMediaInsights(mediaId: string, accessToken: string): Promise<FetchInsightsResult<IMetricStats>> {
    const TAG = '[fetchMediaInsights]';
    logger.debug(`${TAG} Buscando insights para Media ID: ${mediaId}...`);

    const metrics = MEDIA_INSIGHTS_METRICS;
    let urlBase = `${BASE_URL}/${API_VERSION}/${mediaId}/insights?metric=${metrics}`;
    // Adiciona breakdown se necessário para alguma métrica específica
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

                // Erro de permissão específico
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

        // Processa os dados retornados para o formato IMetricStats
        const insights: Partial<IMetricStats> = {};
        if (responseData?.data) {
            responseData.data.forEach(item => {
                const metricName = item.name as keyof IMetricStats;
                if (item.values && item.values.length > 0) {
                    // Pega o valor mais recente (geralmente só há um para insights de mídia)
                    const latestValue = item.values[item.values.length - 1]?.value;
                    if (typeof latestValue === 'number') {
                        insights[metricName] = latestValue;
                    } else if (typeof latestValue === 'object' && latestValue !== null) {
                        // Trata casos onde o valor é um objeto (ex: profile_activity com breakdown)
                        insights[metricName] = latestValue as any;
                    }
                }
            });
        }
        // Retorna sucesso com os dados processados
        return { success: true, data: insights as IMetricStats };

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`${TAG} Erro final ao buscar insights para Media ${mediaId}:`, error);
        // Retorna a mensagem específica se for erro de permissão/token/falha
        return { success: false, error: message.includes('Permissão') || message.includes('Token') || message.includes('Falha') ? message : `Erro interno ao buscar insights da mídia: ${message}` };
    }
}

/**
 * Busca insights agregados para uma conta do Instagram em um período específico.
 * @param accountId - ID da conta do Instagram.
 * @param accessToken - Token de acesso válido (pode ser System User ou LLAT do usuário).
 * @param period - Período dos insights (ex: 'day', 'week', 'days_28').
 * @returns Resultado da busca de insights da conta.
 */
export async function fetchAccountInsights(
    accountId: string,
    accessToken: string,
    period: string = DEFAULT_ACCOUNT_INSIGHTS_PERIOD
): Promise<FetchInsightsResult<IAccountInsightsPeriod>> {
    const TAG = '[fetchAccountInsights]';
    logger.debug(`${TAG} Buscando insights da conta ${accountId} para o período: ${period}...`);

    const metrics = ACCOUNT_INSIGHTS_METRICS;
    let urlBase = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${metrics}&period=${period}`;
    // Adiciona breakdowns se necessário
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

        // Processa os dados retornados para o formato IAccountInsightsPeriod
        const insights: Partial<IAccountInsightsPeriod> = { period: period };
        if (responseData?.data) {
            responseData.data.forEach(item => {
                const metricName = item.name as keyof IAccountInsightsPeriod;
                if (item.values && item.values.length > 0) {
                    // Para insights de conta, geralmente pegamos o primeiro valor (total do período)
                    const valueData = item.values[0]?.value;
                    if (typeof valueData === 'number') {
                        insights[metricName] = valueData;
                    } else if (typeof valueData === 'object' && valueData !== null) {
                        // Trata casos com breakdown (ex: follows_and_unfollows)
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
 * @param accessToken - Token de acesso válido (pode ser System User ou LLAT do usuário).
 * @returns Resultado da busca de dados demográficos.
 */
export async function fetchAudienceDemographics(
    accountId: string,
    accessToken: string
): Promise<FetchInsightsResult<IAudienceDemographics>> {
    const TAG = '[fetchAudienceDemographics]';
    logger.debug(`${TAG} Buscando dados demográficos da conta ${accountId}...`);

    const metrics = DEMOGRAPHICS_METRICS;
    const period = 'lifetime'; // Demografia geralmente é 'lifetime'
    const breakdown = DEMOGRAPHICS_BREAKDOWNS;
    const timeframe = DEMOGRAPHICS_TIMEFRAME; // Ex: 'last_30_days'
    const urlBase = `${BASE_URL}/${API_VERSION}/${accountId}/insights?metric=${metrics}&period=${period}&breakdown=${breakdown}&timeframe=${timeframe}`;

    try {
        const responseData = await retry(async (bail, attempt) => {
             const currentUrl = `${urlBase}&access_token=${accessToken}`;
             if (attempt > 1) {
                  logger.warn(`${TAG} Tentativa ${attempt} para buscar demografia da conta ${accountId}.`);
             }

            const response = await fetch(currentUrl);
            // Verifica se a resposta é JSON antes de tentar parsear
            if (!response.headers.get('content-type')?.includes('application/json')) {
                 logger.error(`${TAG} Resposta inesperada não-JSON da API (Status: ${response.status})`);
                 // Considera erro não recuperável se não for JSON
                 bail(new Error(`Resposta inesperada não-JSON da API (Status: ${response.status})`));
                 return null; // Retorna null para o retry/bail
            }

            const data: InstagramApiResponse<InstagramApiDemographicItem> & FacebookApiError = await response.json();

            if (!response.ok || data.error) {
                type ErrorType = FacebookApiErrorStructure | { message: string; code: number; };
                const error: ErrorType = data.error || { message: `Erro ${response.status} da API`, code: response.status };
                logger.error(`${TAG} Erro da API (Tentativa ${attempt}) ao buscar demografia da conta ${accountId}:`, error);

                const isTokenError = error.code === 190 ||
                                     ('error_subcode' in error && (error.error_subcode === 463 || error.error_subcode === 467));

                // Erro 10 (Permissão) ou 200 (Permissão/Dados Insuficientes) para demografia são comuns
                if (error.code === 10 || error.code === 200) {
                     logger.warn(`${TAG} Permissão ausente, dados insuficientes ou erro (${error.code}) ao buscar demografia para ${accountId}. Mensagem: ${error.message}`);
                     // Considera isso como sucesso, mas sem dados (não tenta novamente)
                     bail(new Error(`Demographics unavailable (${error.code}): ${error.message}`));
                     return null; // Retorna null para indicar que não há dados, mas não é um erro de API recuperável
                }
                if (isTokenError) { bail(new Error('Token de acesso inválido ou expirado ao buscar demografia.')); return; }
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                     bail(new Error(`Falha ao buscar demografia (Erro ${response.status}): ${error.message}`)); return;
                 }
                throw new Error(`Erro temporário (${response.status}) ao buscar demografia: ${error.message}`);
            }
             // Verifica se 'data' existe, mesmo com resposta OK
             if (!data.data) {
                 logger.warn(`${TAG} Demografia retornada com sucesso (Status ${response.status}), mas sem array 'data' na resposta para conta ${accountId}. Resposta:`, data);
                 // Trata como sucesso, mas sem dados
                 return { data: [] };
             }
            return data;

        }, RETRY_OPTIONS);

        // Se responseData for null (devido a erro 10, 200 ou não-JSON), retorna sucesso sem dados
        if (!responseData) {
             logger.warn(`${TAG} Concluído sem dados demográficos para ${accountId} devido a erro (10, 200) ou falha na API.`);
             return { success: true, data: {}, errorMessage: 'Dados demográficos insuficientes ou indisponíveis.' };
        }
        // Se responseData.data for vazio
        if (responseData.data.length === 0) {
            logger.warn(`${TAG} Demografia retornada com sucesso, mas sem dados ('data' array vazio) para conta ${accountId}.`);
            return { success: true, data: {}, errorMessage: 'Dados demográficos não encontrados.' };
        }


        // Processa os dados demográficos
        const demographics: Partial<IAudienceDemographics> = {};
        if (responseData.data) {
            responseData.data.forEach(item => {
                const metricName = item.name; // 'follower_demographics' ou 'engaged_audience_demographics'
                const targetKey = metricName as keyof IAudienceDemographics;
                // Verifica se há valor e se é um objeto
                if (item.values?.[0]?.value && typeof item.values[0].value === 'object') {
                    const breakdownData = item.values[0].value; // Ex: { city: {...}, country: {...}, gender_age: {...} }
                    const parsedBreakdowns: Partial<IAudienceDemographics[typeof targetKey]> = {};

                    // Itera sobre as chaves de breakdown (city, country, gender_age)
                    for (const breakdownKey in breakdownData) {
                        if (Object.prototype.hasOwnProperty.call(breakdownData, breakdownKey)) {
                            const subBreakdownMap = breakdownData[breakdownKey]; // Ex: { 'Sao Paulo': 100, 'Rio de Janeiro': 50 }
                            // Verifica se é um objeto válido
                            if (typeof subBreakdownMap === 'object' && subBreakdownMap !== null) {
                                // Mapeia para o formato [{ value: 'Sao Paulo', count: 100 }, ...]
                                const breakdownArray: IDemographicBreakdown[] = Object.entries(subBreakdownMap)
                                    .filter(([_, count]) => typeof count === 'number') // Garante que o valor é um número
                                    .map(([val, count]) => ({ value: val, count: count as number }));

                                // Adiciona ao objeto de breakdowns parseados se houver dados
                                if (breakdownArray.length > 0) {
                                    // Valida se a chave de breakdown é esperada
                                    if (['gender_age', 'city', 'country'].includes(breakdownKey)) {
                                        parsedBreakdowns[breakdownKey as keyof typeof parsedBreakdowns] = breakdownArray;
                                    } else {
                                        logger.warn(`${TAG} Chave de breakdown inesperada '${breakdownKey}' encontrada em ${metricName}.`);
                                    }
                                }
                            }
                        }
                    }
                    // Adiciona os breakdowns parseados ao objeto final de demografia se houver algum
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
        // Retorna sucesso, mesmo que os dados sejam vazios, mas inclui a mensagem de erro se for o caso
        return { success: true, data: demographics as IAudienceDemographics, errorMessage: hasData ? undefined : 'Dados demográficos insuficientes ou indisponíveis.' };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro final ao buscar demografia para Conta ${accountId}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        // Se o erro foi por dados indisponíveis (código 10, 200) ou resposta não-JSON, retorna sucesso com mensagem
        if (message.startsWith('Demographics unavailable') || message.includes('non-JSON')) {
            return { success: true, data: {}, errorMessage: 'Dados demográficos insuficientes ou indisponíveis.' };
        }
        // Outros erros (token, falha genérica) são retornados como falha
        return { success: false, error: message.includes('Token') || message.includes('Falha') ? message : `Erro interno ao buscar demografia da conta: ${message}` };
    }
}

/**
 * Busca dados básicos do perfil de uma conta do Instagram.
 * @param accountId - ID da conta do Instagram.
 * @param accessToken - Token de acesso válido (pode ser System User ou LLAT do usuário).
 * @returns Resultado da busca dos dados básicos.
 */
export async function fetchBasicAccountData(
    accountId: string,
    accessToken: string
): Promise<FetchBasicAccountDataResult> {
    const TAG = '[fetchBasicAccountData]';
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
            const data: any & FacebookApiError = await response.json(); // A resposta aqui não tem 'data[]'

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
            return data; // Retorna o objeto de dados diretamente

        }, RETRY_OPTIONS);

        // Mapeia a resposta da API para os campos da interface IUser (parcial)
        const accountData: Partial<IUser> = {
            instagramAccountId: responseData?.id, // Confirma o ID
            username: responseData?.username,
            name: responseData?.name,
            biography: responseData?.biography,
            website: responseData?.website,
            profile_picture_url: responseData?.profile_picture_url,
            followers_count: responseData?.followers_count,
            follows_count: responseData?.follows_count,
            media_count: responseData?.media_count,
            // Campos booleanos ou outros podem ser adicionados aqui se necessário
            // is_published: responseData?.is_published,
            // shopping_product_tag_eligibility: responseData?.shopping_product_tag_eligibility,
        };
        // Remove chaves com valor undefined
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
 * Define isInstagramConnected como false.
 * @param userId - ID do usuário (string ou ObjectId).
 */
export async function clearInstagramConnection(userId: string | mongoose.Types.ObjectId): Promise<void> {
    const TAG = '[clearInstagramConnection]';
    logger.warn(`${TAG} Limpando dados de conexão Instagram para User ${userId}...`);
    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido fornecido para limpar conexão: ${userId}`);
        return;
    }
    try {
        await connectToDatabase();
        await DbUser.findByIdAndUpdate(userId, {
            $set: {
                isInstagramConnected: false, // Define como desconectado
                lastInstagramSyncSuccess: null, // Reseta status de sync
            },
             $unset: {
                 instagramAccessToken: "", // Remove o token
                 instagramAccountId: "", // Remove o ID da conta
                 // Opcional: remover outros campos relacionados se desejado
                 // username: "",
                 // profile_picture_url: "",
                 // etc...
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
    switch (mediaType) {
        case 'IMAGE': return 'Foto';
        case 'VIDEO': return 'Reel'; // Ou 'Vídeo' se preferir
        case 'CAROUSEL_ALBUM': return 'Carrossel';
        default: return 'Desconhecido';
    }
}

/**
 * Salva ou atualiza os dados e insights de uma mídia no banco de dados (coleção Metrics).
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
    const startTime = Date.now();
    logger.info(`${TAG} Iniciando salvamento/atualização para User: ${userId}, Media: ${media.id}`);

    if (!media.id) {
        logger.error(`${TAG} Tentativa de salvar métrica sem instagramMediaId.`);
        throw new Error("Tentativa de salvar métrica sem instagramMediaId.");
    }
    // Ignora mídias do tipo STORY nesta coleção
    if (media.media_type === 'STORY') {
        logger.debug(`${TAG} Ignorando mídia do tipo STORY ${media.id}.`);
        return;
    }

    let savedMetric: IMetric | null = null;

    try {
        await connectToDatabase();

        const filter = { user: userId, instagramMediaId: media.id };
        const format = mapMediaTypeToFormat(media.media_type);

        // Prepara o objeto $set para os stats, tratando valores undefined/null
        const statsUpdate: { [key: string]: number | object } = {};
         if (insights) {
             Object.entries(insights).forEach(([key, value]) => {
                 // Inclui apenas se o valor for um número ou um objeto (para breakdowns)
                 if (value !== undefined && value !== null && (typeof value === 'number' || typeof value === 'object')) {
                     statsUpdate[`stats.${key}`] = value;
                 }
             });
         }

        // Operação de atualização/inserção
        const finalUpdateOperation = {
            $set: {
                 user: userId,
                 instagramMediaId: media.id,
                 source: 'api', // Indica que os dados vieram da API
                 postLink: media.permalink ?? '',
                 description: media.caption ?? '',
                 postDate: media.timestamp ? new Date(media.timestamp) : new Date(),
                 format: format,
                 updatedAt: new Date(), // Atualiza sempre
                 ...statsUpdate // Adiciona os insights ao $set
            },
            $setOnInsert: { // Define apenas na criação
                 createdAt: new Date()
                 // classificationStatus: 'pending' // Pode definir aqui se for o padrão
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
            // Enfileira se tiver descrição e status pendente
            if (savedMetric.classificationStatus === 'pending' && savedMetric.description && savedMetric.description.trim() !== '') {
                try {
                    await qstashClient.publishJSON({ url: workerUrl, body: { metricId: savedMetric._id.toString() } });
                    logger.info(`${TAG} Tarefa de classificação enviada para QStash para Metric ID: ${savedMetric._id}.`);
                } catch (qstashError) {
                    logger.error(`${TAG} ERRO ao enviar tarefa para QStash para Metric ID: ${savedMetric._id}.`, qstashError);
                }
            }
        } else if (!qstashClient) {
             // logger.debug(`${TAG} QStash client não configurado.`); // Log menos verboso
        } else if (!workerUrl) {
             logger.warn(`${TAG} CLASSIFICATION_WORKER_URL não definido, classificação não será enfileirada.`);
        }

        // --- Daily Snapshot Logic ---
        // Chama a função para criar/atualizar o snapshot diário após salvar a métrica
        await createOrUpdateDailySnapshot(savedMetric);

    } catch (error) {
        logger.error(`${TAG} Erro CRÍTICO durante o salvamento/atualização da métrica ${media.id} no DB:`, error);
        // Re-throw para que o erro seja propagado para triggerDataRefresh se necessário
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
    // Só cria snapshot para métricas da API com data de postagem
    if (metric.source !== 'api') { return; }
    if (!metric.postDate) {
        logger.warn(`${SNAPSHOT_TAG} Metric ${metric._id} não possui postDate. Impossível calcular snapshot.`);
        return;
    }

    try {
        const postDate = new Date(metric.postDate);
        const today = new Date(); today.setUTCHours(0, 0, 0, 0); // Data atual (UTC, início do dia)

        // Define data de corte (ex: 30 dias após postagem) - Opcional
        // const cutoffDate = new Date(postDate); cutoffDate.setUTCDate(cutoffDate.getUTCDate() + 30); cutoffDate.setUTCHours(0, 0, 0, 0);
        // if (today > cutoffDate) { logger.debug(`${SNAPSHOT_TAG} Metric ${metric._id} postada há mais de 30 dias. Snapshot não será mais atualizado.`); return; }

        const snapshotDate = today; // O snapshot representa o estado no *final* do dia de hoje (ou início de amanhã)
        logger.debug(`${SNAPSHOT_TAG} Calculando/Atualizando snapshot para Metric ${metric._id} na data ${snapshotDate.toISOString().split('T')[0]}.`);

        // Busca o último snapshot salvo para esta métrica ANTES da data atual
        const lastSnapshot: IDailyMetricSnapshot | null = await DailyMetricSnapshotModel.findOne({
            metric: metric._id,
            date: { $lt: snapshotDate } // Busca snapshot anterior a hoje
        }).sort({ date: -1 }).lean(); // Pega o mais recente dos anteriores

        // Inicializa estatísticas cumulativas anteriores (0 se não houver snapshot anterior)
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

        // Pega as estatísticas cumulativas atuais da métrica principal
        const currentCumulativeStats = metric.stats;
        if (!currentCumulativeStats) { logger.warn(`${SNAPSHOT_TAG} Metric ${metric._id} sem 'stats' atuais. Não é possível calcular delta.`); return; }

        // Calcula as estatísticas diárias (delta)
        const dailyStats: Partial<Record<keyof IDailyMetricSnapshot, number>> = {};
        const metricsToCalculateDelta: (keyof IMetricStats)[] = [ 'views', 'likes', 'comments', 'shares', 'saved', 'reach', 'follows', 'profile_visits' /* Adicionar outras se necessário */ ];

        for (const metricName of metricsToCalculateDelta) {
            const currentVal = Number(currentCumulativeStats[metricName] ?? 0);
            if (isNaN(currentVal)) { logger.warn(`${SNAPSHOT_TAG} Valor inválido para '${metricName}' em Metric ${metric._id}. Pulando delta.`); continue; }
            const previousVal = previousCumulativeStats[metricName] ?? 0;

            // Constrói a chave do campo diário (ex: dailyViews, dailyLikes)
            const metricNameStr = String(metricName);
            const dailyKey = `daily${metricNameStr.charAt(0).toUpperCase() + metricNameStr.slice(1)}` as keyof IDailyMetricSnapshot;

            // Calcula o delta, garantindo que não seja negativo
            dailyStats[dailyKey] = Math.max(0, currentVal - previousVal);

            // Loga um aviso se o valor cumulativo diminuiu (pode indicar problema na API ou lógica)
            if (currentVal < previousVal) { logger.warn(`${SNAPSHOT_TAG} Valor cumulativo de '${metricNameStr}' diminuiu (${metric._id}). Atual: ${currentVal}, Anterior: ${previousVal}. Delta será 0.`); }
        }

        // Define o tipo para os dados do snapshot a serem salvos
        type SnapshotUpdateData = {
            metric: Types.ObjectId; date: Date;
            dailyViews?: number; dailyLikes?: number; dailyComments?: number; dailyShares?: number; dailySaved?: number;
            dailyReach?: number; dailyFollows?: number; dailyProfileVisits?: number; /* Adicionar outros daily */
            cumulativeViews?: number; cumulativeLikes?: number; cumulativeComments?: number; cumulativeShares?: number; cumulativeSaved?: number;
            cumulativeReach?: number; cumulativeFollows?: number; cumulativeProfileVisits?: number; cumulativeTotalInteractions?: number; /* Adicionar outros cumulative */
        };

        // Monta o objeto de dados para o snapshot
        const snapshotData: SnapshotUpdateData = {
             metric: metric._id, date: snapshotDate,
             // Dados diários (delta)
             dailyViews: dailyStats.dailyViews, dailyLikes: dailyStats.dailyLikes, dailyComments: dailyStats.dailyComments,
             dailyShares: dailyStats.dailyShares, dailySaved: dailyStats.dailySaved, dailyReach: dailyStats.dailyReach,
             dailyFollows: dailyStats.dailyFollows, dailyProfileVisits: dailyStats.dailyProfileVisits,
             // Dados cumulativos atuais
             cumulativeViews: Number(currentCumulativeStats.views ?? 0), cumulativeLikes: Number(currentCumulativeStats.likes ?? 0),
             cumulativeComments: Number(currentCumulativeStats.comments ?? 0), cumulativeShares: Number(currentCumulativeStats.shares ?? 0),
             cumulativeSaved: Number(currentCumulativeStats.saved ?? 0), cumulativeReach: Number(currentCumulativeStats.reach ?? 0),
             cumulativeFollows: Number(currentCumulativeStats.follows ?? 0), cumulativeProfileVisits: Number(currentCumulativeStats.profile_visits ?? 0),
             cumulativeTotalInteractions: Number(currentCumulativeStats.total_interactions ?? 0),
         };

        // Salva ou atualiza o snapshot para a métrica e data específicas
        await DailyMetricSnapshotModel.updateOne(
            { metric: metric._id, date: snapshotDate },
            { $set: snapshotData },
            { upsert: true } // Cria se não existir, atualiza se existir
        );
        logger.debug(`${SNAPSHOT_TAG} Snapshot salvo/atualizado para Metric ${metric._id} em ${snapshotDate.toISOString().split('T')[0]}.`);

    } catch (snapError) {
        // Loga o erro, mas não o propaga, pois um erro no snapshot não deve impedir o resto do sync
        logger.error(`${SNAPSHOT_TAG} Erro NÃO FATAL ao processar/salvar snapshot para Metric ${metric._id}:`, snapError);
    }
}


/**
 * Salva um snapshot dos insights da conta, demografia e dados básicos do perfil.
 * @param userId - ObjectId do usuário.
 * @param accountId - ID da conta do Instagram.
 * @param insights - Insights do período da conta (opcional).
 * @param demographics - Dados demográficos da audiência (opcional).
 * @param accountData - Dados básicos do perfil da conta (opcional).
 */
export async function saveAccountInsightData(
    userId: Types.ObjectId,
    accountId: string,
    insights: IAccountInsightsPeriod | undefined,
    demographics: IAudienceDemographics | undefined,
    accountData: Partial<IUser> | undefined
): Promise<void> {
    const TAG = '[saveAccountInsightData]';
    logger.debug(`${TAG} Preparando snapshot de insights/demografia/dados básicos para User ${userId}, Conta IG ${accountId}...`);
    try {
        // Monta o objeto de snapshot apenas com os dados que foram fornecidos
        const snapshot: Partial<IAccountInsight> = {
            user: userId,
            instagramAccountId: accountId,
            recordedAt: new Date(), // Data em que o snapshot foi criado
            // Adiciona insights apenas se existirem e tiverem dados além do 'period'
            ...(insights && Object.keys(insights).length > 1 && { accountInsightsPeriod: insights }),
            // Adiciona demografia apenas se existir e tiver dados relevantes
            ...(demographics && (demographics.follower_demographics || demographics.engaged_audience_demographics) && { audienceDemographics: demographics }),
            // Adiciona detalhes da conta apenas se existirem e tiverem dados além do 'instagramAccountId'
            ...(accountData && Object.keys(accountData).filter(k => k !== 'instagramAccountId').length > 0 && {
                accountDetails: {
                    username: accountData.username,
                    name: accountData.name,
                    biography: accountData.biography,
                    website: accountData.website,
                    profile_picture_url: accountData.profile_picture_url,
                    followers_count: accountData.followers_count,
                    follows_count: accountData.follows_count,
                    media_count: accountData.media_count,
                    // Adicionar outros campos básicos se necessário
                }
            }),
        };

        // Verifica se há dados relevantes para salvar
        const hasDataToSave = !!snapshot.accountInsightsPeriod || !!snapshot.audienceDemographics || !!snapshot.accountDetails;

        if (hasDataToSave) {
            await connectToDatabase();
            // Cria um novo documento na coleção AccountInsightModel
            await AccountInsightModel.create(snapshot);
            logger.info(`${TAG} Snapshot de conta salvo com sucesso para User ${userId}.`);
        } else {
            logger.warn(`${TAG} Nenhum dado novo de conta (insights, demo, basic) para salvar no snapshot para User ${userId}.`);
        }
    } catch (error) {
        logger.error(`${TAG} Erro ao salvar snapshot de conta para User ${userId}:`, error);
        // Não propaga o erro, pois falha aqui não deve parar o sync principal
    }
}

/**
 * Dispara o processo completo de atualização de dados do Instagram para um usuário.
 * Busca dados básicos, insights da conta, demografia e métricas de mídias recentes.
 * @param userId - ID (string) do usuário.
 * @returns Objeto com status de sucesso, mensagem e detalhes da operação.
 */
export async function triggerDataRefresh(userId: string): Promise<{ success: boolean; message: string; details?: any }> {
    const TAG = '[triggerDataRefresh]';
    const startTime = Date.now();
    logger.info(`${TAG} Iniciando atualização de dados para User ${userId}...`);

    // Validação inicial do ID
    if (!mongoose.isValidObjectId(userId)) {
         logger.error(`${TAG} ID de usuário inválido: ${userId}`);
         return { success: false, message: 'ID de usuário inválido.' };
    }
    const userObjectId = new Types.ObjectId(userId);

    // --- Obtenção do Token e Account ID ---
    // Tenta obter o token do System User primeiro (se configurado)
    const systemUserToken = process.env.FB_SYSTEM_USER_TOKEN;
    let accessToken: string | null = systemUserToken ?? null;
    let accountId: string | null = null;
    let usingSystemToken = !!systemUserToken;

    // Busca o accountId do usuário no DB
    try {
        await connectToDatabase();
        const user = await DbUser.findById(userObjectId).select('instagramAccountId isInstagramConnected instagramAccessToken').lean();
        if (!user || !user.isInstagramConnected || !user.instagramAccountId) {
            logger.warn(`${TAG} Usuário ${userId} não encontrado, não conectado ou sem instagramAccountId no DB. Abortando refresh.`);
            // Atualiza status no DB para refletir a falha
            await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncAttempt: new Date(), lastInstagramSyncSuccess: false } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (usuário não conectado) ${userId}:`, dbErr));
            return { success: false, message: 'Usuário não conectado ou ID da conta Instagram não encontrado.' };
        }
        accountId = user.instagramAccountId;

        // Se não estiver usando System Token, tenta usar o token do usuário (LLAT do fallback)
        if (!usingSystemToken) {
            accessToken = user.instagramAccessToken ?? null;
            if (!accessToken) {
                logger.error(`${TAG} System Token não configurado e token do usuário (LLAT) não encontrado no DB para ${userId}. Abortando refresh.`);
                await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncAttempt: new Date(), lastInstagramSyncSuccess: false } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (token ausente) ${userId}:`, dbErr));
                return { success: false, message: 'Token de acesso necessário não encontrado.' };
            }
            logger.info(`${TAG} Utilizando token de acesso do usuário (LLAT) para o refresh.`);
        } else {
            logger.info(`${TAG} Utilizando System User Token para o refresh.`);
        }

    } catch (dbError) {
        logger.error(`${TAG} Erro ao buscar dados iniciais do usuário ${userId} no DB:`, dbError);
        return { success: false, message: 'Erro ao acessar dados do usuário no banco de dados.' };
    }

    // --- Início do Processo de Refresh ---
    // Marca a tentativa de sync no DB
    await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncAttempt: new Date() } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar início sync ${userId}:`, dbErr));

    // Variáveis de controle e resultado
    let totalMediaFound = 0, totalMediaProcessed = 0, collectedMediaInsights = 0, savedMediaMetrics = 0;
    let collectedAccountInsights = false, savedAccountInsights = false, collectedDemographics = false;
    let savedDemographics = false, collectedBasicAccountData = false;
    let errors: string[] = [];
    let mediaCurrentPage = 0;
    let hasMoreMediaPages = true;
    let overallSuccess = true; // Assume sucesso inicial, muda para false se ocorrer erro crítico (ex: token)

    try {
        // --- 1. Fetch Basic Account Data ---
        logger.info(`${TAG} Buscando dados básicos da conta ${accountId}...`);
        let basicAccountData: Partial<IUser> | undefined;
        const basicDataResult = await fetchBasicAccountData(accountId, accessToken!); // Usa o token obtido (System ou User)
        if (basicDataResult.success && basicDataResult.data) {
             collectedBasicAccountData = true; basicAccountData = basicDataResult.data; logger.debug(`${TAG} Dados básicos obtidos.`);
             // Opcional: Atualizar campos básicos no DbUser aqui mesmo
             // await DbUser.findByIdAndUpdate(userObjectId, { $set: { ...basicAccountData } });
        } else {
            logger.warn(`${TAG} Falha ao obter dados básicos: ${basicDataResult.error}`); errors.push(`Dados básicos: ${basicDataResult.error ?? 'Erro desconhecido'}`);
            // Se for erro de token, marca falha geral e interrompe
            if (basicDataResult.error?.includes('Token')) { overallSuccess = false; throw new Error("Token inválido ao buscar dados básicos."); }
        }

        // --- 2. Fetch and Process Media Pages ---
        if (overallSuccess) {
            logger.info(`${TAG} Iniciando busca de mídias (limite ${MAX_PAGES_MEDIA} pgs)...`);
            let nextPageMediaUrl: string | null | undefined = undefined; mediaCurrentPage = 0;
            do {
                mediaCurrentPage++; const pageStartTime = Date.now(); logger.info(`${TAG} Processando pág ${mediaCurrentPage}/${MAX_PAGES_MEDIA} de mídias...`);
                // fetchInstagramMedia atualmente usa o token do DB. Precisa ser adaptado ou usar o token correto.
                // Por enquanto, vamos assumir que o token correto está no DB (se fallback) ou que fetchInstagramMedia será adaptado.
                // Se estivermos usando System Token, fetchInstagramMedia falhará se não for adaptado.
                // SOLUÇÃO TEMPORÁRIA: Passar o token para fetchInstagramMedia (requer refatoração de fetchInstagramMedia)
                // SOLUÇÃO ATUAL (mantendo código original): fetchInstagramMedia usa getInstagramConnectionDetails
                const mediaResult = await fetchInstagramMedia(userId, nextPageMediaUrl ?? undefined);

                if (!mediaResult.success) {
                    logger.error(`${TAG} Falha busca pág ${mediaCurrentPage} mídias: ${mediaResult.error}`); errors.push(`Busca mídia pág ${mediaCurrentPage}: ${mediaResult.error ?? 'Erro desconhecido'}`);
                    // Se for erro de token, marca falha geral e interrompe busca de mídias
                    if (mediaResult.error?.includes('Token')) { logger.warn(`${TAG} Erro de token, interrompendo busca de mídias.`); hasMoreMediaPages = false; overallSuccess = false; break; } // Sai do loop de mídias
                    // Outros erros podem não ser fatais para o sync geral, continua para outras partes se possível
                }

                const mediaInPage = mediaResult.data ?? []; totalMediaFound += mediaInPage.length;
                if (mediaInPage.length > 0 && overallSuccess) {
                    // Filtra mídias processáveis (não STORY)
                    const processableMedia = mediaInPage.filter(m => m.media_type !== 'STORY'); totalMediaProcessed += processableMedia.length;
                    logger.info(`${TAG} Pág ${mediaCurrentPage}: ${processableMedia.length} mídias processáveis. Buscando insights...`);

                    // Busca insights em paralelo com limite de concorrência
                    const insightTasks = processableMedia.map(media => limitInsightsFetch(async () => {
                        if (!media.id || !accessToken) return { mediaId: media.id ?? '?', status: 'skipped', reason: 'ID/Token ausente' };
                        // Chama fetchMediaInsights com o token correto (System ou User)
                        const insightsResult = await fetchMediaInsights(media.id, accessToken!);
                        // Se for erro de token aqui, lança erro para ser pego pelo Promise.allSettled
                        if (!insightsResult.success && insightsResult.error?.includes('Token')) throw new Error('Token error during media insights fetch');
                        return { mediaId: media.id, media, insightsResult };
                    }));

                    const insightTaskResults = await Promise.allSettled(insightTasks);

                    // Processa resultados dos insights
                    for (const result of insightTaskResults) {
                        if (result.status === 'fulfilled' && result.value) {
                            const { mediaId, media, insightsResult } = result.value;
                            if (insightsResult?.success && insightsResult.data) {
                                collectedMediaInsights++;
                                try {
                                    // Salva os dados da métrica e insights
                                    await saveMetricData(userObjectId, media, insightsResult.data);
                                    savedMediaMetrics++;
                                } catch (saveError: any) { errors.push(`Salvar métrica ${mediaId}: ${saveError.message}`); }
                            } else if (insightsResult) {
                                errors.push(`Insights mídia ${mediaId}: ${insightsResult.error || result.value.reason || 'Erro desconhecido'}`);
                            }
                        } else if (result.status === 'rejected') {
                            const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
                            // Se o erro for de token, marca falha geral e interrompe
                            if (errorMsg.includes('Token error')) {
                                logger.error(`${TAG} Erro de token detectado durante busca de insights de mídia. Interrompendo sync.`);
                                errors.push('Erro de token nos insights de mídia.');
                                overallSuccess = false; hasMoreMediaPages = false; break; // Sai do loop for e do while
                            } else { errors.push(`Erro tarefa insight mídia: ${errorMsg}`); }
                        }
                    }
                    if (!overallSuccess) break; // Sai do loop while se ocorreu erro de token nos insights

                } else if (!overallSuccess) { logger.info(`${TAG} Pulando processamento da pág ${mediaCurrentPage} de mídias devido a erro anterior.`); }
                else { logger.info(`${TAG} Pág ${mediaCurrentPage}: Nenhuma mídia encontrada ou retornada.`); }

                // Prepara para próxima página ou encerra
                nextPageMediaUrl = mediaResult.nextPageUrl; if (!nextPageMediaUrl) hasMoreMediaPages = false;
                logger.info(`${TAG} Pág ${mediaCurrentPage} mídias processada em ${Date.now() - pageStartTime}ms.`);
                // Adiciona delay entre páginas se houver mais
                if (hasMoreMediaPages && mediaCurrentPage < MAX_PAGES_MEDIA && overallSuccess) await new Promise(r => setTimeout(r, DELAY_MS));

            } while (hasMoreMediaPages && mediaCurrentPage < MAX_PAGES_MEDIA && overallSuccess);

            if (mediaCurrentPage >= MAX_PAGES_MEDIA && hasMoreMediaPages) { logger.warn(`${TAG} Limite de ${MAX_PAGES_MEDIA} páginas de mídia atingido.`); errors.push(`Limite ${MAX_PAGES_MEDIA} pgs mídia atingido.`); }
            logger.info(`${TAG} Processamento de mídias concluído.`);
        }

        // --- 3. Fetch and Save Account Insights & Demographics ---
        if (overallSuccess) {
            logger.info(`${TAG} Buscando insights/demografia da conta ${accountId}...`);
            let accountInsightData: IAccountInsightsPeriod | undefined; let audienceDemographicsData: IAudienceDemographics | undefined;
            const insightPeriod = DEFAULT_ACCOUNT_INSIGHTS_PERIOD;

            // Busca insights da conta
            const accountInsightsResult = await fetchAccountInsights(accountId, accessToken!, insightPeriod);
            if (accountInsightsResult.success && accountInsightsResult.data) { collectedAccountInsights = true; accountInsightData = accountInsightsResult.data; }
            else {
                errors.push(`Insights conta: ${accountInsightsResult.error ?? 'Erro desconhecido'}`);
                if (accountInsightsResult.error?.includes('Token')) { overallSuccess = false; logger.error(`${TAG} Erro de token ao buscar insights da conta. Interrompendo.`); }
            }

            // Busca demografia (apenas se não houve erro de token antes)
            if (overallSuccess) {
                await new Promise(r => setTimeout(r, DELAY_MS)); // Pequeno delay
                const demographicsResult = await fetchAudienceDemographics(accountId, accessToken!);
                collectedDemographics = true; // Marca que tentou buscar
                if (demographicsResult.success && demographicsResult.data && (demographicsResult.data.follower_demographics || demographicsResult.data.engaged_audience_demographics)) {
                    audienceDemographicsData = demographicsResult.data;
                    savedDemographics = true; // Marca que salvou dados válidos
                } else {
                    // Loga aviso ou erro, mas não considera falha geral a menos que seja erro de token
                    const demoErrorMsg = demographicsResult.error || demographicsResult.errorMessage || 'Dados insuficientes/indisponíveis';
                    logger.warn(`${TAG} Falha/Dados insuficientes demografia: ${demoErrorMsg}`);
                    if(demographicsResult.error) errors.push(`Demografia: ${demographicsResult.error}`);
                    if (demographicsResult.error?.includes('Token')) { overallSuccess = false; logger.error(`${TAG} Erro de token ao buscar demografia. Interrompendo.`); }
                }
            }

            // Salva o snapshot da conta (se não houve erro de token)
            if (overallSuccess && (accountInsightData || audienceDemographicsData || basicAccountData)) {
                logger.info(`${TAG} Salvando snapshot da conta...`);
                await saveAccountInsightData( userObjectId, accountId, accountInsightData, audienceDemographicsData, basicAccountData );
                savedAccountInsights = true; // Indica que a função de salvar foi chamada com algum dado
            } else if (!overallSuccess) { logger.warn(`${TAG} Pulando salvamento do snapshot da conta devido a erro de token anterior.`); }
            else { logger.warn(`${TAG} Nenhum dado novo de conta (insights, demo, basic) para salvar no snapshot.`); }

        } else { logger.warn(`${TAG} Pulando busca de insights/demografia da conta devido a erro anterior.`); }

        // --- Conclusion ---
        const duration = Date.now() - startTime;
        const finalSuccessStatus = overallSuccess; // Sucesso geral depende de não ter havido erro de token
        const statusMsg = finalSuccessStatus ? 'concluída com sucesso' : 'concluída com erros/falha (verificar token/permissões)';
        const summary = `Mídias: ${savedMediaMetrics}/${totalMediaProcessed}. Insights Conta: ${savedAccountInsights ? 'Salvo' : 'Não'}. Demo: ${savedDemographics ? 'Salva' : 'Não'}. Básicos: ${collectedBasicAccountData ? 'OK' : 'Não'}.`;
        const finalMessage = `Atualização ${statusMsg} para User ${userId}. ${summary} ${errors.length > 0 ? `Erros (${errors.length}): ${errors.slice(0, 3).join('; ')}...` : ''}`; // Mostra os primeiros erros

        logger.info(`${TAG} Finalizado. User: ${userId}. Sucesso Geral: ${finalSuccessStatus}. Duração: ${duration}ms. ${finalMessage}`);
        if(errors.length > 0) logger.warn(`${TAG} Detalhes dos erros (${errors.length}): ${errors.join('; ')}`);

        // Atualiza o status final no DB
        await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncSuccess: finalSuccessStatus } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status final sync ${userId}:`, dbErr));

        return { success: finalSuccessStatus, message: finalMessage, details: { errors, durationMs: duration, savedMediaMetrics, totalMediaProcessed, savedAccountInsights, savedDemographics, collectedBasicAccountData } };

    } catch (error: unknown) {
        // Captura erros críticos não tratados (ex: erro de token lançado nos passos anteriores)
        const duration = Date.now() - startTime;
        logger.error(`${TAG} Erro crítico NÃO TRATADO durante refresh para ${userId}. Duração: ${duration}ms`, error);
        const message = error instanceof Error ? error.message : String(error);
        // Garante que o status de sucesso seja marcado como false no DB
        await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncSuccess: false } }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (erro crítico) ${userId}:`, dbErr));
        return { success: false, message: `Erro interno crítico durante a atualização: ${message}` };
    }
}

// =========================================================================
// == Função fetchAvailableInstagramAccounts ATUALIZADA com Fluxo System User ===
// =========================================================================
/**
 * Busca contas Instagram Business/Creator disponíveis para um usuário.
 * Tenta primeiro via System User Token (se configurado).
 * Se falhar ou não configurado, usa o fluxo de fallback com o token do usuário (SLT -> LLAT).
 * @param shortLivedToken - Token de curta duração do usuário (necessário APENAS para o fluxo de fallback).
 * @param userId - ID do usuário no DB (necessário APENAS para o fluxo de fallback, para limpar conexão em erro de token).
 * @returns Objeto com lista de contas ou erro.
 */
export async function fetchAvailableInstagramAccounts(
    shortLivedToken: string, // Usado apenas no fluxo de fallback
    userId: string // Usado apenas no fluxo de fallback para obter LLAT e limpar conexão
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

        logger.debug(`${TAG} Buscando páginas via /${businessId}/owned_pages...`);
        while (currentPageUrl && pageCount < MAX_ACCOUNT_FETCH_PAGES) {
            pageCount++;
            logger.debug(`${TAG} Buscando página ${pageCount}/${MAX_ACCOUNT_FETCH_PAGES} de /owned_pages...`);
            try {
                const paginationRetryOptions = { ...RETRY_OPTIONS, retries: 2 }; // Menos retries para busca de contas
                const pageData = await retry(async (bail, attempt) => {
                    if (attempt > 1) logger.warn(`${TAG} Tentativa ${attempt} pág ${pageCount} /owned_pages.`);

                    logger.debug(`${TAG} [System User Flow] Chamando fetch para URL: ${currentPageUrl?.replace(systemUserAccessToken, '[SYSTEM_TOKEN_OCULTO]')}`);

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
                        // Erros comuns e tratamento
                        if (error.code === 190) { bail(new Error('System User Token inválido/expirado. Verifique as configurações.')); return; }
                        if (error.code === 10 || error.code === 200) { bail(new Error('Permissão insuficiente para System User (business_management, pages_show_list, etc.). Verifique permissões no Business Manager.')); return; }
                        if (error.code === 100 && error.message.includes("Unsupported get request")) { bail(new Error(`Business ID (${businessId}) inválido ou não acessível pelo System User Token.`)); return; }
                        if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha pág ${pageCount} /owned_pages: ${error.message}`)); return; }
                        throw new Error(error.message || `Erro temp ${response.status} pág ${pageCount}.`);
                    } return data;
                }, paginationRetryOptions);

                if (pageData?.data) { allPagesData.push(...pageData.data); logger.debug(`${TAG} Pág ${pageCount}: ${pageData.data.length} itens. Total: ${allPagesData.length}`); }
                else if (pageData === null) { logger.warn(`${TAG} Busca pág ${pageCount} /owned_pages falhou/interrompida (ver erro anterior).`); }
                else { logger.warn(`${TAG} Pág ${pageCount} /owned_pages sem 'data'. Resp:`, pageData); }
                currentPageUrl = pageData?.paging?.next ?? null;
                if (currentPageUrl) await new Promise(r => setTimeout(r, ACCOUNT_FETCH_DELAY_MS));
            } catch (error) {
                fetchError = error instanceof Error ? error : new Error(String(error));
                logger.error(`${TAG} Erro irrecuperável (System User) durante paginação /owned_pages (pág ${pageCount}):`, fetchError);
                currentPageUrl = null; // Stop pagination
            }
        } // End while

        if (pageCount >= MAX_ACCOUNT_FETCH_PAGES && currentPageUrl) logger.warn(`${TAG} Limite ${MAX_ACCOUNT_FETCH_PAGES} págs /owned_pages atingido.`);

        // Se houve erro durante a paginação, retorna falha
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
            // Considera isso um erro 404 (não encontrado), não uma falha da API
            return { success: false, error: errorMsg, errorCode: 404 };
        }

        logger.info(`${TAG} (System User) Encontradas ${availableAccounts.length} contas IG vinculadas.`);
        logger.debug(`${TAG} (System User) Contas (Nomes): ${availableAccounts.map(a => a.pageName).join(', ')}`);
        // Retorna sucesso com as contas e um LLAT vazio (não aplicável ao System User)
        return { success: true, accounts: availableAccounts, longLivedAccessToken: '' };

    }
    // --- Fluxo de Fallback: Token de Usuário ---
    else {
        logger.info(`${TAG} System User não configurado ou ID/Token ausente. Utilizando fluxo de fallback via User Token (LLAT) e /me/accounts.`);
        // Validações para o fallback
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
                    // Erro 400 geralmente indica token inválido/expirado
                    if (response.status === 400 || error.code === 190) { bail(new Error(error.message || 'Falha ao obter token de longa duração (SLT inválido/expirado?).')); return; }
                    if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(error.message || `Falha não recuperável (${response.status}) ao obter LLAT.`)); return; }
                    throw new Error(error.message || `Erro temporário ${response.status} ao obter LLAT.`);
                } return data;
            }, RETRY_OPTIONS);
            userLongLivedAccessToken = llatData.access_token;
            logger.info(`${TAG} (Fallback) LLAT obtido com sucesso para User ${userId}.`);

            // 2. Buscar Páginas via /me/accounts com paginação usando o LLAT
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
                        logger.debug(`${TAG} [Fallback Flow] Chamando fetch para URL: ${currentPageUrl?.replace(userLongLivedAccessToken!, '[USER_TOKEN_OCULTO]')}`);
                        const response = await fetch(currentPageUrl!); if (!response.headers.get('content-type')?.includes('application/json')) { bail(new Error(`Resposta não-JSON (Status: ${response.status})`)); return null; }
                        const data: InstagramApiResponse<PageAccountData> & FacebookApiError = await response.json();
                        if (!response.ok || data.error) {
                            type ErrorType = FacebookApiErrorStructure | { message: string; code: number; }; const error: ErrorType = data.error || { message: `Erro ${response.status} pág ${pageCount}`, code: response.status }; logger.error(`${TAG} (Fallback) Erro API (Tentativa ${attempt}) pág ${pageCount}:`, error);
                            if (error.code === 190) { bail(new Error('Token de longa duração (LLAT) inválido/expirado.')); return; } // Erro de token LLAT
                            if (error.code === 10) { bail(new Error('Permissão `pages_show_list` ausente para o usuário.')); return; }
                            if (error.code === 100 && 'error_subcode' in error && error.error_subcode === 33) { bail(new Error('Erro ao acessar página (requer conta IG conectada ou outra permissão?).')); return; } // Erro comum
                            if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha pág ${pageCount}: ${error.message}`)); return; } throw new Error(error.message || `Erro temp ${response.status} pág ${pageCount}.`);
                        } return data;
                    }, paginationRetryOptions);
                    if (pageData?.data) { allPagesData.push(...pageData.data); logger.debug(`${TAG} (Fallback) Pág ${pageCount}: ${pageData.data.length} itens. Total: ${allPagesData.length}`); }
                    else if (pageData === null) { logger.warn(`${TAG} (Fallback) Busca pág ${pageCount} falhou/interrompida (ver erro anterior).`); }
                    else { logger.warn(`${TAG} (Fallback) Pág ${pageCount} /me/accounts sem 'data'. Resp:`, pageData); }
                    currentPageUrl = pageData?.paging?.next ?? null; if (currentPageUrl) await new Promise(r => setTimeout(r, ACCOUNT_FETCH_DELAY_MS));
                } catch (error) { fetchError = error instanceof Error ? error : new Error(String(error)); logger.error(`${TAG} (Fallback) Erro irrecuperável durante paginação /me/accounts (pág ${pageCount}):`, fetchError); currentPageUrl = null; }
            } // End while
            if (pageCount >= MAX_ACCOUNT_FETCH_PAGES && currentPageUrl) logger.warn(`${TAG} (Fallback) Limite ${MAX_ACCOUNT_FETCH_PAGES} págs /me/accounts atingido.`);

            // Se houve erro irrecuperável na paginação, propaga o erro
            if (fetchError) {
                // Se o erro for de token, limpa a conexão antiga do usuário
                if (fetchError.message.toLowerCase().includes('token')) {
                    logger.warn(`${TAG} (Fallback) Erro de token detectado durante busca /me/accounts. Limpando conexão antiga para User ${userId}.`);
                    await clearInstagramConnection(userId);
                }
                throw fetchError; // Propaga o erro para o catch principal do fallback
            }
            logger.info(`${TAG} (Fallback) Busca paginada /me/accounts concluída. ${allPagesData.length} itens em ${pageCount} págs API.`);

            // 3. Filtrar e Mapear Contas IG
            const availableAccounts: AvailableInstagramAccount[] = [];
            for (const page of allPagesData) { if (page.instagram_business_account?.id) { availableAccounts.push({ igAccountId: page.instagram_business_account.id, pageId: page.id, pageName: page.name }); } }
            if (availableAccounts.length === 0) {
                const errorMsg = "Nenhuma conta IG Business/Creator encontrada vinculada às páginas FB que o usuário gerencia.";
                logger.warn(`${TAG} (Fallback) ${errorMsg} User: ${userId}. Págs processadas: ${allPagesData.length}`);
                return { success: false, error: errorMsg, errorCode: 404 }; // Não encontrado
            }
            logger.info(`${TAG} (Fallback) Encontradas ${availableAccounts.length} contas IG vinculadas para User ${userId}.`);
            logger.debug(`${TAG} (Fallback) Contas (Nomes): ${availableAccounts.map(a => a.pageName).join(', ')}`);

            // 4. Retornar Lista e LLAT do Usuário
            if (!userLongLivedAccessToken) {
                // Isso não deveria acontecer se chegou até aqui
                logger.error(`${TAG} (Fallback) LLAT do usuário nulo inesperadamente após busca de contas.`);
                throw new Error("LLAT (usuário) nulo inesperadamente.");
            }
            // Retorna sucesso com as contas e o LLAT obtido
            return { success: true, accounts: availableAccounts, longLivedAccessToken: userLongLivedAccessToken };

        } catch (error: unknown) { // Catch principal para o fluxo de fallback
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`${TAG} (Fallback) Erro CRÍTICO durante busca de contas para User ${userId}:`, error);
            // Se o erro foi de token (LLAT inválido ou SLT inválido) e temos um userId, limpa a conexão
            if (errorMsg.toLowerCase().includes('token') && mongoose.isValidObjectId(userId)) {
                logger.warn(`${TAG} (Fallback) Erro de token no fluxo geral. Limpando conexão antiga para User ${userId}.`);
                await clearInstagramConnection(userId);
            }
            // Retorna falha com a mensagem de erro
            return { success: false, error: errorMsg.includes('Token') || errorMsg.includes('Permissão') || errorMsg.includes('Falha') ? errorMsg : `Erro interno (Fallback): ${errorMsg}` };
        }
    } // Fim do else (Fallback)
}
// =========================================================================
// == FIM DA FUNÇÃO ATUALIZADA fetchAvailableInstagramAccounts           ===
// =========================================================================


/**
 * Finaliza a conexão com o Instagram salvando o token e ID selecionado no DB.
 * ESTA FUNÇÃO É USADA APENAS PELO FLUXO DE FALLBACK ANTIGO (se ainda existir).
 * A NOVA LÓGICA DEVE USAR `connectInstagramAccount`.
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
    const TAG = '[finalizeInstagramConnection - DEPRECATED?]'; // Marcar como potencialmente obsoleto
    logger.warn(`${TAG} Esta função pode estar obsoleta. A nova lógica usa connectInstagramAccount. Verificando chamada...`);
    logger.info(`${TAG} (Fallback Antigo?) Finalizando conexão User ${userId}, Conta IG ${selectedIgAccountId}`);

    if (!mongoose.isValidObjectId(userId)) return { success: false, error: `ID usuário inválido: ${userId}` };
    if (!selectedIgAccountId) return { success: false, error: `ID conta IG não fornecido.` };
    if (!longLivedAccessToken) return { success: false, error: `LLAT (usuário) não fornecido.` };

    try {
        await connectToDatabase();
        // Salva o LLAT do usuário e marca como conectado
        const updateData = {
            instagramAccessToken: longLivedAccessToken, // Salva o token do usuário
            instagramAccountId: selectedIgAccountId,
            isInstagramConnected: true,
            lastInstagramSyncAttempt: new Date(), // Marca a tentativa
            lastInstagramSyncSuccess: null, // Reseta o sucesso
        };
        const updateResult = await DbUser.findByIdAndUpdate(userId, { $set: updateData });

        if (!updateResult) return { success: false, error: `Usuário ${userId} não encontrado no DB.` };

        logger.info(`${TAG} (Fallback Antigo?) Usuário ${userId} atualizado. Conexão IG ${selectedIgAccountId} OK.`);

        // Dispara o refresh de dados
        triggerDataRefresh(userId).then(res => {
            logger.info(`${TAG} (Fallback Antigo?) triggerDataRefresh async ${userId}. Sucesso: ${res.success}. Msg: ${res.message}`);
            DbUser.findByIdAndUpdate(userId, { $set: { lastInstagramSyncSuccess: res.success } })
                   .catch(err => logger.error(`${TAG} (Fallback Antigo?) Erro update lastSyncSuccess ${userId}:`, err));
        }).catch(err => {
            logger.error(`${TAG} (Fallback Antigo?) Erro triggerDataRefresh async ${userId}:`, err);
            DbUser.findByIdAndUpdate(userId, { $set: { lastInstagramSyncSuccess: false } })
                   .catch(dbErr => logger.error(`${TAG} (Fallback Antigo?) Erro update lastSyncSuccess (fail) ${userId}:`, dbErr));
        });

        return { success: true, message: "Conta Instagram conectada (via fallback antigo)!" };

    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`${TAG} (Fallback Antigo?) Erro CRÍTICO ${userId}:`, error);
        return { success: false, error: `Erro interno (Fallback Antigo): ${errorMsg}` };
    }
}

// =========================================================================
// == NOVA FUNÇÃO connectInstagramAccount                                ===
// =========================================================================
/**
 * Atualiza o status de conexão do Instagram para um usuário no DB.
 * Usado após fetchAvailableInstagramAccounts ter sucesso (System User ou Fallback).
 * Marca o usuário como conectado, salva o ID da conta, mas NÃO salva o token de acesso.
 * Dispara a atualização de dados em segundo plano.
 * @param userId - ID do usuário (string ou ObjectId).
 * @param instagramAccountId - ID da conta Instagram a ser conectada.
 */
export async function connectInstagramAccount(
    userId: string | Types.ObjectId,
    instagramAccountId: string): Promise<{ success: boolean; error?: string }> {
    const TAG = '[connectInstagramAccount]';
    logger.info(`${TAG} Atualizando status de conexão para User ${userId}, Conta IG ${instagramAccountId}`);

    // Validação dos IDs
    if (!mongoose.isValidObjectId(userId)) {
        const errorMsg = `ID de usuário inválido: ${userId}`;
        logger.error(`${TAG} ${errorMsg}`);
        return { success: false, error: errorMsg };
    }
    if (!instagramAccountId) {
        const errorMsg = `ID da conta Instagram não fornecido.`;
        logger.error(`${TAG} ${errorMsg}`);
        return { success: false, error: errorMsg };
    }

    try {
        await connectToDatabase();
        // Define os campos a serem atualizados no banco de dados
        // Nota: instagramAccessToken é definido explicitamente como null,
        // pois o token relevante é o do System User (não salvo por usuário)
        // ou o token do usuário já foi usado no fallback e não precisa ser persistido aqui.
        const updateData = {
            instagramAccessToken: null, // <<< Define como null
            instagramAccountId: instagramAccountId, // Salva o ID da conta conectada
            isInstagramConnected: true, // Marca como conectado
            lastInstagramSyncAttempt: new Date(), // Marca a tentativa de sync imediatamente
            lastInstagramSyncSuccess: null, // Reseta o status de sucesso do sync anterior
        };

        logger.debug(`${TAG} Atualizando usuário ${userId} no DB com dados de conexão...`, updateData);
        // Encontra o usuário pelo ID e atualiza os campos definidos em $set
        const updateResult = await DbUser.findByIdAndUpdate(userId, { $set: updateData });

        // Verifica se o usuário foi encontrado e atualizado
        if (!updateResult) {
            const errorMsg = `Falha ao encontrar usuário ${userId} no DB para conectar conta IG.`;
            logger.error(`${TAG} ${errorMsg}`);
            return { success: false, error: errorMsg };
        }

        logger.info(`${TAG} Usuário ${userId} atualizado no DB. Conexão com IG ${instagramAccountId} marcada como ativa.`);

        // Dispara a atualização de dados (triggerDataRefresh) em segundo plano *APÓS*
        // a atualização bem-sucedida do status no banco de dados.
        // Usamos .then().catch() para não bloquear o retorno desta função.
        triggerDataRefresh(userId.toString()).then(refreshResult => { // Garante que userId seja string para triggerDataRefresh
            logger.info(`${TAG} triggerDataRefresh (async) concluído para ${userId}. Sucesso: ${refreshResult.success}. Msg: ${refreshResult.message}`);
            // Atualiza o status final da sincronização no DB (opcional, mas útil)
            DbUser.findByIdAndUpdate(userId, { $set: { lastInstagramSyncSuccess: refreshResult.success } })
                  .catch(err => logger.error(`${TAG} Erro ao atualizar lastInstagramSyncSuccess para ${userId} após refresh:`, err));
        }).catch(err => {
            // Captura erros lançados pelo próprio triggerDataRefresh
            logger.error(`${TAG} Erro durante a execução assíncrona de triggerDataRefresh para ${userId}:`, err);
            // Marca o sync como falho no DB
            DbUser.findByIdAndUpdate(userId, { $set: { lastInstagramSyncSuccess: false } })
                  .catch(dbErr => logger.error(`${TAG} Erro ao atualizar lastInstagramSyncSuccess (falha) para ${userId} após erro no refresh:`, dbErr));
        });

        // Retorna sucesso, indicando que a conexão foi marcada no DB
        // A atualização de dados está rodando em segundo plano.
        return { success: true };

    } catch (error: unknown) {
        // Captura erros durante a conexão com DB ou findByIdAndUpdate
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`${TAG} Erro CRÍTICO ao tentar conectar conta IG para User ${userId}:`, error);
        return { success: false, error: `Erro interno ao conectar conta: ${errorMsg}` };
    }
}
// =========================================================================
// == FIM DA NOVA FUNÇÃO connectInstagramAccount                         ===
// =========================================================================


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
    value: any // O tipo exato pode variar dependendo do webhook
): Promise<{ success: boolean; error?: string }> {
    const TAG = '[processStoryWebhookPayload]';
    logger.debug(`${TAG} Recebido webhook para Story Media ${mediaId}, Conta ${webhookAccountId}. Value:`, value);

    // Validações iniciais
    if (!webhookAccountId) {
        logger.warn(`${TAG} Webhook recebido sem ID da conta (entry.id). Ignorando.`);
        return { success: false, error: 'ID da conta do webhook ausente.' };
    }
    if (!value || typeof value !== 'object' || !mediaId) {
        logger.warn(`${TAG} Payload do webhook inválido ou media_id ausente. Media: ${mediaId}, Value:`, value);
        return { success: false, error: 'Payload do webhook inválido ou media_id ausente.' };
    }

    try {
        await connectToDatabase();
        // Encontra o usuário no DB que corresponde à conta do webhook
        const user = await DbUser.findOne({ instagramAccountId: webhookAccountId }).select('_id').lean();

        if (!user) {
            logger.warn(`${TAG} Usuário não encontrado no DB para instagramAccountId ${webhookAccountId} (Webhook). Ignorando webhook.`);
            // Retorna sucesso, pois não é um erro processar um webhook para uma conta não gerenciada
            return { success: true };
        }
        const userId = user._id;

        // Extrai as estatísticas do 'value' do webhook
        // As chaves exatas podem variar, ajuste conforme necessário
        const stats: Partial<IStoryStats> = {
            impressions: value.impressions,
            reach: value.reach,
            taps_forward: value.taps_forward,
            taps_back: value.taps_back,
            exits: value.exits,
            replies: value.replies,
            // Adicionar outras métricas de story se disponíveis no webhook
        };
         // Remove chaves com valor null ou undefined
         Object.keys(stats).forEach(key => (stats[key as keyof IStoryStats] == null) && delete stats[key as keyof IStoryStats]);

        // Se não houver estatísticas válidas, não faz nada
        if (Object.keys(stats).length === 0) {
            logger.warn(`${TAG} Nenhum insight de Story válido encontrado no payload do webhook para ${mediaId}.`);
            return { success: true }; // Sucesso, pois não há o que salvar
        }

        // Prepara a atualização ou inserção no modelo StoryMetricModel
        const filter = { user: userId, instagramMediaId: mediaId };
        const updateData = {
            $set: {
                stats: stats as IStoryStats, // Salva as estatísticas extraídas
                lastWebhookAt: new Date() // Marca quando o último webhook foi processado
            },
            $setOnInsert: { // Define apenas na criação
                user: userId,
                instagramMediaId: mediaId,
                createdAt: new Date()
            }
        };
        const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true };
        const savedStoryMetric = await StoryMetricModel.findOneAndUpdate(filter, updateData, options);

        if (!savedStoryMetric) {
            // Isso não deveria acontecer com upsert: true
            logger.error(`${TAG} Falha inesperada ao salvar/atualizar Story Metric ${mediaId} via webhook (findOneAndUpdate retornou null).`);
            return { success: false, error: 'Falha ao salvar dados do Story no DB.' };
        }

        logger.info(`${TAG} Insights de Story ${mediaId} (Webhook) processados e salvos com sucesso para User ${userId}.`);
        return { success: true };

    } catch (error) {
        logger.error(`${TAG} Erro ao processar webhook de Story ${mediaId}, Conta ${webhookAccountId}:`, error);
        return { success: false, error: 'Erro interno ao processar webhook de Story.' };
    }
}
