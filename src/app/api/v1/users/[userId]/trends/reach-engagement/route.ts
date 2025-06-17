import { NextResponse } from 'next/server';
import getReachEngagementTrendChartData from '@/charts/getReachEngagementTrendChartData'; // Ajuste o caminho
import { Types } from 'mongoose';

type ReachEngagementChartResponse = any;

// Reutilizar as constantes de validação ou definir específicas se necessário
const ALLOWED_TIME_PERIODS: string[] = ["last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months", "all_time"]; // all_time pode não ser ideal para reach/engaged diário/semanal
const ALLOWED_GRANULARITIES: string[] = ["daily", "weekly"];

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

  // Fornecer valores padrão e validar
  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_30_days"; // Default time period

  const granularity = granularityParam && ALLOWED_GRANULARITIES.includes(granularityParam)
    ? granularityParam as "daily" | "weekly"
    : "daily"; // Default granularity

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  if (granularityParam && !ALLOWED_GRANULARITIES.includes(granularityParam)) {
    return NextResponse.json({ error: `Granularity inválida. Permitidas: ${ALLOWED_GRANULARITIES.join(', ')}` }, { status: 400 });
  }

  try {
    const data: ReachEngagementChartResponse = await getReachEngagementTrendChartData(
      userId,
      timePeriod,
      granularity
    );

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error(`[API TRENDS/REACH-ENGAGEMENT] Error fetching reach & engagement trend data for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}

