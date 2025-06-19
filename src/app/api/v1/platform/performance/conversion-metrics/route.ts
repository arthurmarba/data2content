import { NextResponse } from 'next/server';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';
import { fetchPlatformConversionMetrics } from '@/app/lib/dataService/marketAnalysisService';


interface PlatformConversionMetricsResponse {
  averageFollowerConversionRatePerPost: number;
  accountFollowerConversionRate: number;
  numberOfPostsConsideredForRate: number;
  accountsEngagedInPeriod: number;
  followersGainedInPeriod: number;
}

// CORREÇÃO: Função de verificação de tipo (type guard) para validar o parâmetro
function isAllowedTimePeriod(period: any): period is TimePeriod {
    return ALLOWED_TIME_PERIODS.includes(period);
}


export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');

  // CORREÇÃO: Usa a função de verificação de tipo para validar e inferir o tipo correto.
  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : "last_90_days"; // Default

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  try {
    const metrics = await fetchPlatformConversionMetrics({ dateRange: { startDate, endDate } });
    return NextResponse.json(metrics, { status: 200 });
  } catch (error: any) {
    console.error('[API PLATFORM/PERFORMANCE/CONVERSION-METRICS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao processar sua solicitação de métricas de conversão da plataforma.', details: errorMessage }, { status: 500 });
  }
}
