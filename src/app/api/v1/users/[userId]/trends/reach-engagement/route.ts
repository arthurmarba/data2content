// src/app/api/v1/users/[userId]/trends/reach-engagement/route.ts
import { NextResponse } from 'next/server';
import getReachInteractionTrendChartData from '@/charts/getReachInteractionTrendChartData';
import { Types } from 'mongoose';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';

// Tipos específicos para a resposta da API.
interface ApiReachEngagementDataPoint {
  date: string;
  reach: number | null;
  engagedUsers: number | null;
}

interface ReachEngagementChartResponse {
  chartData: ApiReachEngagementDataPoint[];
  insightSummary?: string;
}


const ALLOWED_GRANULARITIES: string[] = ["daily", "weekly"];

// --- Função de verificação de tipo (Type Guard) ---
function isAllowedTimePeriod(period: any): period is TimePeriod {
    return ALLOWED_TIME_PERIODS.includes(period);
}

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
  const granularityParam = searchParams.get('granularity');

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : "last_30_days";

  const granularity = granularityParam && ALLOWED_GRANULARITIES.includes(granularityParam)
    ? granularityParam as "daily" | "weekly"
    : "daily";

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  if (granularityParam && !ALLOWED_GRANULARITIES.includes(granularityParam)) {
    return NextResponse.json({ error: `Granularity inválida. Permitidas: ${ALLOWED_GRANULARITIES.join(', ')}` }, { status: 400 });
  }

  try {
    const data: ReachEngagementChartResponse =
      await getReachInteractionTrendChartData(
        userId,
        timePeriod,
        granularity
      );

    if (!data.chartData || data.chartData.length === 0) {
      data.insightSummary =
        data.insightSummary || 'Sem dados no período selecionado.';
    }

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error(`[API TRENDS/REACH-ENGAGEMENT] Error fetching reach & engagement trend data for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}
