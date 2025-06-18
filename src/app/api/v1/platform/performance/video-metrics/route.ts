import { NextResponse } from 'next/server';
import MetricModel from '@/app/models/Metric';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';

// Periodos permitidos para o filtro de tempo

// Tipos de vídeo usados para filtrar métricas pelo campo `type` do Metric
const DEFAULT_VIDEO_TYPES: string[] = ['REEL', 'VIDEO'];

interface PlatformVideoMetricsResponse {
  averageRetentionRate: number | null;
  averageWatchTimeSeconds: number | null;
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

    // Filtra posts de vídeo usando o campo `type`
    const queryConditions: any = { type: { $in: DEFAULT_VIDEO_TYPES } };
    if (timePeriod !== 'all_time') {
      queryConditions.postDate = { $gte: startDate, $lte: endDate };
    }

    const [agg] = await MetricModel.aggregate([
      { $match: queryConditions },
      {
        $project: {
          retention_rate: { $ifNull: ['$stats.retention_rate', null] },
          average_video_watch_time_seconds: {
            $ifNull: ['$stats.average_video_watch_time_seconds', null],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalRetentionSum: {
            $sum: {
              $cond: [{ $isNumber: '$retention_rate' }, '$retention_rate', 0],
            },
          },
          countRetentionValid: {
            $sum: {
              $cond: [{ $isNumber: '$retention_rate' }, 1, 0],
            },
          },
          totalWatchTimeSum: {
            $sum: {
              $cond: [{ $isNumber: '$average_video_watch_time_seconds' }, '$average_video_watch_time_seconds', 0],
            },
          },
          countWatchTimeValid: {
            $sum: {
              $cond: [{ $isNumber: '$average_video_watch_time_seconds' }, 1, 0],
            },
          },
          totalVideoPosts: { $sum: 1 },
        },
      },
    ]);

    // Se nenhum post de vídeo foi encontrado
    if (!agg || agg.totalVideoPosts === 0) {
      const summary = `Nenhum post de vídeo encontrado no período "${timePeriod}".`;
      return NextResponse.json<PlatformVideoMetricsResponse>({
        averageRetentionRate: null,
        averageWatchTimeSeconds: null,
        numberOfVideoPosts: 0,
        insightSummary: summary,
      });
    }

    // Cálculo dos valores médios
    const avgRetention = agg.countRetentionValid
      ? (agg.totalRetentionSum / agg.countRetentionValid) * 100
      : null;
    const avgWatchTime = agg.countWatchTimeValid
      ? agg.totalWatchTimeSum / agg.countWatchTimeValid
      : null;

    const summary =
      `No período "${timePeriod}", retenção média de vídeos: ${
        avgRetention != null ? avgRetention.toFixed(1) + '%' : 'N/A'
      }, tempo médio de visualização: ${
        avgWatchTime != null ? avgWatchTime.toFixed(0) + 's' : 'N/A'
      } em ${agg.totalVideoPosts.toLocaleString()} vídeos.`;

    return NextResponse.json<PlatformVideoMetricsResponse>({
      averageRetentionRate: avgRetention,
      averageWatchTimeSeconds: avgWatchTime,
      numberOfVideoPosts: agg.totalVideoPosts,
      insightSummary: summary,
    });
  } catch (error) {
    console.error('[API PLATFORM/VIDEO-METRICS]', error);
    return NextResponse.json(
      {
        error: 'Erro ao processar métricas de vídeo.',
        averageRetentionRate: null,
        averageWatchTimeSeconds: null,
        numberOfVideoPosts: null,
        insightSummary: 'Falha ao carregar dados de performance de vídeo.'
      },
      { status: 500 }
    );
  }
}
