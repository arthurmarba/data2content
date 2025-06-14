/**
 * @fileoverview Serviço para buscar dados de séries temporais.
 * @version 1.0.0
 */

import { PipelineStage, Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '../connection';
import { DatabaseError } from '@/app/lib/errors';
import { IFetchCreatorTimeSeriesArgs, ICreatorTimeSeriesDataPoint } from './types';

const SERVICE_TAG = '[dataService][timeSeriesService]';

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
  logger.info(`${TAG} Fetching for creator ${args.creatorId}, metric: ${args.metric}`);

  try {
    await connectToDatabase();

    if (!Types.ObjectId.isValid(args.creatorId)) {
      throw new Error('Invalid creatorId format.');
    }
    const creatorObjectId = new Types.ObjectId(args.creatorId);

    let metricFieldPath: string | null = null;
    let accumulator: string | null = null;
    let needsNonNullCheck = true;

    switch (args.metric) {
      case 'post_count':
        accumulator = '$sum';
        needsNonNullCheck = false;
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
    if (needsNonNullCheck && metricFieldPath) {
        matchStage.$match[metricFieldPath.substring(1)] = { $exists: true, $ne: null };
    }

    let groupId: any;
    let dateProjection: any;

    if (args.period === 'monthly') {
      groupId = { year: { $year: '$postDate' }, month: { $month: '$postDate' } };
      dateProjection = { $dateFromParts: { year: '$_id.year', month: '$_id.month', day: 1 } };
    } else { // weekly
      groupId = { year: { $isoWeekYear: '$postDate' }, week: { $isoWeek: '$postDate' } };
      dateProjection = { $dateFromParts: { isoWeekYear: '$_id.year', isoWeek: '$_id.week', isoDayOfWeek: 1 } };
    }

    const groupStage: PipelineStage.Group = {
      $group: {
        _id: groupId,
        rawValue: accumulator === '$sum' && !metricFieldPath
            ? { $sum: 1 }
            : ({ [accumulator!]: metricFieldPath } as any),
      },
    };

    const sortKey = args.period === 'monthly' ? { '_id.year': 1, '_id.month': 1 } : { '_id.year': 1, '_id.week': 1 };
    const sortStage: PipelineStage.Sort = { $sort: sortKey as any };

    const projectStage: PipelineStage.Project = {
      $project: {
        _id: 0,
        date: dateProjection,
        value: '$rawValue',
      },
    };
    
    if (projectStage.$project) { // Type guard
        if (args.metric === 'avg_engagement_rate') {
            projectStage.$project.value = { $round: ['$rawValue', 4] };
        } else if (args.metric !== 'post_count' && accumulator === '$avg') {
            projectStage.$project.value = { $round: ['$rawValue', 2] };
        }
    }

    const pipeline: PipelineStage[] = [matchStage, groupStage, sortStage, projectStage];
    const results = await MetricModel.aggregate(pipeline);
    return results as ICreatorTimeSeriesDataPoint[];

  } catch (error: any) {
    logger.error(`${TAG} Error fetching time series data:`, error);
    throw new DatabaseError(`Failed to fetch time series data: ${error.message}`);
  }
}
