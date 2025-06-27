import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { getStartDateFromTimePeriod } from './dateHelpers';
import { PipelineStage } from 'mongoose';

async function calculatePlatformAverageMetric(
  periodInDays: number,
  metricField: string,
  referenceDate: Date = new Date()
): Promise<number> {
  const ref = new Date(referenceDate);
  const endDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(ref, `last_${periodInDays}_days`);

  try {
    await connectToDatabase();

    const pipeline: PipelineStage[] = [
      { $match: { postDate: { $gte: startDate, $lte: endDate } } },
      { $project: { metricValue: `$${metricField}` } },
      { $match: { metricValue: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$metricValue' } } }
    ];

    const [result] = await MetricModel.aggregate(pipeline);
    return result?.avg ?? 0;
  } catch (error) {
    logger.error('Error calculating platform average metric:', error);
    return 0;
  }
}

export default calculatePlatformAverageMetric;
