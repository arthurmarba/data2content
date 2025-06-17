// src/utils/getTopPerformingContext.ts

import MetricModel, { IMetric } from "@/app/models/Metric";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getNestedValue } from "./dataAccessHelpers";
import { getStartDateFromTimePeriod } from "./dateHelpers";

export type ContextType = string;

interface ContextPerformanceData {
  context: ContextType | null;
  averagePerformance: number;
  postsCount: number;
  metricUsed: string;
}

async function getTopPerformingContext(
  userId: string | Types.ObjectId,
  periodInDays: number,
  performanceMetricField: string
): Promise<ContextPerformanceData | null> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  const endDate = new Date(
    today.getFullYear(), today.getMonth(), today.getDate(),
    23, 59, 59, 999
  );
  const startDate = getStartDateFromTimePeriod(today, `last_${periodInDays}_days`);

  try {
    await connectToDatabase();

    const posts: IMetric[] = await MetricModel.find({
      user: resolvedUserId,
      postDate: { $gte: startDate, $lte: endDate },
    }).lean();

    if (!posts || posts.length === 0) {
      return null;
    }

    const performanceByContext: Record<string, { sumPerformance: number; count: number }> = {};

    for (const post of posts) {
      const context = post.context as ContextType | undefined;
      const perf = getNestedValue(post, performanceMetricField);
      if (!context || perf == null) continue;

      const key = context.toString();
      if (!performanceByContext[key]) {
        performanceByContext[key] = { sumPerformance: 0, count: 0 };
      }
      performanceByContext[key].sumPerformance += perf;
      performanceByContext[key].count += 1;
    }

    const entries = Object.entries(performanceByContext);
    if (entries.length === 0) {
      return null;
    }

    let topContext: ContextType | null = null;
    let maxAvg = -Infinity;
    let topCount = 0;

    for (const [ctx, data] of entries) {
      if (data.count <= 0) continue;
      const avg = data.sumPerformance / data.count;
      if (avg > maxAvg) {
        maxAvg = avg;
        topContext = ctx as ContextType;
        topCount = data.count;
      }
    }

    if (topContext === null) {
      return null;
    }

    return {
      context: topContext,
      averagePerformance: maxAvg,
      postsCount: topCount,
      metricUsed: performanceMetricField,
    };
  } catch (error) {
    logger.error(
      `Error calculating top performing context for user ${resolvedUserId}, period ${periodInDays} days, metric ${performanceMetricField}:`,
      error
    );
    return null;
  }
}

export default getTopPerformingContext;
