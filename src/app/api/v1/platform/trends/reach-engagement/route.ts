// src/app/api/v1/platform/trends/reach-engagement/route.ts

import { NextResponse } from 'next/server';
// --- INÍCIO DA CORREÇÃO ---
// Importa a função de lógica correta e específica para a plataforma.
import { getPlatformReachEngagementTrendChartData } from '@/charts/getReachInteractionTrendChartData';
// --- FIM DA CORREÇÃO ---
import { connectToDatabase } from '@/app/lib/mongoose';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
export const dynamic = 'force-dynamic';


interface ApiChartDataPoint {
  date: string;
  reach: number | null;
  totalInteractions: number | null;
}

interface ChartResponse {
  chartData: ApiChartDataPoint[];
  insightSummary?: string;
  averageReach?: number;
  averageInteractions?: number;
}

const ALLOWED_GRANULARITIES: string[] = ["daily", "weekly"];

function isAllowedTimePeriod(period: any): period is TimePeriod {
    return ALLOWED_TIME_PERIODS.includes(period);
}

export async function GET(
  request: Request,
) {
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
    await connectToDatabase();
    
    // --- INÍCIO DA CORREÇÃO ---
    // Chama a função de agregação de plataforma, que não precisa de um userId.
    const platformData = await getPlatformReachEngagementTrendChartData(timePeriod, granularity);

    if (!platformData || platformData.chartData.length === 0) {
      return NextResponse.json({
        chartData: [],
        insightSummary: "Nenhum dado encontrado na plataforma para agregar dados."
      }, { status: 200 });
    }

    // Retorna diretamente a resposta, pois ela já está no formato correto.
    return NextResponse.json(platformData, { status: 200 });
    // --- FIM DA CORREÇÃO ---

  } catch (error) {
    console.error(`[API PLATFORM/TRENDS/REACH-ENGAGEMENT] Error aggregating platform data:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}