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
  const { dateRange, limit = 5, offset = 0 } = params;
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
      { $skip: offset },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'creatorDetails',
          pipeline: [{ $project: { name: 1, profile_picture_url: 1, isInstagramConnected: 1 } }]
        }
      },
      { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } },
      { $match: { 'creatorDetails.isInstagramConnected': true } },
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
  const { dateRange, limit = 5, offset = 0 } = params;
   logger.info(`${TAG} Fetching for period: ${dateRange.startDate} - ${dateRange.endDate}`);

  try {
    await connectToDatabase();
    const pipeline: PipelineStage[] = [
      { $match: { postDate: { $gte: dateRange.startDate, $lte: dateRange.endDate } } },
      { $group: { _id: '$user', metricValue: { $sum: 1 } }},
      { $sort: { metricValue: -1 } },
      { $skip: offset },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'creatorDetails',
          pipeline: [{ $project: { name: 1, profile_picture_url: 1, isInstagramConnected: 1 } }]
        }
      },
      { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } },
      { $match: { 'creatorDetails.isInstagramConnected': true } },
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
    const { dateRange, limit = 5, offset = 0 } = params;
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
      { $skip: offset },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'creatorDetails',
          pipeline: [{ $project: { name: 1, profile_picture_url: 1, isInstagramConnected: 1 } }]
        }
      },
      { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } },
      { $match: { 'creatorDetails.isInstagramConnected': true } },
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
    const { dateRange, limit = 5, offset = 0 } = params;
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
      { $skip: offset },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'creatorDetails',
          pipeline: [{ $project: { name: 1, profile_picture_url: 1, isInstagramConnected: 1 } }]
        }
      },
      { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } },
      { $match: { 'creatorDetails.isInstagramConnected': true } },
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

/**
 * @function fetchAvgEngagementPerPostCreators
 * @description Ranks creators by their average interactions per post.
 */
export async function fetchAvgEngagementPerPostCreators(
  params: IFetchCreatorRankingParams
): Promise<ICreatorMetricRankItem[]> {
  const TAG = `${SERVICE_TAG}[fetchAvgEngagementPerPostCreators]`;
  const { dateRange, limit = 5, offset = 0 } = params;
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
      {
        $group: {
          _id: '$user',
          postCount: { $sum: 1 },
          totalInteractions: { $sum: '$stats.total_interactions' }
        }
      },
      { $match: { postCount: { $gte: 3 } } },
      {
        $addFields: {
          metricValue: { $divide: ['$totalInteractions', '$postCount'] }
        }
      },
      { $sort: { metricValue: -1 } },
      { $skip: offset },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'creatorDetails',
          pipeline: [{ $project: { name: 1, profile_picture_url: 1, isInstagramConnected: 1 } }]
        }
      },
      { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } },
      { $match: { 'creatorDetails.isInstagramConnected': true } },
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
    throw new DatabaseError(`Failed to fetch avg engagement per post creators: ${error.message}`);
  }
}

/**
 * @function fetchAvgReachPerPostCreators
 * @description Ranks creators by their average reach per post.
 */
export async function fetchAvgReachPerPostCreators(
  params: IFetchCreatorRankingParams
): Promise<ICreatorMetricRankItem[]> {
  const TAG = `${SERVICE_TAG}[fetchAvgReachPerPostCreators]`;
  const { dateRange, limit = 5, offset = 0 } = params;
  logger.info(`${TAG} Fetching for period: ${dateRange.startDate} - ${dateRange.endDate}`);

  try {
    await connectToDatabase();
    const pipeline: PipelineStage[] = [
      {
        $match: {
          postDate: { $gte: dateRange.startDate, $lte: dateRange.endDate },
          'stats.reach': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$user',
          postCount: { $sum: 1 },
          totalReach: { $sum: '$stats.reach' }
        }
      },
      { $match: { postCount: { $gte: 3 } } },
      {
        $addFields: {
          metricValue: { $divide: ['$totalReach', '$postCount'] }
        }
      },
      { $sort: { metricValue: -1 } },
      { $skip: offset },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'creatorDetails',
          pipeline: [{ $project: { name: 1, profile_picture_url: 1, isInstagramConnected: 1 } }]
        }
      },
      { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } },
      { $match: { 'creatorDetails.isInstagramConnected': true } },
      {
        $project: {
          _id: 0,
          creatorId: '$_id',
          creatorName: { $ifNull: ['$creatorDetails.name', 'Unknown Creator'] },
          profilePictureUrl: '$creatorDetails.profile_picture_url',
          metricValue: { $round: ['$metricValue', 0] }
        }
      }
    ];
    const results = await MetricModel.aggregate(pipeline);
    logger.info(`${TAG} Found ${results.length} creators.`);
    return results as ICreatorMetricRankItem[];
  } catch (error: any) {
    logger.error(`${TAG} Error:`, error);
    throw new DatabaseError(`Failed to fetch avg reach per post creators: ${error.message}`);
  }
}

/**
 * @function fetchEngagementVariationCreators
 * @description Ranks creators by percentage change in total interactions compared to the previous period.
 */
export async function fetchEngagementVariationCreators(
  params: IFetchCreatorRankingParams
): Promise<ICreatorMetricRankItem[]> {
  const TAG = `${SERVICE_TAG}[fetchEngagementVariationCreators]`;
  const { dateRange, limit = 5, offset = 0 } = params;
  logger.info(`${TAG} Fetching for period: ${dateRange.startDate} - ${dateRange.endDate}`);

  const periodMs = dateRange.endDate.getTime() - dateRange.startDate.getTime();
  const previousStart = new Date(dateRange.startDate.getTime() - periodMs - 86400000);
  const previousEnd = new Date(dateRange.startDate.getTime() - 86400000);

  try {
    await connectToDatabase();
    const pipeline: PipelineStage[] = [
      {
        $match: {
          postDate: { $gte: previousStart, $lte: dateRange.endDate },
          'stats.total_interactions': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$user',
          currentTotal: {
            $sum: {
              $cond: [
                { $and: [ { $gte: ['$postDate', dateRange.startDate] }, { $lte: ['$postDate', dateRange.endDate] } ] },
                '$stats.total_interactions',
                0
              ]
            }
          },
          previousTotal: {
            $sum: {
              $cond: [
                { $and: [ { $gte: ['$postDate', previousStart] }, { $lte: ['$postDate', previousEnd] } ] },
                '$stats.total_interactions',
                0
              ]
            }
          }
        }
      },
      { $match: { currentTotal: { $gte: 50 }, previousTotal: { $gte: 50 } } },
      {
        $addFields: {
          metricValue: {
            $multiply: [{ $divide: [{ $subtract: ['$currentTotal', '$previousTotal'] }, '$previousTotal'] }, 100]
          }
        }
      },
      { $sort: { metricValue: -1 } },
      { $skip: offset },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'creatorDetails',
          pipeline: [{ $project: { name: 1, profile_picture_url: 1, isInstagramConnected: 1 } }]
        }
      },
      { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } },
      { $match: { 'creatorDetails.isInstagramConnected': true } },
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
    throw new DatabaseError(`Failed to fetch engagement variation creators: ${error.message}`);
  }
}

/**
 * @function fetchPerformanceConsistencyCreators
 * @description Ranks creators by consistency of interactions per post (lower variability means higher score).
 */
export async function fetchPerformanceConsistencyCreators(
  params: IFetchCreatorRankingParams
): Promise<ICreatorMetricRankItem[]> {
  const TAG = `${SERVICE_TAG}[fetchPerformanceConsistencyCreators]`;
  const { dateRange, limit = 5, offset = 0 } = params;
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
      {
        $group: {
          _id: '$user',
          postCount: { $sum: 1 },
          avgInteractions: { $avg: '$stats.total_interactions' },
          stdDevInteractions: { $stdDevPop: '$stats.total_interactions' }
        }
      },
      { $match: { postCount: { $gte: 5 }, avgInteractions: { $gte: 50 } } },
      {
        $addFields: {
          cv: { $cond: [ { $eq: ['$avgInteractions', 0] }, null, { $divide: ['$stdDevInteractions', '$avgInteractions'] } ] }
        }
      },
      {
        $addFields: {
          metricValue: { $cond: [ { $eq: ['$cv', null] }, 0, { $divide: [1, { $add: ['$cv', 1] }] } ] }
        }
      },
      { $sort: { metricValue: -1 } },
      { $skip: offset },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'creatorDetails',
          pipeline: [{ $project: { name: 1, profile_picture_url: 1, isInstagramConnected: 1 } }]
        }
      },
      { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } },
      { $match: { 'creatorDetails.isInstagramConnected': true } },
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
    throw new DatabaseError(`Failed to fetch performance consistency creators: ${error.message}`);
  }
}

/**
 * @function fetchReachPerFollowerCreators
 * @description Ranks creators by total reach relative to follower count.
 */
export async function fetchReachPerFollowerCreators(
  params: IFetchCreatorRankingParams
): Promise<ICreatorMetricRankItem[]> {
  const TAG = `${SERVICE_TAG}[fetchReachPerFollowerCreators]`;
  const { dateRange, limit = 5, offset = 0 } = params;
  logger.info(`${TAG} Fetching for period: ${dateRange.startDate} - ${dateRange.endDate}`);

  try {
    await connectToDatabase();
    const pipeline: PipelineStage[] = [
      {
        $match: {
          postDate: { $gte: dateRange.startDate, $lte: dateRange.endDate },
          'stats.reach': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$user',
          postCount: { $sum: 1 },
          totalReach: { $sum: '$stats.reach' }
        }
      },
      { $match: { postCount: { $gte: 3 } } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'creatorDetails',
          pipeline: [{ $project: { name: 1, profile_picture_url: 1, followers_count: 1, isInstagramConnected: 1 } }]
        }
      },
      { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } },
      { $match: { 'creatorDetails.followers_count': { $gte: 1000 }, 'creatorDetails.isInstagramConnected': true } },
      {
        $addFields: {
          metricValue: { $divide: ['$totalReach', '$creatorDetails.followers_count'] }
        }
      },
      { $sort: { metricValue: -1 } },
      { $skip: offset },
      { $limit: limit },
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
    throw new DatabaseError(`Failed to fetch reach per follower creators: ${error.message}`);
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