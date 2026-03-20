import { NextRequest, NextResponse } from 'next/server';
import { camelizeKeys } from '@/utils/camelizeKeys';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import aggregatePlatformPerformanceHighlights from '@/utils/aggregatePlatformPerformanceHighlights';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';
import { aggregatePlatformDayPerformance } from '@/utils/aggregatePlatformDayPerformance';
import { aggregatePlatformTimePerformance } from '@/utils/aggregatePlatformTimePerformance';
import { getAgencySession } from '@/lib/getAgencySession';
import UserModel from '@/app/models/User';
import MetricModel, { IMetric } from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { getNestedValue } from '@/utils/dataAccessHelpers';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';
import { getCategoryById } from '@/app/lib/classification';

export const dynamic = 'force-dynamic';

const PERFORMANCE_METRIC_FIELD = 'stats.total_interactions';
const PERFORMANCE_METRIC_LABEL = 'Interacoes (media por post)';

interface PerformanceHighlight {
  name: string;
  metricName: string;
  value: number;
  valueFormatted: string;
  postsCount?: number;
}

interface PlatformPerformanceSummaryResponse {
  topPerformingFormat: PerformanceHighlight | null;
  lowPerformingFormat: PerformanceHighlight | null;
  topPerformingContext: PerformanceHighlight | null;
  topPerformingProposal: PerformanceHighlight | null;
  topPerformingTone: PerformanceHighlight | null;
  topPerformingReference: PerformanceHighlight | null;
  topPerformingContentIntent: PerformanceHighlight | null;
  topPerformingNarrativeForm: PerformanceHighlight | null;
  topPerformingContentSignal: PerformanceHighlight | null;
  topPerformingStance: PerformanceHighlight | null;
  topPerformingProofStyle: PerformanceHighlight | null;
  topPerformingCommercialMode: PerformanceHighlight | null;
  bestDay: { dayOfWeek: number; average: number } | null;
  insightSummary: string;
}

interface TimePerformanceSlot {
  dayOfWeek: number;
  hour: number;
  average: number;
  count: number;
}

interface TimeDistributionResponse {
  buckets: TimePerformanceSlot[];
  bestSlots: TimePerformanceSlot[];
  worstSlots: TimePerformanceSlot[];
  insightSummary?: string;
}

function isAllowedTimePeriod(period: unknown): period is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(period as TimePeriod);
}

function formatPerformanceValue(value: number, metricFieldId: string): string {
  if (metricFieldId.includes('Rate') || metricFieldId.includes('percentage')) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

function getPortugueseWeekdayNameForSummary(day: number): string {
  const days = ['Domingo', 'Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado'];
  return days[day - 1] || '';
}

function toPerformanceHighlight(
  source: { name: string | null; average: number; count: number } | null,
  performanceMetricLabel: string,
  performanceMetricField: string
): PerformanceHighlight | null {
  if (!source) return null;

  return {
    name: source.name as string,
    metricName: performanceMetricLabel,
    value: source.average,
    valueFormatted: formatPerformanceValue(source.average, performanceMetricField),
    postsCount: source.count,
  };
}

async function fetchFormatRanking(timePeriod: TimePeriod, agencyId: string, onlyActiveSubscribers = false) {
  await connectToDatabase();

  const userQuery: Record<string, unknown> = { agency: agencyId };
  if (onlyActiveSubscribers) {
    userQuery.planStatus = 'active';
  }

  const agencyUsers = await UserModel.find(userQuery).select('_id').lean();
  const agencyUserIds = agencyUsers.map((user) => user._id);

  if (agencyUserIds.length === 0) {
    return { chartData: [], metricUsed: PERFORMANCE_METRIC_FIELD, groupBy: 'format' };
  }

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  const query: Record<string, unknown> = {
    user: { $in: agencyUserIds },
  };

  if (timePeriod !== 'all_time') {
    query.postDate = { $gte: startDate, $lte: endDate };
  }

  const posts: IMetric[] = await MetricModel.find(query).lean();
  const performanceByGroup: Record<string, { sumPerformance: number; count: number }> = {};

  for (const post of posts) {
    const groupKey = post.format;
    const metricValue = getNestedValue(post, PERFORMANCE_METRIC_FIELD);
    if (!groupKey || metricValue === null) continue;

    const keys = Array.isArray(groupKey) ? groupKey : [groupKey];
    for (const key of keys) {
      if (!performanceByGroup[key]) {
        performanceByGroup[key] = { sumPerformance: 0, count: 0 };
      }
      performanceByGroup[key].sumPerformance += metricValue;
      performanceByGroup[key].count += 1;
    }
  }

  const results = Object.entries(performanceByGroup)
    .map(([key, data]) => ({
      name: key,
      value: data.sumPerformance / data.count,
      postsCount: data.count,
    }))
    .sort((a, b) => b.value - a.value);

  return { chartData: results, metricUsed: PERFORMANCE_METRIC_FIELD, groupBy: 'format' };
}

export async function GET(request: NextRequest) {
  const session = await getAgencySession(request);
  if (!session || !session.user || !session.user.agencyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const onlyActiveSubscribers = searchParams.get('onlyActiveSubscribers') === 'true';
  const contextFilter = searchParams.get('context') || undefined;
  const creatorContext = searchParams.get('creatorContext') || undefined;
  const heatmapMetricParam = searchParams.get('heatmapMetric') || undefined;
  const heatmapFormatParam = searchParams.get('heatmapFormat') || undefined;
  const heatmapProposalParam = searchParams.get('heatmapProposal') || undefined;
  const heatmapContextParam = searchParams.get('heatmapContext') || undefined;
  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam) ? timePeriodParam : 'last_90_days';

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Invalid timePeriod. Allowed: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  const periodInDaysValue = timePeriodToDays(timePeriod);
  const heatmapMetricField = heatmapMetricParam || PERFORMANCE_METRIC_FIELD;
  const heatmapContext = heatmapContextParam || contextFilter;

  const [aggResult, dayAgg, formatRanking, timeDistributionRaw] = await Promise.all([
    aggregatePlatformPerformanceHighlights(
      periodInDaysValue,
      PERFORMANCE_METRIC_FIELD,
      session.user.agencyId,
      new Date(),
      onlyActiveSubscribers,
      contextFilter,
      creatorContext
    ),
    aggregatePlatformDayPerformance(
      periodInDaysValue,
      PERFORMANCE_METRIC_FIELD,
      { context: contextFilter || undefined, creatorContext: creatorContext || undefined },
      session.user.agencyId,
      new Date(),
      onlyActiveSubscribers
    ),
    fetchFormatRanking(timePeriod, session.user.agencyId, onlyActiveSubscribers),
    aggregatePlatformTimePerformance(
      periodInDaysValue,
      heatmapMetricField,
      {
        format: heatmapFormatParam || undefined,
        proposal: heatmapProposalParam || undefined,
        context: heatmapContext || undefined,
        creatorContext: creatorContext || undefined,
      },
      session.user.agencyId,
      new Date(),
      onlyActiveSubscribers
    ),
  ]);

  const bestDay = dayAgg.bestDays[0] || null;
  const summary: PlatformPerformanceSummaryResponse = {
    topPerformingFormat: toPerformanceHighlight(aggResult.topFormat, PERFORMANCE_METRIC_LABEL, PERFORMANCE_METRIC_FIELD),
    lowPerformingFormat: toPerformanceHighlight(aggResult.lowFormat, PERFORMANCE_METRIC_LABEL, PERFORMANCE_METRIC_FIELD),
    topPerformingContext: toPerformanceHighlight(aggResult.topContext, PERFORMANCE_METRIC_LABEL, PERFORMANCE_METRIC_FIELD),
    topPerformingProposal: toPerformanceHighlight(aggResult.topProposal, PERFORMANCE_METRIC_LABEL, PERFORMANCE_METRIC_FIELD),
    topPerformingTone: toPerformanceHighlight(aggResult.topTone, PERFORMANCE_METRIC_LABEL, PERFORMANCE_METRIC_FIELD),
    topPerformingReference: toPerformanceHighlight(aggResult.topReference, PERFORMANCE_METRIC_LABEL, PERFORMANCE_METRIC_FIELD),
    topPerformingContentIntent: toPerformanceHighlight(aggResult.topContentIntent, PERFORMANCE_METRIC_LABEL, PERFORMANCE_METRIC_FIELD),
    topPerformingNarrativeForm: toPerformanceHighlight(aggResult.topNarrativeForm, PERFORMANCE_METRIC_LABEL, PERFORMANCE_METRIC_FIELD),
    topPerformingContentSignal: toPerformanceHighlight(aggResult.topContentSignal, PERFORMANCE_METRIC_LABEL, PERFORMANCE_METRIC_FIELD),
    topPerformingStance: toPerformanceHighlight(aggResult.topStance, PERFORMANCE_METRIC_LABEL, PERFORMANCE_METRIC_FIELD),
    topPerformingProofStyle: toPerformanceHighlight(aggResult.topProofStyle, PERFORMANCE_METRIC_LABEL, PERFORMANCE_METRIC_FIELD),
    topPerformingCommercialMode: toPerformanceHighlight(aggResult.topCommercialMode, PERFORMANCE_METRIC_LABEL, PERFORMANCE_METRIC_FIELD),
    bestDay: bestDay ? { dayOfWeek: bestDay.dayOfWeek, average: bestDay.average } : null,
    insightSummary: '',
  };

  const insights: string[] = [];
  if (summary.topPerformingFormat) {
    insights.push(`O formato de melhor performance e ${summary.topPerformingFormat.name} (${summary.topPerformingFormat.valueFormatted} de media).`);
  }
  if (summary.topPerformingContext) {
    insights.push(`${summary.topPerformingContext.name} e o contexto de melhor performance (${summary.topPerformingContext.valueFormatted} de media).`);
  }
  if (summary.topPerformingProposal) {
    insights.push(`${summary.topPerformingProposal.name} e a proposta de melhor desempenho (${summary.topPerformingProposal.valueFormatted} de media).`);
  }
  if (summary.topPerformingContentIntent) {
    insights.push(`${summary.topPerformingContentIntent.name} e a intencao de conteudo de melhor desempenho (${summary.topPerformingContentIntent.valueFormatted} de media).`);
  }
  if (summary.topPerformingNarrativeForm) {
    insights.push(`${summary.topPerformingNarrativeForm.name} e a forma narrativa de melhor desempenho (${summary.topPerformingNarrativeForm.valueFormatted} de media).`);
  }
  if (summary.topPerformingStance) {
    insights.push(`${summary.topPerformingStance.name} e a postura de melhor desempenho (${summary.topPerformingStance.valueFormatted} de media).`);
  }
  if (summary.bestDay) {
    const dayName = getPortugueseWeekdayNameForSummary(summary.bestDay.dayOfWeek);
    insights.push(`O melhor dia para postar e ${dayName}, com media de ${summary.bestDay.average.toFixed(1)} interacoes por post.`);
  }
  if (summary.lowPerformingFormat && summary.lowPerformingFormat.name !== summary.topPerformingFormat?.name) {
    insights.push(`O formato ${summary.lowPerformingFormat.name} tem performance mais baixa (${summary.lowPerformingFormat.valueFormatted}).`);
  }

  summary.insightSummary = insights.length
    ? insights.join(' ')
    : 'Nao ha dados suficientes para gerar insights de performance no periodo selecionado.';

  const bestSlot = timeDistributionRaw.bestSlots[0];
  const worstSlot = timeDistributionRaw.worstSlots[0];
  let heatmapSummary = '';
  if (bestSlot) {
    const dayName = getPortugueseWeekdayNameForSummary(bestSlot.dayOfWeek).toLowerCase();
    const bestAvg = bestSlot.average.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    heatmapSummary += `O pico de performance ocorre ${dayName} as ${bestSlot.hour}h, com uma media de ${bestAvg} de engajamento por post.`;
  }
  if (worstSlot) {
    const dayName = getPortugueseWeekdayNameForSummary(worstSlot.dayOfWeek).toLowerCase();
    heatmapSummary += ` O menor desempenho e ${dayName} as ${worstSlot.hour}h.`;
  }

  const filterLabels: string[] = [];
  if (heatmapFormatParam) filterLabels.push(getCategoryById(heatmapFormatParam, 'format')?.label || heatmapFormatParam);
  if (heatmapProposalParam) filterLabels.push(getCategoryById(heatmapProposalParam, 'proposal')?.label || heatmapProposalParam);
  if (heatmapContext) filterLabels.push(getCategoryById(heatmapContext, 'context')?.label || heatmapContext);
  if (filterLabels.length > 0 && heatmapSummary) {
    heatmapSummary = `Para posts sobre ${filterLabels.join(' e ')}, ${heatmapSummary.charAt(0).toLowerCase() + heatmapSummary.slice(1)}`;
  }

  const timeDistribution: TimeDistributionResponse = camelizeKeys({
    ...timeDistributionRaw,
    insightSummary: heatmapSummary,
  }) as TimeDistributionResponse;

  return NextResponse.json({
    summary: camelizeKeys(summary),
    formatRanking,
    timeDistribution,
  }, { status: 200 });
}
