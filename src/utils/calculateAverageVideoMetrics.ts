import MetricModel, { IMetric } from "@/app/models/Metric"; // Ajuste o caminho
import { Types } from "mongoose";
import { getStartDateFromTimePeriod } from "@/utils/dateHelpers";

// --- Tipos e Enums definidos localmente para resolver o erro ---
export enum FormatType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  REEL = "REEL",
  CAROUSEL_ALBUM = "CAROUSEL_ALBUM",
}

export interface AverageVideoMetricsData {
  numberOfVideoPosts: number;
  averageRetentionRate: number | null; // Em percentual, ex: 25.5 para 25.5%
  averageWatchTimeSeconds: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

async function calculateAverageVideoMetrics(
  userId: string | Types.ObjectId,
  periodInDays: number,
  videoFormats: FormatType[] = [FormatType.REEL, FormatType.VIDEO] // Default video formats
): Promise<AverageVideoMetricsData> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  
  // Usar helper para consistência
  const startDate = getStartDateFromTimePeriod(today, `last_${periodInDays}_days`);
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  const initialResult: AverageVideoMetricsData = {
    numberOfVideoPosts: 0,
    averageRetentionRate: null, // Default to null when no data
    averageWatchTimeSeconds: null, // Default to null when no data
    startDate: startDate,
    endDate: endDate,
  };

  try {
    const videoPosts: IMetric[] = await MetricModel.find({
      user: resolvedUserId,
      postDate: { $gte: startDate, $lte: endDate },
      format: { $in: videoFormats }, // Filtrar por tipos de vídeo
    }).lean();

    if (!videoPosts || videoPosts.length === 0) {
      return initialResult;
    }

    let sumRetentionRate = 0.0;
    let sumAverageVideoWatchTimeSeconds = 0;
    let validPostsForRetention = 0;
    let validPostsForWatchTime = 0;

    for (const post of videoPosts) {
      if (post.stats) {
        if (typeof post.stats.retention_rate === 'number') {
          sumRetentionRate += post.stats.retention_rate;
          validPostsForRetention++;
        }
        if (typeof post.stats.average_video_watch_time_seconds === 'number') {
          sumAverageVideoWatchTimeSeconds += post.stats.average_video_watch_time_seconds;
          validPostsForWatchTime++;
        }
      }
    }

    initialResult.numberOfVideoPosts = videoPosts.length;

    if (validPostsForRetention > 0) {
      // Se retention_rate no DB é decimal (0.25), multiplicamos por 100.
      initialResult.averageRetentionRate = (sumRetentionRate / validPostsForRetention) * 100;
    }
    
    if (validPostsForWatchTime > 0) {
      initialResult.averageWatchTimeSeconds = sumAverageVideoWatchTimeSeconds / validPostsForWatchTime;
    }

    return initialResult;

  } catch (error) {
    console.error(`Error calculating average video metrics for userId ${resolvedUserId}:`, error);
    // Retorna a resposta inicial com nulos em caso de erro
    return initialResult;
  }
}

export default calculateAverageVideoMetrics;
