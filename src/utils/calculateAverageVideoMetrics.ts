import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import MetricModel, { IMetric } from '@/app/models/Metric';
import { getStartDateFromTimePeriod } from './dateHelpers';

interface AverageVideoMetricsData {
  numberOfVideoPosts: number;
  averageRetentionRate: number; // percentual, ex: 25.5 para 25.5%
  averageWatchTimeSeconds: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Calcula métricas médias de vídeos de um usuário em um período.
 * videoTypes deve corresponder ao campo `type` do Metric.
 */
async function calculateAverageVideoMetrics(
  userId: string | Types.ObjectId,
  periodInDays: number,
  videoTypes: string[] = ['REEL', 'VIDEO']
): Promise<AverageVideoMetricsData> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23, 59, 59, 999
  );
  const startDate = getStartDateFromTimePeriod(today, `last_${periodInDays}_days`);

  const result: AverageVideoMetricsData = {
    numberOfVideoPosts: 0,
    averageRetentionRate: 0,
    averageWatchTimeSeconds: 0,
    startDate,
    endDate,
  };

  try {
    await connectToDatabase();
    // Buscar posts do usuário filtrando pelo campo `type`
    const videoPosts: IMetric[] = await MetricModel.find({
      user: resolvedUserId,
      postDate: { $gte: startDate, $lte: endDate },
      type: { $in: videoTypes },
    }).lean();

    const count = videoPosts.length;
    if (count === 0) return result;

    let sumRetention = 0;
    let sumWatchTime = 0;

    for (const post of videoPosts) {
      const stats = post.stats as any;
      if (typeof stats.retention_rate === 'number') sumRetention += stats.retention_rate;
      if (typeof stats.average_video_watch_time_seconds === 'number') sumWatchTime += stats.average_video_watch_time_seconds;
    }

    result.numberOfVideoPosts = count;
    result.averageRetentionRate = (sumRetention / count) * 100;
    result.averageWatchTimeSeconds = sumWatchTime / count;

    return result;
  } catch (err) {
    logger.error(`Erro ao calcular métricas de vídeo (${resolvedUserId}):`, err);
    return result;
  }
}

export default calculateAverageVideoMetrics;
