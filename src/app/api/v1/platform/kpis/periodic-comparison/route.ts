import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import UserModel from '@/app/models/User';
import AccountInsightModel from '@/app/models/AccountInsight';
import calculateAverageEngagementPerPost from '@/utils/calculateAverageEngagementPerPost';
import { addDays, getStartDateFromTimePeriod as getStartDateFromTimePeriodGeneric } from '@/utils/dateHelpers';

// Tipos de dados para a resposta
interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null;
}

interface PlatformPeriodicComparisonResponse {
  platformFollowerGrowth: KPIComparisonData;
  platformTotalEngagement: KPIComparisonData;
  insightSummary?: {
    platformFollowerGrowth?: string;
    platformTotalEngagement?: string;
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


export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);
  const comparisonPeriodParam = searchParams.get('comparisonPeriod');

  // Define the variable that will hold the configuration.
  let comparisonConfig: { currentPeriodDays: number, periodNameCurrent: string, periodNamePrevious: string };

  if (comparisonPeriodParam) {
    const potentialConfig = ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam];
    if (potentialConfig) {
      // If a valid comparison period is provided via URL parameter, use it.
      comparisonConfig = potentialConfig;
    } else {
      // If the parameter is provided but is not a valid key, return an error response.
      return NextResponse.json({ error: `Comparison period inválido. Permitidos: ${Object.keys(ALLOWED_COMPARISON_PERIODS).join(', ')}` }, { status: 400 });
    }
  } else {
    // If no parameter is provided, use the default configuration.
    // We add a '!' to assert that this key definitely exists, satisfying the strict type check.
    comparisonConfig = ALLOWED_COMPARISON_PERIODS["last_30d_vs_previous_30d"]!;
  }
  
  // At this point, TypeScript's control-flow analysis knows that 'comparisonConfig' is definitely assigned.
  const { currentPeriodDays } = comparisonConfig;
  const today = new Date();

  const currentEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const currentStartDate = getStartDateFromTimePeriodGeneric(today, `last_${currentPeriodDays}_days`);

  const previousEndDate = addDays(new Date(currentStartDate), -1);
  previousEndDate.setHours(23,59,59,999);
  const previousStartDate = addDays(new Date(previousEndDate), -(currentPeriodDays -1));
  previousStartDate.setHours(0,0,0,0);

  try {
    const platformUsers = await UserModel.find({
        // Critérios para usuários ativos podem ser adicionados aqui
    }).select('_id').limit(10).lean(); // Limitar para teste

    if (!platformUsers || platformUsers.length === 0) {
      return NextResponse.json({
        platformFollowerGrowth: { currentValue: 0, previousValue: 0, percentageChange: 0 },
        platformTotalEngagement: { currentValue: 0, previousValue: 0, percentageChange: 0 },
        insightSummary: { platformFollowerGrowth: "Nenhum usuário na plataforma.", platformTotalEngagement: "Nenhum usuário na plataforma." }
      }, { status: 200 });
    }
    const userIds = platformUsers.map(user => user._id as Types.ObjectId);

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
    };

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
    };

    const response: PlatformPeriodicComparisonResponse = {
      platformFollowerGrowth: followerGrowthData,
      platformTotalEngagement: totalEngagementData,
      insightSummary: {
          platformFollowerGrowth: `Crescimento de seguidores da plataforma: ${followerGrowthData.currentValue?.toLocaleString() ?? 'N/A'} vs ${followerGrowthData.previousValue?.toLocaleString() ?? 'N/A'} no período anterior.`,
          platformTotalEngagement: `Engajamento total da plataforma: ${totalEngagementData.currentValue?.toLocaleString() ?? 'N/A'} vs ${totalEngagementData.previousValue?.toLocaleString() ?? 'N/A'} no período anterior.`
      }
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error("[API PLATFORM/KPIS/PERIODIC] Error fetching platform periodic comparison KPIs:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação de KPIs da plataforma.", details: errorMessage }, { status: 500 });
  }
}
