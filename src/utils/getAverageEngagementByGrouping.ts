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
 * @param userId ID do usuário ou ObjectId
 * @param periodInDays Número de dias para o período (ex: 30)
 * @param videoFormats Array de formatos de vídeo a considerar (ex: ['REEL', 'VIDEO'])
 * @returns Objetos com contagem de posts, retenção média (%) e tempo médio de visualização (s)
 */
async function calculateAverageVideoMetrics(
  userId: string | Types.ObjectId,
  periodInDays: number,
  videoFormats: string[] = ['REEL', 'VIDEO']
): Promise<AverageVideoMetricsData> {
  const resolvedUserId = typeof userId === 'string'
    ? new Types.ObjectId(userId)
    : userId;

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

    // Buscar posts do usuário filtrando formatos de vídeo
    const videoPosts: IMetric[] = await MetricModel.find({
      user: resolvedUserId,
      postDate: { $gte: startDate, $lte: endDate },
      format: { $in: videoFormats },
    }).lean();

    const count = videoPosts.length;
    if (count === 0) return result;

    let sumRetention = 0;
    let sumWatchTime = 0;

    for (const post of videoPosts) {
      const stats = post.stats as any;
      if (typeof stats.retention_rate === 'number') {
        sumRetention += stats.retention_rate;
      }
      if (typeof stats.average_video_watch_time_seconds === 'number') {
        sumWatchTime += stats.average_video_watch_time_seconds;
      }
    }

    result.numberOfVideoPosts = count;
    result.averageRetentionRate = (sumRetention / count) * 100;          // Converter decimal para percentual
    result.averageWatchTimeSeconds = sumWatchTime / count;

    return result;
  } catch (err) {
    logger.error(`Erro ao calcular métricas de vídeo (${resolvedUserId}):`, err);
    return result;
  }
}

export default calculateAverageVideoMetrics;
