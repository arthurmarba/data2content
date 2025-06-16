import MetricModel, { IMetric, FormatType } from "@/app/models/Metric"; // Ajuste o caminho
import { Types } from "mongoose";
import { getNestedValue } from "./dataAccessHelpers"; // Importar a função compartilhada

interface FormatPerformanceData {
  format: FormatType | string | null;
  averagePerformance: number;
  postsCount: number;
  metricUsed: string;
}

async function getTopPerformingFormat(
  userId: string | Types.ObjectId,
  periodInDays: number,
  performanceMetricField: string // Ex: "stats.total_interactions", "stats.views"
): Promise<FormatPerformanceData | null> {
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

    let topFormat: FormatType | string | null = null;
    let maxAveragePerformance = -Infinity;
    let topFormatPostsCount = 0;

    for (const formatKey in performanceByFormat) {
      const data = performanceByFormat[formatKey];
      if (data.count > 0) {
        const average = data.sumPerformance / data.count;
        if (average > maxAveragePerformance) {
          maxAveragePerformance = average;
          topFormat = formatKey as FormatType;
          topFormatPostsCount = data.count;
        }
      }
    }

    if (topFormat === null) {
      return null;
    }

    return {
      format: topFormat,
      averagePerformance: maxAveragePerformance,
      postsCount: topFormatPostsCount,
      metricUsed: performanceMetricField,
    };

  } catch (error) {
    console.error(`Error calculating top performing format for userId ${resolvedUserId}:`, error);
    return null;
  }
}

export default getTopPerformingFormat;
```
