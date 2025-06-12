/**
 * @fileoverview Serviço para análises de mercado agregadas da Creator Economy.
 * @version 3.3.0
 * @description
 * ## Principais Melhorias na Versão 3.3.0:
 * - **Correção de Erro de Tipo (Agregação):** Adicionada uma asserção de tipo (`as ICohortComparisonResult[]`)
 * ao resultado da agregação de coortes. Isso informa ao TypeScript a estrutura
 * correta dos dados, resolvendo o erro 'Type 'unknown' is not assignable'.
 */

import { Types, PipelineStage } from 'mongoose';
import { subDays } from 'date-fns';
import { z } from 'zod';

import { logger } from '@/app/lib/logger';
import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric';
import UserModel, { IUser } from '@/app/models/User';
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot'; // Added missing import
import { connectToDatabase } from './connection';
import { DatabaseError } from '@/app/lib/errors';

const SERVICE_TAG = '[dataService][marketAnalysisService v3.3.0]';

// --- Validação de Schema e Tipos de Contrato ---

export const TopCreatorMetricEnum = z.enum([
    'total_interactions',
    'engagement_rate_on_reach',
    'likes',
    'shares',
    'comments'
]);
export type TopCreatorMetric = z.infer<typeof TopCreatorMetricEnum>;

// --- Interfaces de Contrato (EXISTENTES E NOVAS) ---
export interface IMarketPerformanceResult {
    avgEngagementRate?: number;
    avgShares?: number;
    avgLikes?: number;
    postCount: number;
}
export interface ITopCreatorResult {
    creatorId: string;
    creatorName?: string;
    metricValue: number;
    totalInteractions: number;
    postCount: number;
}
export interface ICreatorProfile {
    creatorId: string;
    creatorName: string;
    postCount: number;
    avgLikes: number;
    avgShares: number;
    avgEngagementRate: number;
    topPerformingContext: string;
    profilePictureUrl?: string; // Added
}

// --- Interface for fetchMultipleCreatorProfiles ---
export interface IFetchMultipleCreatorProfilesArgs {
  creatorIds: string[];
}


export interface FindGlobalPostsArgs {
    context?: string;
    proposal?: string;
    format?: string;
    minInteractions?: number;
    limit?: number; // Mantido para compatibilidade, mas idealmente controlado por page/limit
    page?: number;
    sortBy?: string; // e.g., 'postDate', 'stats.engagement_rate_on_reach'
    sortOrder?: 'asc' | 'desc';
    dateRange?: {
        startDate?: Date;
        endDate?: Date;
    };
}
// MODIFIED: IGlobalPostResult to reflect projected fields
export interface IGlobalPostResult {
  _id: Types.ObjectId; // Or string, depending on how it's used post-aggregation
  text_content?: string;
  description?: string;
  creatorName?: string;
  postDate?: Date;
  format?: string;
  proposal?: string;
  context?: string;
  stats?: { // Only include the stats we project
    total_interactions?: number;
    likes?: number;
    shares?: number;
  };
  // Other fields from IMetric like 'user', 'source', 'specificMetricMeta', 'raw_data' are excluded
}
// Adicionar uma interface para o retorno paginado
export interface IGlobalPostsPaginatedResult {
    posts: IGlobalPostResult[];
    totalPosts: number;
    page: number;
    limit: number;
}

// NOVAS Interfaces de Contrato para a Fase 1

// Interfaces para fetchDashboardCreatorsList
export interface IFetchDashboardCreatorsListParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: {
    nameSearch?: string;
    planStatus?: string[]; // MODIFIED: Already an array, ensure logic handles it as such. Kept as string[] for consistency with previous state, will ensure API sends array.
    expertiseLevel?: string[]; // MODIFIED: Already an array, ensure logic handles it as such.
    minTotalPosts?: number;
    minFollowers?: number; // Supondo que 'followers' é um campo em User
  };
}

export interface IDashboardCreator {
  _id: Types.ObjectId; // ID do usuário
  name: string;
  // email?: string; // Removed by projection
  planStatus?: string;
  inferredExpertiseLevel?: string;
  totalPosts: number;
  lastActivityDate?: Date;
  avgEngagementRate: number;
  // avgLikes: number; // Removed by projection
  // avgShares: number; // Removed by projection
  // Campos adicionais conforme necessário
  // followers?: number; // Removed by projection
  profilePictureUrl?: string; // URL da foto de perfil
}

export interface IFetchTucaRadarEffectivenessArgs {
    alertType?: string;
    periodDays: number;
}
export interface ITucaRadarEffectivenessResult {
    alertType: string;
    positiveInteractionRate: number;
    totalAlerts: number;
}
export interface IFetchCohortComparisonArgs {
    metric: string;
    cohorts: { filterBy: 'planStatus' | 'inferredExpertiseLevel'; value: string }[];
}
export interface ICohortComparisonResult {
    cohortName: string;
    avgMetricValue: number;
    userCount: number;
}


/**
 * @function fetchDashboardOverallContentStats
 * @description Fetches overall content statistics for the dashboard, including breakdowns by format, proposal, and context.
 * @param {IFetchDashboardOverallContentStatsFilters} params - Filters for the statistics (e.g., dateRange).
 * @returns {Promise<IDashboardOverallStats>} - Overall content statistics.
 */
export async function fetchDashboardOverallContentStats(
  params: IFetchDashboardOverallContentStatsFilters = {}
): Promise<IDashboardOverallStats> {
  const TAG = `${SERVICE_TAG}[fetchDashboardOverallContentStats]`;
  logger.info(`${TAG} Iniciando busca de estatísticas gerais de conteúdo com params: ${JSON.stringify(params)}`);

  try {
    await connectToDatabase();
    const { dateRange } = params;

    // --- Estágio $match base para filtros de data ---
    const dateMatchStage: PipelineStage.Match['$match'] = {};
    if (dateRange?.startDate) {
      dateMatchStage.postDate = { ...dateMatchStage.postDate, $gte: dateRange.startDate };
    }
    if (dateRange?.endDate) {
      dateMatchStage.postDate = { ...dateMatchStage.postDate, $lte: dateRange.endDate };
    }

    // --- Pipeline principal usando $facet ---
    const aggregationPipeline: PipelineStage[] = [];
    if (Object.keys(dateMatchStage).length > 0) {
        aggregationPipeline.push({ $match: dateMatchStage });
    }

    aggregationPipeline.push({
      $facet: {
        // Total de posts na plataforma
        totalPlatformPosts: [{ $count: 'count' }],
        // Média de taxa de engajamento da plataforma
        averagePlatformEngagementRate: [
          { $match: { 'stats.engagement_rate_on_reach': { $exists: true, $ne: null } } },
          { $group: { _id: null, avgEngagement: { $avg: '$stats.engagement_rate_on_reach' } } },
        ],
        // Total de criadores de conteúdo únicos
        totalContentCreators: [
          { $group: { _id: '$user' } },
          { $count: 'count' }
        ],
        // Breakdown por formato
        breakdownByFormat: [
          { $match: { format: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$format',
              count: { $sum: 1 },
              // avgEngagement: { $avg: '$stats.engagement_rate_on_reach' }, // Removed
            },
          },
          { $project: { _id: 0, format: '$_id', count: 1 /* avgEngagement: 0 */ } }, // Removed avgEngagement
          { $sort: { count: -1 } },
        ],
        // Breakdown por proposta
        breakdownByProposal: [
          { $match: { proposal: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$proposal',
              count: { $sum: 1 },
              // avgEngagement: { $avg: '$stats.engagement_rate_on_reach' }, // Removed
            },
          },
          { $project: { _id: 0, proposal: '$_id', count: 1 /* avgEngagement: 0 */ } }, // Removed avgEngagement
          { $sort: { count: -1 } },
        ],
        // Breakdown por contexto
        breakdownByContext: [
          { $match: { context: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$context',
              count: { $sum: 1 },
              // avgEngagement: { $avg: '$stats.engagement_rate_on_reach' }, // Removed
            },
          },
          { $project: { _id: 0, context: '$_id', count: 1 /* avgEngagement: 0 */ } }, // Removed avgEngagement
          { $sort: { count: -1 } },
        ],
      },
    });

    logger.debug(`${TAG} Pipeline de agregação para fetchDashboardOverallContentStats: ${JSON.stringify(aggregationPipeline)}`);

    const results = await MetricModel.aggregate(aggregationPipeline);
    const stats = results[0]; // Resultado do $facet é um array com um único objeto

    const overallStats: IDashboardOverallStats = {
      totalPlatformPosts: stats.totalPlatformPosts[0]?.count || 0,
      averagePlatformEngagementRate: stats.averagePlatformEngagementRate[0]?.avgEngagement || 0,
      totalContentCreators: stats.totalContentCreators[0]?.count || 0,
      breakdownByFormat: stats.breakdownByFormat || [],
      breakdownByProposal: stats.breakdownByProposal || [],
      breakdownByContext: stats.breakdownByContext || [],
    };

    logger.info(`${TAG} Busca de estatísticas gerais de conteúdo concluída.`);
    return overallStats;

  } catch (error: any) {
    logger.error(`${TAG} Erro ao buscar estatísticas gerais de conteúdo:`, error);
    throw new DatabaseError(`Falha ao buscar estatísticas gerais de conteúdo: ${error.message}`);
  }
}


// Interfaces para fetchDashboardOverallContentStats
export interface IFetchDashboardOverallContentStatsFilters {
  dateRange?: {
    startDate?: Date;
    endDate?: Date;
  };
}

export interface IDashboardOverallStats {
  totalPlatformPosts: number;
  averagePlatformEngagementRate: number;
  totalContentCreators: number;
  breakdownByFormat: { format: string; count: number }[]; // avgEngagement removed
  breakdownByProposal: { proposal: string; count: number }[]; // avgEngagement removed
  breakdownByContext: { context: string; count: number }[]; // avgEngagement removed
  // Adicionar mais breakdowns conforme necessário (ex: por tema, sentimento)
}


// ============================================================================
// --- Funções Helper e de Agregação Base ---
// ============================================================================
const createBasePipeline = (): PipelineStage[] => [
    {
        $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'creatorInfo',
        },
    },
    {
        $unwind: {
            path: '$creatorInfo',
            preserveNullAndEmptyArrays: true,
        },
    },
];
// ============================================================================
// --- Funções de Serviço (EXISTENTES E NOVAS) ---
// ============================================================================

export async function getAvailableContexts(): Promise<string[]> {
    const TAG = `${SERVICE_TAG}[getAvailableContexts]`;
    try {
        await connectToDatabase();
        const contexts = await MetricModel.distinct('context');
        return contexts.filter((c): c is string => !!c);
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar contextos:`, error);
        throw new DatabaseError(`Falha ao obter a lista de contextos: ${error.message}`);
    }
}


/**
 * @function fetchDashboardCreatorsList
 * @description Fetches a paginated and sorted list of dashboard creators with aggregated metrics.
 * @param {IFetchDashboardCreatorsListParams} params - Parameters for pagination, sorting, and filtering.
 * @returns {Promise<{ creators: IDashboardCreator[], totalCreators: number }>} - List of creators and total count.
 */
export async function fetchDashboardCreatorsList(
  params: IFetchDashboardCreatorsListParams
): Promise<{ creators: IDashboardCreator[]; totalCreators: number }> {
  const TAG = `${SERVICE_TAG}[fetchDashboardCreatorsList]`;
  logger.info(`${TAG} Iniciando busca de criadores para dashboard com params: ${JSON.stringify(params)}`);

  try {
    await connectToDatabase();

    const {
      page = 1,
      limit = 10,
      sortBy = 'totalPosts',
      sortOrder = 'desc',
      filters = {},
    } = params;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Pipeline de agregação para buscar usuários e suas métricas
    const aggregationPipeline: PipelineStage[] = [];

    // Estágio $match para filtros de usuário
    const userMatchStage: PipelineStage.Match['$match'] = {};
    if (filters.nameSearch) {
      userMatchStage.name = { $regex: filters.nameSearch, $options: 'i' };
    }
    // Updated logic for planStatus and expertiseLevel
    if (filters.planStatus && Array.isArray(filters.planStatus) && filters.planStatus.length > 0) {
      userMatchStage.planStatus = { $in: filters.planStatus };
    }
    if (filters.expertiseLevel && Array.isArray(filters.expertiseLevel) && filters.expertiseLevel.length > 0) {
      userMatchStage.inferredExpertiseLevel = { $in: filters.expertiseLevel };
    }
    // TODO: Adicionar filtro minFollowers se o campo existir em UserModel
    // if (filters.minFollowers) {
    //   userMatchStage.followers = { $gte: filters.minFollowers };
    // }
    if (Object.keys(userMatchStage).length > 0) {
        aggregationPipeline.push({ $match: userMatchStage });
    }

    // Lookup para as métricas dos usuários
    aggregationPipeline.push(
      {
        $lookup: {
          from: 'metrics', // Nome da coleção de métricas
          localField: '_id',
          foreignField: 'user',
          as: 'metrics',
        },
      },
      // Calcular métricas agregadas
      {
        $addFields: {
          totalPosts: { $size: '$metrics' },
          lastActivityDate: { $max: '$metrics.postDate' },
          avgEngagementRate: { $avg: '$metrics.stats.engagement_rate_on_reach' },
          avgLikes: { $avg: '$metrics.stats.likes' },
          avgShares: { $avg: '$metrics.stats.shares' },
          // Adicionar profilePictureUrl se existir no UserModel
          // profilePictureUrl: '$profilePictureUrl'
        },
      }
    );

    // Estágio $match para filtros baseados em métricas agregadas (ex: minTotalPosts)
    const postMetricsMatchStage: PipelineStage.Match['$match'] = {};
    if (filters.minTotalPosts) {
        postMetricsMatchStage.totalPosts = { $gte: filters.minTotalPosts };
    }
    if (Object.keys(postMetricsMatchStage).length > 0) {
        aggregationPipeline.push({ $match: postMetricsMatchStage });
    }

    // Contagem total de documentos antes da paginação
    const countPipeline = [...aggregationPipeline, { $count: 'totalCreators' }];
    const totalCreatorsResult = await UserModel.aggregate(countPipeline);
    const totalCreators = totalCreatorsResult.length > 0 ? totalCreatorsResult[0].totalCreators : 0;

    // Adicionar ordenação, skip e limit para paginação
    // O campo de ordenação pode ser do UserModel ou calculado (totalPosts, avgEngagementRate, etc.)
    const sortStage: PipelineStage.Sort = { $sort: { [sortBy]: sortDirection } };
    aggregationPipeline.push(sortStage);
    aggregationPipeline.push({ $skip: skip });
    aggregationPipeline.push({ $limit: limit });

    // Projeção final para formatar a saída - Optimized
    aggregationPipeline.push({
      $project: {
        // _id is implicitly included, but we map it to creatorId if needed by interface, or ensure it's just _id
        // The IDashboardCreator interface expects _id, so we keep it.
        _id: 1,
        name: 1,
        // email: 0, // Removed as not used in CreatorTable
        planStatus: 1,
        inferredExpertiseLevel: 1, // Kept for potential filtering/future use
        totalPosts: 1,
        lastActivityDate: 1,
        avgEngagementRate: { $ifNull: ['$avgEngagementRate', 0] },
        // avgLikes: 0, // Removed as not used in CreatorTable
        // avgShares: 0, // Removed as not used in CreatorTable
        profilePictureUrl: '$profilePictureUrl', // Assuming it's available from $addFields or UserModel directly
        // followers: 0, // Removed
      },
    });

    logger.debug(`${TAG} Pipeline de agregação para fetchDashboardCreatorsList: ${JSON.stringify(aggregationPipeline)}`);

    const creators = await UserModel.aggregate(aggregationPipeline);

    logger.info(`${TAG} Busca de criadores para dashboard concluída. Encontrados: ${creators.length}, Total: ${totalCreators}`);
    // Ensure the returned data matches IDashboardCreator, especially if fields were removed
    // The current IDashboardCreator includes avgLikes, avgShares. This might need adjustment
    // or we cast carefully. For now, we assume the projection shapes it for the table.
    // If IDashboardCreator is strict, this projection needs to align or the interface needs an update.
    // Let's assume the projection is the source of truth for what's returned.
    return { creators: creators as IDashboardCreator[], totalCreators };

  } catch (error: any) {
    logger.error(`${TAG} Erro ao buscar lista de criadores para dashboard:`, error);
    throw new DatabaseError(`Falha ao buscar lista de criadores: ${error.message}`);
  }
}


export async function fetchMarketPerformance(args: { format: string, proposal: string, days: number }): Promise<IMarketPerformanceResult> {
  const { format, proposal, days } = args;
  const TAG = `${SERVICE_TAG}[fetchMarketPerformance]`;
  try {
    await connectToDatabase();
    const sinceDate = subDays(new Date(), days);
    const aggregationPipeline: PipelineStage[] = [
      { $match: { format: { $regex: `^${format}$`, $options: 'i' }, proposal: { $regex: `^${proposal}$`, $options: 'i' }, postDate: { $gte: sinceDate }, 'stats.engagement_rate_on_reach': { $exists: true, $ne: null } } },
      { $group: { _id: null, avgEngagementRate: { $avg: '$stats.engagement_rate_on_reach' }, avgShares: { $avg: '$stats.shares' }, avgLikes: { $avg: '$stats.likes' }, postCount: { $sum: 1 } } },
      { $project: { _id: 0 } }
    ];
    const results = await MetricModel.aggregate(aggregationPipeline);
    return results[0] || { postCount: 0 };
  } catch (error: any) {
    logger.error(`${TAG} Erro na agregação de performance:`, error);
    throw new DatabaseError(`Falha ao buscar performance de mercado: ${error.message}`);
  }
}

export async function fetchTopCreators(args: { context: string, metricToSortBy: TopCreatorMetric, days: number, limit: number }): Promise<ITopCreatorResult[]> {
  const { context, metricToSortBy, days, limit } = args;
  const TAG = `${SERVICE_TAG}[fetchTopCreators]`;
  try {
    await connectToDatabase();
    const sinceDate = subDays(new Date(), days);
    const sortField = `stats.${metricToSortBy}`;
    const matchStage: PipelineStage.Match['$match'] = { postDate: { $gte: sinceDate }, [sortField]: { $exists: true, $ne: null, $gt: 0 } };
    if (context && !['geral', 'todos', 'all'].includes(context.toLowerCase())) {
        matchStage.context = { $regex: context, $options: 'i' };
    }
    const aggregationPipeline: PipelineStage[] = [
      { $match: matchStage },
      { $group: { _id: '$user', metricValue: { $avg: `$${sortField}` }, totalInteractions: { $sum: '$stats.total_interactions' }, postCount: { $sum: 1 } } },
      { $sort: { metricValue: -1 } },
      { $limit: limit },
      ...createBasePipeline(),
      { $project: { _id: 0, creatorId: '$_id', creatorName: '$creatorInfo.name', totalInteractions: 1, metricValue: 1, postCount: 1 } },
    ];
    return await MetricModel.aggregate(aggregationPipeline);
  } catch (error: any) {
    logger.error(`${TAG} Erro na agregação de top criadores:`, error);
    throw new DatabaseError(`Falha ao buscar top criadores: ${error.message}`);
  }
}

export async function getCreatorProfile(args: { name: string }): Promise<ICreatorProfile | null> {
    const TAG = `${SERVICE_TAG}[getCreatorProfile]`;
    try {
        await connectToDatabase();
        const user = await UserModel.findOne({ name: { $regex: `^${args.name}$`, $options: 'i' } });

        if (!user) {
            logger.warn(`${TAG} Usuário com nome "${args.name}" não encontrado.`);
            return null;
        }

        const aggregationPipeline: PipelineStage[] = [
            { $match: { user: user._id } },
            {
                $facet: {
                    mainStats: [
                        {
                            $group: {
                                _id: null,
                                postCount: { $sum: 1 },
                                avgLikes: { $avg: '$stats.likes' },
                                avgShares: { $avg: '$stats.shares' },
                                avgEngagementRate: { $avg: '$stats.engagement_rate_on_reach' }
                            }
                        }
                    ],
                    topContext: [
                        { $match: { context: { $ne: null } } },
                        { $group: { _id: '$context', count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 1 }
                    ]
                }
            }
        ];

        const result = await MetricModel.aggregate(aggregationPipeline);

        const stats = result[0]?.mainStats[0];
        if (!stats) return null;

        return {
            creatorId: user._id.toString(),
            creatorName: user.name || 'Criador Desconhecido',
            postCount: stats.postCount,
            avgLikes: stats.avgLikes || 0,
            avgShares: stats.avgShares || 0,
            avgEngagementRate: stats.avgEngagementRate || 0,
            topPerformingContext: result[0]?.topContext[0]?._id || 'Geral'
        };

    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar perfil do criador "${args.name}":`, error);
        throw new DatabaseError(`Falha ao buscar o perfil do criador: ${error.message}`);
    }
}

/**
 * @function findGlobalPostsByCriteria
 * @description Finds global posts based on various criteria with pagination, sorting, and date range filters.
 * @param {FindGlobalPostsArgs} args - Arguments for filtering, pagination, and sorting.
 * @returns {Promise<IGlobalPostsPaginatedResult>} - Paginated list of global posts and total count.
 */
export async function findGlobalPostsByCriteria(args: FindGlobalPostsArgs): Promise<IGlobalPostsPaginatedResult> {
    const TAG = `${SERVICE_TAG}[findGlobalPostsByCriteria]`;
    const {
        context,
        proposal,
        format,
        minInteractions = 0,
        page = 1,
        limit = 10, // Default limit para paginação
        sortBy = 'stats.total_interactions', // Default sort field
        sortOrder = 'desc', // Default sort order
        dateRange,
    } = args;

    logger.info(`${TAG} Buscando posts com critérios: ${JSON.stringify(args)}`);

    try {
        await connectToDatabase();
        const matchStage: PipelineStage.Match['$match'] = {};

        if (context) matchStage.context = { $regex: context, $options: 'i' };
        if (proposal) matchStage.proposal = { $regex: proposal, $options: 'i' };
        if (format) matchStage.format = { $regex: format, $options: 'i' };
        if (minInteractions > 0) {
            matchStage['stats.total_interactions'] = { $gte: minInteractions };
        }
        if (dateRange?.startDate) {
            matchStage.postDate = { ...matchStage.postDate, $gte: dateRange.startDate };
        }
        if (dateRange?.endDate) {
            matchStage.postDate = { ...matchStage.postDate, $lte: dateRange.endDate };
        }

        const baseAggregation: PipelineStage[] = [
            ...createBasePipeline(), // Garante que creatorInfo seja populado primeiro
            { $addFields: { creatorName: '$creatorInfo.name' } }, // Adiciona creatorName consistentemente
            { $project: { creatorInfo: 0 } }, // Remove o objeto creatorInfo duplicado/grande
             // Aplicar $match APÓS $lookup e $addFields se os filtros dependerem de campos populados
            { $match: matchStage },
        ];


        // Pipeline para contagem total de documentos
        const countPipeline: PipelineStage[] = [
            ...baseAggregation,
            { $count: 'totalPosts' },
        ];

        const totalPostsResult = await MetricModel.aggregate(countPipeline);
        const totalPosts = totalPostsResult.length > 0 ? totalPostsResult[0].totalPosts : 0;

        // Pipeline para buscar os posts paginados e ordenados
        const postsPipeline: PipelineStage[] = [...baseAggregation];

        const sortDirection = sortOrder === 'asc' ? 1 : -1;
        postsPipeline.push({ $sort: { [sortBy]: sortDirection } });

        const skip = (page - 1) * limit;
        postsPipeline.push({ $skip: skip });
        postsPipeline.push({ $limit: limit });

        // Add projection stage to select only necessary fields
        postsPipeline.push({
            $project: {
                _id: 1,
                text_content: 1, // Or 'description' if that's the preferred field
                description: 1, // Include both if either could be used
                creatorName: 1, // Added in baseAggregation
                postDate: 1,
                format: 1,
                proposal: 1,
                context: 1,
                'stats.total_interactions': '$stats.total_interactions',
                'stats.likes': '$stats.likes',
                'stats.shares': '$stats.shares',
                // Explicitly exclude other fields from stats if necessary, though projecting specific paths usually suffices
                // user: 0, // Example if user field from MetricModel was populated and not needed
                // raw_data: 0, // Example
            }
        });

        logger.debug(`${TAG} Pipeline de agregação para posts: ${JSON.stringify(postsPipeline)}`);
        const posts = await MetricModel.aggregate(postsPipeline);

        logger.info(`${TAG} Busca global encontrou ${posts.length} posts de um total de ${totalPosts}. Página: ${page}, Limite: ${limit}`);

        return {
            posts: posts as IGlobalPostResult[], // IGlobalPostResult might need update if it's strict about all MetricModel fields
            totalPosts,
            page,
            limit,
        };

    } catch (error: any) {
        logger.error(`${TAG} Erro ao executar busca global:`, error);
        throw new DatabaseError(`Falha ao buscar posts globais: ${error.message}`);
    }
}


/**
 * NOVO: Calcula a eficácia dos alertas do Radar Tuca com base na interação dos usuários.
 */
export async function fetchTucaRadarEffectiveness(args: IFetchTucaRadarEffectivenessArgs): Promise<ITucaRadarEffectivenessResult[]> {
    const TAG = `${SERVICE_TAG}[fetchTucaRadarEffectiveness]`;
    const { alertType, periodDays } = args;
    try {
        await connectToDatabase();
        const sinceDate = subDays(new Date(), periodDays);
        const positiveInteractionTypes = ['explored_further', 'clicked_suggestion', 'provided_feedback'];

        const matchStage: PipelineStage.Match['$match'] = {
            'alertHistory.date': { $gte: sinceDate }
        };
        if (alertType) {
            matchStage['alertHistory.type'] = alertType;
        }

        const aggregationPipeline: PipelineStage[] = [
            { $unwind: '$alertHistory' },
            { $match: matchStage },
            { 
                $group: {
                    _id: '$alertHistory.type',
                    totalAlerts: { $sum: 1 },
                    positiveInteractions: {
                        $sum: {
                            $cond: [{ $in: ['$alertHistory.userInteraction.type', positiveInteractionTypes] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    alertType: '$_id',
                    totalAlerts: 1,
                    positiveInteractionRate: {
                        $cond: [{ $eq: ['$totalAlerts', 0] }, 0, { $divide: ['$positiveInteractions', '$totalAlerts'] }]
                    }
                }
            },
            { $sort: { positiveInteractionRate: -1 } }
        ];

        logger.info(`${TAG} Executando agregação para eficácia dos alertas.`);
        const results = await UserModel.aggregate(aggregationPipeline);
        return results;
    } catch (error: any) {
        logger.error(`${TAG} Erro ao calcular eficácia do Radar Tuca:`, error);
        throw new DatabaseError(`Falha ao buscar dados de eficácia dos alertas: ${error.message}`);
    }
}

/**
 * NOVO: Compara a performance média de métricas de conteúdo entre diferentes coortes de usuários.
 */
export async function fetchCohortComparison(args: IFetchCohortComparisonArgs): Promise<ICohortComparisonResult[]> {
    const TAG = `${SERVICE_TAG}[fetchCohortComparison]`;
    const { metric, cohorts } = args;
    try {
        await connectToDatabase();
        const metricPath = `stats.${metric}`;

        const facetPipelines: Record<string, PipelineStage.FacetPipelineStage[]> = {};
        for (const cohort of cohorts) {
            const cohortKey = `${cohort.filterBy}_${cohort.value}`.replace(/\s/g, '_');
            facetPipelines[cohortKey] = [
                { $match: { [cohort.filterBy]: cohort.value } },
                { $lookup: { from: 'metrics', localField: '_id', foreignField: 'user', as: 'metrics' } },
                { $unwind: '$metrics' },
                { $replaceRoot: { newRoot: '$metrics' } },
                { $match: { [metricPath]: { $exists: true, $ne: null } } },
                { 
                    $group: {
                        _id: null,
                        avgMetricValue: { $avg: `$${metricPath}` },
                        userCount: { $addToSet: '$user' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        cohortName: { $concat: [cohort.filterBy, ": ", cohort.value] },
                        avgMetricValue: 1,
                        userCount: { $size: '$userCount' }
                    }
                }
            ];
        }

        const aggregationPipeline: PipelineStage[] = [{ $facet: facetPipelines }];
        
        logger.info(`${TAG} Executando agregação para comparação de coortes.`);
        const results = await UserModel.aggregate(aggregationPipeline);

        const flattenedResults = Object.values(results[0] || {}).flat();
        
        // CORREÇÃO: Adicionada aserção de tipo para os resultados da agregação.
        return (flattenedResults as ICohortComparisonResult[]).sort((a, b) => b.avgMetricValue - a.avgMetricValue);

    } catch (error: any) {
        logger.error(`${TAG} Erro ao comparar coortes:`, error);
        throw new DatabaseError(`Falha ao comparar coortes de usuários: ${error.message}`);
    }
}


// --- Interfaces for Creator Time Series Data ---
export interface IFetchCreatorTimeSeriesArgs {
  creatorId: string; // Should be Types.ObjectId compatible string
  metric: 'post_count' | 'avg_engagement_rate' | 'avg_likes' | 'avg_shares' | 'total_interactions'; // Extendable
  period: 'monthly' | 'weekly';
  dateRange: { startDate: Date; endDate: Date };
}

export interface ICreatorTimeSeriesDataPoint {
  date: Date; // Represents the start of the period
  value: number;
}

/**
 * @function fetchCreatorTimeSeriesData
 * @description Fetches time series data for a specific creator and metric.
 * @param {IFetchCreatorTimeSeriesArgs} args - Arguments for fetching time series data.
 * @returns {Promise<ICreatorTimeSeriesDataPoint[]>} - Array of time series data points.
 */
export async function fetchCreatorTimeSeriesData(
  args: IFetchCreatorTimeSeriesArgs
): Promise<ICreatorTimeSeriesDataPoint[]> {
  const TAG = `${SERVICE_TAG}[fetchCreatorTimeSeriesData]`;
  logger.info(`${TAG} Fetching time series data for creator ${args.creatorId}, metric: ${args.metric}, period: ${args.period}`);

  try {
    await connectToDatabase();

    if (!Types.ObjectId.isValid(args.creatorId)) {
      logger.warn(`${TAG} Invalid creatorId: ${args.creatorId}`);
      throw new Error('Invalid creatorId format.'); // Or return empty array, depending on desired strictness
    }
    const creatorObjectId = new Types.ObjectId(args.creatorId);

    let metricFieldPath: string | null = null;
    let accumulator: string | null = null;
    let needsNonNullCheck = true; // Most metrics require the field to exist and not be null

    switch (args.metric) {
      case 'post_count':
        accumulator = '$sum';
        metricFieldPath = null; // For $sum: 1
        needsNonNullCheck = false; // post_count does not depend on a specific field value being non-null
        break;
      case 'avg_engagement_rate':
        accumulator = '$avg';
        metricFieldPath = '$stats.engagement_rate_on_reach';
        break;
      case 'avg_likes':
        accumulator = '$avg';
        metricFieldPath = '$stats.likes';
        break;
      case 'avg_shares':
        accumulator = '$avg';
        metricFieldPath = '$stats.shares';
        break;
      case 'total_interactions':
        accumulator = '$sum';
        metricFieldPath = '$stats.total_interactions';
        break;
      default:
        logger.warn(`${TAG} Unsupported metric: ${args.metric}`);
        throw new Error(`Unsupported metric: ${args.metric}`);
    }

    const matchStage: PipelineStage.Match = {
      $match: {
        user: creatorObjectId,
        postDate: {
          $gte: args.dateRange.startDate,
          $lte: args.dateRange.endDate,
        },
      },
    };
    // Add non-null check for averageable metrics
    if (needsNonNullCheck && metricFieldPath && metricFieldPath.startsWith('$')) {
        // Remove '$' for field path in $match
        matchStage.$match[metricFieldPath.substring(1)] = { $exists: true, $ne: null };
    }


    let groupId: any;
    let dateProjection: any;

    if (args.period === 'monthly') {
      groupId = {
        year: { $year: '$postDate' },
        month: { $month: '$postDate' },
      };
      dateProjection = {
        $dateFromParts: {
          year: '$_id.year',
          month: '$_id.month',
          day: 1,
        },
      };
    } else { // weekly
      groupId = {
        year: { $isoWeekYear: '$postDate' },
        week: { $isoWeek: '$postDate' },
      };
      dateProjection = {
        $dateFromParts: {
          isoWeekYear: '$_id.year',
          isoWeek: '$_id.week',
          isoDayOfWeek: 1, // Monday
        },
      };
    }

    const groupStage: PipelineStage.Group = {
      $group: {
        _id: groupId,
        rawValue: accumulator === '$sum' && !metricFieldPath
            ? { $sum: 1 }
            : { [accumulator!]: metricFieldPath } ,
      },
    };

    const sortKey = args.period === 'monthly' ? { '_id.year': 1, '_id.month': 1 } : { '_id.year': 1, '_id.week': 1 };
    const sortStage: PipelineStage.Sort = { $sort: sortKey };

    const projectStage: PipelineStage.Project = {
      $project: {
        _id: 0,
        date: dateProjection,
        value: '$rawValue',
      },
    };

    // For metrics like engagement rate, we might want to round the value
    if (args.metric === 'avg_engagement_rate') {
        projectStage.$project.value = { $round: ['$rawValue', 4] }; // Example: round to 4 decimal places
    } else if (args.metric !== 'post_count' && accumulator === '$avg') { // Other averages
        projectStage.$project.value = { $round: ['$rawValue', 2] }; // Example: round to 2 decimal places for likes/shares avg
    }


    const pipeline: PipelineStage[] = [matchStage, groupStage, sortStage, projectStage];
    logger.debug(`${TAG} Aggregation pipeline: ${JSON.stringify(pipeline)}`);

    const results = await MetricModel.aggregate(pipeline);
    return results as ICreatorTimeSeriesDataPoint[];

  } catch (error: any) {
    logger.error(`${TAG} Error fetching time series data:`, error);
    throw new DatabaseError(`Failed to fetch time series data: ${error.message}`);
  }
}


// --- Helper function to map TopMoverMetric to actual DB field names ---
// This assumes DailyMetricSnapshotModel stores fields like 'cumulative_likes', etc.
// Adjust if field names in the model are different (e.g. camelCase or with 'stats.' prefix)
function mapMetricToDbField(metric: TopMoverMetric): string {
    // Example: if your TopMoverMetric is 'cumulativeLikes' but DB field is 'cumulative_likes'
    // if (metric === 'cumulativeLikes') return 'cumulative_likes';
    // For now, assuming they are the same or direct mapping:
    return metric;
}


// --- Interfaces for Segment Performance Data ---
export interface ISegmentDefinition { // Also used by Top Movers for contentFilters
  format?: string;
  proposal?: string;
  context?: string;
}

export interface IFetchSegmentPerformanceArgs {
  criteria: ISegmentDefinition;
  dateRange: { startDate: Date; endDate: Date };
}

export interface ISegmentPerformanceResult {
  postCount: number;
  avgEngagementRate: number;
  avgLikes: number;
  avgShares: number;
  avgComments: number;
  // avgViews?: number; // Optional, or default to 0 if always included
}


// --- Interfaces for Top Movers Data ---
export interface IPeriod {
  startDate: Date;
  endDate: Date;
}

export type TopMoverEntityType = 'content' | 'creator';

// Assuming these are fields directly available in DailyMetricSnapshotModel or can be derived/mapped
// These should align with fields in DailyMetricSnapshotModel. For this example, using direct field names.
export type TopMoverMetric =
  | 'cumulative_views'
  | 'cumulative_likes'
  | 'cumulative_shares'
  | 'cumulative_comments'
  | 'cumulative_saves' // Assuming 'saves' exists
  | 'cumulative_reach' // Assuming 'reach' exists
  | 'cumulative_impressions' // Assuming 'impressions' exists
  | 'cumulative_total_interactions';
  // Note: 'engagement_rate' itself is often not cumulative but calculated per post.
  // If a cumulative or average engagement for a period is needed for a creator, it's a different calculation.
  // For 'content' movers based on engagement, it might be about change in a post's own rate if snapshots store that.
  // This interface currently focuses on cumulative metrics from DailyMetricSnapshotModel.

export type TopMoverSortBy =
  | 'absoluteChange_increase'
  | 'absoluteChange_decrease'
  | 'percentageChange_increase'
  | 'percentageChange_decrease';

// Minimal filters for creators for now, can be expanded
export interface ITopMoverCreatorFilters {
    planStatus?: string[];
    inferredExpertiseLevel?: string[];
}

export interface IFetchTopMoversArgs {
  entityType: TopMoverEntityType;
  metric: TopMoverMetric;
  currentPeriod: IPeriod;
  previousPeriod: IPeriod; // For comparison
  topN?: number;
  sortBy?: TopMoverSortBy;
  creatorFilters?: ITopMoverCreatorFilters; // Filters for entityType 'creator'
  contentFilters?: ISegmentDefinition;   // Filters for entityType 'content'
}

export interface ITopMoverResult {
  entityId: string; // ObjectId as string (contentId or creatorId)
  entityName: string; // Post description/title or Creator name
  profilePictureUrl?: string; // For creators
  metricName: TopMoverMetric; // The metric that was analyzed
  previousValue: number;
  currentValue: number;
  absoluteChange: number;
  percentageChange: number | null; // Null if previousValue was 0
}


/**
 * @function fetchTopMoversData
 * @description Fetches top moving content or creators based on metric changes between two periods.
 * @param {IFetchTopMoversArgs} args - Arguments defining the entity, metric, periods, and filters.
 * @returns {Promise<ITopMoverResult[]>} - An array of top mover results.
 */
export async function fetchTopMoversData(
  args: IFetchTopMoversArgs
): Promise<ITopMoverResult[]> {
  const TAG = `${SERVICE_TAG}[fetchTopMoversData]`;
  logger.info(`${TAG} Fetching top movers for entity: ${args.entityType}, metric: ${args.metric}`);

  try {
    await connectToDatabase();

    const {
      entityType,
      metric,
      currentPeriod,
      previousPeriod,
      topN = 10,
      sortBy = 'absoluteChange_decrease', // Default sort: biggest decreases
      creatorFilters,
      contentFilters,
    } = args;

    const mappedMetricField = mapMetricToDbField(metric);

    let results: ITopMoverResult[] = [];

    if (entityType === 'content') {
      // --- Logic for Content Top Movers (EXISTING, VERIFIED) ---
      let preFilteredPostIds: Types.ObjectId[] | null = null;
      if (contentFilters && (contentFilters.format || contentFilters.proposal || contentFilters.context)) {
        const filterQuery: any = {};
        if (contentFilters.format) filterQuery.format = contentFilters.format;
        if (contentFilters.proposal) filterQuery.proposal = contentFilters.proposal;
        if (contentFilters.context) filterQuery.context = contentFilters.context;

        logger.debug(`${TAG} [Content] Pre-filtering posts with criteria: ${JSON.stringify(filterQuery)}`);
        const matchingMetrics = await MetricModel.find(filterQuery).select('_id').lean();
        preFilteredPostIds = matchingMetrics.map(m => m._id);
        if (preFilteredPostIds.length === 0) {
          logger.info(`${TAG} [Content] No posts found matching contentFilters. Returning empty.`);
          return [];
        }
        logger.info(`${TAG} [Content] Found ${preFilteredPostIds.length} posts after pre-filtering.`);
      }

      const snapshotMatchContent: PipelineStage.Match['$match'] = {
        date: { $in: [previousPeriod.endDate, currentPeriod.endDate] },
        [mappedMetricField]: { $exists: true, $ne: null }
      };
      if (preFilteredPostIds) {
        snapshotMatchContent.metric = { $in: preFilteredPostIds };
      }

      const contentPipeline: PipelineStage[] = [
        { $match: snapshotMatchContent },
        { $sort: { metric: 1, date: 1 } },
        { $group: { _id: "$metric", values: { $push: { date: "$date", val: `$${mappedMetricField}` } } } },
        { $addFields: {
            previousValueData: { $let: { vars: { pd: { $filter: { input: "$values", cond: { $eq: ["$$this.date", previousPeriod.endDate] } } } }, in: { $arrayElemAt: ["$$pd", 0] }}},
            currentValueData: { $let: { vars: { cd: { $filter: { input: "$values", cond: { $eq: ["$$this.date", currentPeriod.endDate] } } } }, in: { $arrayElemAt: ["$$cd", 0] }}}
        }},
        { $addFields: { previousValue: { $ifNull: ["$previousValueData.val", 0] }, currentValue: { $ifNull: ["$currentValueData.val", 0] }}},
        { $match: { $expr: { $ne: ["$previousValue", "$currentValue"] } } }, // Keep only actual movers
        { $addFields: {
            absoluteChange: { $subtract: ["$currentValue", "$previousValue"] },
            percentageChange: { $cond: { if: { $eq: ["$previousValue", 0] }, then: null, else: { $divide: [{ $subtract: ["$currentValue", "$previousValue"] }, "$previousValue"] }}}
        }},
      ];

      let sortStageContent: PipelineStage.Sort | null = null;
      switch(sortBy) {
          case 'absoluteChange_increase': sortStageContent = { $sort: { absoluteChange: -1 } }; break;
          case 'absoluteChange_decrease': sortStageContent = { $sort: { absoluteChange: 1 } }; break;
          case 'percentageChange_increase': sortStageContent = { $sort: { percentageChange: -1 } }; break;
          case 'percentageChange_decrease': sortStageContent = { $sort: { percentageChange: 1 } }; break;
      }
      if (sortStageContent) contentPipeline.push(sortStageContent);
      contentPipeline.push({ $limit: topN });
      contentPipeline.push(
        { $lookup: { from: 'metrics', localField: '_id', foreignField: '_id', as: 'metricInfo' }},
        { $unwind: { path: '$metricInfo', preserveNullAndEmptyArrays: true } }
      );

      logger.debug(`${TAG} [Content] Pipeline: ${JSON.stringify(contentPipeline)}`);
      const aggregatedContentMovers = await DailyMetricSnapshotModel.aggregate(contentPipeline);
      results = aggregatedContentMovers.map(mover => ({
        entityId: mover._id.toString(),
        entityName: mover.metricInfo?.description || mover.metricInfo?.text_content || `Post ID: ${mover._id.toString().slice(-5)}`,
        metricName: metric,
        previousValue: mover.previousValue,
        currentValue: mover.currentValue,
        absoluteChange: mover.absoluteChange,
        percentageChange: mover.percentageChange,
      }));

    } else { // entityType === 'creator'
      // --- Logic for Creator Top Movers ---
      let targetCreatorIds: Types.ObjectId[] | undefined = undefined;
      if (creatorFilters && (creatorFilters.planStatus?.length || creatorFilters.inferredExpertiseLevel?.length)) {
          const userMatchFilters: any = {};
          if (creatorFilters.planStatus?.length) userMatchFilters.planStatus = { $in: creatorFilters.planStatus };
          if (creatorFilters.inferredExpertiseLevel?.length) userMatchFilters.inferredExpertiseLevel = { $in: creatorFilters.inferredExpertiseLevel };

          logger.debug(`${TAG} [Creator] Pre-filtering creators with: ${JSON.stringify(userMatchFilters)}`);
          const filteredUsers = await UserModel.find(userMatchFilters).select('_id').lean();
          targetCreatorIds = filteredUsers.map(u => u._id);
          if (targetCreatorIds.length === 0) {
              logger.info(`${TAG} [Creator] No users found matching creatorFilters. Returning empty.`);
              return [];
          }
          logger.info(`${TAG} [Creator] Found ${targetCreatorIds.length} users after pre-filtering.`);
      }

      const creatorPipeline: PipelineStage[] = [
        // Stage 1: Match relevant snapshots by date and metric existence
        { $match: {
            date: { $in: [previousPeriod.endDate, currentPeriod.endDate] },
            [mappedMetricField]: { $exists: true, $ne: null }
        }},
        // Stage 2: Lookup MetricModel to get the user (creatorId) for each snapshot
        { $lookup: {
            from: 'metrics',
            localField: 'metric', // metric in DailyMetricSnapshot is the _id of a post in MetricModel
            foreignField: '_id',
            as: 'metricInfo',
            pipeline: [{ $project: { _id: 0, user: 1 } }] // Only need the user field
        }},
        { $unwind: { path: "$metricInfo", preserveNullAndEmptyArrays: false } }, // Exclude snapshots without a valid linked metric/user
        // Stage 3: Conditional $match if targetCreatorIds are specified from pre-filtering
      ];
      if (targetCreatorIds && targetCreatorIds.length > 0) {
          creatorPipeline.push({ $match: { 'metricInfo.user': { $in: targetCreatorIds } } });
      }
      // Stage 4: Group by creator and date to sum the metric for all their posts
      creatorPipeline.push({
        $group: {
          _id: { creatorId: "$metricInfo.user", date: "$date" },
          totalValueOnDate: { $sum: `$${mappedMetricField}` }
        }
      });
      // Stage 5: Group again by creatorId to pivot dates and collect previous/current values
      creatorPipeline.push({
        $group: {
          _id: "$_id.creatorId", // This is the actual creatorId
          periodValues: { $push: { date: "$_id.date", val: "$totalValueOnDate" } }
        }
      });
      // Stage 6 & 7: Extract previousValue and currentValue, default to 0
      creatorPipeline.push(
        { $addFields: {
            previousValueData: { $let: { vars: { pd: { $filter: { input: "$periodValues", cond: { $eq: ["$$this.date", previousPeriod.endDate] } } } }, in: { $arrayElemAt: ["$$pd", 0] }}},
            currentValueData: { $let: { vars: { cd: { $filter: { input: "$periodValues", cond: { $eq: ["$$this.date", currentPeriod.endDate] } } } }, in: { $arrayElemAt: ["$$cd", 0] }}}
        }},
        { $addFields: {
            previousValue: { $ifNull: ["$previousValueData.val", 0] },
            currentValue: { $ifNull: ["$currentValueData.val", 0] }
        }}
      );
      // Stage 8: Filter out non-movers
      creatorPipeline.push({ $match: { $expr: { $ne: ["$previousValue", "$currentValue"] } } });
      // Stage 9: Calculate changes
      creatorPipeline.push({ $addFields: {
        absoluteChange: { $subtract: ["$currentValue", "$previousValue"] },
        percentageChange: { $cond: { if: { $eq: ["$previousValue", 0] }, then: null, else: { $divide: [{ $subtract: ["$currentValue", "$previousValue"] }, "$previousValue"] }}}
      }});
      // Stage 10: Sort
      let sortStageCreator: PipelineStage.Sort | null = null;
      switch(sortBy) {
          case 'absoluteChange_increase': sortStageCreator = { $sort: { absoluteChange: -1 } }; break;
          case 'absoluteChange_decrease': sortStageCreator = { $sort: { absoluteChange: 1 } }; break;
          case 'percentageChange_increase': sortStageCreator = { $sort: { percentageChange: -1 } }; break;
          case 'percentageChange_decrease': sortStageCreator = { $sort: { percentageChange: 1 } }; break;
      }
      if (sortStageCreator) creatorPipeline.push(sortStageCreator);
      // Stage 11: Limit
      creatorPipeline.push({ $limit: topN });
      // Stage 12 & 13: Lookup to UserModel for creator details
      creatorPipeline.push(
        { $lookup: {
            from: 'users',
            localField: '_id', // creatorId
            foreignField: '_id',
            as: 'creatorDetails',
            pipeline: [{ $project: { _id: 0, name: 1, profile_picture_url: 1 } }] // Select only needed fields
        }},
        { $unwind: { path: "$creatorDetails", preserveNullAndEmptyArrays: true } }
      );
      // Stage 14: Project to final ITopMoverResult shape
      creatorPipeline.push({
        $project: {
          _id: 0, // Exclude the default _id from this stage
          entityId: { $toString: "$_id" }, // Ensure it's a string
          entityName: { $ifNull: ["$creatorDetails.name", "Criador Desconhecido"] },
          profilePictureUrl: "$creatorDetails.profile_picture_url",
          metricName: metric, // from args
          previousValue: 1,
          currentValue: 1,
          absoluteChange: 1,
          percentageChange: 1,
        }
      });

      logger.debug(`${TAG} [Creator] Pipeline: ${JSON.stringify(creatorPipeline)}`);
      const aggregatedCreatorMovers = await DailyMetricSnapshotModel.aggregate(creatorPipeline);
      results = aggregatedCreatorMovers as ITopMoverResult[]; // Cast, assuming projection matches
    }

    return results;

  } catch (error: any) {
    logger.error(`${TAG} Error fetching top movers data:`, error);
    throw new DatabaseError(`Failed to fetch top movers data: ${error.message}`);
  }
}


/**
 * @function fetchSegmentPerformanceData
 * @description Fetches aggregated performance metrics for a specific content segment.
 * @param {IFetchSegmentPerformanceArgs} args - Arguments defining the segment and date range.
 * @returns {Promise<ISegmentPerformanceResult>} - Aggregated performance data for the segment.
 */
export async function fetchSegmentPerformanceData(
  args: IFetchSegmentPerformanceArgs
): Promise<ISegmentPerformanceResult> {
  const TAG = `${SERVICE_TAG}[fetchSegmentPerformanceData]`;
  logger.info(`${TAG} Fetching performance data for segment: ${JSON.stringify(args.criteria)} within date range: ${args.dateRange.startDate} - ${args.dateRange.endDate}`);

  try {
    await connectToDatabase();

    const { criteria, dateRange } = args;
    const matchQuery: PipelineStage.Match['$match'] = {
      postDate: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      },
      // Ensure fields for averaging exist and are not null to prevent errors/skewed results
      'stats.engagement_rate_on_reach': { $exists: true, $ne: null },
      'stats.likes': { $exists: true, $ne: null },
      'stats.shares': { $exists: true, $ne: null },
      'stats.comments': { $exists: true, $ne: null },
      // 'stats.views': { $exists: true, $ne: null }, // If avgViews is included
    };

    if (criteria.format && criteria.format.trim() !== '') {
      matchQuery.format = criteria.format;
    }
    if (criteria.proposal && criteria.proposal.trim() !== '') {
      matchQuery.proposal = criteria.proposal;
    }
    if (criteria.context && criteria.context.trim() !== '') {
      matchQuery.context = criteria.context;
    }

    const aggregationPipeline: PipelineStage[] = [
      { $match: matchQuery },
      {
        $group: {
          _id: null, // Group all matched documents into a single result
          postCount: { $sum: 1 },
          avgEngagementRate: { $avg: "$stats.engagement_rate_on_reach" },
          avgLikes: { $avg: "$stats.likes" },
          avgShares: { $avg: "$stats.shares" },
          avgComments: { $avg: "$stats.comments" },
          // avgViews: { $avg: "$stats.views" }, // If avgViews is included
        }
      },
      {
        $project: {
          _id: 0,
          postCount: { $ifNull: ["$postCount", 0] }, // Ensure postCount is 0 if group stage yields no doc
          avgEngagementRate: { $ifNull: ["$avgEngagementRate", 0] },
          avgLikes: { $ifNull: ["$avgLikes", 0] },
          avgShares: { $ifNull: ["$avgShares", 0] },
          avgComments: { $ifNull: ["$avgComments", 0] },
          // avgViews: { $ifNull: ["$avgViews", 0] }, // If avgViews is included
        }
      }
    ];

    logger.debug(`${TAG} Aggregation pipeline: ${JSON.stringify(aggregationPipeline)}`);
    const results = await MetricModel.aggregate(aggregationPipeline);

    if (results.length > 0) {
      logger.info(`${TAG} Successfully fetched segment performance data.`);
      return results[0] as ISegmentPerformanceResult; // The $project stage ensures fields match
    } else {
      logger.info(`${TAG} No data found for the specified segment. Returning default zeroed values.`);
      // Return default zeroed result if no documents matched the criteria
      return {
        postCount: 0,
        avgEngagementRate: 0,
        avgLikes: 0,
        avgShares: 0,
        avgComments: 0,
        // avgViews: 0, // If avgViews is included
      };
    }

  } catch (error: any) {
    logger.error(`${TAG} Error fetching segment performance data:`, error);
    throw new DatabaseError(`Failed to fetch segment performance data: ${error.message}`);
  }
}
