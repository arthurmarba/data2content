// src/app/api/v1/users/[userId]/trends/reach-engagement/route.ts

import { NextResponse } from 'next/server';
// --- INÍCIO DA CORREÇÃO DE BUILD ---
// Corrigida a importação para usar a exportação nomeada correta.
import { getUserReachInteractionTrendChartData, ContentFilters } from '@/charts/getReachInteractionTrendChartData';
// --- FIM DA CORREÇÃO DE BUILD ---
import { connectToDatabase } from '@/app/lib/mongoose';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { Types } from 'mongoose';

const ALLOWED_GRANULARITIES: string[] = ["daily", "weekly"];

function isAllowedTimePeriod(period: any): period is TimePeriod {
    return ALLOWED_TIME_PERIODS.includes(period);
}

export async function GET(
  request: Request,
  { params }: { params: { userId: string } } 
) {
  const { userId } = params;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'User ID inválido ou ausente.' }, { status: 400 });
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
    
  const formatParam = searchParams.get('format');
  const proposalParam = searchParams.get('proposal');
  const contextParam = searchParams.get('context');

  const contentFilters: ContentFilters = {};
  if (formatParam) {
    contentFilters.format = formatParam.split(',').filter(id => id.trim() !== '');
  }
  if (proposalParam) {
    contentFilters.proposal = proposalParam.split(',').filter(id => id.trim() !== '');
  }
  if (contextParam) {
    contentFilters.context = contextParam.split(',').filter(id => id.trim() !== '');
  }

  try {
    await connectToDatabase();
    
    // --- INÍCIO DA CORREÇÃO DE BUILD ---
    // Corrigido o nome da função chamada para corresponder à importação.
    const userData = await getUserReachInteractionTrendChartData(
      userId,
      timePeriod,
      granularity,
      contentFilters
    );
    // --- FIM DA CORREÇÃO DE BUILD ---

    if (!userData) {
      return NextResponse.json({
        chartData: [],
        insightSummary: "Erro ao buscar dados do usuário."
      }, { status: 500 });
    }
    
    return NextResponse.json(userData, { status: 200 });

  } catch (error) {
    console.error(`[API USERS/TRENDS/REACH-ENGAGEMENT] Error for user ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}