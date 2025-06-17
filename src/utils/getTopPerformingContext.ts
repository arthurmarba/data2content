import MetricModel, { IMetric } from "@/app/models/Metric"; // Ajuste o caminho
import { Types } from "mongoose";
import { getNestedValue } from "./dataAccessHelpers"; // Importar a função compartilhada

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
  const endDate = new Date(today);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - periodInDays);

  try {
    const posts: IMetric[] = await MetricModel.find({
      user: resolvedUserId,
      postDate: { $gte: startDate, $lte: endDate },
    }).lean();

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
    console.error(`Error calculating top performing context for userId ${resolvedUserId}:`, error);
    return null;
  }
}

export default getTopPerformingContext;
```
