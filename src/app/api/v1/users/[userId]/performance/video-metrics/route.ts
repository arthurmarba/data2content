import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import calculateAverageVideoMetrics from '@/utils/calculateAverageVideoMetrics';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';

interface AverageVideoMetricsData {
  averageRetentionRate: number;
  averageWatchTimeSeconds: number;
  averageViews: number;
  averageLikes: number;
  averageComments: number;
  numberOfVideoPosts: number;
  averageShares: number;
  averageSaves: number;
}

interface UserVideoMetricsResponse extends Omit<Awaited<ReturnType<typeof calculateAverageVideoMetrics>>, 'startDate' | 'endDate'> {
  insightSummary?: string;
}

// --- Função de verificação de tipo (Type Guard) ---
function isAllowedTimePeriod(period: any): period is TimePeriod {
    return ALLOWED_TIME_PERIODS.includes(period);
}

// Helper para converter timePeriod string para periodInDays number

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "User ID inválido ou ausente." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');

  // CORREÇÃO: Usa a função de verificação de tipo para validar e inferir o tipo correto.
  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : "last_90_days";

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  try {
    const periodInDaysValue = timePeriodToDays(timePeriod);

    const videoMetrics: AverageVideoMetricsData = await calculateAverageVideoMetrics(
      userId,
      periodInDaysValue
    );

    const responsePayload: UserVideoMetricsResponse = {
      averageRetentionRate: videoMetrics.averageRetentionRate,
      averageWatchTimeSeconds: videoMetrics.averageWatchTimeSeconds,
      averageViews: videoMetrics.averageViews,
      averageLikes: videoMetrics.averageLikes,
      averageComments: videoMetrics.averageComments,
      numberOfVideoPosts: videoMetrics.numberOfVideoPosts,
      averageShares: videoMetrics.averageShares,
      averageSaves: videoMetrics.averageSaves,
      insightSummary: `Nos ${timePeriod.replace("last_","").replace("_"," ")}, a retenção média dos seus vídeos é de ${videoMetrics.averageRetentionRate.toFixed(1)}% e o tempo médio de visualização é de ${videoMetrics.averageWatchTimeSeconds.toFixed(0)}s, baseado em ${videoMetrics.numberOfVideoPosts} vídeos.`
    };
    if (videoMetrics.numberOfVideoPosts === 0) {
        responsePayload.insightSummary = `Nenhum post de vídeo encontrado para o período selecionado (${timePeriod.replace("last_","").replace("_"," ")}).`;
    }


    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error) {
    console.error(`[API USER/PERFORMANCE/VIDEO-METRICS] Error for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação de métricas de vídeo.", details: errorMessage }, { status: 500 });
  }
}
