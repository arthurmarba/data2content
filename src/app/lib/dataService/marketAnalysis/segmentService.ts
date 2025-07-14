/**
 * @fileoverview Serviço para buscar dados de performance de segmentos de conteúdo.
 * @version 1.0.1
 */

import { PipelineStage, Types } from 'mongoose';
import { subDays } from 'date-fns';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '../connection';
import { DatabaseError } from '@/app/lib/errors';
import { IFetchSegmentPerformanceArgs, ISegmentPerformanceResult, IMarketPerformanceResult } from './types';

const SERVICE_TAG = '[dataService][segmentService]';

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
  logger.info(`${TAG} Fetching for segment: ${JSON.stringify(args.criteria)}`);

  try {
    await connectToDatabase();
    const { criteria, dateRange } = args;
    const matchQuery: PipelineStage.Match['$match'] = {
      postDate: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      },
      'stats.engagement_rate_on_reach': { $exists: true, $ne: null },
      'stats.likes': { $exists: true, $ne: null },
      'stats.shares': { $exists: true, $ne: null },
      'stats.comments': { $exists: true, $ne: null },
    };

    if (criteria.format) matchQuery.format = criteria.format;
    if (criteria.proposal) matchQuery.proposal = criteria.proposal;
    if (criteria.context) matchQuery.context = criteria.context;

    const pipeline: PipelineStage[] = [
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          postCount: { $sum: 1 },
          avgEngagementRate: { $avg: "$stats.engagement_rate_on_reach" },
          avgLikes: { $avg: "$stats.likes" },
          avgShares: { $avg: "$stats.shares" },
          avgComments: { $avg: "$stats.comments" },
        }
      },
      {
        $project: {
          _id: 0,
          postCount: { $ifNull: ["$postCount", 0] },
          avgEngagementRate: { $ifNull: ["$avgEngagementRate", 0] },
          avgLikes: { $ifNull: ["$avgLikes", 0] },
          avgShares: { $ifNull: ["$avgShares", 0] },
          avgComments: { $ifNull: ["$avgComments", 0] },
        }
      }
    ];

    const results = await MetricModel.aggregate(pipeline);
    return results[0] || {
        postCount: 0,
        avgEngagementRate: 0,
        avgLikes: 0,
        avgShares: 0,
        avgComments: 0,
    };
  } catch (error: any) {
    logger.error(`${TAG} Error fetching segment performance data:`, error);
    throw new DatabaseError(`Failed to fetch segment performance data: ${error.message}`);
  }
}

/**
 * @function fetchMarketPerformance
 * @description Fetches overall market performance for a given format and proposal.
 * @param args - Arguments for fetching market performance.
 * @returns {Promise<IMarketPerformanceResult>} The market performance data.
 */
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

// --- Performance by Content Type ---

export interface IContentPerformanceByTypeArgs {
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  agencyId?: string;
}

export interface IContentPerformanceByTypeDataPoint {
  type: string;
  averageInteractions: number;
}

const SERVICE_TAG_CONTENT_PERF = '[dataService][segmentService][ContentPerformanceByType]';

/**
 * @function fetchContentPerformanceByType
 * @description Fetches aggregated average interactions for each content type within a date range.
 * @param {IContentPerformanceByTypeArgs} args - Arguments defining the date range.
 * @returns {Promise<IContentPerformanceByTypeDataPoint[]>} - Aggregated performance data by type.
 */
export async function fetchContentPerformanceByType(
  args: IContentPerformanceByTypeArgs
): Promise<IContentPerformanceByTypeDataPoint[]> {
  const TAG = `${SERVICE_TAG_CONTENT_PERF}[fetchContentPerformanceByType]`;
  logger.info(`${TAG} Fetching performance by type for date range: ${args.dateRange.startDate?.toISOString()} - ${args.dateRange.endDate?.toISOString()}`);

  try {
    await connectToDatabase();
    const { dateRange, agencyId } = args;

    if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
      throw new Error('Date range with startDate and endDate must be provided.');
    }

    // Ensure dates are proper Date objects
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date format provided.');
    }

    // To include the whole endDate, set time to end of day
    endDate.setUTCHours(23, 59, 59, 999);


    const matchStage: PipelineStage.Match = {
      $match: {
        postDate: {
          $gte: startDate,
          $lte: endDate,
        },
        'stats.total_interactions': { $exists: true, $ne: null, $type: 'number' },
        type: { $exists: true, $nin: [null, ''] },
      },
    };

    if (agencyId) {
      const agencyUserIds = await UserModel.find({ agency: new Types.ObjectId(agencyId) }).distinct('_id');
      if (agencyUserIds.length === 0) {
        return [];
      }
      (matchStage.$match as any).user = { $in: agencyUserIds };
    }

    const pipeline: PipelineStage[] = [
      matchStage,
      {
        $group: {
          _id: "$type",
          avgInteractions: { $avg: "$stats.total_interactions" }
        }
      },
      {
        $project: {
          _id: 0,
          type: "$_id",
          // Round averageInteractions to 2 decimal places
          averageInteractions: { $round: ["$avgInteractions", 2] }
        }
      },
      {
        $sort: { averageInteractions: -1 } // Optional: sort by highest interactions
      }
    ];

    logger.debug(`${TAG} Aggregation pipeline: ${JSON.stringify(pipeline)}`);
    const results: IContentPerformanceByTypeDataPoint[] = await MetricModel.aggregate(pipeline);

    if (!results) {
        logger.warn(`${TAG} Aggregation returned null or undefined.`);
        return [];
    }

    logger.info(`${TAG} Successfully fetched ${results.length} data points.`);
    return results;

  } catch (error: any) {
    logger.error(`${TAG} Error fetching content performance by type:`, {
      message: error.message,
      stack: error.stack,
      args
    });
    if (error instanceof DatabaseError) {
        throw error;
    }
    throw new DatabaseError(`Failed to fetch content performance by type: ${error.message}`);
  }
}
