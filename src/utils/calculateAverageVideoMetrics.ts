import MetricModel, { IMetric, FormatType } from "@/app/models/Metric"; // Ajuste o caminho
import { Types } from "mongoose";

interface AverageVideoMetricsData {
  numberOfVideoPosts: number;
  averageRetentionRate: number; // Em percentual, ex: 25.5 para 25.5%
  averageWatchTimeSeconds: number;
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
  const endDate = new Date(today);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - periodInDays);

  const initialResult: AverageVideoMetricsData = {
    numberOfVideoPosts: 0,
    averageRetentionRate: 0.0,
    averageWatchTimeSeconds: 0,
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

    let sumRetentionRate = 0.0; // Assumindo que a retenção é armazenada como decimal (ex: 0.25 para 25%)
    let sumAverageVideoWatchTimeSeconds = 0;
    // validPostsForRetention e validPostsForWatchTime não são mais necessários para o cálculo da média
    // conforme a definição estrita da tarefa, mas podem ser úteis para outros insights.

    for (const post of videoPosts) {
      if (post.stats) {
        if (typeof post.stats.retention_rate === 'number') {
          sumRetentionRate += post.stats.retention_rate;
        }
        if (typeof post.stats.average_video_watch_time_seconds === 'number') {
          sumAverageVideoWatchTimeSeconds += post.stats.average_video_watch_time_seconds;
        }
      }
    }

    initialResult.numberOfVideoPosts = videoPosts.length;

    if (initialResult.numberOfVideoPosts > 0) {
      // A task pede a saída em percentual, ex: 25.5 para 25.5%
      // Se retention_rate no DB é decimal (0.25), multiplicamos por 100.
      // Conforme a definição da tarefa, dividir pelo número total de posts de vídeo.
      initialResult.averageRetentionRate = (sumRetentionRate / initialResult.numberOfVideoPosts) * 100;
      initialResult.averageWatchTimeSeconds = sumAverageVideoWatchTimeSeconds / initialResult.numberOfVideoPosts;
    }

    return initialResult;

  } catch (error) {
    console.error(`Error calculating average video metrics for userId ${resolvedUserId}:`, error);
    return {
      numberOfVideoPosts: 0,
      averageRetentionRate: 0.0,
      averageWatchTimeSeconds: 0,
      startDate: startDate,
      endDate: endDate,
    };
  }
}

export default calculateAverageVideoMetrics;
```
