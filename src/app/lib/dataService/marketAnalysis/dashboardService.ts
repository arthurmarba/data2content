/**
 * @fileoverview Serviço para buscar dados relacionados ao dashboard de criadores.
 * @version 2.0.0
 * @description Adicionadas anotações de otimização de performance.
 */

import { PipelineStage } from 'mongoose';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '../connection';
import { DatabaseError } from '@/app/lib/errors';
import {
    IFetchDashboardCreatorsListParams,
    IDashboardCreator,
    IFetchDashboardOverallContentStatsFilters,
    IDashboardOverallStats
} from './types';

const SERVICE_TAG = '[dataService][dashboardService]';


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

    const { startDate, endDate } = filters;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const aggregationPipeline: PipelineStage[] = [];

    const userMatchStage: PipelineStage.Match['$match'] = {};
    if (filters.nameSearch) {
      userMatchStage.name = { $regex: filters.nameSearch, $options: 'i' };
    }
    if (filters.planStatus && Array.isArray(filters.planStatus) && filters.planStatus.length > 0) {
      userMatchStage.planStatus = { $in: filters.planStatus };
    }
    if (filters.expertiseLevel && Array.isArray(filters.expertiseLevel) && filters.expertiseLevel.length > 0) {
      userMatchStage.inferredExpertiseLevel = { $in: filters.expertiseLevel };
    }
    
    // OTIMIZAÇÃO: Para melhorar a performance, considere criar índices nos seguintes campos
    // da coleção 'users' que são usados para filtragem:
    // - Índices de texto em 'name' para otimizar buscas com $regex.
    // - Índices em 'planStatus' e 'inferredExpertiseLevel' para acelerar a filtragem por $in.
    if (Object.keys(userMatchStage).length > 0) {
        aggregationPipeline.push({ $match: userMatchStage });
    }

    aggregationPipeline.push(
      {
        $lookup: {
          from: 'metrics',
          localField: '_id',
          foreignField: 'user',
          as: 'metrics',
          pipeline: (() => {
            const metricsPipeline: PipelineStage.Match[] = [];
            const metricsMatchStage: PipelineStage.Match['$match'] = {};
            // OTIMIZAÇÃO: Um índice no campo 'metrics.postDate' é crucial para a performance
            // de consultas com intervalo de datas.
            if (startDate) {
              metricsMatchStage.postDate = { ...metricsMatchStage.postDate, $gte: new Date(startDate) };
            }
            if (endDate) {
              const endOfDay = new Date(endDate);
              endOfDay.setUTCHours(23, 59, 59, 999);
              metricsMatchStage.postDate = { ...metricsMatchStage.postDate, $lte: endOfDay };
            }
            if (Object.keys(metricsMatchStage).length > 0) {
              metricsPipeline.push({ $match: metricsMatchStage });
            }
            return metricsPipeline;
          })(),
        },
      },
      {
        $addFields: {
          totalPosts: { $size: '$metrics' },
          lastActivityDate: { $max: '$metrics.postDate' },
          avgEngagementRate: { $avg: '$metrics.stats.engagement_rate_on_reach' },
        },
      }
    );

    const postMetricsMatchStage: PipelineStage.Match['$match'] = {};
    if (typeof filters.minTotalPosts === 'number') {
        postMetricsMatchStage.totalPosts = { $gte: filters.minTotalPosts };
    }
    if (Object.keys(postMetricsMatchStage).length > 0) {
        aggregationPipeline.push({ $match: postMetricsMatchStage });
    }

    const countPipeline = [...aggregationPipeline, { $count: 'totalCreators' }];
    const totalCreatorsResult = await UserModel.aggregate(countPipeline);
    const totalCreators = totalCreatorsResult.length > 0 ? totalCreatorsResult[0].totalCreators : 0;

    // OTIMIZAÇÃO: A ordenação por campos calculados ('totalPosts', 'avgEngagementRate')
    // força o MongoDB a processar todo o conjunto de dados em memória. Para grandes volumes,
    // considere pré-calcular e armazenar estas métricas agregadas diretamente nos documentos dos utilizadores
    // e atualizá-las periodicamente. Isso permitiria a utilização de índices para a ordenação.
    const sortStage: PipelineStage.Sort = { $sort: { [sortBy]: sortDirection } };
    aggregationPipeline.push(sortStage, { $skip: skip }, { $limit: limit });

    aggregationPipeline.push({
      $project: {
        _id: 1,
        name: 1,
        planStatus: 1,
        inferredExpertiseLevel: 1,
        totalPosts: 1,
        lastActivityDate: 1,
        avgEngagementRate: { $ifNull: ['$avgEngagementRate', 0] },
        profilePictureUrl: '$profilePictureUrl',
        metrics: 0 // Remove o array de métricas para uma resposta mais leve
      },
    });

    logger.debug(`${TAG} Pipeline: ${JSON.stringify(aggregationPipeline)}`);
    const creators = await UserModel.aggregate(aggregationPipeline);

    logger.info(`${TAG} Busca concluída. Encontrados: ${creators.length}, Total: ${totalCreators}`);
    return { creators: creators as IDashboardCreator[], totalCreators };

  } catch (error: any) {
    logger.error(`${TAG} Erro ao buscar lista de criadores:`, error);
    throw new DatabaseError(`Falha ao buscar lista de criadores: ${error.message}`);
  }
}

/**
 * @function fetchDashboardOverallContentStats
 * @description Fetches overall content statistics for the dashboard.
 * @param {IFetchDashboardOverallContentStatsFilters} params - Filters for the statistics.
 * @returns {Promise<IDashboardOverallStats>} - Overall content statistics.
 */
export async function fetchDashboardOverallContentStats(
  params: IFetchDashboardOverallContentStatsFilters = {}
): Promise<IDashboardOverallStats> {
  const TAG = `${SERVICE_TAG}[fetchDashboardOverallContentStats]`;
  logger.info(`${TAG} Iniciando busca de estatísticas gerais com params: ${JSON.stringify(params)}`);

  try {
    await connectToDatabase();
    const { dateRange } = params;

    const dateMatchStage: PipelineStage.Match['$match'] = {};
    if (dateRange?.startDate) {
      dateMatchStage.postDate = { ...dateMatchStage.postDate, $gte: dateRange.startDate };
    }
    if (dateRange?.endDate) {
      dateMatchStage.postDate = { ...dateMatchStage.postDate, $lte: dateRange.endDate };
    }

    const aggregationPipeline: PipelineStage[] = [];
    if (Object.keys(dateMatchStage).length > 0) {
        // OTIMIZAÇÃO: Um índice em 'metrics.postDate' acelera significativamente esta consulta.
        aggregationPipeline.push({ $match: dateMatchStage });
    }

    // OTIMIZAÇÃO: As agregações em $facet são executadas em paralelo, o que é bom.
    // Para dashboards muito acedidos, considere armazenar em cache os resultados desta agregação
    // (ex: a cada hora) para evitar recálculos constantes.
    aggregationPipeline.push({
      $facet: {
        totalPlatformPosts: [{ $count: 'count' }],
        averagePlatformEngagementRate: [
          { $match: { 'stats.engagement_rate_on_reach': { $exists: true, $ne: null } } },
          { $group: { _id: null, avgEngagement: { $avg: '$stats.engagement_rate_on_reach' } } },
        ],
        totalContentCreators: [
          { $group: { _id: '$user' } },
          { $count: 'count' }
        ],
        breakdownByFormat: [
          { $match: { format: { $exists: true, $ne: null } } },
          { $group: { _id: '$format', count: { $sum: 1 }}},
          { $project: { _id: 0, format: '$_id', count: 1 } },
          { $sort: { count: -1 } },
        ],
        breakdownByProposal: [
          { $match: { proposal: { $exists: true, $ne: null } } },
          { $group: { _id: '$proposal', count: { $sum: 1 }}},
          { $project: { _id: 0, proposal: '$_id', count: 1 } },
          { $sort: { count: -1 } },
        ],
        breakdownByContext: [
          { $match: { context: { $exists: true, $ne: null } } },
          { $group: { _id: '$context', count: { $sum: 1 }}},
          { $project: { _id: 0, context: '$_id', count: 1 } },
          { $sort: { count: -1 } },
        ],
      },
    });

    logger.debug(`${TAG} Pipeline: ${JSON.stringify(aggregationPipeline)}`);
    const results = await MetricModel.aggregate(aggregationPipeline);
    const stats = results[0];

    const overallStats: IDashboardOverallStats = {
      totalPlatformPosts: stats.totalPlatformPosts[0]?.count || 0,
      averagePlatformEngagementRate: stats.averagePlatformEngagementRate[0]?.avgEngagement || 0,
      totalContentCreators: stats.totalContentCreators[0]?.count || 0,
      breakdownByFormat: stats.breakdownByFormat || [],
      breakdownByProposal: stats.breakdownByProposal || [],
      breakdownByContext: stats.breakdownByContext || [],
    };

    logger.info(`${TAG} Busca concluída.`);
    return overallStats;

  } catch (error: any) {
    logger.error(`${TAG} Erro ao buscar estatísticas gerais:`, error);
    throw new DatabaseError(`Falha ao buscar estatísticas gerais: ${error.message}`);
  }
}
