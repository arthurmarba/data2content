// src/app/api/v1/platform/trends/reach-engagement/route.ts

import { NextResponse } from 'next/server';
import UserModel from '@/app/models/User';
import getReachEngagementTrendChartData from '@/charts/getReachEngagementTrendChartData';
import getReachInteractionTrendChartData from '@/charts/getReachInteractionTrendChartData';
import { connectToDatabase } from '@/app/lib/mongoose';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { Types } from 'mongoose';
import {
  addDays,
  formatDateYYYYMMDD,
  getStartDateFromTimePeriod,
  getYearWeek,
} from '@/utils/dateHelpers';

interface ApiChartDataPoint {
  date: string;
  reach: number | null;
  totalInteractions: number | null;
}

interface ChartResponse {
  chartData: ApiChartDataPoint[];
  insightSummary: string;
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
    
    // A lógica foi simplificada para chamar a função de agregação de plataforma diretamente.
    // O placeholder de userId é mantido por compatibilidade de interface, mas não é usado.
    const placeholderUserId = new Types.ObjectId();
    const platformData = await getReachEngagementTrendChartData(placeholderUserId, timePeriod, granularity);

    if (!platformData || platformData.chartData.length === 0) {
      return NextResponse.json({
        chartData: [],
        insightSummary: "Nenhum dado encontrado na plataforma para agregar dados."
      }, { status: 200 });
    }

    // A função já retorna os dados no formato correto.
    // Apenas garantimos que o nome da propriedade esteja correto na resposta final.
    const response: ChartResponse = {
      chartData: platformData.chartData.map(d => ({
          date: d.date,
          reach: d.reach,
          totalInteractions: d.totalInteractions,
      })),
      insightSummary: platformData.insightSummary || "Dados de tendência da plataforma.",
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error(`[API PLATFORM/TRENDS/REACH-ENGAGEMENT] Error aggregating platform data:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}
