import { NextResponse } from 'next/server';
import UserModel from '@/app/models/User'; // Importar UserModel
import AccountInsightModel from '@/app/models/AccountInsight'; // Para buscar seguidores diretamente
import calculateAverageEngagementPerPost from '@/utils/calculateAverageEngagementPerPost';
import { addDays, getStartDateFromTimePeriod as getStartDateFromTimePeriodGeneric } from '@/utils/dateHelpers';

// Tipos de dados para a resposta
interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null;
  // chartData para mini-gráficos (omitido por agora)
}

interface PlatformPeriodicComparisonResponse {
  platformFollowerGrowth: KPIComparisonData;
  platformTotalEngagement: KPIComparisonData;
  // platformPostingFrequency?: KPIComparisonData; // Omitido por simplicidade nesta etapa
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

// Função auxiliar para buscar o total de seguidores da plataforma em uma data específica
async function getPlatformTotalFollowersAtDate(date: Date, userIds: Types.ObjectId[]): Promise<number> {
    // Para cada usuário, encontrar o snapshot mais recente ATÉ essa data
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

  const comparisonConfig = comparisonPeriodParam && ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam]
    ? ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam]
    : ALLOWED_COMPARISON_PERIODS["last_30d_vs_previous_30d"];

  if (comparisonPeriodParam && !ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam]) {
     return NextResponse.json({ error: `Comparison period inválido. Permitidos: ${Object.keys(ALLOWED_COMPARISON_PERIODS).join(', ')}` }, { status: 400 });
  }

  const { currentPeriodDays } = comparisonConfig;
  const today = new Date();

  // Definir datas para o período ATUAL
  const currentEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const currentStartDate = getStartDateFromTimePeriodGeneric(today, `last_${currentPeriodDays}_days`);

  // Definir datas para o período ANTERIOR
  const previousEndDate = addDays(new Date(currentStartDate), -1);
  previousEndDate.setHours(23,59,59,999);
  const previousStartDate = addDays(new Date(previousEndDate), -(currentPeriodDays -1));
  previousStartDate.setHours(0,0,0,0);

  try {
    // 1. Buscar Usuários da Plataforma
    const platformUsers = await UserModel.find({
        // TODO: Adicionar critérios para usuários ativos
    }).select('_id').limit(10).lean(); // Limitar para teste

    if (!platformUsers || platformUsers.length === 0) {
      return NextResponse.json({
        platformFollowerGrowth: { currentValue: 0, previousValue: 0, percentageChange: 0 },
        platformTotalEngagement: { currentValue: 0, previousValue: 0, percentageChange: 0 },
        insightSummary: { platformFollowerGrowth: "Nenhum usuário na plataforma.", platformTotalEngagement: "Nenhum usuário na plataforma." }
      }, { status: 200 });
    }
    const userIds = platformUsers.map(user => user._id as Types.ObjectId);


    // --- Platform Follower Growth ---
    // T0 = Fim do período atual (currentEndDate)
    // T1 = Fim do período anterior (previousEndDate) / Início do período atual
    // T2 = Início do período anterior (previousStartDate)

    const followersT0 = await getPlatformTotalFollowersAtDate(currentEndDate, userIds);
    const followersT1 = await getPlatformTotalFollowersAtDate(previousEndDate, userIds);

    // Para T2, precisamos do valor no *início* do previousStartDate.
    // A data passada para getPlatformTotalFollowersAtDate é $lte.
    // Para pegar o valor no "início" do previousStartDate, precisamos do valor do dia anterior a previousStartDate.
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
```
