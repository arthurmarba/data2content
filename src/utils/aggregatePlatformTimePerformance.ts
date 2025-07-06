import MetricModel from "@/app/models/Metric";
import { PipelineStage } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "./dateHelpers";

export interface TimeBucket {
  dayOfWeek: number;
  timeBlock: string;
  average: number;
  count: number;
}

export interface PlatformTimePerformance {
  buckets: TimeBucket[];
  bestSlots: TimeBucket[];
  worstSlots: TimeBucket[];
}

export interface PerformanceFilters {
  format?: string;
  proposal?: string;
  context?: string;
}

export async function aggregatePlatformTimePerformance(
  periodInDays: number,
  metricField: string,
  filters: PerformanceFilters = {},
  referenceDate: Date = new Date()
): Promise<PlatformTimePerformance> {
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

  const result: PlatformTimePerformance = { buckets: [], bestSlots: [], worstSlots: [] };

  try {
    await connectToDatabase();

    const matchStage: PipelineStage.Match = {
      $match: {
        postDate: { $gte: startDate, $lte: endDate },
      },
    };

    if (filters.format) {
      (matchStage.$match as any).format = filters.format;
    }
    if (filters.proposal) {
      (matchStage.$match as any).proposal = filters.proposal;
    }
    if (filters.context) {
      (matchStage.$match as any).context = filters.context;
    }

    const pipeline: PipelineStage[] = [
      matchStage,
      {
        $project: {
          dayOfWeek: { $dayOfWeek: "$postDate" },
          hour: { $hour: "$postDate" },
          metricValue: `$${metricField}`,
        },
      },
      { $match: { metricValue: { $ne: null } } },
      {
        $addFields: {
          timeBlock: {
            $switch: {
              branches: [
                { case: { $lte: ["$hour", 5] }, then: "0-6" },
                { case: { $lte: ["$hour", 11] }, then: "6-12" },
                { case: { $lte: ["$hour", 17] }, then: "12-18" },
                { case: { $lte: ["$hour", 23] }, then: "18-24" },
              ],
              default: "unknown",
            },
          },
        },
      },
      {
        $group: {
          _id: { dayOfWeek: "$dayOfWeek", timeBlock: "$timeBlock" },
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
      dayOfWeek: d._id.dayOfWeek,
      timeBlock: d._id.timeBlock,
      average: d.avg,
      count: d.count,
    }));

    result.bestSlots = result.buckets.slice(0, 3);
    result.worstSlots = result.buckets.slice(-3).reverse();

    return result;
  } catch (error) {
    logger.error("Error in aggregatePlatformTimePerformance:", error);
    return result;
  }
}

export default aggregatePlatformTimePerformance;
