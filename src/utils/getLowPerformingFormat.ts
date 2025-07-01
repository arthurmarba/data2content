// src/utils/getLowPerformingFormat.ts

import MetricModel, { IMetric } from "@/app/models/Metric";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getNestedValue } from "./dataAccessHelpers";
import { getStartDateFromTimePeriod } from "./dateHelpers";

// Definindo o tipo de formato se existir, senão string genérico
export type FormatType = string;

interface FormatPerformanceData {
  format: FormatType | null;
  averagePerformance: number;
  postsCount: number;
  metricUsed: string;
}

async function getLowPerformingFormat(
  userId: string | Types.ObjectId,
  periodInDays: number,
  performanceMetricField: string,
  minPostsForConsideration: number = 3
): Promise<FormatPerformanceData | null> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, `last_${periodInDays}_days`);

  try {
    await connectToDatabase();

    const posts: IMetric[] = await MetricModel.find({
      user: resolvedUserId,
      postDate: { $gte: startDate, $lte: endDate },
    })
      .select({ format: 1, context: 1, stats: 1, postDate: 1 })
      .lean();

    if (!posts.length) return null;

    const performanceByFormat: Record<string, { sumPerformance: number; count: number }> = {};

    for (const post of posts) {
      // CORREÇÃO: O erro ocorre porque 'post.format' é um array de strings (string[]),
      // não uma única string. A lógica foi ajustada para iterar sobre cada formato
      // dentro do array 'post.format'. Isso garante que cada formato seja processado
      // individualmente, resolvendo o erro de tipo.
      const formats = post.format;
      const performanceValue = getNestedValue(post, performanceMetricField);
      if (performanceValue == null || typeof performanceValue !== 'number') continue;

      if (Array.isArray(formats)) {
        for (const format of formats) {
            if (!format) continue; // Pula valores vazios no array

            if (!performanceByFormat[format]) {
                performanceByFormat[format] = { sumPerformance: 0, count: 0 };
            }
            performanceByFormat[format].sumPerformance += performanceValue;
            performanceByFormat[format].count += 1;
        }
      }
    }

    let lowFormat: FormatType | null = null;
    let minAvgPerformance = Infinity;
    let lowPostsCount = 0;

    for (const [fmt, data] of Object.entries(performanceByFormat)) {
      if (data.count < minPostsForConsideration) continue;
      const avg = data.sumPerformance / data.count;
      if (avg < minAvgPerformance) {
        minAvgPerformance = avg;
        lowFormat = fmt;
        lowPostsCount = data.count;
      }
    }

    if (lowFormat == null) return null;

    return {
      format: lowFormat,
      averagePerformance: minAvgPerformance,
      postsCount: lowPostsCount,
      metricUsed: performanceMetricField,
    };
  } catch (error) {
    logger.error(
      `Error calculating low performing format for user ${resolvedUserId}, period ${periodInDays}d, metric ${performanceMetricField}:`,
      error
    );
    return null;
  }
}

export default getLowPerformingFormat;
