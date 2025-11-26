import MetricModel from "@/app/models/Metric";
import UserModel from "@/app/models/User";
import { PipelineStage, Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "./dateHelpers";
import { getCategoryWithSubcategoryIds, getCategoryById } from "@/app/lib/classification";
import { resolveCreatorIdsByContext } from "@/app/lib/creatorContextHelper";

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
  creatorContext?: string;
}

export async function aggregatePlatformDayPerformance(
  periodInDays: number,
  metricField: string,
  filters: PerformanceFilters = {},
  agencyId?: string,
  referenceDate: Date = new Date(),
  onlyActiveSubscribers?: boolean
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

    let userFilter: any = {};
    if (agencyId || onlyActiveSubscribers) {
      const query: any = {};
      if (agencyId) query.agency = new Types.ObjectId(agencyId);
      if (onlyActiveSubscribers) query.planStatus = 'active';
      const userIds = await UserModel.find(query).distinct('_id');
      if (!userIds.length) {
        return result;
      }
      userFilter = { user: { $in: userIds } };
    }

    if (filters.creatorContext) {
      const contextIds = await resolveCreatorIdsByContext(filters.creatorContext, { onlyActiveSubscribers });
      const contextObjectIds = contextIds.map((id) => new Types.ObjectId(id));
      if (!contextObjectIds.length) {
        return result;
      }

      if (userFilter.user && userFilter.user.$in) {
        const existing = userFilter.user.$in as Types.ObjectId[];
        userFilter.user = { $in: existing.filter((id) => contextObjectIds.some((cid) => cid.equals(id))) };
      } else {
        userFilter.user = { $in: contextObjectIds };
      }
    }

    const matchStage: PipelineStage.Match = {
      $match: {
        postDate: { $gte: startDate, $lte: endDate },
        ...userFilter,
      },
    };

    if (filters.format) {
      const ids = getCategoryWithSubcategoryIds(filters.format, 'format');
      const labels = ids.map(id => getCategoryById(id, 'format')?.label || id);
      (matchStage.$match as any).format = { $in: labels };
    }
    if (filters.proposal) {
      const ids = getCategoryWithSubcategoryIds(filters.proposal, 'proposal');
      const labels = ids.map(id => getCategoryById(id, 'proposal')?.label || id);
      (matchStage.$match as any).proposal = { $in: labels };
    }
    if (filters.context) {
      const ids = getCategoryWithSubcategoryIds(filters.context, 'context');
      const labels = ids.map(id => getCategoryById(id, 'context')?.label || id);
      (matchStage.$match as any).context = { $in: labels };
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
