/**
 * @fileoverview Serviço para buscar os "top movers" (conteúdos ou criadores com maiores mudanças).
 * @version 1.1.0 - Adicionada coverUrl nos resultados para entidade 'content'.
 */

import { PipelineStage, Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric';
import UserModel from '@/app/models/User';
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot';
import { connectToDatabase } from '../connection';
import { DatabaseError } from '@/app/lib/errors';
import { IFetchTopMoversArgs, ITopMoverResult } from './types';
import { mapMetricToDbField } from './helpers';

const SERVICE_TAG = '[dataService][moversService]';

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
  logger.info(`${TAG} Fetching for entity: ${args.entityType}, metric: ${args.metric}`);

  try {
    await connectToDatabase();

    const {
      entityType,
      metric,
      currentPeriod,
      previousPeriod,
      topN = 10,
      sortBy = 'absoluteChange_decrease',
      creatorFilters,
      contentFilters,
      agencyId,
    } = args;

    const mappedMetricField = mapMetricToDbField(metric);
    let results: ITopMoverResult[] = [];

    if (entityType === 'content') {
      let preFilteredPostIds: Types.ObjectId[] | null = null;
      let userMongoIds: Types.ObjectId[] | null = null;
      if (agencyId) {
        const agencyUsers = await UserModel.find({ agency: agencyId }).select('_id').lean();
        userMongoIds = agencyUsers.map(u => u._id);
        if (userMongoIds.length === 0) return [];
      }

      if (contentFilters && (contentFilters.format || contentFilters.proposal || contentFilters.context || userMongoIds)) {
        const filterQuery: any = {};
        if (contentFilters.format) filterQuery.format = contentFilters.format;
        if (contentFilters.proposal) filterQuery.proposal = contentFilters.proposal;
        if (contentFilters.context) filterQuery.context = contentFilters.context;
        if (userMongoIds) filterQuery.user = { $in: userMongoIds };
        const matchingMetrics = await MetricModel.find(filterQuery).select('_id').lean();
        preFilteredPostIds = matchingMetrics.map(m => m._id);
        if (preFilteredPostIds.length === 0) return [];
      } else if (userMongoIds) {
        const matchingMetrics = await MetricModel.find({ user: { $in: userMongoIds } }).select('_id').lean();
        preFilteredPostIds = matchingMetrics.map(m => m._id);
        if (preFilteredPostIds.length === 0) return [];
      }

      const snapshotMatch: PipelineStage.Match['$match'] = {
        date: { $in: [previousPeriod.endDate, currentPeriod.endDate] },
        [mappedMetricField]: { $exists: true, $ne: null }
      };
      if (preFilteredPostIds) snapshotMatch.metric = { $in: preFilteredPostIds };

      const pipeline: PipelineStage[] = [
        { $match: snapshotMatch },
        { $sort: { metric: 1, date: 1 } },
        { $group: { _id: "$metric", values: { $push: { date: "$date", val: `$${mappedMetricField}` } } } },
        { $addFields: {
            previousValueData: { $arrayElemAt: [{ $filter: { input: "$values", cond: { $eq: ["$$this.date", previousPeriod.endDate] } } }, 0] },
            currentValueData: { $arrayElemAt: [{ $filter: { input: "$values", cond: { $eq: ["$$this.date", currentPeriod.endDate] } } }, 0] }
        }},
        { $addFields: { previousValue: { $ifNull: ["$previousValueData.val", 0] }, currentValue: { $ifNull: ["$currentValueData.val", 0] }}},
        { $match: { $expr: { $ne: ["$previousValue", "$currentValue"] } } },
        { $addFields: {
            absoluteChange: { $subtract: ["$currentValue", "$previousValue"] },
            percentageChange: { $cond: [{ $eq: ["$previousValue", 0] }, null, { $divide: [{ $subtract: ["$currentValue", "$previousValue"] }, "$previousValue"] }] }
        }},
      ];

      const sortOrder = sortBy.includes('_increase') ? -1 : 1;
      const sortField = sortBy.startsWith('absolute') ? 'absoluteChange' : 'percentageChange';
      pipeline.push({ $sort: { [sortField]: sortOrder } });

      pipeline.push(
        { $limit: topN },
        { $lookup: { from: 'metrics', localField: '_id', foreignField: '_id', as: 'metricInfo' }},
        { $unwind: { path: '$metricInfo', preserveNullAndEmptyArrays: true } }
      );

      const aggregatedMovers = await DailyMetricSnapshotModel.aggregate(pipeline);
      
      // MODIFICAÇÃO: Adicionado 'coverUrl' ao mapeamento.
      results = aggregatedMovers.map(mover => ({
        entityId: mover._id.toString(),
        entityName: mover.metricInfo?.description || mover.metricInfo?.text_content || `Post ID: ${mover._id.toString().slice(-5)}`,
        coverUrl: mover.metricInfo?.coverUrl,
        metricName: metric,
        previousValue: mover.previousValue,
        currentValue: mover.currentValue,
        absoluteChange: mover.absoluteChange,
        percentageChange: mover.percentageChange,
      }));

    } else { // entityType === 'creator'
      let preFilteredCreatorIds: Types.ObjectId[] | null = null;
      if (creatorFilters || agencyId) {
        const userQuery: any = {};
        if (creatorFilters?.planStatus) userQuery.planStatus = { $in: creatorFilters.planStatus };
        if (creatorFilters?.inferredExpertiseLevel) userQuery.inferredExpertiseLevel = { $in: creatorFilters.inferredExpertiseLevel };
        if (agencyId) userQuery.agency = agencyId;
        const matchingUsers = await UserModel.find(userQuery).select('_id').lean();
        preFilteredCreatorIds = matchingUsers.map(u => u._id);
        if (preFilteredCreatorIds.length === 0) return [];
      }

      const snapshotMatch: PipelineStage.Match['$match'] = {
        date: { $in: [previousPeriod.endDate, currentPeriod.endDate] },
        [mappedMetricField]: { $exists: true, $ne: null }
      };

      const pipeline: PipelineStage[] = [
        { $match: snapshotMatch },
        { $lookup: { from: 'metrics', localField: 'metric', foreignField: '_id', as: 'metricInfo' } },
        { $unwind: { path: '$metricInfo', preserveNullAndEmptyArrays: false } }
      ];

      if (preFilteredCreatorIds) {
        pipeline.push({ $match: { 'metricInfo.user': { $in: preFilteredCreatorIds } } });
      }

      pipeline.push(
        { $group: { _id: { creatorId: '$metricInfo.user', date: '$date' }, value: { $sum: `$${mappedMetricField}` } } },
        { $group: { _id: '$_id.creatorId', periodValues: { $push: { date: '$_id.date', val: '$value' } } } },
        { $addFields: {
            previousValueData: { $arrayElemAt: [{ $filter: { input: '$periodValues', cond: { $eq: ['$$this.date', previousPeriod.endDate] } } }, 0] },
            currentValueData: { $arrayElemAt: [{ $filter: { input: '$periodValues', cond: { $eq: ['$$this.date', currentPeriod.endDate] } } }, 0] }
        }},
        { $addFields: { previousValue: { $ifNull: ['$previousValueData.val', 0] }, currentValue: { $ifNull: ['$currentValueData.val', 0] } } },
        { $match: { $expr: { $ne: ['$previousValue', '$currentValue'] } } },
        { $addFields: {
            absoluteChange: { $subtract: ['$currentValue', '$previousValue'] },
            percentageChange: { $cond: [{ $eq: ['$previousValue', 0] }, null, { $divide: [{ $subtract: ['$currentValue', '$previousValue'] }, '$previousValue'] }] }
        } }
      );

      const sortOrder = sortBy.includes('_increase') ? -1 : 1;
      const sortField = sortBy.startsWith('absolute') ? 'absoluteChange' : 'percentageChange';
      pipeline.push({ $sort: { [sortField]: sortOrder } });

      pipeline.push(
        { $limit: topN },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'creatorDetails' } },
        { $unwind: { path: '$creatorDetails', preserveNullAndEmptyArrays: true } }
      );

      const aggregatedMovers = await DailyMetricSnapshotModel.aggregate(pipeline);
      results = aggregatedMovers.map(mover => ({
        entityId: mover._id.toString(),
        entityName: mover.creatorDetails?.name || `Creator ID: ${mover._id.toString().slice(-5)}`,
        profilePictureUrl: mover.creatorDetails?.profile_picture_url,
        metricName: metric,
        previousValue: mover.previousValue,
        currentValue: mover.currentValue,
        absoluteChange: mover.absoluteChange,
        percentageChange: mover.percentageChange,
      }));
    }

    return results;

  } catch (error: any) {
    logger.error(`${TAG} Error fetching top movers data:`, error);
    throw new DatabaseError(`Failed to fetch top movers data: ${error.message}`);
  }
}