import MetricModel, { IMetric } from "@/app/models/Metric"; // Ajuste o caminho
import { Types } from "mongoose";
import { getNestedValue } from "./dataAccessHelpers"; // Importar a função compartilhada
import { getStartDateFromTimePeriod } from "./dateHelpers";

// --- Tipos e Enums definidos localmente para resolver o erro ---
export enum FormatType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  REEL = "REEL",
  CAROUSEL_ALBUM = "CAROUSEL_ALBUM",
}

export interface FormatPerformanceData {
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
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, `last_${periodInDays}_days`);

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
      const format = (post.format as string) || "UNKNOWN";
      const performanceValue = getNestedValue(post, performanceMetricField);

      if (format && typeof performanceValue === 'number') {
        if (!performanceByFormat[format]) {
          performanceByFormat[format] = { sumPerformance: 0, count: 0 };
        }
        const formatData = performanceByFormat[format];
        if (formatData) {
            formatData.sumPerformance += performanceValue;
            formatData.count += 1;
        }
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
      if (data && data.count > 0 && data.count >= minPostsForConsideration) {
        const average = data.sumPerformance / data.count;
        if (average < minAveragePerformance) {
          minAveragePerformance = average;
          lowFormat = formatKey as FormatType;
          lowFormatPostsCount = data.count;
        }
      }
    }

    if (lowFormat === null) {
      return null;
    }

    return {
      format: lowFormat,
      averagePerformance: minAveragePerformance,
      postsCount: lowFormatPostsCount,
      metricUsed: performanceMetricField,
    };

  } catch (error) {
    console.error(`Error calculating low performing format for userId ${resolvedUserId}:`, error);
    return null;
  }
}

export default getLowPerformingFormat;
