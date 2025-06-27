import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { getStartDateFromTimePeriod } from './dateHelpers';
import { getFromCache, setInCache } from '@/app/lib/stateService';
import { CACHE_TTL_SECONDS } from '@/app/lib/constants';
import { PipelineStage } from 'mongoose';

async function calculatePlatformAverageMetric(
  periodInDays: number,
  metricField: string,
  referenceDate: Date = new Date()
): Promise<number> {
  const ref = new Date(referenceDate);
  const endDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(ref, `last_${periodInDays}_days`);

  const cacheKey = `platform_avg:${metricField}:${periodInDays}:${ref.toISOString().slice(0, 10)}`;

  const cached = await getFromCache(cacheKey);
  if (cached !== null) {
    const parsed = Number(cached);
    if (!Number.isNaN(parsed)) return parsed;
  }

  try {
    await connectToDatabase();

    const pipeline: PipelineStage[] = [
      { $match: { postDate: { $gte: startDate, $lte: endDate } } },
      { $project: { metricValue: `$${metricField}` } },
      { $match: { metricValue: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$metricValue' } } }
    ];

    const [result] = await MetricModel.aggregate(pipeline);
    const avg = result?.avg ?? 0;
    try {
      await setInCache(cacheKey, String(avg), CACHE_TTL_SECONDS);
    } catch (cacheError) {
      logger.warn('Error caching platform average metric:', cacheError);
    }
    return avg;
  } catch (error) {
    logger.error('Error calculating platform average metric:', error);
    return 0;
  }
}

export default calculatePlatformAverageMetric;
