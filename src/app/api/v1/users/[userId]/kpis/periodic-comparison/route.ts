import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';

// ⚙️ Garante execução em Node e desativa qualquer cache estático da rota
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Importando tipos e utilitários
import { KpiComparison as UserPeriodicComparisonResponse, KPIComparisonData } from '@/types/mediakit';
import calculateFollowerGrowthRate from '@/utils/calculateFollowerGrowthRate';
import calculateAverageEngagementPerPost from '@/utils/calculateAverageEngagementPerPost';
import calculateWeeklyPostingFrequency from '@/utils/calculateWeeklyPostingFrequency';
import MetricModel from '@/app/models/Metric';
import { addDays, getStartDateFromTimePeriod as getStartDateFromTimePeriodGeneric } from '@/utils/dateHelpers';
import { triggerDataRefresh } from '@/app/lib/instagram';

// Períodos de comparação permitidos
const ALLOWED_COMPARISON_PERIODS: {
  [key: string]: { currentPeriodDays: number; periodNameCurrent: string; periodNamePrevious: string }
} = {
  month_vs_previous: { currentPeriodDays: 30, periodNameCurrent: 'Este Mês', periodNamePrevious: 'Mês Passado' },
  last_7d_vs_previous_7d: { currentPeriodDays: 7, periodNameCurrent: 'Últimos 7 Dias', periodNamePrevious: '7 Dias Anteriores' },
  last_30d_vs_previous_30d: { currentPeriodDays: 30, periodNameCurrent: 'Últimos 30 Dias', periodNamePrevious: '30 Dias Anteriores' },
};

const MAX_METRIC_AGE_HOURS = 24;

// Função auxiliar para calcular a variação percentual
function calculatePercentageChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return current > 0 ? Infinity : current === 0 ? 0 : -Infinity;
  return ((current - previous) / previous) * 100;
}

// Função auxiliar para criar o objeto de dados de KPI, evitando repetição
function createKpiDataObject(
  current: number | null,
  previous: number | null,
  periodNames: { current: string; previous: string }
): KPIComparisonData {
  return {
    currentValue: current,
    previousValue: previous,
    percentageChange: calculatePercentageChange(current, previous),
    chartData: [
      { name: periodNames.previous, value: previous ?? 0 },
      { name: periodNames.current, value: current ?? 0 },
    ],
  };
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
  const comparisonPeriodParam = searchParams.get('comparisonPeriod') || 'last_30d_vs_previous_30d';
  const comparisonConfig = ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam];

  if (!comparisonConfig) {
    return NextResponse.json(
      { error: `Período de comparação inválido. Permitidos: ${Object.keys(ALLOWED_COMPARISON_PERIODS).join(', ')}` },
      { status: 400 }
    );
  }

  const { currentPeriodDays, periodNameCurrent, periodNamePrevious } = comparisonConfig;
  const today = new Date();
  const currentEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const currentStartDate = getStartDateFromTimePeriodGeneric(today, `last_${currentPeriodDays}_days`);
  const previousEndDate = addDays(new Date(currentStartDate), -1);
  previousEndDate.setHours(23, 59, 59, 999);
  const previousStartDate = addDays(new Date(previousEndDate), -(currentPeriodDays - 1));
  previousStartDate.setHours(0, 0, 0, 0);

  try {
    // ✅ Garante conexão ANTES de qualquer consulta (aggregate/find)
    await connectToDatabase();

    const resolvedUserId = new Types.ObjectId(userId);

    const latestMetric = await MetricModel.findOne({ user: resolvedUserId })
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .lean();
    const isStale =
      !latestMetric?.updatedAt ||
      Date.now() - new Date(latestMetric.updatedAt).getTime() >
        MAX_METRIC_AGE_HOURS * 60 * 60 * 1000;
    if (isStale) {
      try {
        await triggerDataRefresh(userId);
      } catch (e) {
        console.error(
          `[API USER KPIS/PERIODIC] refresh failed for user ${userId}:`,
          e,
        );
      }
    }

    async function getAverage(field: string, start: Date, end: Date): Promise<number | null> {
      const [agg] = await MetricModel.aggregate([
        { $match: { user: resolvedUserId, postDate: { $gte: start, $lte: end } } },
        { $project: { value: `$${field}` } },
        { $match: { value: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$value' } } },
      ]);
      return agg?.avg ?? null;
    }

    async function getAverageViews(start: Date, end: Date): Promise<number | null> {
      const [agg] = await MetricModel.aggregate([
        { $match: { user: resolvedUserId, postDate: { $gte: start, $lte: end } } },
        { $project: { value: { $ifNull: ['$stats.views', '$stats.video_views'] } } },
        { $match: { value: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$value' } } },
      ]);
      return agg?.avg ?? null;
    }

    const [
      fgDataCurrent,
      fgDataOverall,
      engCurrentResult,
      engPreviousResult,
      freqData,
      currViews,
      prevViews,
      currLikes,
      prevLikes,
      currComments,
      prevComments,
      currShares,
      prevShares,
      currSaves,
      prevSaves,
      // NOVO: Buscando o Alcance Médio
      currReach,
      prevReach,
    ] = await Promise.all([
      calculateFollowerGrowthRate(resolvedUserId, currentPeriodDays),
      calculateFollowerGrowthRate(resolvedUserId, currentPeriodDays * 2),
      calculateAverageEngagementPerPost(resolvedUserId, { startDate: currentStartDate, endDate: currentEndDate }),
      calculateAverageEngagementPerPost(resolvedUserId, { startDate: previousStartDate, endDate: previousEndDate }),
      calculateWeeklyPostingFrequency(resolvedUserId, currentPeriodDays),
      getAverageViews(currentStartDate, currentEndDate),
      getAverageViews(previousStartDate, previousEndDate),
      getAverage('stats.likes', currentStartDate, currentEndDate),
      getAverage('stats.likes', previousStartDate, previousEndDate),
      getAverage('stats.comments', currentStartDate, currentEndDate),
      getAverage('stats.comments', previousStartDate, previousEndDate),
      getAverage('stats.shares', currentStartDate, currentEndDate),
      getAverage('stats.shares', previousStartDate, previousEndDate),
      getAverage('stats.saved', currentStartDate, currentEndDate),
      getAverage('stats.saved', previousStartDate, previousEndDate),
      // NOVO: Chamada para a nova métrica de alcance
      getAverage('stats.reach', currentStartDate, currentEndDate),
      getAverage('stats.reach', previousStartDate, previousEndDate),
    ]);

    const fgT0 = fgDataCurrent.currentFollowers;
    const fgT1 = fgDataCurrent.previousFollowers;
    const fgT2 = fgDataOverall.previousFollowers;

    const currentFollowerGain = fgT0 !== null && fgT1 !== null ? fgT0 - fgT1 : null;
    const previousFollowerGain = fgT1 !== null && fgT2 !== null ? fgT1 - fgT2 : null;
    const followerGrowthData = createKpiDataObject(currentFollowerGain, previousFollowerGain, {
      current: periodNameCurrent,
      previous: periodNamePrevious,
    });

    const currentEngagementRate =
      engCurrentResult.totalEngagement !== null && fgT0 !== null && fgT0 > 0
        ? (engCurrentResult.totalEngagement / fgT0) * 100
        : null;
    const previousEngagementRate =
      engPreviousResult.totalEngagement !== null && fgT1 !== null && fgT1 > 0
        ? (engPreviousResult.totalEngagement / fgT1) * 100
        : null;
    const engagementRateData = createKpiDataObject(
      currentEngagementRate,
      previousEngagementRate,
      { current: periodNameCurrent, previous: periodNamePrevious }
    );

    const totalEngagementData = createKpiDataObject(
      engCurrentResult.totalEngagement,
      engPreviousResult.totalEngagement,
      { current: periodNameCurrent, previous: periodNamePrevious }
    );

    const postingFrequencyData = createKpiDataObject(
      freqData.currentWeeklyFrequency,
      freqData.previousWeeklyFrequency,
      { current: periodNameCurrent, previous: periodNamePrevious }
    );

    const periodNames = { current: periodNameCurrent, previous: periodNamePrevious };

    const avgViewsPerPostData = createKpiDataObject(currViews, prevViews, periodNames);
    const avgLikesPerPostData = createKpiDataObject(currLikes, prevLikes, periodNames);
    const avgCommentsPerPostData = createKpiDataObject(currComments, prevComments, periodNames);
    const avgSharesPerPostData = createKpiDataObject(currShares, prevShares, periodNames);
    const avgSavesPerPostData = createKpiDataObject(currSaves, prevSaves, periodNames);
    // NOVO: Criando o objeto de dados para o alcance médio
    const avgReachPerPostData = createKpiDataObject(currReach, prevReach, periodNames);

    const compactNumberFormat = (num: number | null) =>
      num?.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }) ?? 'N/A';

    const response: UserPeriodicComparisonResponse = {
      comparisonPeriod: comparisonPeriodParam,
      followerGrowth: followerGrowthData,
      engagementRate: engagementRateData,
      totalEngagement: totalEngagementData,
      postingFrequency: postingFrequencyData,
      avgViewsPerPost: avgViewsPerPostData,
      avgLikesPerPost: avgLikesPerPostData,
      avgCommentsPerPost: avgCommentsPerPostData,
      avgSharesPerPost: avgSharesPerPostData,
      avgSavesPerPost: avgSavesPerPostData,
      // NOVO: Adicionando o alcance médio à resposta
      avgReachPerPost: avgReachPerPostData,
      insightSummary: {
        followerGrowth: `Ganho de ${followerGrowthData.currentValue?.toLocaleString() ?? 'N/A'} seguidores.`,
        engagementRate: `Taxa de ${engagementRateData.currentValue?.toFixed(2) ?? 'N/A'}% por post.`,
        totalEngagement: `${compactNumberFormat(totalEngagementData.currentValue)} interações no período.`,
        postingFrequency: `${postingFrequencyData.currentValue?.toFixed(1) ?? 'N/A'} posts por semana.`,
        avgViewsPerPost: `Média de ${compactNumberFormat(avgViewsPerPostData.currentValue)} views/post.`,
        avgLikesPerPost: `Média de ${compactNumberFormat(avgLikesPerPostData.currentValue)} curtidas/post.`,
        avgCommentsPerPost: `Média de ${compactNumberFormat(avgCommentsPerPostData.currentValue)} comentários/post.`,
        avgSharesPerPost: `Média de ${compactNumberFormat(avgSharesPerPostData.currentValue)} compartilhamentos/post.`,
        avgSavesPerPost: `Média de ${compactNumberFormat(avgSavesPerPostData.currentValue)} salvamentos/post.`,
        // NOVO: Insight para o alcance médio
        avgReachPerPost: `Média de ${compactNumberFormat(avgReachPerPostData.currentValue)} contas alcançadas/post.`,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(`[API USER KPIS/PERIODIC] Error for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorKpi: KPIComparisonData = { currentValue: null, previousValue: null, percentageChange: null, chartData: [] };
    return NextResponse.json(
      {
        error: 'Erro ao processar sua solicitação de KPIs.',
        details: errorMessage,
        followerGrowth: errorKpi,
        engagementRate: errorKpi,
        totalEngagement: errorKpi,
        postingFrequency: errorKpi,
        avgViewsPerPost: errorKpi,
        avgCommentsPerPost: errorKpi,
        avgSharesPerPost: errorKpi,
        avgSavesPerPost: errorKpi,
        avgLikesPerPost: errorKpi,
        // NOVO: Adicionando o campo de alcance à resposta de erro
        avgReachPerPost: errorKpi,
      },
      { status: 500 }
    );
  }
}
