/**
 * @fileoverview Serviço para operações relacionadas a relatórios e métricas no dataService.
 * @version 2.14.14 (Garante seleção de dayNumber em getDailySnapshotsForMetric)
 */
import mongoose, { Model, Types } from 'mongoose';
import { subDays, differenceInDays } from 'date-fns';

// Logger e Erros
import { logger } from '@/app/lib/logger';
import { MetricsNotFoundError, DatabaseError, ReportAggregationError, DetailedStatsError, UserNotFoundError, OperationNotPermittedError } from '@/app/lib/errors';

// Modelos Mongoose
import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric'; 
// IDailyMetricSnapshot agora inclui dayNumber opcional
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot';


// Helpers de Relatório
import {
    buildAggregatedReport,
    AggregatedReport,
} from '@/app/lib/reportHelpers';

// Módulos internos do dataService
import { connectToDatabase } from './connection';
import { DEFAULT_METRICS_FETCH_DAYS } from './constants';
import { IUser, IEnrichedReport, PreparedData, ReferenceSearchResult, IGrowthDataResult, PostObject } from './types'; 
import { getUserProfileSegment, getMultimediaSuggestion, getCombinedGrowthData } from './helpers';

/**
 * Busca e prepara os dados para um relatório enriquecido de um utilizador.
 * @param params - Parâmetros contendo o utilizador e uma data opcional de início da análise.
 * @param params.user - O objeto do utilizador.
 * @param params.analysisSinceDate - Data opcional para iniciar a análise das métricas.
 * @returns Uma promessa que resolve para os dados do relatório preparado.
 */
export async function fetchAndPrepareReportData(
    { user, analysisSinceDate }: { user: IUser; analysisSinceDate?: Date; }
): Promise<PreparedData> {
    const userId = user._id instanceof Types.ObjectId ? user._id : new Types.ObjectId(user._id);
    const TAG = '[dataService][reportService][fetchAndPrepareReportData v2.14.9]'; 
    const sinceDate = analysisSinceDate || subDays(new Date(), DEFAULT_METRICS_FETCH_DAYS);

    logger.info(`${TAG} Iniciando para utilizador ${userId}. Período de busca: desde ${sinceDate.toISOString()}`);

    let growthData: IGrowthDataResult;
    try {
        await connectToDatabase();
        growthData = await getCombinedGrowthData(userId);
        logger.debug(`${TAG} Dados de crescimento (placeholder) obtidos para ${userId}.`);
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar dados de crescimento para ${userId}:`, error);
        growthData = { historical: {}, longTerm: {} };
    }

    let aggregatedReport: AggregatedReport;
    try {
        await connectToDatabase();
        logger.debug(`${TAG} Gerando relatório agregado (usando buildAggregatedReport e MetricModel interno) para ${userId} desde ${sinceDate.toISOString()}...`);
        aggregatedReport = await buildAggregatedReport(userId, sinceDate, MetricModel);
        logger.info(`${TAG} Relatório agregado gerado com sucesso para ${userId}. Posts no relatório: ${aggregatedReport?.overallStats?.totalPosts ?? 'N/A'}`);

        if (!aggregatedReport || !aggregatedReport.overallStats || aggregatedReport.overallStats.totalPosts === 0) {
             const daysAnalyzed = differenceInDays(new Date(), sinceDate);
             logger.warn(`${TAG} Nenhum dado encontrado nos últimos ${daysAnalyzed} dias para gerar relatório para ${userId}. overallStats: ${JSON.stringify(aggregatedReport?.overallStats)}`);
             throw new MetricsNotFoundError(
                 `Ainda não tem métricas suficientes nos últimos ${daysAnalyzed} dias para gerar este relatório.`
             );
        }
    } catch (error: any) {
        logger.error(`${TAG} Erro ao gerar relatório agregado para ${userId} desde ${sinceDate.toISOString()}:`, error);
        if (error instanceof MetricsNotFoundError || error instanceof ReportAggregationError || error instanceof DetailedStatsError) {
            throw error;
        }
        throw new ReportAggregationError(`Falha ao processar as suas métricas para gerar o relatório: ${error instanceof Error ? error.message : String(error)}`);
    }

    logger.debug(`${TAG} Montando relatório enriquecido final para ${userId}`);
    const enrichedReport: IEnrichedReport = {
        overallStats: aggregatedReport.overallStats,
        profileSegment: getUserProfileSegment(user),
        multimediaSuggestion: getMultimediaSuggestion(aggregatedReport),
        top3Posts: aggregatedReport.top3Posts,
        bottom3Posts: aggregatedReport.bottom3Posts,
        durationStats: aggregatedReport.durationStats,
        detailedContentStats: aggregatedReport.detailedContentStats,
        proposalStats: aggregatedReport.proposalStats, 
        contextStats: aggregatedReport.contextStats,   
        historicalComparisons: growthData.historical,
        longTermComparisons: growthData.longTerm,
        performanceByDayPCO: aggregatedReport.performanceByDayPCO,
    };

    return { enrichedReport };
}

/**
 * Extrai uma referência de post de um texto e tenta encontrar o post correspondente.
 * @param text - O texto contendo a referência ao post.
 * @param userId - O ID do utilizador proprietário do post.
 * @returns Uma promessa que resolve para um objeto ReferenceSearchResult.
 */
export async function extractReferenceAndFindPost( text: string, userId: Types.ObjectId ): Promise<ReferenceSearchResult> {
    const fnTag = '[dataService][reportService][extractReferenceAndFindPost]';
    logger.debug(`${fnTag} Buscando referência de post em "${text}" para utilizador ${userId}`);

    const quotedText = text.match(/["“”'](.+?)["“”']/)?.[1];
    const aboutText = text.match(/(?:sobre|referente a)\s+(.+)/i)?.[1]?.trim();
    const reference = quotedText || aboutText || text.trim();

    if (!reference) {
        logger.warn(`${fnTag} Referência vazia ou inválida extraída de: "${text}"`);
        return { status: 'clarify', message: 'Hum, não consegui entender a referência do post. 🤔 Poderia me dizer uma parte única da descrição ou o link dele?' };
    }
    logger.debug(`${fnTag} Referência extraída: "${reference}" para utilizador ${userId}`);

    try {
        await connectToDatabase();
        const escapedReference = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedReference, 'i');

        const posts = await MetricModel.find({
            user: userId,
            description: regex
        })
        .select('_id description proposal context format') 
        .limit(5)
        .lean();

        if (!posts || posts.length === 0) {
            logger.info(`${fnTag} Nenhum post encontrado para referência "${reference}" e utilizador ${userId}`);
            return { status: 'clarify', message: `Não achei nenhum post com a descrição parecida com "${reference}". Pode tentar descrever de outra forma ou me mandar o link?` };
        }

        if (posts.length === 1) {
            const post = posts[0]!;
            logger.info(`${fnTag} Post único encontrado para referência "${reference}" (ID: ${post._id}) para utilizador ${userId}`);
            return { status: 'found', post: { 
                _id: post._id.toString(), 
                description: post.description || '', 
                proposal: post.proposal, 
                context: post.context,
                format: post.format 
            } };
        }

        logger.info(`${fnTag} ${posts.length} posts encontrados para referência "${reference}" para utilizador ${userId}, pedindo clarificação.`);
        const postList = posts.map((p, i) => `${i + 1}. "${(p.description || 'Sem descrição').slice(0, 60)}…"`) .join('\n');
        return { status: 'clarify', message: `Encontrei ${posts.length} posts com descrição parecida:\n${postList}\n\nQual deles quer analisar? (Digite o número)` };

    } catch (error: any) {
        logger.error(`${fnTag} Erro ao buscar post por referência "${reference}" para utilizador ${userId}:`, error);
        return { status: 'error', message: `Ocorreu um erro ao buscar o post. Tente novamente mais tarde. (Detalhe: ${error instanceof Error ? error.message : String(error)})` };
    }
}

/**
 * Busca o último relatório agregado para um utilizador (placeholder, conforme original).
 * @param userId - O ID do utilizador.
 * @returns Uma promessa que resolve para o relatório agregado ou null se não encontrado.
 */
export async function getLatestAggregatedReport(userId: string): Promise<AggregatedReport | null> {
    const TAG = '[dataService][reportService][getLatestAggregatedReport]';
    logger.debug(`${TAG} Buscando último relatório agregado para utilizador ${userId}`);

     if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido fornecido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }
    try {
        await connectToDatabase();
        const reportDocument: AggregatedReport | null = null; 

        if (reportDocument) {
            logger.info(`${TAG} Último relatório agregado (previamente salvo) encontrado para ${userId}.`);
            return reportDocument;
        } else {
            logger.info(`${TAG} Nenhum relatório agregado (previamente salvo) encontrado para ${userId}. Esta função é um placeholder no momento.`);
            return null;
        }
    } catch (error: any) {
        logger.error(`${TAG} Erro de banco de dados ao buscar último relatório para ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar último relatório: ${error.message}`);
    }
}

/**
 * Busca objetos de posts recentes para um utilizador (Radar Tuca).
 * @param userId - O ID do utilizador.
 * @param daysToLookback - Número de dias para retroceder na busca.
 * @param filters - Filtros opcionais para tipo de post e IDs a excluir.
 * @returns Uma promessa que resolve para um array de PostObject.
 */
export async function getRecentPostObjects(
    userId: string,
    daysToLookback: number,
    filters?: { types?: Array<'IMAGE' | 'CAROUSEL' | 'REEL' | 'VIDEO' | 'STORY'>, excludeIds?: string[] }
): Promise<PostObject[]> {
    const TAG = '[dataService][reportService][getRecentPostObjects v2.14.13]'; 
    logger.debug(`${TAG} Buscando posts recentes para User ${userId}. Dias: ${daysToLookback}, Filtros: ${JSON.stringify(filters)}`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }

    try {
        await connectToDatabase();
        const sinceDate = subDays(new Date(), daysToLookback);
        const query: any = { user: new Types.ObjectId(userId), postDate: { $gte: sinceDate } };

        if (filters?.types && filters.types.length > 0) {
            query.type = { $in: filters.types };
        }
        if (filters?.excludeIds && filters.excludeIds.length > 0) {
            const validExcludeObjectIds = filters.excludeIds
                .filter(id => mongoose.isValidObjectId(id))
                .map(id => new Types.ObjectId(id));
            if (validExcludeObjectIds.length > 0) {
                query._id = { $nin: validExcludeObjectIds };
            }
        }

        const postsFromMetrics: IMetric[] = await MetricModel.find(query)
            .select('_id user instagramMediaId type description postDate stats format proposal context') 
            .sort({ postDate: -1 })
            .limit(100) 
            .lean();

        logger.info(`${TAG} Encontrados ${postsFromMetrics.length} posts recentes para User ${userId}.`);

        return postsFromMetrics.map((metric): PostObject => ({ 
            _id: metric._id.toString(),
            userId: metric.user.toString(),
            platformPostId: metric.instagramMediaId, 
            type: metric.type as PostObject['type'], 
            description: metric.description,
            createdAt: metric.postDate,
            stats: metric.stats, 
            format: metric.format,
            proposal: metric.proposal,
            context: metric.context,
        }));
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar posts recentes para User ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar posts recentes: ${error.message}`);
    }
}

/**
 * Busca objetos de posts recentes com métricas agregadas (Radar Tuca).
 * @param userId - O ID do utilizador.
 * @param days - Número de dias para retroceder na busca.
 * @returns Uma promessa que resolve para um array de PostObject com métricas.
 */
export async function getRecentPostObjectsWithAggregatedMetrics(
    userId: string,
    days: number
): Promise<PostObject[]> {
    const TAG = '[dataService][reportService][getRecentPostObjectsWithAggregatedMetrics v2.14.13]'; 
    logger.info(`${TAG} Buscando posts com métricas agregadas (incl. comentários, F/P/C) para User ${userId} nos últimos ${days} dias.`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }

    try {
        await connectToDatabase();
        const sinceDate = subDays(new Date(), days);

        const recentMetrics: IMetric[] = await MetricModel.find({
            user: new Types.ObjectId(userId),
            postDate: { $gte: sinceDate }
        })
        .select('_id user instagramMediaId type description postDate stats format proposal context')
        .sort({ postDate: -1 })
        .limit(150) 
        .lean();

        if (!recentMetrics || recentMetrics.length === 0) {
            logger.info(`${TAG} Nenhum post encontrado para User ${userId} nos últimos ${days} dias.`);
            return [];
        }

        const results: PostObject[] = recentMetrics.map((metric): PostObject => { 
            const totalImpressions = metric.stats?.impressions || 0;
            const totalEngagement = metric.stats?.engagement || 0;
            const videoViews = metric.stats?.video_views || 0;
            const totalComments = metric.stats?.comments || 0;

            return {
                _id: metric._id.toString(),
                userId: metric.user.toString(),
                platformPostId: metric.instagramMediaId, 
                type: metric.type as PostObject['type'], 
                description: metric.description,
                createdAt: metric.postDate,
                totalImpressions: totalImpressions,
                totalEngagement: totalEngagement,
                videoViews: videoViews,
                totalComments: totalComments,
                stats: metric.stats, 
                format: metric.format,
                proposal: metric.proposal,
                context: metric.context,
            };
        });

        logger.info(`${TAG} Retornando ${results.length} posts com métricas agregadas (incl. comentários, F/P/C) para User ${userId}.`);
        return results;
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar posts com métricas agregadas para User ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar posts com métricas agregadas: ${error.message}`);
    }
}

/**
 * Busca o histórico de snapshots diários de métricas para um post (métrica) específico,
 * após verificar a propriedade do post.
 * @param metricId O ID da métrica (post) para o qual buscar os snapshots.
 * @param userIdForAuth O ID do usuário para verificar a propriedade da métrica.
 * @returns Uma promessa que resolve para um array de IDailyMetricSnapshot.
 */
export async function getDailySnapshotsForMetric(
    metricId: string,
    userIdForAuth: string
): Promise<IDailyMetricSnapshot[]> {
    const TAG = '[dataService][reportService][getDailySnapshotsForMetric v2.14.14]'; // Versão atualizada
    logger.info(`${TAG} Buscando snapshots diários para Metric ID: ${metricId}, User Auth ID: ${userIdForAuth}`);

    if (!mongoose.isValidObjectId(metricId)) {
        logger.warn(`${TAG} ID da métrica inválido (formato): ${metricId}`);
        throw new DatabaseError("O ID da métrica fornecido não parece ser válido.");
    }
    if (!mongoose.isValidObjectId(userIdForAuth)) {
        logger.warn(`${TAG} ID de usuário para autenticação inválido (formato): ${userIdForAuth}`);
        throw new DatabaseError("ID de usuário para autenticação inválido.");
    }

    const objectMetricId = new Types.ObjectId(metricId);
    const userObjectId = new Types.ObjectId(userIdForAuth);

    try {
        await connectToDatabase();

        const metricOwnerCheck = await MetricModel.findOne({ _id: objectMetricId, user: userObjectId }).select('_id').lean();
        if (!metricOwnerCheck) {
            const metricExists = await MetricModel.findById(objectMetricId).select('_id').lean();
            if (!metricExists) {
                logger.warn(`${TAG} Métrica com ID ${metricId} não encontrada.`);
                throw new MetricsNotFoundError("Não encontrei nenhuma métrica com este ID.");
            } else {
                logger.warn(`${TAG} Métrica ${metricId} encontrada, mas não pertence ao User ${userIdForAuth}. Acesso negado.`);
                // Alterado para UserNotFoundError para ser mais específico sobre o tipo de erro de acesso
                throw new UserNotFoundError("Você não tem permissão para acessar o histórico desta métrica.");
            }
        }

        const snapshots = await DailyMetricSnapshotModel.find({ metric: objectMetricId })
            .sort({ date: 1 })
            // ATUALIZADO: Garante que dayNumber seja selecionado, pois agora faz parte do modelo.
            .select('date dayNumber dailyViews dailyLikes dailyComments dailyShares dailySaved dailyReach dailyFollows dailyProfileVisits cumulativeViews cumulativeLikes cumulativeComments cumulativeShares cumulativeSaved cumulativeReach cumulativeFollows cumulativeProfileVisits cumulativeTotalInteractions dailyReelsVideoViewTotalTime cumulativeReelsVideoViewTotalTime currentReelsAvgWatchTime')
            .lean();

        logger.info(`${TAG} Encontrados ${snapshots.length} snapshots diários para Metric ${metricId}.`);
        // O cast para IDailyMetricSnapshot[] é seguro, pois o modelo agora inclui dayNumber (opcional).
        // Se dayNumber não for preenchido no banco para snapshots antigos, ele será undefined, o que é permitido pela interface.
        return snapshots as IDailyMetricSnapshot[];

    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar histórico diário da métrica ${metricId} para User ${userIdForAuth}:`, error);
        if (error instanceof DatabaseError || error instanceof MetricsNotFoundError || error instanceof UserNotFoundError) {
            throw error;
        }
        throw new DatabaseError(`Ocorreu um erro inesperado ao buscar o histórico diário do post: ${error.message}`);
    }
}

/**
 * Busca os N posts com melhor desempenho para um utilizador, ordenados por uma métrica específica.
 * @param userId O ID do utilizador.
 * @param metric A métrica pela qual ordenar (ex: 'shares', 'likes').
 * @param limit O número de posts a retornar.
 * @returns Uma promessa que resolve para um array de objetos de métrica (posts).
 */
export async function getTopPostsByMetric(
    userId: string,
    metric: keyof IMetricStats | string,
    limit: number
): Promise<IMetric[]> {
    const TAG = '[dataService][reportService][getTopPostsByMetric]';
    logger.info(`${TAG} Buscando top ${limit} posts para User ID: ${userId}, Métrica: ${metric}`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }
    if (!metric || typeof metric !== 'string' || metric.trim() === '') {
        logger.error(`${TAG} Métrica inválida ou vazia: ${metric}`);
        throw new DatabaseError(`Métrica inválida ou vazia: ${metric}`);
    }
    if (typeof limit !== 'number' || limit <= 0 || limit > 20) {
        logger.error(`${TAG} Limite inválido: ${limit}. Deve ser um número entre 1 e 20.`);
        throw new DatabaseError(`Limite inválido: ${limit}. Deve ser um número entre 1 e 20.`);
    }

    const userObjectId = new Types.ObjectId(userId);
    const allowedMetrics: (keyof IMetricStats)[] = ['views', 'likes', 'comments', 'shares', 'saved', 'reach', 'video_views', 'ig_reels_avg_watch_time', 'impressions', 'engagement'];
    if (!allowedMetrics.includes(metric as keyof IMetricStats) && !metric.startsWith('custom_')) {
        logger.error(`${TAG} Métrica não permitida para ordenação: ${metric}`);
        throw new DatabaseError(`Métrica não permitida para ordenação: ${metric}`);
    }
    const sortField = `stats.${metric}`;

    try {
        await connectToDatabase();

        const topPosts = await MetricModel.find({
            user: userObjectId,
            postDate: { $exists: true },
            [sortField]: { $exists: true, $ne: null }
        })
        .select(`_id description postLink instagramMediaId stats.${metric} stats.shares stats.saved stats.likes stats.comments stats.reach stats.video_views format postDate proposal context`) 
        .sort({ [sortField]: -1 })
        .limit(limit)
        .lean()
        .exec();

        logger.info(`${TAG} Encontrados ${topPosts.length} posts para User ${userId} com a métrica ${metric}.`);
        return topPosts as IMetric[];

    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar top posts para User ${userId}, Métrica ${metric}:`, error);
        throw new DatabaseError(`Erro ao buscar top posts: ${error.message}`);
    }
}

/**
 * Busca os detalhes completos de uma métrica (post) específica, verificando a propriedade.
 * @param metricId O ID da métrica a ser detalhada.
 * @param userId O ID do usuário para verificar a propriedade.
 * @returns Uma promessa que resolve para o objeto IMetric encontrado, ou null se não encontrado ou sem permissão.
 */
export async function getMetricDetails(
    metricId: string,
    userId: string
): Promise<IMetric | null> {
    const TAG = '[dataService][reportService][getMetricDetails]';
    logger.info(`${TAG} Buscando detalhes para Metric ID: ${metricId} para User ID: ${userId}`);

    if (!mongoose.isValidObjectId(metricId)) {
        logger.warn(`${TAG} ID da métrica inválido (formato): ${metricId}`);
        throw new DatabaseError("O ID da métrica fornecido não parece ser válido.");
    }
    if (!mongoose.isValidObjectId(userId)) {
        logger.warn(`${TAG} ID do usuário inválido (formato): ${userId}`);
        throw new DatabaseError("ID de usuário inválido.");
    }

    const objectMetricId = new Types.ObjectId(metricId);
    const userObjectId = new Types.ObjectId(userId);

    try {
        await connectToDatabase();

        const metricDoc = await MetricModel.findOne({ _id: objectMetricId, user: userObjectId })
            .select('-rawData -__v') 
            .lean()
            .exec();

        if (!metricDoc) {
            const metricExistsForOtherUser = await MetricModel.findById(objectMetricId).select('_id').lean();
            if (metricExistsForOtherUser) {
                logger.warn(`${TAG} Métrica ${metricId} encontrada, mas não pertence ao User ${userId}. Acesso negado.`);
                return null;
            }
            logger.warn(`${TAG} Métrica com ID ${metricId} não encontrada para User ${userId}.`);
            return null;
        }

        logger.info(`${TAG} Detalhes da Métrica ${metricId} encontrados para User ${userId}.`);
        return metricDoc as IMetric;

    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar detalhes da métrica ${metricId} para User ${userId}:`, error);
        if (error instanceof DatabaseError || error instanceof MetricsNotFoundError || error instanceof UserNotFoundError) {
            throw error;
        }
        throw new DatabaseError(`Ocorreu um erro inesperado ao buscar os detalhes desta métrica: ${error.message}`);
    }
}

/**
 * Argumentos para a função findMetricsByCriteria.
 */
export interface FindMetricsCriteriaArgs {
    criteria: {
        format?: string; 
        proposal?: string;
        context?: string;
        dateRange?: {
            start?: string;
            end?: string;
        };
        minLikes?: number;
        minShares?: number;
    };
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

/**
 * Busca métricas (posts) que correspondem a critérios específicos.
 * @param userId O ID do usuário para o qual buscar as métricas.
 * @param args Os argumentos da busca, incluindo critérios, limite e ordenação.
 * @returns Uma promessa que resolve para um array de IMetric.
 */
export async function findMetricsByCriteria(
    userId: string,
    args: FindMetricsCriteriaArgs
): Promise<IMetric[]> {
    const TAG = '[dataService][reportService][findMetricsByCriteria]';
    const { criteria, limit = 5, sortBy = 'postDate', sortOrder = 'desc' } = args;

    logger.info(`${TAG} Buscando métricas para User ID: ${userId} com critérios: ${JSON.stringify(criteria)}, limite: ${limit}, sortBy: ${sortBy}, sortOrder: ${sortOrder}`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido: ${userId}`);
        throw new DatabaseError(`ID de usuário inválido: ${userId}`);
    }

    const userObjectId = new Types.ObjectId(userId);
    const filterQuery: any = { user: userObjectId };

    if (criteria.format) filterQuery.format = criteria.format;
    if (criteria.proposal) filterQuery.proposal = { $regex: new RegExp(criteria.proposal, 'i') };
    if (criteria.context) filterQuery.context = { $regex: new RegExp(criteria.context, 'i') };

    if (criteria.dateRange) {
        filterQuery.postDate = {};
        try {
            if (criteria.dateRange.start) {
                const startDate = new Date(criteria.dateRange.start);
                if (isNaN(startDate.getTime())) throw new Error('Data de início inválida fornecida para a busca.');
                filterQuery.postDate.$gte = startDate;
            }
            if (criteria.dateRange.end) {
                const endDate = new Date(criteria.dateRange.end);
                if (isNaN(endDate.getTime())) throw new Error('Data de fim inválida fornecida para a busca.');
                endDate.setUTCHours(23, 59, 59, 999);
                filterQuery.postDate.$lte = endDate;
            }
            if (filterQuery.postDate.$gte && filterQuery.postDate.$lte && filterQuery.postDate.$gte > filterQuery.postDate.$lte) {
                throw new DatabaseError("A data de início não pode ser posterior à data de fim na busca por critérios.");
            }
        } catch (dateErr: any) {
            logger.warn(`${TAG} Erro ao processar dateRange nos critérios: ${JSON.stringify(criteria.dateRange)}`, dateErr);
            throw new DatabaseError(`Ocorreu um erro ao processar o intervalo de datas fornecido: ${dateErr.message}`);
        }
        if (Object.keys(filterQuery.postDate).length === 0) delete filterQuery.postDate;
    }

    if (typeof criteria.minLikes === 'number' && criteria.minLikes >= 0) filterQuery['stats.likes'] = { $gte: criteria.minLikes };
    if (typeof criteria.minShares === 'number' && criteria.minShares >= 0) filterQuery['stats.shares'] = { $gte: criteria.minShares };

    const sortOptions: any = {};
    const validSortFields = ['postDate', 'stats.likes', 'stats.shares', 'stats.comments', 'stats.reach', 'stats.saved', 'stats.video_views', 'stats.impressions', 'stats.engagement'];
    if (sortBy && validSortFields.includes(sortBy)) {
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy) {
        logger.warn(`${TAG} Campo de ordenação '${sortBy}' inválido ou não permitido. Usando 'postDate' descendente como padrão.`);
        sortOptions['postDate'] = -1;
    } else {
        sortOptions['postDate'] = -1;
    }

    const effectiveLimit = Math.max(1, Math.min(limit ?? 5, 20));

    logger.debug(`${TAG} Filtro MQL final para findMetricsByCriteria: ${JSON.stringify(filterQuery)}`);
    logger.debug(`${TAG} Ordenação MQL final para findMetricsByCriteria: ${JSON.stringify(sortOptions)}`);

    try {
        await connectToDatabase();
        const metrics = await MetricModel.find(filterQuery)
            .select('_id description postLink instagramMediaId postDate stats format proposal context')
            .sort(sortOptions)
            .limit(effectiveLimit)
            .lean()
            .exec();

        logger.info(`${TAG} Encontradas ${metrics.length} métricas para os critérios fornecidos.`);
        return metrics as IMetric[];

    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar métricas por critérios para User ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar posts por critérios: ${error.message}`);
    }
}
