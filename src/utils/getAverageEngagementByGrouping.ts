import MetricModel, { IMetric } from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { Types } from 'mongoose';
import { getNestedValue } from './dataAccessHelpers';
import { getStartDateFromTimePeriod } from './dateHelpers';

export type GroupingType = 'format' | 'context' | 'proposal';

interface AverageResult {
  name: string;
  value: number;
  postsCount: number;
}

async function getAverageEngagementByGrouping(
  userId: string | Types.ObjectId,
  timePeriod: string,
  performanceMetricField: string,
  groupBy: GroupingType,
  formatMapping?: Record<string, string>
): Promise<AverageResult[]> {
  const resolvedUserId =
    typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23, 59, 59, 999
  );
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  try {
    await connectToDatabase();

    const query: any = { user: resolvedUserId };
    if (timePeriod !== 'all_time') {
      query.postDate = { $gte: startDate, $lte: endDate };
    }

    const posts: IMetric[] = await MetricModel.find(query).lean();
    if (!posts.length) {
      return [];
    }

    const aggregation: Record<string, { sum: number; count: number }> = {};

    for (const post of posts) {
      const metricValue = getNestedValue(post, performanceMetricField);
      if (typeof metricValue !== 'number') continue;

      const key =
        groupBy === 'format'
          ? (post.format || '').toString()
          : groupBy === 'context'
            ? post.context ?? null
            : post.proposal ?? null;

      if (groupBy === 'format') {
        if (!key) continue;
      } else {
        if (key === null) continue;
      }

      if (!aggregation[key]) {
        aggregation[key] = { sum: 0, count: 0 };
      }
      aggregation[key].sum += metricValue;
      aggregation[key].count += 1;
    }

    const results: AverageResult[] = [];
    for (const [key, data] of Object.entries(aggregation)) {
      if (data.count === 0) continue;
      const name =
        groupBy === 'format'
          ? formatMapping?.[key] ||
            key
              .replace(/_/g, ' ')
              .toLocaleLowerCase()
              .replace(/\b\w/g, (l) => l.toUpperCase())
          : key;
      results.push({
        name,
        value: data.sum / data.count,
        postsCount: data.count,
      });
    }

    results.sort((a, b) => b.value - a.value);
    return results;
  } catch (error) {
    logger.error(
      `Error in getAverageEngagementByGrouping for userId ${resolvedUserId}:`,
      error
    );
    return [];
  }
}

export default getAverageEngagementByGrouping;
