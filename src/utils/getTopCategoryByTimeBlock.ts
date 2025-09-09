import { PipelineStage, Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import MetricModel from '@/app/models/Metric';
import { getCategoryByValue } from '@/app/lib/classification';
import { getStartDateFromTimePeriod } from './dateHelpers';
import { logger } from '@/app/lib/logger';

export type CategoryDimension = 'format' | 'context' | 'proposal' | 'reference' | 'tone';

export interface TopCategoryByBlockResult {
  categoryId: string; // normalized ID when possible; otherwise original value
  categoryRaw: string; // raw value from DB (label or id)
  average: number;
  count: number;
}

const TARGET_TIMEZONE = 'America/Sao_Paulo';

// Ensures a value is treated as array in aggregation
function arrayExprOf(field: string) {
  return {
    $cond: [
      { $isArray: `$${field}` },
      `$${field}`,
      {
        $cond: [
          { $and: [{ $ne: [`$${field}`, null] }, { $ne: [`$${field}`, undefined] }] },
          [ `$${field}` ],
          []
        ]
      }
    ]
  };
}

/**
 * Returns the top category by average metric for a specific user, day-of-week and 3h block.
 * Uses stats.total_interactions by default, but metricField is configurable.
 */
export async function getTopCategoryByTimeBlock(
  userId: string | Types.ObjectId,
  periodInDays: number,
  metricField: string,
  dimension: CategoryDimension,
  dayOfWeek: number, // 1..7 (Mongo $dayOfWeek)
  blockStartHour: number // 0,3,6,...,21
): Promise<TopCategoryByBlockResult | null> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, `last_${periodInDays}_days`);

  try {
    await connectToDatabase();

    const hours = [blockStartHour, (blockStartHour + 1) % 24, (blockStartHour + 2) % 24];
    const dimField = dimension; // 'format' | 'context' | 'proposal'

    const pipeline: PipelineStage[] = [
      { $match: { user: resolvedUserId, postDate: { $gte: startDate, $lte: endDate } } },
      {
        $project: {
          dayOfWeek: { $dayOfWeek: { date: '$postDate', timezone: TARGET_TIMEZONE } },
          hour: { $hour: { date: '$postDate', timezone: TARGET_TIMEZONE } },
          metricValue: { $ifNull: [`$${metricField}`, 0] },
          categoryArray: arrayExprOf(dimField),
        }
      },
      { $match: { dayOfWeek, hour: { $in: hours }, metricValue: { $ne: null } } },
      { $unwind: '$categoryArray' },
      {
        $group: {
          _id: '$categoryArray',
          total: { $sum: '$metricValue' },
          count: { $sum: 1 },
        }
      },
      {
        $addFields: {
          avg: {
            $cond: [{ $eq: ['$count', 0] }, 0, { $divide: ['$total', '$count'] }]
          }
        }
      },
      { $sort: { avg: -1 } },
      { $limit: 1 },
    ];

    const agg = await MetricModel.aggregate(pipeline);
    const top = agg?.[0];
    if (!top) return null;

    const raw: string = top._id;
    const id = getCategoryByValue(raw, dimension)?.id ?? raw;
    return { categoryId: id, categoryRaw: raw, average: top.avg ?? 0, count: top.count ?? 0 };
  } catch (err) {
    logger.error('[getTopCategoryByTimeBlock] Error', { err, userId: String(userId), dimension, dayOfWeek, blockStartHour });
    return null;
  }
}

export default getTopCategoryByTimeBlock;
