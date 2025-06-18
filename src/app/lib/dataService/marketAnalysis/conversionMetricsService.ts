import { PipelineStage } from 'mongoose';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric';
import AccountInsightModel from '@/app/models/AccountInsight';
import { connectToDatabase } from '../connection';
import { DatabaseError } from '@/app/lib/errors';
import { IFetchPlatformConversionMetricsArgs, IPlatformConversionMetrics } from './types';

const SERVICE_TAG = '[dataService][conversionMetricsService]';

export async function fetchPlatformConversionMetrics(
  args: IFetchPlatformConversionMetricsArgs
): Promise<IPlatformConversionMetrics> {
  const TAG = `${SERVICE_TAG}[fetchPlatformConversionMetrics]`;
  logger.info(`${TAG} Aggregating metrics for date range: ${args.dateRange.startDate.toISOString()} - ${args.dateRange.endDate.toISOString()}`);

  try {
    await connectToDatabase();

    const { startDate, endDate } = args.dateRange;

    const postMatch: PipelineStage.Match['$match'] = {
      postDate: { $gte: startDate, $lte: endDate },
      'stats.follower_conversion_rate': { $exists: true, $ne: null, $type: 'number' },
    };

    const postPipeline: PipelineStage[] = [
      { $match: postMatch },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgRate: { $avg: '$stats.follower_conversion_rate' },
        },
      },
      {
        $project: {
          _id: 0,
          count: { $ifNull: ['$count', 0] },
          avgRate: { $ifNull: ['$avgRate', 0] },
        },
      },
    ];

    const postResults = await MetricModel.aggregate(postPipeline);
    const numberOfPosts = postResults[0]?.count || 0;
    const avgConversionPerPost = postResults[0]?.avgRate || 0;

    const insightMatch: PipelineStage.Match['$match'] = {
      recordedAt: { $gte: startDate, $lte: endDate },
    };

    const insightPipeline: PipelineStage[] = [
      { $match: insightMatch },
      {
        $group: {
          _id: null,
          accountsEngaged: { $sum: '$accountInsightsPeriod.accounts_engaged' },
          followerGains: { $sum: '$accountInsightsPeriod.follows_and_unfollows.follower_gains' },
        },
      },
      {
        $project: {
          _id: 0,
          accountsEngaged: { $ifNull: ['$accountsEngaged', 0] },
          followerGains: { $ifNull: ['$followerGains', 0] },
        },
      },
    ];

    const insightResults = await AccountInsightModel.aggregate(insightPipeline);
    const accountsEngaged = insightResults[0]?.accountsEngaged || 0;
    const followersGained = insightResults[0]?.followerGains || 0;

    const accountConversionRate = accountsEngaged > 0 ? (followersGained / accountsEngaged) * 100 : 0;
    const averageFollowerConversionRatePerPost = avgConversionPerPost * 100;

    return {
      averageFollowerConversionRatePerPost: parseFloat(averageFollowerConversionRatePerPost.toFixed(2)),
      accountFollowerConversionRate: parseFloat(accountConversionRate.toFixed(2)),
      numberOfPostsConsideredForRate: numberOfPosts,
      accountsEngagedInPeriod: accountsEngaged,
      followersGainedInPeriod: followersGained,
    };
  } catch (error: any) {
    logger.error(`${TAG} Error aggregating platform conversion metrics:`, error);
    throw new DatabaseError(`Failed to aggregate platform conversion metrics: ${error.message}`);
  }
}
