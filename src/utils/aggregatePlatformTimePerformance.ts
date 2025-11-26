/*
================================================================================
ARQUIVO 1/3: src/utils/aggregatePlatformTimePerformance.ts
FUNÇÃO: Lógica de agregação no back-end.
OTIMIZAÇÃO: A pipeline de agregação foi modificada para agrupar os dados por
hora individual, em vez de blocos de 6 horas, fornecendo maior granularidade.
================================================================================
*/
import MetricModel from "@/app/models/Metric";
import UserModel from "@/app/models/User";
import { PipelineStage, Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "./dateHelpers";
import { getCategoryWithSubcategoryIds, getCategoryById } from "@/app/lib/classification";
import { resolveCreatorIdsByContext } from "@/app/lib/creatorContextHelper";

export interface TimeBucket {
  dayOfWeek: number;
  hour: number; // ALTERADO: de timeBlock: string para hour: number
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
  creatorContext?: string;
}

export async function aggregatePlatformTimePerformance(
  periodInDays: number,
  metricField: string,
  filters: PerformanceFilters = {},
  agencyId?: string,
  referenceDate: Date = new Date(),
  onlyActiveSubscribers?: boolean
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

    if (agencyId || onlyActiveSubscribers) {
      const query: any = {};
      if (agencyId) query.agency = new Types.ObjectId(agencyId);
      if (onlyActiveSubscribers) query.planStatus = 'active';
      const userIds = await UserModel.find(query).distinct('_id');
      if (userIds.length === 0) {
        return result;
      }
      (matchStage.$match as any).user = { $in: userIds };
    }

    if (filters.creatorContext) {
      const contextIds = await resolveCreatorIdsByContext(filters.creatorContext, { onlyActiveSubscribers });
      const contextObjectIds = contextIds.map((id) => new Types.ObjectId(id));
      if (!contextObjectIds.length) {
        return result;
      }

      const currentUserFilter = (matchStage.$match as any).user;
      if (currentUserFilter && currentUserFilter.$in) {
        const existingIds = currentUserFilter.$in as Types.ObjectId[];
        (matchStage.$match as any).user = { $in: existingIds.filter((id) => contextObjectIds.some((cid) => cid.equals(id))) };
      } else {
        (matchStage.$match as any).user = { $in: contextObjectIds };
      }
    }

    // Filtros traduzidos de IDs para Labels (compatível com arrays)
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
          hour: { $hour: "$postDate" },
          metricValue: `$${metricField}`,
        },
      },
      { $match: { metricValue: { $ne: null } } },
      // REMOVIDO: O estágio que criava 'timeBlock' foi removido.
      {
        $group: {
          // ALTERADO: Agrupamento agora é por hora individual.
          _id: { dayOfWeek: "$dayOfWeek", hour: "$hour" },
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
      hour: d._id.hour, // ALTERADO: Mapeando 'hour' em vez de 'timeBlock'.
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
