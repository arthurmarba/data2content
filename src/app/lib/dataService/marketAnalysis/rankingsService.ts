/**
 * @fileoverview Serviço para buscar rankings de criadores e categorias.
 * @version 1.3.0
 * @description Tornada a função fetchTopCategories flexível para aceitar userId opcional (visão global vs. individual).
 */

import { PipelineStage, Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '../connection';
import { DatabaseError } from '@/app/lib/errors';
import {
  IFetchCreatorRankingParams,
  ICreatorMetricRankItem,
  ICategoryMetricRankItem,
  RankableCategory,
  CategoryRankingMetric
} from './types';

const SERVICE_TAG = '[dataService][rankingsService]';

// ... (as outras funções de ranking de criadores permanecem inalteradas) ...

/**
 * @function fetchTopEngagingCreators
 * @description Fetches creators ranked by engagement rate.
 * @param {IFetchCreatorRankingParams} params - Parameters including dateRange and limit.
 * @returns {Promise<ICreatorMetricRankItem[]>} - List of top engaging creators.
 */
export async function fetchTopEngagingCreators(
  params: IFetchCreatorRankingParams
): Promise<ICreatorMetricRankItem[]> {
  const TAG = `${SERVICE_TAG}[fetchTopEngagingCreators]`;
  const { dateRange, limit = 5 } = params;
  logger.info(`${TAG} Fetching for period: ${dateRange.startDate} - ${dateRange.endDate}`);

  try {
    await connectToDatabase();
    const pipeline: PipelineStage[] = [
      {
        $match: {
          postDate: { $gte: dateRange.startDate, $lte: dateRange.endDate },
          'stats.reach': { $exists: true, $ne: null, $gt: 0 },
          'stats.total_interactions': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$user',
          totalInteractions: { $sum: '$stats.total_interactions' },
          totalReach: { $sum: '$stats.reach' }
        }
      },
      { $match: { totalReach: { $gt: 0 } } },
      {
        $addFields: {
          metricValue: { $multiply: [{ $divide: ['$totalInteractions', '$totalReach'] }, 100] }
        }
      },
      { $sort: { metricValue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'creatorDetails',
          pipeline: [{ $project: { name: 1, profile_picture_url: 1 } }]
        }
      },
      { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          creatorId: '$_id',
          creatorName: { $ifNull: ['$creatorDetails.name', 'Unknown Creator'] },
          profilePictureUrl: '$creatorDetails.profile_picture_url',
          metricValue: { $round: ['$metricValue', 2] }
        }
      }
    ];
    const results = await MetricModel.aggregate(pipeline);
    logger.info(`${TAG} Found ${results.length} creators.`);
    return results as ICreatorMetricRankItem[];
  } catch (error: any) {
    logger.error(`${TAG} Error:`, error);
    throw new DatabaseError(`Failed to fetch top engaging creators: ${error.message}`);
  }
}

/**
 * @function fetchMostProlificCreators
 * @description Fetches creators ranked by the total number of posts.
 * @param {IFetchCreatorRankingParams} params - Parameters including dateRange and limit.
 * @returns {Promise<ICreatorMetricRankItem[]>} - List of most prolific creators.
 */
export async function fetchMostProlificCreators(
  params: IFetchCreatorRankingParams
): Promise<ICreatorMetricRankItem[]> {
  const TAG = `${SERVICE_TAG}[fetchMostProlificCreators]`;
  const { dateRange, limit = 5 } = params;
   logger.info(`${TAG} Fetching for period: ${dateRange.startDate} - ${dateRange.endDate}`);

  try {
    await connectToDatabase();
    const pipeline: PipelineStage[] = [
      { $match: { postDate: { $gte: dateRange.startDate, $lte: dateRange.endDate } } },
      { $group: { _id: '$user', metricValue: { $sum: 1 } }},
      { $sort: { metricValue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'creatorDetails',
          pipeline: [{ $project: { name: 1, profile_picture_url: 1 } }]
        }
      },
      { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          creatorId: '$_id',
          creatorName: { $ifNull: ['$creatorDetails.name', 'Unknown Creator'] },
          profilePictureUrl: '$creatorDetails.profile_picture_url',
          metricValue: 1
        }
      }
    ];
    const results = await MetricModel.aggregate(pipeline);
    logger.info(`${TAG} Found ${results.length} creators.`);
    return results as ICreatorMetricRankItem[];
  } catch (error: any) {
    logger.error(`${TAG} Error:`, error);
    throw new DatabaseError(`Failed to fetch most prolific creators: ${error.message}`);
  }
}

/**
 * @function fetchTopInteractionCreators
 * @description Fetches creators ranked by total interactions.
 * @param {IFetchCreatorRankingParams} params - Parameters including dateRange and limit.
 * @returns {Promise<ICreatorMetricRankItem[]>} - List of top interaction creators.
 */
export async function fetchTopInteractionCreators(
  params: IFetchCreatorRankingParams
): Promise<ICreatorMetricRankItem[]> {
    const TAG = `${SERVICE_TAG}[fetchTopInteractionCreators]`;
    const { dateRange, limit = 5 } = params;
    logger.info(`${TAG} Fetching for period: ${dateRange.startDate} - ${dateRange.endDate}`);

  try {
    await connectToDatabase();
    const pipeline: PipelineStage[] = [
      {
        $match: {
          postDate: { $gte: dateRange.startDate, $lte: dateRange.endDate },
          'stats.total_interactions': { $exists: true, $ne: null }
        }
      },
      { $group: { _id: '$user', metricValue: { $sum: '$stats.total_interactions' } }},
      { $sort: { metricValue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'creatorDetails',
          pipeline: [{ $project: { name: 1, profile_picture_url: 1 } }]
        }
      },
      { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          creatorId: '$_id',
          creatorName: { $ifNull: ['$creatorDetails.name', 'Unknown Creator'] },
          profilePictureUrl: '$creatorDetails.profile_picture_url',
          metricValue: 1
        }
      }
    ];
    const results = await MetricModel.aggregate(pipeline);
    logger.info(`${TAG} Found ${results.length} creators.`);
    return results as ICreatorMetricRankItem[];
  } catch (error: any) {
    logger.error(`${TAG} Error:`, error);
    throw new DatabaseError(`Failed to fetch top interaction creators: ${error.message}`);
  }
}

/**
 * @function fetchTopSharingCreators
 * @description Fetches creators ranked by total shares.
 * @param {IFetchCreatorRankingParams} params - Parameters including dateRange and limit.
 * @returns {Promise<ICreatorMetricRankItem[]>} - List of top sharing creators.
 */
export async function fetchTopSharingCreators(
  params: IFetchCreatorRankingParams
): Promise<ICreatorMetricRankItem[]> {
    const TAG = `${SERVICE_TAG}[fetchTopSharingCreators]`;
    const { dateRange, limit = 5 } = params;
    logger.info(`${TAG} Fetching for period: ${dateRange.startDate} - ${dateRange.endDate}`);

  try {
    await connectToDatabase();
    const pipeline: PipelineStage[] = [
      {
        $match: {
          postDate: { $gte: dateRange.startDate, $lte: dateRange.endDate },
          'stats.shares': { $exists: true, $ne: null }
        }
      },
      { $group: { _id: '$user', metricValue: { $sum: '$stats.shares' } }},
      { $sort: { metricValue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'creatorDetails',
          pipeline: [{ $project: { name: 1, profile_picture_url: 1 } }]
        }
      },
      { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          creatorId: '$_id',
          creatorName: { $ifNull: ['$creatorDetails.name', 'Unknown Creator'] },
          profilePictureUrl: '$creatorDetails.profile_picture_url',
          metricValue: 1
        }
      }
    ];
    const results = await MetricModel.aggregate(pipeline);
    logger.info(`${TAG} Found ${results.length} creators.`);
    return results as ICreatorMetricRankItem[];
  } catch (error: any) {
    logger.error(`${TAG} Error:`, error);
    throw new DatabaseError(`Failed to fetch top sharing creators: ${error.message}`);
  }
}



// --- (ATUALIZADO E FINALIZADO) Função genérica para ranking de categorias ---
/**
 * @function fetchTopCategories
 * @description Fetches a ranking for a given category. Can be global or for a specific user.
 * @param params - Parameters including dateRange, category, metric, limit, and an optional userId.
 * @returns {Promise<ICategoryMetricRankItem[]>} - List of top-ranking categories.
 */
export async function fetchTopCategories(params: {
  userId?: string; // (ALTERADO) userId agora é opcional
  dateRange: { startDate: Date; endDate: Date };
  category: RankableCategory;
  metric: CategoryRankingMetric;
  limit?: number;
}): Promise<ICategoryMetricRankItem[]> {
  const TAG = `${SERVICE_TAG}[fetchTopCategories]`;
  const { userId, dateRange, category, metric, limit = 5 } = params;
  logger.info(`${TAG} Fetching top ${limit} for category '${category}' by metric '${metric}'. User filter: ${userId || 'Global'}`);

  try {
    await connectToDatabase();

    const metricField = metric === 'posts' ? null : `$stats.${metric}`;
    const categoryField = `$${category}`;

    // (ALTERADO) Construção do filtro de forma dinâmica
    const matchFilter: any = {
      postDate: { $gte: dateRange.startDate, $lte: dateRange.endDate },
      [category]: { $exists: true, $ne: [] },
    };

    // Adiciona o filtro de usuário apenas se um userId for fornecido
    if (userId) {
      matchFilter.user = new Types.ObjectId(userId);
    }

    const pipeline: PipelineStage[] = [
      {
        $match: matchFilter
      },
      {
        $unwind: categoryField
      },
      {
        $group: {
          _id: categoryField,
          metricValue: metricField ? { $sum: metricField } : { $sum: 1 }
        }
      },
      {
        $sort: {
          metricValue: -1
        }
      },
      {
        $limit: limit
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          value: { $round: ['$metricValue', 0] }
        }
      }
    ];

    const results = await MetricModel.aggregate(pipeline);
    logger.info(`${TAG} Found ${results.length} results. User filter: ${userId || 'Global'}`);
    return results as ICategoryMetricRankItem[];
  } catch (error: any) {
    logger.error(`${TAG} Error:`, error);
    throw new DatabaseError(`Failed to fetch top categories: ${error.message}`);
  }
}