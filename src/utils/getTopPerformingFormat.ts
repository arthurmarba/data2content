// src/utils/getTopPerformingFormat.ts

import MetricModel, { IMetric } from "@/app/models/Metric";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getNestedValue } from "./dataAccessHelpers";
import { getStartDateFromTimePeriod } from "./dateHelpers";

// Definição local de FormatType
export type FormatType = string;

interface FormatPerformanceData {
  format: FormatType | null;
  averagePerformance: number;
  postsCount: number;
  metricUsed: string;
}

async function getTopPerformingFormat(
  userId: string | Types.ObjectId,
  periodInDays: number,
  performanceMetricField: string // Ex: "stats.total_interactions", "stats.views"
): Promise<FormatPerformanceData | null> {
  const resolvedUserId =
    typeof userId === "string" ? new Types.ObjectId(userId) : userId;
  const today = new Date();
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

  try {
    await connectToDatabase();

    const posts: IMetric[] = await MetricModel.find({
      user: resolvedUserId,
      postDate: { $gte: startDate, $lte: endDate },
    })
      .select({ format: 1, context: 1, stats: 1, postDate: 1 })
      .lean();

    if (!posts.length) {
      return null;
    }

    const performanceByFormat: Record<
      string,
      { sumPerformance: number; count: number }
    > = {};

    for (const post of posts) {
      // CORREÇÃO: O erro ocorre porque 'post.format' é um array de strings (string[]),
      // não uma única string. A lógica foi ajustada para iterar sobre cada formato
      // dentro do array. Isso garante que cada formato seja processado individualmente,
      // resolvendo o erro de tipo.
      const formats = post.format;
      const perf = getNestedValue(post, performanceMetricField);
      if (perf == null || typeof perf !== 'number') continue;

      if (Array.isArray(formats)) {
        for (const format of formats) {
            if (!format) continue; // Pula valores vazios no array

            if (!performanceByFormat[format]) {
                performanceByFormat[format] = { sumPerformance: 0, count: 0 };
            }
            performanceByFormat[format].sumPerformance += perf;
            performanceByFormat[format].count += 1;
        }
      }
    }

    let topFormat: FormatType | null = null;
    let maxAvg = -Infinity;
    let topCount = 0;

    for (const [fmt, data] of Object.entries(performanceByFormat)) {
      if (data.count <= 0) continue;
      const avg = data.sumPerformance / data.count;
      if (avg > maxAvg) {
        maxAvg = avg;
        topFormat = fmt as FormatType;
        topCount = data.count;
      }
    }

    if (topFormat === null) {
      return null;
    }

    return {
      format: topFormat,
      averagePerformance: maxAvg,
      postsCount: topCount,
      metricUsed: performanceMetricField,
    };
  } catch (error) {
    logger.error(
      `Error calculating top performing format for user ${resolvedUserId}, period ${periodInDays} days, metric ${performanceMetricField}:`,
      error
    );
    return null;
  }
}

export default getTopPerformingFormat;
