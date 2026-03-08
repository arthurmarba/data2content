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
import { getCategoryWithSubcategoryIds, getCategoryById } from "@/app/lib/classification";
import { isProxyMetricField, resolvePerformanceMetricValue } from "./performanceMetricResolver";

// Define o fuso horário alvo para garantir consistência
const TARGET_TIMEZONE = 'America/Sao_Paulo';
const WEEKDAY_TO_MONGO_INDEX: Record<string, number> = {
  Sun: 1,
  Mon: 2,
  Tue: 3,
  Wed: 4,
  Thu: 5,
  Fri: 6,
  Sat: 7,
};

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
  tone?: string;
  reference?: string;
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

    if (filters.format) {
      const formatIds = getCategoryWithSubcategoryIds(filters.format, 'format');
      const formatLabels = formatIds.map(id => getCategoryById(id, 'format')?.label || id);
      (matchStage.$match as any).format = { $in: formatLabels };
    }
    if (filters.proposal) {
      const proposalIds = getCategoryWithSubcategoryIds(filters.proposal, 'proposal');
      const proposalLabels = proposalIds.map(id => getCategoryById(id, 'proposal')?.label || id);
      (matchStage.$match as any).proposal = { $in: proposalLabels };
    }
    if (filters.context) {
      const contextIds = getCategoryWithSubcategoryIds(filters.context, 'context');
      const contextLabels = contextIds.map(id => getCategoryById(id, 'context')?.label || id);
      (matchStage.$match as any).context = { $in: contextLabels };
    }
    if (filters.tone) {
      const toneIds = getCategoryWithSubcategoryIds(filters.tone, 'tone');
      const toneLabels = toneIds.map(id => getCategoryById(id, 'tone')?.label || id);
      (matchStage.$match as any).tone = { $in: toneLabels };
    }
    if (filters.reference) {
      const referenceIds = getCategoryWithSubcategoryIds(filters.reference, 'reference');
      const referenceLabels = referenceIds.map(id => getCategoryById(id, 'reference')?.label || id);
      (matchStage.$match as any).references = { $in: referenceLabels };
    }

    if (isProxyMetricField(metricField)) {
      const posts = await MetricModel.find(matchStage.$match)
        .select("postDate stats")
        .lean();

      const buckets = new Map<string, { dayOfWeek: number; hour: number; total: number; count: number }>();
      for (const post of posts) {
        const date = post?.postDate instanceof Date ? post.postDate : new Date(post?.postDate);
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) continue;
        const metricValue = resolvePerformanceMetricValue(post, metricField);
        if (typeof metricValue !== "number") continue;

        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: TARGET_TIMEZONE,
          weekday: "short",
          hour: "numeric",
          hourCycle: "h23",
        }).formatToParts(date);
        const weekdayLabel = parts.find((part) => part.type === "weekday")?.value || "";
        const weekdayPart = WEEKDAY_TO_MONGO_INDEX[weekdayLabel];
        const hourPart = Number(parts.find((part) => part.type === "hour")?.value || "");
        if (weekdayPart === undefined || !Number.isFinite(hourPart)) continue;
        const dayOfWeek = weekdayPart;

        const key = `${dayOfWeek}-${hourPart}`;
        const bucket = buckets.get(key) || {
          dayOfWeek,
          hour: hourPart,
          total: 0,
          count: 0,
        };
        bucket.total += metricValue;
        bucket.count += 1;
        buckets.set(key, bucket);
      }

      result.buckets = Array.from(buckets.values())
        .map((bucket) => ({
          dayOfWeek: bucket.dayOfWeek,
          hour: bucket.hour,
          average: bucket.count > 0 ? bucket.total / bucket.count : 0,
          count: bucket.count,
        }))
        .sort((a, b) => b.average - a.average);

      result.bestSlots = result.buckets.slice(0, 3);
      result.worstSlots = result.buckets.slice(-3).reverse();
      return result;
    }

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
