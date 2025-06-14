/**
 * @fileoverview Serviço para buscar os "top movers" (conteúdos ou criadores com maiores mudanças).
 * @version 1.0.0
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
    } = args;

    const mappedMetricField = mapMetricToDbField(metric);
    let results: ITopMoverResult[] = [];

    if (entityType === 'content') {
      let preFilteredPostIds: Types.ObjectId[] | null = null;
      if (contentFilters && (contentFilters.format || contentFilters.proposal || contentFilters.context)) {
        const filterQuery: any = {};
        if (contentFilters.format) filterQuery.format = contentFilters.format;
        if (contentFilters.proposal) filterQuery.proposal = contentFilters.proposal;
        if (contentFilters.context) filterQuery.context = contentFilters.context;
        const matchingMetrics = await MetricModel.find(filterQuery).select('_id').lean();
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
      results = aggregatedMovers.map(mover => ({
        entityId: mover._id.toString(),
        entityName: mover.metricInfo?.description || mover.metricInfo?.text_content || `Post ID: ${mover._id.toString().slice(-5)}`,
        metricName: metric,
        previousValue: mover.previousValue,
        currentValue: mover.currentValue,
        absoluteChange: mover.absoluteChange,
        percentageChange: mover.percentageChange,
      }));

    } else { // entityType === 'creator'
      // ... A lógica para criadores seria implementada aqui de forma similar ...
      logger.warn(`${TAG} Creator top movers logic is not yet fully implemented.`);
    }

    return results;

  } catch (error: any) {
    logger.error(`${TAG} Error fetching top movers data:`, error);
    throw new DatabaseError(`Failed to fetch top movers data: ${error.message}`);
  }
}
