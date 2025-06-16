import { NextResponse } from 'next/server';
import { Types } from 'mongoose';

import calculateFollowerGrowthRate from '@/utils/calculateFollowerGrowthRate';
import calculateAverageEngagementPerPost from '@/utils/calculateAverageEngagementPerPost';
import calculateWeeklyPostingFrequency from '@/utils/calculateWeeklyPostingFrequency';
import { addDays, getStartDateFromTimePeriod as getStartDateFromTimePeriodGeneric } from '@/utils/dateHelpers';


interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null;
  chartData?: { comparisonPair: string; periodName: string; value: number; periodKey: string }[];
}

interface PeriodicComparisonResponse {
  followerGrowth: KPIComparisonData;
  totalEngagement: KPIComparisonData;
  postingFrequency: KPIComparisonData;
  insightSummary?: {
    followerGrowth?: string;
    totalEngagement?: string;
    postingFrequency?: string;
  };
}

const ALLOWED_COMPARISON_PERIODS: { [key: string]: { currentPeriodDays: number, periodNameCurrent: string, periodNamePrevious: string } } = {
  "month_vs_previous": { currentPeriodDays: 30, periodNameCurrent: "Este Mês", periodNamePrevious: "Mês Passado"},
  "last_7d_vs_previous_7d": { currentPeriodDays: 7, periodNameCurrent: "Últimos 7 Dias", periodNamePrevious: "7 Dias Anteriores"},
  "last_30d_vs_previous_30d": { currentPeriodDays: 30, periodNameCurrent: "Últimos 30 Dias", periodNamePrevious: "30 Dias Anteriores"},
};

function calculatePercentageChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) {
    return current > 0 ? 1.0 : (current === 0 ? 0.0 : -1.0);
  }
  return (current - previous) / previous;
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
  const comparisonPeriodParam = searchParams.get('comparisonPeriod');

  let comparisonConfig: { currentPeriodDays: number, periodNameCurrent: string, periodNamePrevious: string };

  if (comparisonPeriodParam) {
    const potentialConfig = ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam];
    if (potentialConfig) {
      comparisonConfig = potentialConfig;
    } else {
      return NextResponse.json({ error: `Comparison period inválido. Permitidos: ${Object.keys(ALLOWED_COMPARISON_PERIODS).join(', ')}` }, { status: 400 });
    }
  } else {
    // We add a '!' to assert that this key definitely exists, satisfying the strict type check.
    comparisonConfig = ALLOWED_COMPARISON_PERIODS["last_30d_vs_previous_30d"]!;
  }

  const { currentPeriodDays, periodNameCurrent, periodNamePrevious } = comparisonConfig;

  try {
    const resolvedUserId = new Types.ObjectId(userId);
    const today = new Date();

    // Definir datas para o período ATUAL
    const currentEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    // Usar o helper genérico para startDate do período atual, que já considera "last_X_days" a partir de 'today'
    // e inclui 'today' no período.
    const currentStartDate = getStartDateFromTimePeriodGeneric(today, `last_${currentPeriodDays}_days`);

    // Definir datas para o período ANTERIOR
    // O período anterior termina no dia antes do início do período atual.
    const previousEndDate = addDays(new Date(currentStartDate), -1); // Dia anterior ao currentStartDate
    previousEndDate.setHours(23,59,59,999);
    const previousStartDate = addDays(new Date(previousEndDate), -(currentPeriodDays -1)); // Subtrai (periodDays-1) para ter um período de 'currentPeriodDays'
    previousStartDate.setHours(0,0,0,0);


    // --- 1. Follower Growth (Absolute Growth) ---
    const fgT0Data = await calculateFollowerGrowthRate(resolvedUserId, currentPeriodDays); // Crescimento nos últimos currentPeriodDays
    const fgT1 = fgT0Data.previousFollowers; // Seguidores no início do período atual
    const fgT0 = fgT0Data.currentFollowers;   // Seguidores no fim do período atual

    // Para obter seguidores no início do período anterior (T2)
    const fgOverall = await calculateFollowerGrowthRate(resolvedUserId, currentPeriodDays * 2);
    const fgT2 = fgOverall.previousFollowers;

    const currentFollowerGain = (fgT0 !== null && fgT1 !== null) ? fgT0 - fgT1 : null;
    const previousFollowerGain = (fgT1 !== null && fgT2 !== null) ? fgT1 - fgT2 : null;

    const followerGrowthData: KPIComparisonData = {
      currentValue: currentFollowerGain,
      previousValue: previousFollowerGain,
      percentageChange: calculatePercentageChange(currentFollowerGain, previousFollowerGain),
      chartData: [
        { comparisonPair: `${periodNameCurrent} vs ${periodNamePrevious}`, periodName: periodNamePrevious, value: previousFollowerGain ?? 0, periodKey: "P0" },
        { comparisonPair: `${periodNameCurrent} vs ${periodNamePrevious}`, periodName: periodNameCurrent, value: currentFollowerGain ?? 0, periodKey: "P1" },
      ]
    };

    // --- 2. Total Engagement ---
    const engCurrent = await calculateAverageEngagementPerPost(resolvedUserId, {startDate: currentStartDate, endDate: currentEndDate});
    const engPrevious = await calculateAverageEngagementPerPost(resolvedUserId, {startDate: previousStartDate, endDate: previousEndDate});

    const totalEngagementData: KPIComparisonData = {
      currentValue: engCurrent.totalEngagement,
      previousValue: engPrevious.totalEngagement,
      percentageChange: calculatePercentageChange(engCurrent.totalEngagement, engPrevious.totalEngagement),
      chartData: [
        { comparisonPair: `${periodNameCurrent} vs ${periodNamePrevious}`, periodName: periodNamePrevious, value: engPrevious.totalEngagement ?? 0, periodKey: "P0" },
        { comparisonPair: `${periodNameCurrent} vs ${periodNamePrevious}`, periodName: periodNameCurrent, value: engCurrent.totalEngagement ?? 0, periodKey: "P1" },
      ]
    };

    // --- 3. Posting Frequency ---
    // calculateWeeklyPostingFrequency usa periodInDays para definir AMBOS os seus sub-períodos (atual e anterior)
    const freqData = await calculateWeeklyPostingFrequency(resolvedUserId, currentPeriodDays);
    const postingFrequencyData: KPIComparisonData = {
      currentValue: freqData.currentWeeklyFrequency,
      previousValue: freqData.previousWeeklyFrequency,
      percentageChange: calculatePercentageChange(freqData.currentWeeklyFrequency, freqData.previousWeeklyFrequency),
      chartData: [
        { comparisonPair: `${periodNameCurrent} vs ${periodNamePrevious}`, periodName: periodNamePrevious, value: freqData.previousWeeklyFrequency ?? 0, periodKey: "P0" },
        { comparisonPair: `${periodNameCurrent} vs ${periodNamePrevious}`, periodName: periodNameCurrent, value: freqData.currentWeeklyFrequency ?? 0, periodKey: "P1" },
      ]
    };

    const response: PeriodicComparisonResponse = {
      followerGrowth: followerGrowthData,
      totalEngagement: totalEngagementData,
      postingFrequency: postingFrequencyData,
      insightSummary: {
        followerGrowth: `Ganhos de seguidores: ${followerGrowthData.currentValue?.toLocaleString() ?? 'N/A'} vs ${followerGrowthData.previousValue?.toLocaleString() ?? 'N/A'} no período anterior.`,
        totalEngagement: `Engajamento total: ${totalEngagementData.currentValue?.toLocaleString() ?? 'N/A'} vs ${totalEngagementData.previousValue?.toLocaleString() ?? 'N/A'} no período anterior.`,
        postingFrequency: `Frequência de posts: ${postingFrequencyData.currentValue?.toFixed(1) ?? 'N/A'} posts/sem vs ${postingFrequencyData.previousValue?.toFixed(1) ?? 'N/A'} no período anterior.`
      }
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error(`[API KPIS/PERIODIC] Error for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação de KPIs.", details: errorMessage }, { status: 500 });
  }
}
