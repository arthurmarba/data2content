import MetricModel, { IMetric, FormatType } from "@/app/models/Metric"; // Ajuste o caminho
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Added
import { logger } from "@/app/lib/logger"; // Added
import { getNestedValue } from "./dataAccessHelpers"; // Importar a função compartilhada
import { getStartDateFromTimePeriod } from "./dateHelpers"; // Added

interface FormatPerformanceData {
  format: FormatType | string | null;
  averagePerformance: number;
  postsCount: number;
  metricUsed: string;
}

async function getLowPerformingFormat(
  userId: string | Types.ObjectId,
  periodInDays: number,
  performanceMetricField: string, // Ex: "stats.total_interactions", "stats.views"
  minPostsForConsideration: number = 3 // Mínimo de posts para um formato ser considerado "low"
): Promise<FormatPerformanceData | null> {
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
    // 1. $match stage for user and date range.
    // 2. $group stage by 'format' to calculate $avg of 'performanceMetricField' and count.
    // 3. $match stage to filter groups where count is >= minPostsForConsideration.
    // 4. $sort stage by average performance ascending.
    // 5. $limit stage to 1.

    if (!posts || posts.length === 0) {
      return null;
    }

    const performanceByFormat: {
      [key: string]: { sumPerformance: number; count: number }
    } = {};

    for (const post of posts) {
      const format = post.format as string;
      const performanceValue = getNestedValue(post, performanceMetricField);

      if (format && performanceValue !== null) {
        if (!performanceByFormat[format]) {
          performanceByFormat[format] = { sumPerformance: 0, count: 0 };
        }
        performanceByFormat[format].sumPerformance += performanceValue;
        performanceByFormat[format].count += 1;
      }
    }

    if (Object.keys(performanceByFormat).length === 0) {
      return null;
    }

    let lowFormat: FormatType | string | null = null;
    let minAveragePerformance = Infinity;
    let lowFormatPostsCount = 0;

    for (const formatKey in performanceByFormat) {
      const data = performanceByFormat[formatKey];
      // Considerar apenas formatos com um número mínimo de posts
      if (data.count >= minPostsForConsideration) { // Simplified condition
        const average = data.sumPerformance / data.count;
        if (average < minAveragePerformance) {
          minAveragePerformance = average;
          lowFormat = formatKey as FormatType;
          lowFormatPostsCount = data.count;
        }
      }
    }

    if (lowFormat === null) {
      // Pode acontecer se nenhum formato atender ao minPostsForConsideration
      return null;
    }

    return {
      format: lowFormat,
      averagePerformance: minAveragePerformance,
      postsCount: lowFormatPostsCount,
      metricUsed: performanceMetricField,
    };

  } catch (error) {
    logger.error(`Error calculating low performing format for userId ${resolvedUserId}, period ${periodInDays} days, metric ${performanceMetricField}:`, error); // Replaced console.error
    return null;
  }
}

export default getLowPerformingFormat;
```
