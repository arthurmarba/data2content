// /api/v1/users/[userId]/kpis/periodic-comparison/route.ts (CORRIGIDO)

import { NextResponse } from 'next/server';
import { Types } from 'mongoose';

import calculateFollowerGrowthRate from '@/utils/calculateFollowerGrowthRate';
import calculateAverageEngagementPerPost from '@/utils/calculateAverageEngagementPerPost';
import calculateWeeklyPostingFrequency from '@/utils/calculateWeeklyPostingFrequency';
import MetricModel from '@/app/models/Metric';
import { addDays, getStartDateFromTimePeriod as getStartDateFromTimePeriodGeneric } from '@/utils/dateHelpers';

// Tipos de dados para a resposta
interface MiniChartDataPoint {
  name: string;
  value: number;
}
interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null;
  chartData?: MiniChartDataPoint[];
}

// Otimização: A interface de resposta agora espera 'engagementRate'
interface UserPeriodicComparisonResponse {
  followerGrowth: KPIComparisonData;
  engagementRate: KPIComparisonData; // Alterado de totalEngagement
  postingFrequency: KPIComparisonData;
  avgViewsPerPost: KPIComparisonData;
  avgCommentsPerPost: KPIComparisonData;
  avgSharesPerPost: KPIComparisonData;
  avgSavesPerPost: KPIComparisonData;
  insightSummary?: {
    followerGrowth?: string;
    engagementRate?: string; // Alterado de totalEngagement
    postingFrequency?: string;
    avgViewsPerPost?: string;
    avgCommentsPerPost?: string;
    avgSharesPerPost?: string;
    avgSavesPerPost?: string;
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

  const comparisonConfig = comparisonPeriodParam && ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam]
    ? ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam]
    : ALLOWED_COMPARISON_PERIODS["last_30d_vs_previous_30d"];

  if (comparisonPeriodParam && !ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam]) {
     return NextResponse.json({ error: `Comparison period inválido. Permitidos: ${Object.keys(ALLOWED_COMPARISON_PERIODS).join(', ')}` }, { status: 400 });
  }

  const { currentPeriodDays, periodNameCurrent, periodNamePrevious } = comparisonConfig!;
  const today = new Date();

  const currentEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const currentStartDate = getStartDateFromTimePeriodGeneric(today, `last_${currentPeriodDays}_days`);

  const previousEndDate = addDays(new Date(currentStartDate), -1);
  previousEndDate.setHours(23,59,59,999);
  const previousStartDate = addDays(new Date(previousEndDate), -(currentPeriodDays -1));
  previousStartDate.setHours(0,0,0,0);

  try {
    const resolvedUserId = new Types.ObjectId(userId);

    // --- 1. Follower Growth ---
    // Esses valores agora são usados também no cálculo da taxa de engajamento
    const fgT0Data = await calculateFollowerGrowthRate(resolvedUserId, currentPeriodDays);
    const fgT1 = fgT0Data.previousFollowers; // Seguidores no início do período atual
    const fgT0 = fgT0Data.currentFollowers;   // Seguidores no final do período atual

    const fgOverall = await calculateFollowerGrowthRate(resolvedUserId, currentPeriodDays * 2);
    const fgT2 = fgOverall.previousFollowers; // Seguidores no início do período anterior

    const currentFollowerGain = (fgT0 !== null && fgT1 !== null) ? fgT0 - fgT1 : null;
    const previousFollowerGain = (fgT1 !== null && fgT2 !== null) ? fgT1 - fgT2 : null;

    const followerGrowthData: KPIComparisonData = {
      currentValue: currentFollowerGain,
      previousValue: previousFollowerGain,
      percentageChange: calculatePercentageChange(currentFollowerGain, previousFollowerGain),
      chartData: [
        { name: periodNamePrevious, value: previousFollowerGain ?? 0 },
        { name: periodNameCurrent, value: currentFollowerGain ?? 0 }
      ]
    };

    // --- 2. Engagement Rate ---
    const engCurrentResult = await calculateAverageEngagementPerPost(resolvedUserId, {startDate: currentStartDate, endDate: currentEndDate});
    const engPreviousResult = await calculateAverageEngagementPerPost(resolvedUserId, {startDate: previousStartDate, endDate: previousEndDate});

    // Otimização: Cálculo da taxa de engajamento
    const currentEngagementRate = (engCurrentResult.totalEngagement !== null && fgT0 !== null && fgT0 > 0)
      ? (engCurrentResult.totalEngagement / fgT0) * 100
      : null;
    
    // Usamos fgT1 (seguidores no início do período atual) como uma aproximação para os seguidores do período anterior
    const previousEngagementRate = (engPreviousResult.totalEngagement !== null && fgT1 !== null && fgT1 > 0)
      ? (engPreviousResult.totalEngagement / fgT1) * 100
      : null;

    const engagementRateData: KPIComparisonData = {
      currentValue: currentEngagementRate,
      previousValue: previousEngagementRate,
      percentageChange: calculatePercentageChange(currentEngagementRate, previousEngagementRate),
      chartData: [
        { name: periodNamePrevious, value: previousEngagementRate ? parseFloat(previousEngagementRate.toFixed(2)) : 0 },
        { name: periodNameCurrent, value: currentEngagementRate ? parseFloat(currentEngagementRate.toFixed(2)) : 0 }
      ]
    };

    // --- 3. Posting Frequency ---
    const freqData = await calculateWeeklyPostingFrequency(resolvedUserId, currentPeriodDays);
    const postingFrequencyData: KPIComparisonData = {
      currentValue: freqData.currentWeeklyFrequency,
      previousValue: freqData.previousWeeklyFrequency,
      percentageChange: calculatePercentageChange(freqData.currentWeeklyFrequency, freqData.previousWeeklyFrequency),
      chartData: [
        { name: periodNamePrevious, value: freqData.previousWeeklyFrequency ? parseFloat(freqData.previousWeeklyFrequency.toFixed(1)) : 0 },
        { name: periodNameCurrent, value: freqData.currentWeeklyFrequency ? parseFloat(freqData.currentWeeklyFrequency.toFixed(1)) : 0 }
      ]
    };

    async function getAverage(field: string, start: Date, end: Date): Promise<number | null> {
      const [agg] = await MetricModel.aggregate([
        { $match: { user: resolvedUserId, postDate: { $gte: start, $lte: end } } },
        { $project: { value: `$${field}` } },
        { $match: { value: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$value' } } }
      ]);
      return agg?.avg ?? null;
    }

    const [currViews, prevViews, currComments, prevComments, currShares, prevShares, currSaves, prevSaves] = await Promise.all([
      getAverage('stats.views', currentStartDate, currentEndDate),
      getAverage('stats.views', previousStartDate, previousEndDate),
      getAverage('stats.comments', currentStartDate, currentEndDate),
      getAverage('stats.comments', previousStartDate, previousEndDate),
      getAverage('stats.shares', currentStartDate, currentEndDate),
      getAverage('stats.shares', previousStartDate, previousEndDate),
      getAverage('stats.saved', currentStartDate, currentEndDate),
      getAverage('stats.saved', previousStartDate, previousEndDate),
    ]);

    const avgViewsPerPostData: KPIComparisonData = {
      currentValue: currViews,
      previousValue: prevViews,
      percentageChange: calculatePercentageChange(currViews, prevViews),
      chartData: [
        { name: periodNamePrevious, value: prevViews ?? 0 },
        { name: periodNameCurrent, value: currViews ?? 0 }
      ]
    };
    const avgCommentsPerPostData: KPIComparisonData = {
      currentValue: currComments,
      previousValue: prevComments,
      percentageChange: calculatePercentageChange(currComments, prevComments),
      chartData: [
        { name: periodNamePrevious, value: prevComments ?? 0 },
        { name: periodNameCurrent, value: currComments ?? 0 }
      ]
    };
    const avgSharesPerPostData: KPIComparisonData = {
      currentValue: currShares,
      previousValue: prevShares,
      percentageChange: calculatePercentageChange(currShares, prevShares),
      chartData: [
        { name: periodNamePrevious, value: prevShares ?? 0 },
        { name: periodNameCurrent, value: currShares ?? 0 }
      ]
    };
    const avgSavesPerPostData: KPIComparisonData = {
      currentValue: currSaves,
      previousValue: prevSaves,
      percentageChange: calculatePercentageChange(currSaves, prevSaves),
      chartData: [
        { name: periodNamePrevious, value: prevSaves ?? 0 },
        { name: periodNameCurrent, value: currSaves ?? 0 }
      ]
    };

    const response: UserPeriodicComparisonResponse = {
      followerGrowth: followerGrowthData,
      engagementRate: engagementRateData, // Otimização: Retornando a nova métrica
      postingFrequency: postingFrequencyData,
      avgViewsPerPost: avgViewsPerPostData,
      avgCommentsPerPost: avgCommentsPerPostData,
      avgSharesPerPost: avgSharesPerPostData,
      avgSavesPerPost: avgSavesPerPostData,
      insightSummary: {
        followerGrowth: `Ganho de ${followerGrowthData.currentValue?.toLocaleString() ?? 'N/A'} seguidores no período.`,
        engagementRate: `Taxa de engajamento média de ${engagementRateData.currentValue?.toFixed(2) ?? 'N/A'}%.`, // Otimização: Novo insight
        postingFrequency: `Média de ${postingFrequencyData.currentValue?.toFixed(1) ?? 'N/A'} posts por semana.`
      }
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error(`[API USER KPIS/PERIODIC] Error for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const errorKpi: KPIComparisonData = { currentValue: null, previousValue: null, percentageChange: null, chartData: [{name: periodNamePrevious, value:0}, {name: periodNameCurrent, value:0}]};
    return NextResponse.json({
        error: "Erro ao processar sua solicitação de KPIs.",
        details: errorMessage,
        followerGrowth: errorKpi,
        engagementRate: errorKpi, // Alterado
        postingFrequency: errorKpi,
        avgViewsPerPost: errorKpi,
        avgCommentsPerPost: errorKpi,
        avgSharesPerPost: errorKpi,
        avgSavesPerPost: errorKpi,
    }, { status: 500 });
  }
}