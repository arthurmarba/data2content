import { NextResponse } from 'next/server';
import UserModel from '@/app/models/User';
import AccountInsightModel from '@/app/models/AccountInsight';
import MetricModel from '@/app/models/Metric'; // Importar MetricModel
import calculateAverageEngagementPerPost from '@/utils/calculateAverageEngagementPerPost'; // Usado para engajamento
import { addDays, getStartDateFromTimePeriod as getStartDateFromTimePeriodGeneric } from '@/utils/dateHelpers';
import { Types } from 'mongoose';

// Tipos de dados para a resposta
interface MiniChartDataPoint {
  name: string; // Ex: "Anterior", "Atual"
  value: number;
  // periodKey?: string; // Opcional, se o frontend precisar para algo
  // comparisonPair?: string; // Opcional
}

interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null;
  chartData?: MiniChartDataPoint[];
}

interface PlatformPeriodicComparisonResponse {
  platformFollowerGrowth: KPIComparisonData;
  platformTotalEngagement: KPIComparisonData;
  platformPostingFrequency: KPIComparisonData;
  insightSummary?: {
    platformFollowerGrowth?: string;
    platformTotalEngagement?: string;
    platformPostingFrequency?: string;
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

async function getPlatformTotalFollowersAtDate(date: Date, userIds: Types.ObjectId[]): Promise<number> {
    const userFollowerPromises = userIds.map(async (userId) => {
        const snapshot = await AccountInsightModel.findOne({
            user: userId,
            recordedAt: { $lte: date }
        }).sort({ recordedAt: -1 }).select('followersCount').lean();
        return snapshot?.followersCount || 0;
    });
    const userFollowersCounts = await Promise.all(userFollowerPromises);
    return userFollowersCounts.reduce((sum, count) => sum + count, 0);
}

async function getPlatformTotalPostsInPeriod(startDate: Date, endDate: Date, userIds: Types.ObjectId[]): Promise<number> {
    // TODO: Considerar apenas posts de usuários ativos da plataforma
    const count = await MetricModel.countDocuments({
        user: { $in: userIds },
        postDate: { $gte: startDate, $lte: endDate }
    });
    return count;
}


export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);
  const comparisonPeriodParam = searchParams.get('comparisonPeriod');

  const comparisonConfig = comparisonPeriodParam && ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam]
    ? ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam]
    : ALLOWED_COMPARISON_PERIODS["last_30d_vs_previous_30d"];

  if (comparisonPeriodParam && !ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam]) {
     return NextResponse.json({ error: `Comparison period inválido. Permitidos: ${Object.keys(ALLOWED_COMPARISON_PERIODS).join(', ')}` }, { status: 400 });
  }

  const { currentPeriodDays, periodNameCurrent, periodNamePrevious } = comparisonConfig!; // Adicionado periodNameCurrent/Previous
  const today = new Date();

  const currentEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const currentStartDate = getStartDateFromTimePeriodGeneric(today, `last_${currentPeriodDays}_days`);

  const previousEndDate = addDays(new Date(currentStartDate), -1);
  previousEndDate.setHours(23,59,59,999);
  const previousStartDate = addDays(new Date(previousEndDate), -(currentPeriodDays -1));
  previousStartDate.setHours(0,0,0,0);

  try {
    const platformUsers = await UserModel.find({
        // TODO: Adicionar critérios para usuários ativos
    }).select('_id').limit(10).lean();

    if (!platformUsers || platformUsers.length === 0) {
      const emptyKpi: KPIComparisonData = { currentValue: 0, previousValue: 0, percentageChange: 0, chartData: [{name: periodNamePrevious, value:0}, {name: periodNameCurrent, value:0}]};
      return NextResponse.json({
        platformFollowerGrowth: emptyKpi,
        platformTotalEngagement: emptyKpi,
        platformPostingFrequency: emptyKpi,
        insightSummary: {
            platformFollowerGrowth: "Nenhum usuário na plataforma.",
            platformTotalEngagement: "Nenhum usuário na plataforma.",
            platformPostingFrequency: "Nenhum usuário na plataforma."
        }
      }, { status: 200 });
    }
    const userIds = platformUsers.map(user => user._id as Types.ObjectId);

    // --- Platform Follower Growth ---
    const followersT0 = await getPlatformTotalFollowersAtDate(currentEndDate, userIds);
    const followersT1 = await getPlatformTotalFollowersAtDate(previousEndDate, userIds);
    const dayBeforePreviousStartDate = addDays(new Date(previousStartDate), -1);
    dayBeforePreviousStartDate.setHours(23,59,59,999);
    const followersT2 = await getPlatformTotalFollowersAtDate(dayBeforePreviousStartDate, userIds);

    const currentFollowerGainPlatform = followersT0 - followersT1;
    const previousFollowerGainPlatform = followersT1 - followersT2;

    const followerGrowthData: KPIComparisonData = {
      currentValue: currentFollowerGainPlatform,
      previousValue: previousFollowerGainPlatform,
      percentageChange: calculatePercentageChange(currentFollowerGainPlatform, previousFollowerGainPlatform),
      chartData: [
        { name: periodNamePrevious, value: previousFollowerGainPlatform ?? 0 },
        { name: periodNameCurrent, value: currentFollowerGainPlatform ?? 0 }
      ]
    };

    // --- Platform Total Engagement ---
    let currentPlatformTotalEngagement = 0;
    let previousPlatformTotalEngagement = 0;

    const engagementPromisesCurrent = userIds.map(uid =>
        calculateAverageEngagementPerPost(uid, {startDate: currentStartDate, endDate: currentEndDate})
    );
    const engagementResultsCurrent = await Promise.allSettled(engagementPromisesCurrent);
    engagementResultsCurrent.forEach(result => {
        if (result.status === 'fulfilled') currentPlatformTotalEngagement += result.value.totalEngagement;
        else console.error("Error fetching current engagement for a user:", result.reason);
    });

    const engagementPromisesPrevious = userIds.map(uid =>
        calculateAverageEngagementPerPost(uid, {startDate: previousStartDate, endDate: previousEndDate})
    );
    const engagementResultsPrevious = await Promise.allSettled(engagementPromisesPrevious);
    engagementResultsPrevious.forEach(result => {
        if (result.status === 'fulfilled') previousPlatformTotalEngagement += result.value.totalEngagement;
        else console.error("Error fetching previous engagement for a user:", result.reason);
    });

    const totalEngagementData: KPIComparisonData = {
      currentValue: currentPlatformTotalEngagement,
      previousValue: previousPlatformTotalEngagement,
      percentageChange: calculatePercentageChange(currentPlatformTotalEngagement, previousPlatformTotalEngagement),
      chartData: [
        { name: periodNamePrevious, value: previousPlatformTotalEngagement ?? 0 },
        { name: periodNameCurrent, value: currentPlatformTotalEngagement ?? 0 }
      ]
    };

    // --- Platform Posting Frequency ---
    const currentTotalPostsPlatform = await getPlatformTotalPostsInPeriod(currentStartDate, currentEndDate, userIds);
    const previousTotalPostsPlatform = await getPlatformTotalPostsInPeriod(previousStartDate, previousEndDate, userIds);

    // Número de dias nos períodos (deve ser currentPeriodDays para ambos, mas calcular para precisão)
    const daysInCurrentPeriod = (currentEndDate.getTime() - currentStartDate.getTime()) / (1000 * 3600 * 24) + 1;
    const daysInPreviousPeriod = (previousEndDate.getTime() - previousStartDate.getTime()) / (1000 * 3600 * 24) + 1;

    const currentPlatformWeeklyFreq = daysInCurrentPeriod > 0 ? (currentTotalPostsPlatform / daysInCurrentPeriod) * 7 : 0;
    const previousPlatformWeeklyFreq = daysInPreviousPeriod > 0 ? (previousTotalPostsPlatform / daysInPreviousPeriod) * 7 : 0;

    const postingFrequencyData: KPIComparisonData = {
        currentValue: currentPlatformWeeklyFreq,
        previousValue: previousPlatformWeeklyFreq,
        percentageChange: calculatePercentageChange(currentPlatformWeeklyFreq, previousPlatformWeeklyFreq),
        chartData: [
            { name: periodNamePrevious, value: previousPlatformWeeklyFreq ? parseFloat(previousPlatformWeeklyFreq.toFixed(1)) : 0 },
            { name: periodNameCurrent, value: currentPlatformWeeklyFreq ? parseFloat(currentPlatformWeeklyFreq.toFixed(1)) : 0 }
        ]
    };

    const response: PlatformPeriodicComparisonResponse = {
      platformFollowerGrowth: followerGrowthData,
      platformTotalEngagement: totalEngagementData,
      platformPostingFrequency: postingFrequencyData,
      insightSummary: {
          platformFollowerGrowth: `Crescimento de seguidores da plataforma: ${followerGrowthData.currentValue?.toLocaleString() ?? 'N/A'} vs ${followerGrowthData.previousValue?.toLocaleString() ?? 'N/A'} no período anterior.`,
          platformTotalEngagement: `Engajamento total da plataforma: ${totalEngagementData.currentValue?.toLocaleString() ?? 'N/A'} vs ${totalEngagementData.previousValue?.toLocaleString() ?? 'N/A'} no período anterior.`,
          platformPostingFrequency: `Frequência de posts da plataforma: ${postingFrequencyData.currentValue?.toFixed(1) ?? 'N/A'} posts/sem vs ${postingFrequencyData.previousValue?.toFixed(1) ?? 'N/A'} no período anterior.`
      }
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error("[API PLATFORM/KPIS/PERIODIC] Error fetching platform periodic comparison KPIs:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const errorKpi: KPIComparisonData = { currentValue: null, previousValue: null, percentageChange: null, chartData: [{name: periodNamePrevious, value:0}, {name: periodNameCurrent, value:0}]};
    return NextResponse.json({
        error: "Erro ao processar sua solicitação de KPIs da plataforma.",
        details: errorMessage,
        platformFollowerGrowth: errorKpi,
        platformTotalEngagement: errorKpi,
        platformPostingFrequency: errorKpi,
     }, { status: 500 });
  }
}

