/*
==============================================================================
Utilitário: aggregateUserTimePerformance
Função   : Agrega métricas de desempenho por horário para um usuário específico.
Baseado em aggregatePlatformTimePerformance.ts, com filtro adicional por userId.
==============================================================================
*/
import MetricModel from "@/app/models/Metric";
import { PipelineStage, Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "./dateHelpers";

export interface TimeBucket {
  dayOfWeek: number;
  hour: number; // ALTERADO: de timeBlock: string para hour: number
  average: number;
  count: number;
}

export interface UserTimePerformance {
  buckets: TimeBucket[];
  bestSlots: TimeBucket[];
  worstSlots: TimeBucket[];
}

export interface PerformanceFilters {
  format?: string;
  proposal?: string;
  context?: string;
}

export async function aggregateUserTimePerformance(
  userId: string | Types.ObjectId,
  periodInDays: number,
  metricField: string,
  filters: PerformanceFilters = {},
  referenceDate: Date = new Date()
): Promise<UserTimePerformance> {
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

  const result: UserTimePerformance = { buckets: [], bestSlots: [], worstSlots: [] };

  try {
    await connectToDatabase();

    const resolvedUserId =
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const matchStage: PipelineStage.Match = {
      $match: {
        user: resolvedUserId,
        postDate: { $gte: startDate, $lte: endDate },
      },
    };

    // Filtros usam regex para busca case-insensitive.
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
    logger.error("Error in aggregateUserTimePerformance:", error);
    return result;
  }
}
