import MetricModel from "@/app/models/Metric";
import { PipelineStage } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "./dateHelpers";

export interface DayBucket {
  dayOfWeek: number;
  average: number;
  count: number;
}

export interface PlatformDayPerformance {
  buckets: DayBucket[];
  bestDays: DayBucket[];
  worstDays: DayBucket[];
}

export interface PerformanceFilters {
  format?: string;
  proposal?: string;
  context?: string;
}

export async function aggregatePlatformDayPerformance(
  periodInDays: number,
  metricField: string,
  filters: PerformanceFilters = {},
  referenceDate: Date = new Date()
): Promise<PlatformDayPerformance> {
  const today = new Date(referenceDate);
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999
  );
  const startDate = getStartDateFromTimePeriod(
    today,
    `last_${periodInDays}_days`
  );

  const result: PlatformDayPerformance = { buckets: [], bestDays: [], worstDays: [] };

  try {
    await connectToDatabase();

    const matchStage: PipelineStage.Match = {
      $match: {
        postDate: { $gte: startDate, $lte: endDate },
      },
    };

    if (filters.format) {
      (matchStage.$match as any).format = { $regex: `^${filters.format}$`, $options: 'i' };
    }
    if (filters.proposal) {
      (matchStage.$match as any).proposal = { $regex: `^${filters.proposal}$`, $options: 'i' };
    }
    if (filters.context) {
      (matchStage.$match as any).context = { $regex: `^${filters.context}$`, $options: 'i' };
    }

    const pipeline: PipelineStage[] = [
      matchStage,
      {
        $project: {
          dayOfWeek: { $dayOfWeek: "$postDate" },
          metricValue: `$${metricField}`,
        },
      },
      { $match: { metricValue: { $ne: null } } },
      {
        $group: {
          _id: "$dayOfWeek",
          total: { $sum: "$metricValue" },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          avg: {
            $cond: {
              if: { $eq: ["$count", 0] },
              then: 0,
              else: { $divide: ["$total", "$count"] },
            },
          },
        },
      },
      { $sort: { avg: -1 } },
    ];

    const agg = await MetricModel.aggregate(pipeline);
    result.buckets = agg.map((d: any) => ({
      dayOfWeek: d._id,
      average: d.avg,
      count: d.count,
    }));

    result.bestDays = result.buckets.slice(0, 3);
    result.worstDays = result.buckets.slice(-3).reverse();

    return result;
  } catch (error) {
    logger.error("Error in aggregatePlatformDayPerformance:", error);
    return result;
  }
}

export default aggregatePlatformDayPerformance;
