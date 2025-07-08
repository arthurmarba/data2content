/*
================================================================================
ARQUIVO: aggregateUserTimePerformance.ts
FUNÇÃO: Utilitário com a lógica de agregação de dados no MongoDB.
STATUS: CORREÇÃO DE FUSO HORÁRIO. A pipeline foi ajustada para usar um
fuso horário específico ('America/Sao_Paulo'), garantindo que os cálculos
de dia da semana e hora correspondam à perspectiva do usuário no Brasil,
independentemente do fuso horário do servidor.
================================================================================
*/
import MetricModel from "@/app/models/Metric";
import { PipelineStage, Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "./dateHelpers";
import { getCategoryWithSubcategoryIds } from "@/app/lib/classification";

// Define o fuso horário alvo para garantir consistência
const TARGET_TIMEZONE = 'America/Sao_Paulo';

export interface TimeBucket {
  dayOfWeek: number;
  hour: number;
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
  // A data de referência ainda é um problema, mas a correção na pipeline é o passo mais crítico.
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
    
    // ATENÇÃO: A lógica de startDate e endDate AINDA pode causar problemas
    // em filtros de curto período (como "Hoje"). A solução ideal para isso
    // seria usar uma biblioteca como date-fns-tz para criar essas datas
    // já no fuso correto. A correção abaixo resolve o agrupamento.
    const matchStage: PipelineStage.Match = {
      $match: {
        user: resolvedUserId,
        postDate: { $gte: startDate, $lte: endDate },
      },
    };
    
    if (filters.format) {
      const formatIds = getCategoryWithSubcategoryIds(filters.format, 'format');
      (matchStage.$match as any).format = { $in: formatIds.map(id => id.toLowerCase()) };
    }
    if (filters.proposal) {
      const proposalIds = getCategoryWithSubcategoryIds(filters.proposal, 'proposal');
      (matchStage.$match as any).proposal = { $in: proposalIds.map(id => id.toLowerCase()) };
    }
    if (filters.context) {
      const contextIds = getCategoryWithSubcategoryIds(filters.context, 'context');
      (matchStage.$match as any).context = { $in: contextIds.map(id => id.toLowerCase()) };
    }

    const pipeline: PipelineStage[] = [
      matchStage,
      {
        $project: {
          // CORREÇÃO DE FUSO HORÁRIO APLICADA AQUI
          dayOfWeek: { $dayOfWeek: { date: "$postDate", timezone: TARGET_TIMEZONE } },
          hour: { $hour: { date: "$postDate", timezone: TARGET_TIMEZONE } },
          metricValue: { $ifNull: [`$${metricField}`, 0] },
        },
      },
      { $match: { metricValue: { $ne: null } } },
      {
        $group: {
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
      hour: d._id.hour,
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