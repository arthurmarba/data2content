/*
================================================================================
ARQUIVO: aggregateUserTimePerformance.ts
FUNÇÃO: Utilitário com a lógica de agregação de dados no MongoDB.
STATUS: CORRIGIDO. Além do ajuste de fuso horário, a lógica de filtragem
foi corrigida para traduzir os IDs recebidos em Labels, garantindo que
os filtros de formato, proposta e contexto funcionem corretamente.
================================================================================
*/
import MetricModel from "@/app/models/Metric";
import { PipelineStage, Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "./dateHelpers";
// --- INÍCIO DA ALTERAÇÃO ---
// Adicionada a importação de 'getCategoryById' para traduzir IDs em Labels.
import { getCategoryWithSubcategoryIds, getCategoryById } from "@/app/lib/classification";
// --- FIM DA ALTERAÇÃO ---

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
    
    // --- INÍCIO DA ALTERAÇÃO ---
    // A lógica de filtragem foi completamente corrigida para usar Labels.

    if (filters.format) {
      const formatIds = getCategoryWithSubcategoryIds(filters.format, 'format');
      // CORREÇÃO: Converte a lista de IDs para a lista de Labels correspondentes.
      const formatLabels = formatIds.map(id => getCategoryById(id, 'format')?.label || id);
      (matchStage.$match as any).format = { $in: formatLabels };
    }
    if (filters.proposal) {
      const proposalIds = getCategoryWithSubcategoryIds(filters.proposal, 'proposal');
      // CORREÇÃO: Converte a lista de IDs para a lista de Labels correspondentes.
      const proposalLabels = proposalIds.map(id => getCategoryById(id, 'proposal')?.label || id);
      (matchStage.$match as any).proposal = { $in: proposalLabels };
    }
    if (filters.context) {
      const contextIds = getCategoryWithSubcategoryIds(filters.context, 'context');
      // CORREÇÃO: Converte a lista de IDs para a lista de Labels correspondentes.
      const contextLabels = contextIds.map(id => getCategoryById(id, 'context')?.label || id);
      (matchStage.$match as any).context = { $in: contextLabels };
    }
    // --- FIM DA ALTERAÇÃO ---

    const pipeline: PipelineStage[] = [
      matchStage,
      {
        $project: {
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