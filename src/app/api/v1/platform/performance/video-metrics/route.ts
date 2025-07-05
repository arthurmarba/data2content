// src/app/api/v1/platform/performance/video-metrics/route.ts (Versão corrigida para leitura)

import { NextResponse } from 'next/server';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';

const DEFAULT_VIDEO_TYPES: string[] = ['REEL', 'VIDEO'];

interface PlatformVideoMetricsResponse {
  averageRetentionRate: number | null;
  averageWatchTimeSeconds: number | null;
  averageViews: number | null;
  numberOfVideoPosts: number | null;
  insightSummary?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod') as TimePeriod | null;
  const timePeriod: TimePeriod =
    timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
      ? timePeriodParam
      : 'last_90_days';

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json(
      { error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();
    const today = new Date();
    const endDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
      999
    );
    const startDate = getStartDateFromTimePeriod(today, timePeriod);

    const queryConditions: any = { type: { $in: DEFAULT_VIDEO_TYPES } };
    if (timePeriod !== 'all_time') {
      queryConditions.postDate = { $gte: startDate, $lte: endDate };
    }

    // ==================== INÍCIO DA MUDANÇA ====================
    // A mágica acontece aqui. Modificamos a query para calcular as métricas na hora da leitura.
    const [agg] = await MetricModel.aggregate([
      { $match: queryConditions },
      {
        $project: {
          // 1. Calcula o Tempo Médio de Visualização em segundos
          // Ele busca por 'ig_reels_avg_watch_time' (em ms) e divide por 1000.
          average_video_watch_time_seconds: {
            $cond: {
              if: { $gt: [{ $ifNull: ['$stats.ig_reels_avg_watch_time', 0] }, 0] },
              then: { $divide: ['$stats.ig_reels_avg_watch_time', 1000] },
              else: null
            }
          },
          // 2. Calcula a Taxa de Retenção
          // Ele usa o valor calculado acima e divide pela duração do vídeo.
          retention_rate: {
            $cond: {
              if: {
                $and: [
                  { $gt: [{ $ifNull: ['$stats.ig_reels_avg_watch_time', 0] }, 0] },
                  { $gt: [{ $ifNull: ['$stats.video_duration_seconds', 0] }, 0] } // Evita divisão por zero
                ]
              },
              then: {
                $divide: [
                  { $divide: ['$stats.ig_reels_avg_watch_time', 1000] }, // watch time em segundos
                  '$stats.video_duration_seconds' // duration em segundos
                ]
              },
              else: null
            }
          },
          // 3. Visualizações do vídeo
          views: {
            $ifNull: [
              '$stats.views',
              { $ifNull: ['$stats.video_views', null] }
            ]
          }
        },
      },
      {
        $group: {
          _id: null,
          totalRetentionSum: {
            $sum: { $ifNull: ['$retention_rate', 0] }
          },
          countRetentionValid: {
            $sum: { $cond: [{ $ne: ['$retention_rate', null] }, 1, 0] }
          },
          totalWatchTimeSum: {
            $sum: { $ifNull: ['$average_video_watch_time_seconds', 0] }
          },
          countWatchTimeValid: {
            $sum: { $cond: [{ $ne: ['$average_video_watch_time_seconds', null] }, 1, 0] }
          },
          totalViewsSum: { $sum: { $ifNull: ['$views', 0] } },
          countViewsValid: { $sum: { $cond: [{ $ne: ['$views', null] }, 1, 0] } },
          totalVideoPosts: { $sum: 1 },
        },
      },
    ]);
    // ==================== FIM DA MUDANÇA ====================

    if (!agg || agg.totalVideoPosts === 0) {
      const summary = `Nenhum post de vídeo encontrado no período "${timePeriod}".`;
      return NextResponse.json<PlatformVideoMetricsResponse>({
        averageRetentionRate: null,
        averageWatchTimeSeconds: null,
        averageViews: null,
        numberOfVideoPosts: 0,
        insightSummary: summary,
      });
    }

    // Cálculo dos valores médios. Multiplica a retenção por 100 para ser porcentagem.
    const avgRetention = agg.countRetentionValid
      ? (agg.totalRetentionSum / agg.countRetentionValid) * 100
      : null;
    const avgWatchTime = agg.countWatchTimeValid
      ? agg.totalWatchTimeSum / agg.countWatchTimeValid
      : null;
    const avgViews = agg.countViewsValid
      ? agg.totalViewsSum / agg.countViewsValid
      : null;

    const summary =
      `No período "${timePeriod}", visualizações médias: ${
        avgViews != null ? avgViews.toFixed(0) : 'N/A'
      }, tempo médio de visualização: ${
        avgWatchTime != null ? avgWatchTime.toFixed(0) + 's' : 'N/A'
      } em ${agg.totalVideoPosts.toLocaleString()} vídeos.`;

    return NextResponse.json<PlatformVideoMetricsResponse>({
      averageRetentionRate: avgRetention,
      averageWatchTimeSeconds: avgWatchTime,
      averageViews: avgViews,
      numberOfVideoPosts: agg.totalVideoPosts,
      insightSummary: summary,
    });
  } catch (error) {
    console.error('[API PLATFORM/VIDEO-METRICS]', error);
    return NextResponse.json(
      {
        error: 'Erro ao processar métricas de vídeo.',
      },
      { status: 500 }
    );
  }
}