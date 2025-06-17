import MetricModel, { IMetric } from "@/app/models/Metric"; // Ajuste o caminho
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Added
import { logger } from "@/app/lib/logger"; // Added
import { getNestedValue } from "./dataAccessHelpers"; // Importar a função compartilhada
import { getStartDateFromTimePeriod } from "./dateHelpers"; // Added

interface ContextPerformanceData {
  context: string | null;
  averagePerformance: number;
  postsCount: number;
  metricUsed: string;
}

async function getTopPerformingContext(
  userId: string | Types.ObjectId,
  periodInDays: number,
  performanceMetricField: string // Ex: "stats.total_interactions", "stats.views"
): Promise<ContextPerformanceData | null> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  // endDate for query should be end of today
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  // startDate for query should be start of the first day of the period
  const startDate = getStartDateFromTimePeriod(today, `last_${periodInDays}_days`); // Standardized

  try {
    await connectToDatabase(); // Added

    const posts: IMetric[] = await MetricModel.find({
      user: resolvedUserId,
      postDate: { $gte: startDate, $lte: endDate },
    }).lean();
    // TODO: PERFORMANCE - For large datasets, this function would be more performant using a
    // MongoDB aggregation pipeline. This would involve:
    // 1. $match stage for user, date range, valid context, and valid performanceMetricField.
    // 2. $group stage by 'context' to calculate $avg of 'performanceMetricField' and count.
    // 3. $sort stage by average performance descending.
    // 4. $limit stage to 1.

    if (!posts || posts.length === 0) {
      return null;
    }

    const performanceByContext: {
      [key: string]: { sumPerformance: number; count: number }
    } = {};

    for (const post of posts) {
      const context = post.context;
      const performanceValue = getNestedValue(post, performanceMetricField);

      if (context && performanceValue !== null) {
        const contextKey = context.toString();
        if (!performanceByContext[contextKey]) {
          performanceByContext[contextKey] = { sumPerformance: 0, count: 0 };
        }
        performanceByContext[contextKey].sumPerformance += performanceValue;
        performanceByContext[contextKey].count += 1;
      }
    }

    if (Object.keys(performanceByContext).length === 0) {
      return null;
    }

    let topContext: string | null = null;
    let maxAveragePerformance = -Infinity;
    let topContextPostsCount = 0;

    for (const contextKey in performanceByContext) {
      const data = performanceByContext[contextKey];
      if (data.count > 0) {
        const average = data.sumPerformance / data.count;
        if (average > maxAveragePerformance) {
          maxAveragePerformance = average;
          topContext = contextKey;
          topContextPostsCount = data.count;
        }
      }
    }

    if (topContext === null) {
      return null;
    }

    return {
      context: topContext,
      averagePerformance: maxAveragePerformance,
      postsCount: topContextPostsCount,
      metricUsed: performanceMetricField,
    };

  } catch (error) {
    logger.error(`Error calculating top performing context for userId ${resolvedUserId}, period ${periodInDays} days, metric ${performanceMetricField}:`, error); // Replaced console.error
    return null;
  }
}

export default getTopPerformingContext;
```
