// @/app/lib/dataService/reportService.ts
// MODIFICADO: v2.14.24 - Adiciona asserções de tipo para garantir a compatibilidade com os enums de PostObject.
// - CORRIGIDO: `extractReferenceAndFindPost`, `getRecentPostObjects`, `getRecentPostObjectsWithAggregatedMetrics` agora fazem o cast do primeiro elemento dos arrays para o tipo esperado.
// Baseado na v2.14.23.

import mongoose, { Model, Types } from 'mongoose';
import { subDays, differenceInDays } from 'date-fns';

import { logger } from '@/app/lib/logger';
import { MetricsNotFoundError, DatabaseError, ReportAggregationError, DetailedStatsError, UserNotFoundError } from '@/app/lib/errors';

import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric';
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot';

import {
    buildAggregatedReport,
    AggregatedReport,
    DayOfWeekStat 
} from '@/app/lib/reportHelpers';

import { connectToDatabase } from './connection';
import { DEFAULT_METRICS_FETCH_DAYS } from './constants';
// Assumindo que PostObject em ./types.ts foi atualizado para usar consistentemente instagramMediaId
import { IUser, IEnrichedReport, PreparedData, ReferenceSearchResult, IGrowthDataResult, PostObject } from './types'; 
import { getUserProfileSegment, getMultimediaSuggestion, getCombinedGrowthData } from './helpers';

const SERVICE_TAG = '[dataService][reportService v2.14.24]'; // Tag de versão atualizada

export async function fetchAndPrepareReportData(
    { user, analysisSinceDate }: { user: IUser; analysisSinceDate?: Date; }
): Promise<PreparedData> {
    const userId = user._id instanceof Types.ObjectId ? user._id : new Types.ObjectId(user._id);
    const currentVersionTag = "v2.14.20"; // Versão da lógica principal desta função mantida
    const TAG = `${SERVICE_TAG}[fetchAndPrepareReportData ${currentVersionTag}]`;
    const sinceDate = analysisSinceDate || subDays(new Date(), DEFAULT_METRICS_FETCH_DAYS);

    logger.info(`${TAG} Iniciando para utilizador ${userId}. Período de busca: desde ${sinceDate.toISOString()}`);

    let growthData: IGrowthDataResult;
    try {
        await connectToDatabase();
        const userCreatedAt = user.createdAt instanceof Date ? user.createdAt : (typeof user.createdAt === 'string' ? new Date(user.createdAt) : undefined);
        growthData = await getCombinedGrowthData(userId, userCreatedAt);

        if (growthData.dataIsPlaceholder) {
            logger.info(`${TAG} Dados de crescimento placeholder obtidos para ${userId}. Motivo: ${growthData.reasonForPlaceholder || 'Não especificado'}`);
        } else {
            logger.debug(`${TAG} Dados de crescimento REAIS obtidos para ${userId}.`);
        }
    } catch (error: any) {
        logger.error(`${TAG} Erro crítico ao buscar dados de crescimento para ${userId}:`, error);
        growthData = {
            historical: {},
            longTerm: {},
            dataIsPlaceholder: true,
            reasonForPlaceholder: `Erro ao buscar dados de crescimento: ${error instanceof Error ? error.message : String(error)}`
        };
    }

    let aggregatedReport: AggregatedReport;
    try {
        await connectToDatabase();
        logger.debug(`${TAG} Gerando relatório agregado (usando buildAggregatedReport) para ${userId} desde ${sinceDate.toISOString()}...`);
        aggregatedReport = await buildAggregatedReport(userId, sinceDate, MetricModel as Model<IMetric>);
        logger.info(`${TAG} Relatório agregado gerado com sucesso para ${userId}. Posts no relatório: ${aggregatedReport?.overallStats?.totalPosts ?? 'N/A'}`);

        if (!aggregatedReport || !aggregatedReport.overallStats || aggregatedReport.overallStats.totalPosts === 0) {
             const daysAnalyzed = differenceInDays(new Date(), sinceDate);
             logger.warn(`${TAG} Nenhum dado encontrado nos últimos ${daysAnalyzed} dias para gerar relatório para ${userId}. overallStats: ${JSON.stringify(aggregatedReport?.overallStats)}`);
        }
    } catch (error: any) {
        logger.error(`${TAG} Erro ao gerar relatório agregado para ${userId} desde ${sinceDate.toISOString()}:`, error);
        aggregatedReport = { overallStats: { _id: null, totalPosts: 0 }}; 
    }

    logger.debug(`${TAG} Montando relatório enriquecido final para ${userId}`);
    const recentPostsLookback = Math.max(DEFAULT_METRICS_FETCH_DAYS, differenceInDays(new Date(), sinceDate));
    const recentPostsData = await getRecentPostObjects(userId.toString(), recentPostsLookback); 

    const enrichedReport: IEnrichedReport = {
        overallStats: aggregatedReport.overallStats,
        dayOfWeekStats: aggregatedReport.dayOfWeekStats, 
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
        recentPosts: recentPostsData, 
    };

    return { enrichedReport };
}


export async function extractReferenceAndFindPost( text: string, userId: Types.ObjectId ): Promise<ReferenceSearchResult> {
    const fnTag = `${SERVICE_TAG}[extractReferenceAndFindPost]`; // Mantém versão, sem alteração de lógica
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
            // CORREÇÃO: Adicionada asserção de tipo para garantir que a string seja compatível com o enum de PostObject.
            return { status: 'found', post: {
                _id: post._id.toString(),
                description: post.description || '',
                proposal: post.proposal?.[0] as PostObject['proposal'],
                context: post.context?.[0] as PostObject['context'],
                format: post.format?.[0] as PostObject['format']
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

export async function getLatestAggregatedReport(userId: string): Promise<AggregatedReport | null> {
    const TAG = `${SERVICE_TAG}[getLatestAggregatedReport]`; // Mantém versão, sem alteração de lógica
    logger.debug(`${TAG} Buscando último relatório agregado para utilizador ${userId}`);

     if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido fornecido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }
    try {
        await connectToDatabase();
        // Esta função continua como placeholder conforme discussão.
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

export async function getRecentPostObjects(
    userId: string,
    daysToLookback: number,
    filters?: { types?: Array<'IMAGE' | 'CAROUSEL' | 'REEL' | 'VIDEO' | 'STORY'>, excludeIds?: string[] }
): Promise<PostObject[]> {
    const currentVersionTag = "v2.14.24"; // Versão desta função atualizada
    const TAG = `${SERVICE_TAG}[getRecentPostObjects ${currentVersionTag}]`; 
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

        return postsFromMetrics.map((metric): PostObject => {
            // A lógica de tags agora mescla os arrays de classificação corretamente.
            const potentialTags = [
                ...(metric.format || []),
                ...(metric.proposal || []),
                ...(metric.context || [])
            ];
            const tags = potentialTags.filter(tag => 
                typeof tag === 'string' && 
                tag.trim() !== '' && 
                tag.toLowerCase() !== 'outro' && 
                tag.toLowerCase() !== 'geral' &&
                tag.toLowerCase() !== 'desconhecido'
            );

            // Garantindo consistência: usamos instagramMediaId aqui.
            // A interface PostObject (em ./types) deve refletir isso.
            return {
                _id: metric._id.toString(),
                userId: metric.user.toString(),
                instagramMediaId: metric.instagramMediaId, // PADRONIZADO
                type: metric.type as PostObject['type'],
                description: metric.description,
                postDate: metric.postDate, 
                stats: metric.stats,
                // CORREÇÃO: Adicionada asserção de tipo para garantir que a string seja compatível com o enum de PostObject.
                format: metric.format?.[0] as PostObject['format'],
                proposal: metric.proposal?.[0] as PostObject['proposal'],
                context: metric.context?.[0] as PostObject['context'],
                tags: tags,
            };
        });
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar posts recentes para User ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar posts recentes: ${error.message}`);
    }
}

export async function getRecentPostObjectsWithAggregatedMetrics(
    userId: string,
    days: number
): Promise<PostObject[]> { 
    const currentVersionTag = "v2.14.24"; // Versão desta função atualizada
    const TAG = `${SERVICE_TAG}[getRecentPostObjectsWithAggregatedMetrics ${currentVersionTag}]`;
    logger.info(`${TAG} Buscando posts com métricas agregadas para User ${userId} nos últimos ${days} dias.`);

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
            // A lógica de tags agora mescla os arrays de classificação corretamente.
            const potentialTags = [
                ...(metric.format || []),
                ...(metric.proposal || []),
                ...(metric.context || [])
            ];
            const tags = potentialTags.filter(tag => 
                typeof tag === 'string' && 
                tag.trim() !== '' && 
                tag.toLowerCase() !== 'outro' && 
                tag.toLowerCase() !== 'geral' &&
                tag.toLowerCase() !== 'desconhecido'
            );

            return {
                _id: metric._id.toString(),
                userId: metric.user.toString(),
                instagramMediaId: metric.instagramMediaId, 
                type: metric.type as PostObject['type'],
                description: metric.description,
                postDate: metric.postDate, 
                totalImpressions: metric.stats?.impressions || 0,
                totalEngagement: metric.stats?.engagement || 0, 
                videoViews: metric.stats?.video_views || 0,
                totalComments: metric.stats?.comments || 0,
                stats: metric.stats,
                // CORREÇÃO: Adicionada asserção de tipo para garantir que a string seja compatível com o enum de PostObject.
                format: metric.format?.[0] as PostObject['format'],
                proposal: metric.proposal?.[0] as PostObject['proposal'],
                context: metric.context?.[0] as PostObject['context'],
                tags: tags,
            };
        });

        logger.info(`${TAG} Retornando ${results.length} posts com métricas agregadas para User ${userId}.`);
        return results;
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar posts com métricas agregadas para User ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar posts com métricas agregadas: ${error.message}`);
    }
}

export async function getDailySnapshotsForMetric(
    metricId: string,
    userIdForAuth: string
): Promise<IDailyMetricSnapshot[]> {
    const TAG = `${SERVICE_TAG}[getDailySnapshotsForMetric]`; // Mantém versão, sem alteração de lógica
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
                throw new UserNotFoundError("Você não tem permissão para acessar o histórico desta métrica."); 
            }
        }

        const snapshots = await DailyMetricSnapshotModel.find({ metric: objectMetricId })
            .sort({ date: 1 }) 
            .select('date dayNumber dailyViews dailyLikes dailyComments dailyShares dailySaved dailyReach dailyFollows dailyProfileVisits cumulativeViews cumulativeLikes cumulativeComments cumulativeShares cumulativeSaved cumulativeReach cumulativeFollows cumulativeProfileVisits cumulativeTotalInteractions dailyReelsVideoViewTotalTime cumulativeReelsVideoViewTotalTime currentReelsAvgWatchTime')
            .lean();

        logger.info(`${TAG} Encontrados ${snapshots.length} snapshots diários para Metric ${metricId}.`);
        return snapshots as IDailyMetricSnapshot[];

    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar histórico diário da métrica ${metricId} para User ${userIdForAuth}:`, error);
        if (error instanceof DatabaseError || error instanceof MetricsNotFoundError || error instanceof UserNotFoundError) {
            throw error; 
        }
        throw new DatabaseError(`Ocorreu um erro inesperado ao buscar o histórico diário do post: ${error.message}`);
    }
}

export async function getTopPostsByMetric(
    userId: string,
    metric: keyof IMetricStats | string,
    limit: number
): Promise<IMetric[]> {
    const TAG = `${SERVICE_TAG}[getTopPostsByMetric]`; // Mantém versão, sem alteração de lógica
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
    const allowedMetrics: (keyof IMetricStats)[] = ['views', 'likes', 'comments', 'shares', 'saved', 'reach', 'video_views', 'ig_reels_avg_watch_time', 'impressions', 'engagement', 'total_interactions'];
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
        .select(`_id description postLink instagramMediaId stats.${metric} stats.shares stats.saved stats.likes stats.comments stats.reach stats.video_views format postDate proposal context type`) 
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

export async function getMetricDetails(
    metricId: string,
    userId: string
): Promise<IMetric | null> {
    const TAG = `${SERVICE_TAG}[getMetricDetails]`; // Mantém versão, sem alteração de lógica
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

export interface FindMetricsCriteriaArgs { // Mantida aqui pois é específica para esta função dentro do service.
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

export async function findMetricsByCriteria(
    userId: string,
    args: FindMetricsCriteriaArgs
): Promise<IMetric[]> {
    const TAG = `${SERVICE_TAG}[findMetricsByCriteria]`; // Mantém versão, sem alteração de lógica
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
    const validSortFields = ['postDate', 'stats.likes', 'stats.shares', 'stats.comments', 'stats.reach', 'stats.saved', 'stats.video_views', 'stats.impressions', 'stats.engagement', 'stats.total_interactions'];
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
            .select('_id description postLink instagramMediaId postDate stats format proposal context type') 
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

export async function getMetricsHistory(
    userId: string,
    days: number = 360
): Promise<MetricsHistory> {
    const TAG = `${SERVICE_TAG}[getMetricsHistory]`;
    logger.info(`${TAG} Buscando histórico para User ${userId}, últimos ${days} dias.`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido: ${userId}`);
        throw new DatabaseError(`ID de usuário inválido: ${userId}`);
    }
    if (typeof days !== 'number' || days <= 0) {
        logger.warn(`${TAG} Valor de days inválido (${days}). Usando 360.`);
        days = 360;
    }

    await connectToDatabase();
    const objectId = new Types.ObjectId(userId);

    const fromDate = new Date();
    fromDate.setHours(0, 0, 0, 0);
    fromDate.setDate(fromDate.getDate() - days);

    const sortSpec: Record<string, 1 | -1> = { '_id.year': 1, '_id.month': 1, '_id.day': 1 };

    const pipeline: mongoose.PipelineStage[] = [
        { $match: { user: objectId, postDate: { $gte: fromDate } } },
        {
            $group: {
                _id: { year: { $year: '$postDate' }, month: { $month: '$postDate' }, day: { $dayOfMonth: '$postDate' } },
                avgEngagementRate: { $avg: '$stats.engagement_rate' },
                avgPropagationIndex: { $avg: '$stats.propagation_index' },
                avgLikeCommentRatio: { $avg: '$stats.like_comment_ratio' },
                avgSaveRateOnReach: { $avg: '$stats.save_rate_on_reach' },
                avgFollowerConversionRate: { $avg: '$stats.follower_conversion_rate' },
                avgRetentionRate: { $avg: '$stats.retention_rate' },
                avgEngagementDeepVsReach: { $avg: '$stats.engagement_deep_vs_reach' },
                avgEngagementFastVsReach: { $avg: '$stats.engagement_fast_vs_reach' },
                avgLikes: { $avg: '$stats.likes' },
                avgComments: { $avg: '$stats.comments' },
                count: { $sum: 1 }
            }
        },
        { $sort: sortSpec }
    ];

    const results = await MetricModel.aggregate(pipeline);

    const labels: string[] = [];
    const arrEngagementRate: number[] = [];
    const arrPropagationIndex: number[] = [];
    const arrLikeCommentRatio: number[] = [];
    const arrSaveRate: number[] = [];
    const arrFollowerConversion: number[] = [];
    const arrRetentionRate: number[] = [];
    const arrEngajDeep: number[] = [];
    const arrEngajFast: number[] = [];
    const arrLikes: number[] = [];
    const arrComments: number[] = [];

    const parseAvg = (value: any): number => {
        const num = parseFloat(String(value ?? '0').replace(',', '.'));
        return isNaN(num) || !isFinite(num) ? 0 : num;
    };

    results.forEach(doc => {
        const { year, month, day } = doc._id as { year: number; month: number; day: number };
        const label = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        labels.push(label);

        arrEngagementRate.push(parseAvg(doc.avgEngagementRate));
        arrPropagationIndex.push(parseAvg(doc.avgPropagationIndex));
        arrLikeCommentRatio.push(parseAvg(doc.avgLikeCommentRatio));
        arrSaveRate.push(parseAvg(doc.avgSaveRateOnReach));
        arrFollowerConversion.push(parseAvg(doc.avgFollowerConversionRate));
        arrRetentionRate.push(parseAvg(doc.avgRetentionRate));
        arrEngajDeep.push(parseAvg(doc.avgEngagementDeepVsReach));
        arrEngajFast.push(parseAvg(doc.avgEngagementFastVsReach));
        arrLikes.push(parseAvg(doc.avgLikes));
        arrComments.push(parseAvg(doc.avgComments));
    });

    const history: MetricsHistory = {
        engagementRate: { labels, datasets: [{ label: 'Taxa Engajamento / Alcance (%)', data: arrEngagementRate.map(v => v * 100) }] },
        propagationIndex: { labels, datasets: [{ label: 'Índice de Propagação (%)', data: arrPropagationIndex.map(v => v * 100) }] },
        likeCommentRatio: { labels, datasets: [{ label: 'Razão Like/Comentário', data: arrLikeCommentRatio }] },
        saveRateOnReach: { labels, datasets: [{ label: 'Taxa Salvamento / Alcance (%)', data: arrSaveRate.map(v => v * 100) }] },
        followerConversionRate: { labels, datasets: [{ label: 'Taxa Conversão Seg. (%)', data: arrFollowerConversion.map(v => v * 100) }] },
        retentionRate: { labels, datasets: [{ label: 'Taxa Retenção Média (%)', data: arrRetentionRate.map(v => v * 100) }] },
        engagementDeepVsReach: { labels, datasets: [{ label: 'Engaj. Profundo / Alcance (%)', data: arrEngajDeep.map(v => v * 100) }] },
        engagementFastVsReach: { labels, datasets: [{ label: 'Engaj. Rápido / Alcance (%)', data: arrEngajFast.map(v => v * 100) }] },
        likes: { labels, datasets: [{ label: 'Curtidas (média diária)', data: arrLikes }] },
        comments: { labels, datasets: [{ label: 'Comentários (média diária)', data: arrComments }] },
    };

    logger.info(`${TAG} Histórico de métricas preparado para User ${userId}.`);
    return history;
}
