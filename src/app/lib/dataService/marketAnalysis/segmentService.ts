/**
 * @fileoverview Serviço para buscar dados de performance de segmentos de conteúdo.
 * @version 1.0.0
 */

import { PipelineStage } from 'mongoose';
import { subDays } from 'date-fns';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric';
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
