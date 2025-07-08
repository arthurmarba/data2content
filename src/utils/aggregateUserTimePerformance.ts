/*
================================================================================
ARQUIVO 3/4: aggregateUserTimePerformance.ts
FUNÇÃO: Utilitário com a lógica de agregação de dados no MongoDB.
STATUS: CORRIGIDO. Esta é a principal alteração. A lógica de aplicação
de filtros foi refeita para usar o operador '$in' do MongoDB e a nova função
auxiliar, permitindo a filtragem hierárquica de categorias.
================================================================================
*/
import MetricModel from "@/app/models/Metric";
import { PipelineStage, Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "./dateHelpers";
// CORREÇÃO: Importa a nova função auxiliar de `classification.ts`
import { getCategoryWithSubcategoryIds } from "@/app/lib/classification";

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

    // ================== INÍCIO DA CORREÇÃO ==================
    // A lógica de filtragem foi completamente refeita para suportar hierarquias.
    
    if (filters.format) {
      const formatIds = getCategoryWithSubcategoryIds(filters.format, 'format');
      // Usa $in para incluir a categoria e suas subcategorias, se houver.
      // Converte para minúsculas para garantir consistência na busca.
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
    // =================== FIM DA CORREÇÃO ====================

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