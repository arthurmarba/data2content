/**
 * @fileoverview Serviço para buscar dados relacionados ao dashboard de criadores.
 * @version 2.0.1
 * @description Corrigido erro de projeção mista (inclusão/exclusão) no MongoDB.
 */

import { PipelineStage, Types } from 'mongoose';
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
    if (params.agencyId) {
      userMatchStage.agency = new Types.ObjectId(params.agencyId);
    }
    if (filters.planStatus && Array.isArray(filters.planStatus) && filters.planStatus.length > 0) {
      userMatchStage.planStatus = { $in: filters.planStatus };
    }
    if (filters.expertiseLevel && Array.isArray(filters.expertiseLevel) && filters.expertiseLevel.length > 0) {
      userMatchStage.inferredExpertiseLevel = { $in: filters.expertiseLevel };
    }
    
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

    const sortStage: PipelineStage.Sort = { $sort: { [sortBy]: sortDirection } };
    aggregationPipeline.push(sortStage, { $skip: skip }, { $limit: limit });

    // ===== INÍCIO DA CORREÇÃO =====
    aggregationPipeline.push({
      $project: {
        // Apenas inclua os campos que você quer na resposta final.
        // Não adicione "metrics: 0". O MongoDB irá excluí-lo automaticamente
        // porque ele não foi explicitamente incluído nesta lista.
        _id: 1,
        name: 1,
        planStatus: 1,
        inferredExpertiseLevel: 1,
        totalPosts: 1,
        lastActivityDate: 1,
        avgEngagementRate: { $ifNull: ['$avgEngagementRate', 0] },
        profilePictureUrl: '$profilePictureUrl',
        followers_count: 1,
        alertHistory: 1,
      },
    });
    // ===== FIM DA CORREÇÃO =====

    logger.debug(`${TAG} Pipeline: ${JSON.stringify(aggregationPipeline)}`);
    let fetchedCreators: any[] = await UserModel.aggregate(aggregationPipeline);

    // Process alertHistory for each creator
    const creatorsWithAlertsSummary = fetchedCreators.map(creator => {
      const recentAlertsSummary: IDashboardCreator['recentAlertsSummary'] = {
        count: 0,
        alerts: [],
      };

      if (creator.alertHistory && Array.isArray(creator.alertHistory) && creator.alertHistory.length > 0) {
        const sortedAlerts = [...creator.alertHistory].sort((a, b) =>
          (b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime()) -
          (a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime())
        );

        const mostRecentAlerts = sortedAlerts.slice(0, 3);
        recentAlertsSummary.count = sortedAlerts.length;
        recentAlertsSummary.alerts = mostRecentAlerts.map(alert => ({
          type: alert.type || 'Unknown',
          date: alert.date instanceof Date ? alert.date : new Date(alert.date),
          message: alert.finalUserMessage || alert.message || undefined,
        }));
      }

      const { alertHistory, ...creatorFields } = creator;
      return {
        ...creatorFields,
        recentAlertsSummary,
      };
    });

    logger.info(`${TAG} Busca concluída e alertas processados. Encontrados: ${creatorsWithAlertsSummary.length}, Total: ${totalCreators}`);
    return { creators: creatorsWithAlertsSummary as IDashboardCreator[], totalCreators };

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
        aggregationPipeline.push({ $match: dateMatchStage });
    }

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

// --- Platform Summary KPI Service ---

export interface IPlatformSummaryArgs {
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

export interface IPlatformSummaryData {
  totalCreators: number;
  pendingCreators: number;
  activeCreatorsInPeriod: number;
  averageEngagementRateInPeriod: number;
  averageReachInPeriod: number;
}

const PLATFORM_SUMMARY_TAG = `${SERVICE_TAG}[fetchPlatformSummary]`;

export async function fetchPlatformSummary(args: IPlatformSummaryArgs = {}): Promise<IPlatformSummaryData> {
  logger.info(`${PLATFORM_SUMMARY_TAG} Iniciando busca de resumo da plataforma com args: ${JSON.stringify(args)}`);

  try {
    await connectToDatabase();
    const { dateRange } = args;

    // 1. Total Creators
    const totalCreators = await UserModel.countDocuments({});
    logger.info(`${PLATFORM_SUMMARY_TAG} Total de criadores: ${totalCreators}`);

    // 2. Pending Creators
    const pendingCreators = await UserModel.countDocuments({ status: 'PENDING_APPROVAL' });
    logger.info(`${PLATFORM_SUMMARY_TAG} Criadores pendentes: ${pendingCreators}`);

    // 3. Period-specific metrics
    let activeCreatorsInPeriod = 0;
    let averageEngagementRateInPeriod = 0;
    let averageReachInPeriod = 0;

    const dateMatchCriteria: PipelineStage.Match['$match'] = {};
    if (dateRange?.startDate && dateRange?.endDate) {
      const endOfDay = new Date(dateRange.endDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      dateMatchCriteria.postDate = {
        $gte: new Date(dateRange.startDate),
        $lte: endOfDay
      };
      logger.info(`${PLATFORM_SUMMARY_TAG} Critério de data para métricas de período: ${JSON.stringify(dateMatchCriteria.postDate)}`);

      const distinctUsers = await MetricModel.distinct('user', dateMatchCriteria);
      activeCreatorsInPeriod = distinctUsers.length;
      logger.info(`${PLATFORM_SUMMARY_TAG} Criadores ativos no período: ${activeCreatorsInPeriod}`);

      const engagementPipeline: PipelineStage[] = [
        { $match: { ...dateMatchCriteria, 'stats.engagement_rate_on_reach': { $exists: true, $ne: null, $type: "number" } } },
        { $group: { _id: null, avgEngagement: { $avg: '$stats.engagement_rate_on_reach' } } },
        { $project: { _id: 0, avgEngagement: { $ifNull: ['$avgEngagement', 0] } } }
      ];
      const engagementResult = await MetricModel.aggregate(engagementPipeline);
      averageEngagementRateInPeriod = engagementResult[0]?.avgEngagement || 0;
      averageEngagementRateInPeriod = parseFloat(averageEngagementRateInPeriod.toFixed(4));
      logger.info(`${PLATFORM_SUMMARY_TAG} Taxa de engajamento média no período: ${averageEngagementRateInPeriod}`);

      const reachPipeline: PipelineStage[] = [
        { $match: { ...dateMatchCriteria, 'stats.reach': { $exists: true, $ne: null, $type: "number" } } },
        { $group: { _id: null, avgReach: { $avg: '$stats.reach' } } },
        { $project: { _id: 0, avgReach: { $ifNull: ['$avgReach', 0] } } }
      ];
      const reachResult = await MetricModel.aggregate(reachPipeline);
      averageReachInPeriod = reachResult[0]?.avgReach || 0;
      averageReachInPeriod = parseFloat(averageReachInPeriod.toFixed(0));
      logger.info(`${PLATFORM_SUMMARY_TAG} Alcance médio no período: ${averageReachInPeriod}`);

    } else {
      logger.info(`${PLATFORM_SUMMARY_TAG} Nenhum intervalo de datas fornecido; métricas de período serão 0.`);
    }

    return {
      totalCreators,
      pendingCreators,
      activeCreatorsInPeriod,
      averageEngagementRateInPeriod,
      averageReachInPeriod,
    };

  } catch (error: any) {
    logger.error(`${PLATFORM_SUMMARY_TAG} Erro ao buscar resumo da plataforma:`, error);
    throw new DatabaseError(`Falha ao buscar resumo da plataforma: ${error.message}`);
  }
}