/**
 * @fileoverview Serviço de acesso a dados (Usuários, Métricas, Relatórios).
 * Versão otimizada com função para buscar o último relatório agregado.
 * Adicionada função lookupUserById.
 * @version 2.5
 */

import mongoose, { Model, Types } from 'mongoose'; // Importa mongoose completo
import { subDays, differenceInDays } from 'date-fns';
import { logger } from '@/app/lib/logger';

// Modelos do Mongoose (ajuste os imports conforme necessário)
import User, { IUser } from '@/app/models/User';
import { DailyMetric, IDailyMetric } from '@/app/models/DailyMetric';
import Metric, { IMetric } from '@/app/models/Metric';
// Assumindo que você tem um modelo para os relatórios agregados
// import ReportModel from '@/app/models/AggregatedReport'; // Exemplo, ajuste o nome

import {
    buildAggregatedReport,
    AggregatedReport, // Importa o tipo AggregatedReport
    DurationStat,
    OverallStats,
    DetailedContentStat,
    ProposalStat,
    ContextStat,
    PerformanceByDayPCO,
    ReportAggregationError,
    DetailedStatsError
} from '@/app/lib/reportHelpers';

import {
    BaseError,
    UserNotFoundError,
    MetricsNotFoundError,
    DatabaseError
} from '@/app/lib/errors';

/* ------------------------------------------------------------------ *
 * Constantes internas                                                *
 * ------------------------------------------------------------------ */
const METRICS_FETCH_DAYS_LIMIT = 180; // Limite de dias para buscar métricas
const NEW_USER_THRESHOLD_DAYS = 90; // Limite para considerar usuário como novo

/* ------------------------------------------------------------------ *
 * Tipos públicos exportados                                          *
 * ------------------------------------------------------------------ */

// Interface para o relatório enriquecido (pode ser movida para um arquivo de tipos compartilhado)
export interface IEnrichedReport {
    overallStats?: OverallStats;
    profileSegment: string;
    multimediaSuggestion: string;
    top3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink'>[];
    bottom3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink'>[];
    durationStats?: DurationStat[];
    detailedContentStats?: DetailedContentStat[];
    proposalStats?: ProposalStat[];
    contextStats?: ContextStat[];
    historicalComparisons?: IGrowthComparisons;
    longTermComparisons?: IGrowthComparisons;
    performanceByDayPCO?: PerformanceByDayPCO;
}

// Interface para os dados preparados retornados por fetchAndPrepareReportData
interface PreparedData {
    enrichedReport: IEnrichedReport;
}

// Tipos para busca de referência de post
export type ReferenceSearchResult =
    | { status: 'found'; post: { _id: Types.ObjectId; description: string; proposal?: string; context?: string } }
    | { status: 'clarify'; message: string }
    | { status: 'error'; message: string };

// Tipos para dados de crescimento
interface IGrowthComparisons {
    weeklyFollowerChange?: number;
    monthlyReachTrend?: 'up' | 'down' | 'stable';
}
interface IGrowthDataResult {
    historical?: IGrowthComparisons;
    longTerm?: IGrowthComparisons;
}

/* ------------------------------------------------------------------ *
 * Funções auxiliares (perfil, multimídia, growth, helpers)           *
 * ------------------------------------------------------------------ */

/**
 * Determina o segmento do perfil do usuário (Novo, Veterano, Geral).
 * @param {IUser} user Objeto do usuário.
 * @returns {string} O segmento do perfil.
 */
function getUserProfileSegment(user: IUser): string {
    // Verifica se createdAt é uma data válida
    if (user.createdAt instanceof Date && !isNaN(+user.createdAt)) {
        const ageInDays = differenceInDays(new Date(), user.createdAt);
        return ageInDays < NEW_USER_THRESHOLD_DAYS ? 'Novo Usuário' : 'Usuário Veterano';
    }
    logger.warn(`[getUserProfileSegment] Data de criação inválida para usuário ${user._id}`);
    return 'Geral'; // Fallback
}

/**
 * Gera uma sugestão rápida de formato de vídeo com base nas estatísticas de duração.
 * @param {AggregatedReport | null | undefined} report O relatório agregado.
 * @returns {string} Uma string com a sugestão ou vazia se não houver dados.
 */
function getMultimediaSuggestion(report?: AggregatedReport | null): string {
    // Pega a faixa de duração com melhor desempenho (primeiro item do array ordenado)
    const bestDurationStat = report?.durationStats?.[0];
    if (!bestDurationStat) {
        return ''; // Retorna vazio se não houver dados de duração
    }
    // Sugestão específica se vídeos longos performam bem
    if (bestDurationStat.range.includes('60s')) {
        return 'Vídeos acima de 60 segundos têm mostrado boa retenção média para você. Vale a pena experimentar formatos um pouco mais longos!';
    }
    // Sugestão genérica para a melhor faixa
    return `Vídeos na faixa de ${bestDurationStat.range} tiveram um ótimo desempenho recente. Teste produzir mais conteúdos nessa duração!`;
}

/**
 * Placeholder para buscar dados de crescimento (histórico e longo prazo).
 * Substitua pela lógica real de busca/cálculo dessas métricas.
 * @param {Types.ObjectId} userId ID do usuário.
 * @returns {Promise<IGrowthDataResult>} Objeto com dados de crescimento (atualmente vazio).
 */
async function getCombinedGrowthData(
    userId: Types.ObjectId
): Promise<IGrowthDataResult> {
    logger.debug(`[getCombinedGrowthData] Placeholder para usuário ${userId}`);
    // TODO: Implementar a lógica real para buscar/calcular métricas de crescimento
    // Ex: buscar histórico de seguidores, comparar alcance mensal, etc.
    return { historical: {}, longTerm: {} }; // Retorna objeto vazio por enquanto
}

/**
 * Busca detalhes (descrição, link) de posts específicos a partir de um array de métricas diárias.
 * @param {IDailyMetric[] | undefined} metrics Array de métricas diárias contendo postId.
 * @param {Model<IMetric>} model O modelo Mongoose para buscar os detalhes do post (Metric).
 * @returns {Promise<Pick<IMetric, '_id' | 'description' | 'postLink'>[] | undefined>} Array com detalhes dos posts ou undefined.
 */
async function fetchContentDetailsForMetrics(
    metrics: IDailyMetric[] | undefined,
    model: Model<IMetric>
): Promise<Pick<IMetric, '_id' | 'description' | 'postLink'>[] | undefined> {
    // Retorna undefined se não houver métricas
    if (!metrics?.length) return undefined;

    // Extrai e valida os ObjectIds dos posts
    const ids = metrics
        .map(m => m.postId)
        .filter((id): id is Types.ObjectId => !!id && Types.ObjectId.isValid(id));

    // Retorna array vazio se não houver IDs válidos
    if (!ids.length) return [];

    try {
        // Busca os posts no banco de dados selecionando apenas os campos necessários
        const posts = await model
            .find({ _id: { $in: ids } })
            .select('_id description postLink') // Seleciona apenas os campos necessários
            .lean(); // Usa .lean() para performance (retorna objetos JS puros)

        // Cria um mapa para acesso rápido aos posts pelos seus IDs
        const postMap = new Map(posts.map(p => [p._id.toString(), p]));

        // Mapeia as métricas originais para os detalhes dos posts encontrados
        return metrics
            .map(m => m.postId ? postMap.get(m.postId.toString()) : undefined)
            .filter(Boolean) as Pick<IMetric, '_id' | 'description' | 'postLink'>[]; // Filtra nulos/undefined

    } catch (error) {
        logger.error('[fetchContentDetailsForMetrics] Erro ao buscar detalhes dos posts:', error);
        throw new DatabaseError('Falha ao buscar detalhes de conteúdo no banco de dados.'); // Lança erro específico
    }
}

/* ------------------------------------------------------------------ *
 * Funções públicas Exportadas                                        *
 * ------------------------------------------------------------------ */

/**
 * Busca um usuário no banco de dados pelo número de telefone do WhatsApp.
 * @param {string} fromPhone Número de telefone.
 * @returns {Promise<IUser>} O objeto do usuário encontrado.
 * @throws {UserNotFoundError} Se o usuário não for encontrado.
 * @throws {DatabaseError} Se ocorrer um erro no banco de dados.
 */
export async function lookupUser(fromPhone: string): Promise<IUser> {
    const maskedPhone = fromPhone.slice(0, -4) + '****'; // Mascara o telefone para logs
    logger.debug(`[lookupUser] Buscando usuário para telefone ${maskedPhone}`);

    try {
        const user = await User.findOne({ whatsappPhone: fromPhone }).lean();
        if (!user) {
            logger.warn(`[lookupUser] Usuário não encontrado para telefone ${maskedPhone}`);
            throw new UserNotFoundError(`Usuário não encontrado (${maskedPhone})`);
        }
        logger.info(`[lookupUser] Usuário ${user._id} encontrado para telefone ${maskedPhone}`);
        return user as IUser; // Faz cast para IUser (assumindo que lean() retorna o tipo correto)
    } catch (error: any) {
        // Se já for um UserNotFoundError, relança
        if (error instanceof UserNotFoundError) {
            throw error;
        }
        // Outros erros são tratados como erros de banco de dados
        logger.error(`[lookupUser] Erro de banco de dados ao buscar usuário ${maskedPhone}:`, error);
        throw new DatabaseError(`Erro ao buscar usuário: ${error.message}`);
    }
}

/**
 * *** NOVO: Busca um usuário no banco de dados pelo seu ID. ***
 * @param {string} userId O ID do usuário (como string).
 * @returns {Promise<IUser>} O objeto do usuário encontrado.
 * @throws {UserNotFoundError} Se o usuário não for encontrado.
 * @throws {DatabaseError} Se ocorrer um erro no banco de dados ou ID inválido.
 */
export async function lookupUserById(userId: string): Promise<IUser> {
    logger.debug(`[lookupUserById] Buscando usuário por ID ${userId}`);

    // Valida se o ID é um ObjectId válido antes de buscar
    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`[lookupUserById] ID de usuário inválido fornecido: ${userId}`);
        throw new DatabaseError(`ID de usuário inválido: ${userId}`);
    }

    try {
        const user = await User.findById(userId).lean(); // Busca pelo ID
        if (!user) {
            logger.warn(`[lookupUserById] Usuário não encontrado para ID ${userId}`);
            throw new UserNotFoundError(`Usuário não encontrado para ID: ${userId}`);
        }
        logger.info(`[lookupUserById] Usuário ${userId} encontrado.`);
        return user as IUser; // Faz cast
    } catch (error: any) {
        // Se já for um UserNotFoundError, relança
        if (error instanceof UserNotFoundError) {
            throw error;
        }
        // Outros erros são tratados como erros de banco de dados
        logger.error(`[lookupUserById] Erro de banco de dados ao buscar usuário ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar usuário por ID: ${error.message}`);
    }
}


/**
 * Busca as métricas diárias recentes, gera o relatório agregado e enriquece com detalhes.
 * @param {object} params Parâmetros da função.
 * @param {IUser} params.user Objeto do usuário.
 * @param {Model<IDailyMetric>} params.dailyMetricModel Modelo Mongoose para métricas diárias.
 * @param {Model<IMetric>} params.contentMetricModel Modelo Mongoose para métricas de conteúdo.
 * @returns {Promise<PreparedData>} Objeto contendo o relatório enriquecido.
 * @throws {MetricsNotFoundError} Se não houver métricas recentes.
 * @throws {DatabaseError} Se ocorrer erro ao buscar métricas.
 * @throws {ReportAggregationError | DetailedStatsError} Se ocorrer erro na geração do relatório.
 */
export async function fetchAndPrepareReportData(
    {
        user,
        dailyMetricModel,
        contentMetricModel
    }: {
        user: IUser;
        dailyMetricModel: Model<IDailyMetric>;
        contentMetricModel: Model<IMetric>;
    }
): Promise<PreparedData> {
    const userId = user._id;
    logger.debug(`[fetchAndPrepareReportData] Iniciando para usuário ${userId}`);

    // Define a data limite para buscar métricas
    const sinceDate = subDays(new Date(), METRICS_FETCH_DAYS_LIMIT);

    /* --- 1. Busca Métricas Diárias e Dados de Crescimento (em paralelo) --- */
    let dailyMetrics: IDailyMetric[];
    let growthData: IGrowthDataResult;

    try {
        logger.debug(`[fetchAndPrepareReportData] Buscando métricas diárias desde ${sinceDate.toISOString()} para ${userId}`);
        [dailyMetrics, growthData] = await Promise.all([
            dailyMetricModel
                .find({ user: userId, postDate: { $gte: sinceDate } })
                .select('postDate stats postId') // Seleciona campos essenciais
                .lean(),
            getCombinedGrowthData(userId) // Busca dados de crescimento (placeholder)
        ]);
        logger.info(`[fetchAndPrepareReportData] ${dailyMetrics.length} registros de métricas diárias encontrados para ${userId}.`);

        // Verifica se há métricas suficientes
        if (!dailyMetrics.length) {
            logger.warn(`[fetchAndPrepareReportData] Nenhuma métrica encontrada nos últimos ${METRICS_FETCH_DAYS_LIMIT} dias para ${userId}.`);
            throw new MetricsNotFoundError(
                `Você ainda não tem métricas suficientes (precisamos dos últimos ${METRICS_FETCH_DAYS_LIMIT} dias). Continue postando e logo poderemos analisar!`
            );
        }
    } catch (error: any) {
        // Relança erros específicos conhecidos
        if (error instanceof MetricsNotFoundError) throw error;
        logger.error(`[fetchAndPrepareReportData] Erro ao buscar métricas ou dados de crescimento para ${userId}:`, error);
        throw new DatabaseError(`Falha ao buscar dados iniciais: ${error.message}`);
    }

    /* --- 2. Gera o Relatório Agregado --- */
    let aggregatedReport: AggregatedReport;
    try {
        logger.debug(`[fetchAndPrepareReportData] Gerando relatório agregado para ${userId}`);
        aggregatedReport = await buildAggregatedReport(
            dailyMetrics,
            userId,
            sinceDate,
            dailyMetricModel,
            contentMetricModel
        );
        logger.debug(`[fetchAndPrepareReportData] Relatório agregado gerado com sucesso para ${userId}.`);
    } catch (error: any) {
        logger.error(`[fetchAndPrepareReportData] Erro ao gerar relatório agregado para ${userId}:`, error);
        // Lança o erro específico da agregação ou um erro genérico
        if (error instanceof ReportAggregationError || error instanceof DetailedStatsError) {
            throw error;
        }
        throw new ReportAggregationError(`Falha ao processar suas métricas para gerar o relatório: ${error.message}`);
    }

    /* --- 3. Busca Detalhes dos Top/Bottom Posts (em paralelo) --- */
    let top3PostsDetails: Pick<IMetric, '_id' | 'description' | 'postLink'>[] | undefined;
    let bottom3PostsDetails: Pick<IMetric, '_id' | 'description' | 'postLink'>[] | undefined;
    try {
        logger.debug(`[fetchAndPrepareReportData] Buscando detalhes dos top/bottom posts para ${userId}`);
        [top3PostsDetails, bottom3PostsDetails] = await Promise.all([
            fetchContentDetailsForMetrics(aggregatedReport.top3, contentMetricModel),
            fetchContentDetailsForMetrics(aggregatedReport.bottom3, contentMetricModel)
        ]);
        logger.debug(`[fetchAndPrepareReportData] Detalhes dos top/bottom posts buscados para ${userId}.`);
    } catch (error: any) {
        // Loga o erro mas continua, o relatório ainda é útil sem esses detalhes
        logger.error(`[fetchAndPrepareReportData] Erro (não fatal) ao buscar detalhes top/bottom posts para ${userId}:`, error);
    }

    /* --- 4. Monta o Objeto Final Enriquecido --- */
    logger.debug(`[fetchAndPrepareReportData] Montando relatório enriquecido final para ${userId}`);
    const enrichedReport: IEnrichedReport = {
        overallStats: aggregatedReport.overallStats,
        profileSegment: getUserProfileSegment(user),
        multimediaSuggestion: getMultimediaSuggestion(aggregatedReport),
        top3Posts: top3PostsDetails,
        bottom3Posts: bottom3PostsDetails,
        durationStats: aggregatedReport.durationStats,
        detailedContentStats: aggregatedReport.detailedContentStats,
        proposalStats: aggregatedReport.proposalStats,
        contextStats: aggregatedReport.contextStats,
        historicalComparisons: growthData.historical,
        longTermComparisons: growthData.longTerm,
        performanceByDayPCO: aggregatedReport.performanceByDayPCO
    };

    return { enrichedReport };
}

/**
 * Busca posts por referência textual (descrição) e lida com ambiguidades.
 * @param {string} text Texto da referência (pode conter aspas ou "sobre ...").
 * @param {Types.ObjectId} userId ID do usuário.
 * @returns {Promise<ReferenceSearchResult>} Resultado da busca ('found', 'clarify', 'error').
 */
export async function extractReferenceAndFindPost(
    text: string,
    userId: Types.ObjectId
): Promise<ReferenceSearchResult> {
    logger.debug(`[extractReferenceAndFindPost] Buscando referência "${text}" para usuário ${userId}`);

    /* 1. Extrai a parte relevante da referência */
    // Tenta pegar texto entre aspas duplas ou simples
    const quotedText = text.match(/["“”'](.+?)["“”']/)?.[1];
    // Tenta pegar texto após "sobre " ou "referente a "
    const aboutText = text.match(/(?:sobre|referente a)\s+(.+)/i)?.[1]?.trim();
    // Usa o texto entre aspas se existir, senão o texto após "sobre", senão o texto inteiro
    const reference = quotedText || aboutText || text.trim();

    if (!reference) {
        logger.warn(`[extractReferenceAndFindPost] Referência vazia ou inválida: "${text}"`);
        return {
            status: 'clarify',
            message: 'Hum, não consegui entender a referência do post. 🤔 Poderia me dizer uma parte única da descrição ou o link dele?'
        };
    }
    logger.debug(`[extractReferenceAndFindPost] Referência extraída: "${reference}"`);

    /* 2. Busca posts no banco de dados usando regex (case-insensitive) */
    try {
        // Escapa caracteres especiais para usar na regex
        const escapedReference = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedReference, 'i'); // 'i' para case-insensitive

        const posts = await Metric.find({ user: userId, description: regex })
            .select('_id description proposal context') // Campos necessários
            .limit(5) // Limita para não retornar muitos resultados
            .lean();

        /* 3. Analisa os resultados da busca */
        if (!posts.length) {
            logger.info(`[extractReferenceAndFindPost] Nenhum post encontrado para referência "${reference}" e usuário ${userId}`);
            return {
                status: 'clarify',
                message: `Não achei nenhum post com a descrição parecida com "${reference}". Pode tentar descrever de outra forma ou me mandar o link?`
            };
        }

        if (posts.length === 1) {
            const post = posts[0]!; // Non-null assertion pois sabemos que tem 1 item
            logger.info(`[extractReferenceAndFindPost] Post único encontrado para referência "${reference}" (ID: ${post._id})`);
            return {
                status: 'found',
                post: {
                    _id: post._id,
                    description: post.description || '', // Garante que description é string
                    proposal: post.proposal,
                    context: post.context
                }
            };
        }

        // Múltiplos posts encontrados -> Pede clarificação
        logger.info(`[extractReferenceAndFindPost] ${posts.length} posts encontrados para referência "${reference}", pedindo clarificação.`);
        const postList = posts
            .map((p, i) => `${i + 1}. "${(p.description || 'Sem descrição').slice(0, 60)}…"`) // Limita tamanho da descrição
            .join('\n');

        return {
            status: 'clarify',
            message: `Encontrei ${posts.length} posts com descrição parecida:\n${postList}\n\nQual deles você quer analisar? (Digite o número)`
        };

    } catch (error: any) {
        logger.error(`[extractReferenceAndFindPost] Erro ao buscar post por referência "${reference}" para usuário ${userId}:`, error);
        return {
            status: 'error',
            message: `Ocorreu um erro ao buscar o post. Tente novamente mais tarde. (Detalhe: ${error.message})`
        };
    }
}


/**
 * Busca o relatório agregado mais recente para um usuário.
 * @param {string} userId ID do usuário.
 * @returns {Promise<AggregatedReport | null>} O relatório mais recente ou null se não encontrado.
 * @throws {DatabaseError} Se ocorrer um erro no banco de dados.
 */
export async function getLatestAggregatedReport(userId: string): Promise<AggregatedReport | null> {
    const TAG = '[getLatestAggregatedReport]';
    logger.debug(`${TAG} Buscando último relatório agregado para usuário ${userId}`);

     if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido fornecido: ${userId}`);
        throw new DatabaseError(`ID de usuário inválido: ${userId}`);
    }

    try {
        // --- IMPORTANTE: Substitua esta linha pela sua lógica real de busca ---
        // Exemplo: Usando um modelo Mongoose chamado 'AggregatedReportModel'
        /*
        const reportDocument = await AggregatedReportModel.findOne({ userId: new Types.ObjectId(userId) })
            .sort({ reportEndDate: -1 }) // Ordena pela data de fim do relatório, decrescente
            .lean();
        */
        // --- Fim do Exemplo ---

        // Placeholder - Simula não encontrar relatório
        const reportDocument: AggregatedReport | null = null; // REMOVA ESTA LINHA e descomente/adapte o exemplo acima

        if (reportDocument) {
            logger.info(`${TAG} Último relatório encontrado para ${userId}.`);
            // Certifique-se de que o objeto retornado corresponde à interface AggregatedReport
            // Se usar .lean(), o objeto já deve ser JS puro. Se não, use .toObject()
            return reportDocument; // Ou reportDocument.toObject();
        } else {
            logger.info(`${TAG} Nenhum relatório agregado encontrado para ${userId}.`);
            return null;
        }
    } catch (error: any) {
        logger.error(`${TAG} Erro de banco de dados ao buscar último relatório para ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar último relatório: ${error.message}`);
    }
}
