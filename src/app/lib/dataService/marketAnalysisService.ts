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
export interface IGlobalPostResult extends IMetric { creatorName?: string; }
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
    planStatus?: string[]; // Array de status, ex: ['Free', 'Pro']
    expertiseLevel?: string[]; // Array de níveis, ex: ['Iniciante', 'Avançado']
    minTotalPosts?: number;
    minFollowers?: number; // Supondo que 'followers' é um campo em User
  };
}

export interface IDashboardCreator {
  _id: Types.ObjectId; // ID do usuário
  name: string;
  email?: string; // Opcional, dependendo da necessidade de exposição
  planStatus?: string;
  inferredExpertiseLevel?: string;
  totalPosts: number;
  lastActivityDate?: Date;
  avgEngagementRate: number;
  avgLikes: number;
  avgShares: number;
  // Campos adicionais conforme necessário
  followers?: number; // Exemplo se tivermos contagem de seguidores
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
              avgEngagement: { $avg: '$stats.engagement_rate_on_reach' },
            },
          },
          { $project: { _id: 0, format: '$_id', count: 1, avgEngagement: { $ifNull: ['$avgEngagement', 0] } } },
          { $sort: { count: -1 } },
        ],
        // Breakdown por proposta
        breakdownByProposal: [
          { $match: { proposal: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$proposal',
              count: { $sum: 1 },
              avgEngagement: { $avg: '$stats.engagement_rate_on_reach' },
            },
          },
          { $project: { _id: 0, proposal: '$_id', count: 1, avgEngagement: { $ifNull: ['$avgEngagement', 0] } } },
          { $sort: { count: -1 } },
        ],
        // Breakdown por contexto
        breakdownByContext: [
          { $match: { context: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$context',
              count: { $sum: 1 },
              avgEngagement: { $avg: '$stats.engagement_rate_on_reach' },
            },
          },
          { $project: { _id: 0, context: '$_id', count: 1, avgEngagement: { $ifNull: ['$avgEngagement', 0] } } },
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
  breakdownByFormat: { format: string; count: number; avgEngagement: number }[];
  breakdownByProposal: { proposal: string; count: number; avgEngagement: number }[];
  breakdownByContext: { context: string; count: number; avgEngagement: number }[];
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
    if (filters.planStatus && filters.planStatus.length > 0) {
      userMatchStage.planStatus = { $in: filters.planStatus };
    }
    if (filters.expertiseLevel && filters.expertiseLevel.length > 0) {
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

    // Projeção final para formatar a saída
    aggregationPipeline.push({
      $project: {
        _id: 1,
        name: 1,
        email: 1, // Expor email se necessário e permitido
        planStatus: 1,
        inferredExpertiseLevel: 1,
        totalPosts: 1,
        lastActivityDate: 1,
        avgEngagementRate: { $ifNull: ['$avgEngagementRate', 0] },
        avgLikes: { $ifNull: ['$avgLikes', 0] },
        avgShares: { $ifNull: ['$avgShares', 0] },
        // followers: 1, // Incluir se o campo existir e for filtrado/sorteado
        // profilePictureUrl: 1, // Incluir se existir
      },
    });

    logger.debug(`${TAG} Pipeline de agregação para fetchDashboardCreatorsList: ${JSON.stringify(aggregationPipeline)}`);

    const creators = await UserModel.aggregate(aggregationPipeline);

    logger.info(`${TAG} Busca de criadores para dashboard concluída. Encontrados: ${creators.length}, Total: ${totalCreators}`);
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

        logger.debug(`${TAG} Pipeline de agregação para posts: ${JSON.stringify(postsPipeline)}`);
        const posts = await MetricModel.aggregate(postsPipeline);

        logger.info(`${TAG} Busca global encontrou ${posts.length} posts de um total de ${totalPosts}. Página: ${page}, Limite: ${limit}`);

        return {
            posts: posts as IGlobalPostResult[],
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
