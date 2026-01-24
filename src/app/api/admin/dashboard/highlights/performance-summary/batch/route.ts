import { NextRequest, NextResponse } from 'next/server';
import { camelizeKeys } from '@/utils/camelizeKeys';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import aggregatePlatformPerformanceHighlights from '@/utils/aggregatePlatformPerformanceHighlights';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';
import { aggregatePlatformDayPerformance } from '@/utils/aggregatePlatformDayPerformance';
import { aggregatePlatformTimePerformance } from '@/utils/aggregatePlatformTimePerformance';
import { getAdminSession } from '@/lib/getAdminSession';
import { dashboardCache, DEFAULT_DASHBOARD_TTL_MS } from '@/app/lib/cache/dashboardCache';
import { logger } from '@/app/lib/logger';
import UserModel from '@/app/models/User';
import MetricModel, { IMetric } from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { getNestedValue } from '@/utils/dataAccessHelpers';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';
import { getCategoryById } from '@/app/lib/classification';

export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/highlights/performance-summary/batch]';
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

function isAllowedTimePeriod(period: any): period is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(period);
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

async function fetchFormatRanking(timePeriod: TimePeriod) {
  await connectToDatabase();

  const userQuery: any = { planStatus: 'active' };
  const activeUsers = await UserModel.find(userQuery).select('_id').lean();
  const activeIds = activeUsers.map(u => u._id);

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  const query: any = {};
  if (activeIds.length > 0) {
    query.user = { $in: activeIds };
  }
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
  const start = performance.now ? performance.now() : Date.now();
  const session = (await getAdminSession(request)) as { user?: { name?: string } } | null;
  if (!session || !session.user) {
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
  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam) ? timePeriodParam! : 'last_90_days';
  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Invalid timePeriod. Allowed: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  const periodInDaysValue = timePeriodToDays(timePeriod);
  const heatmapMetricField = heatmapMetricParam || PERFORMANCE_METRIC_FIELD;
  const heatmapContext = heatmapContextParam || contextFilter;
  const cacheKey = `${SERVICE_TAG}:${JSON.stringify({
    periodInDaysValue,
    onlyActiveSubscribers,
    contextFilter: contextFilter || '',
    creatorContext: creatorContext || '',
    heatmapMetricField,
    heatmapFormat: heatmapFormatParam || '',
    heatmapProposal: heatmapProposalParam || '',
    heatmapContext: heatmapContext || '',
  })}`;

  try {
    const { value: results, hit } = await dashboardCache.wrap(
      cacheKey,
      async () => {
        const [aggResult, dayAgg, formatRanking, timeDistributionRaw] = await Promise.all([
          aggregatePlatformPerformanceHighlights(
            periodInDaysValue,
            PERFORMANCE_METRIC_FIELD,
            undefined,
            new Date(),
            onlyActiveSubscribers,
            contextFilter,
            creatorContext
          ),
          aggregatePlatformDayPerformance(
            periodInDaysValue,
            PERFORMANCE_METRIC_FIELD,
            { context: contextFilter || undefined, creatorContext: creatorContext || undefined },
            undefined,
            new Date(),
            onlyActiveSubscribers
          ),
          fetchFormatRanking(timePeriod),
          aggregatePlatformTimePerformance(
            periodInDaysValue,
            heatmapMetricField,
            {
              format: heatmapFormatParam || undefined,
              proposal: heatmapProposalParam || undefined,
              context: heatmapContext || undefined,
              creatorContext: creatorContext || undefined,
            },
            undefined,
            new Date(),
            onlyActiveSubscribers
          ),
        ]);

        const bestDay = dayAgg.bestDays[0] || null;
        const summary: PlatformPerformanceSummaryResponse = {
          topPerformingFormat: aggResult.topFormat
            ? {
                name: aggResult.topFormat.name as string,
                metricName: PERFORMANCE_METRIC_LABEL,
                value: aggResult.topFormat.average,
                valueFormatted: formatPerformanceValue(aggResult.topFormat.average, PERFORMANCE_METRIC_FIELD),
                postsCount: aggResult.topFormat.count,
              }
            : null,
          lowPerformingFormat: aggResult.lowFormat
            ? {
                name: aggResult.lowFormat.name as string,
                metricName: PERFORMANCE_METRIC_LABEL,
                value: aggResult.lowFormat.average,
                valueFormatted: formatPerformanceValue(aggResult.lowFormat.average, PERFORMANCE_METRIC_FIELD),
                postsCount: aggResult.lowFormat.count,
              }
            : null,
          topPerformingContext: aggResult.topContext
            ? {
                name: aggResult.topContext.name as string,
                metricName: PERFORMANCE_METRIC_LABEL,
                value: aggResult.topContext.average,
                valueFormatted: formatPerformanceValue(aggResult.topContext.average, PERFORMANCE_METRIC_FIELD),
                postsCount: aggResult.topContext.count,
              }
            : null,
          topPerformingProposal: aggResult.topProposal
            ? {
                name: aggResult.topProposal.name as string,
                metricName: PERFORMANCE_METRIC_LABEL,
                value: aggResult.topProposal.average,
                valueFormatted: formatPerformanceValue(aggResult.topProposal.average, PERFORMANCE_METRIC_FIELD),
                postsCount: aggResult.topProposal.count,
              }
            : null,
          topPerformingTone: aggResult.topTone
            ? {
                name: aggResult.topTone.name as string,
                metricName: PERFORMANCE_METRIC_LABEL,
                value: aggResult.topTone.average,
                valueFormatted: formatPerformanceValue(aggResult.topTone.average, PERFORMANCE_METRIC_FIELD),
                postsCount: aggResult.topTone.count,
              }
            : null,
          topPerformingReference: aggResult.topReference
            ? {
                name: aggResult.topReference.name as string,
                metricName: PERFORMANCE_METRIC_LABEL,
                value: aggResult.topReference.average,
                valueFormatted: formatPerformanceValue(aggResult.topReference.average, PERFORMANCE_METRIC_FIELD),
                postsCount: aggResult.topReference.count,
              }
            : null,
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

        return {
          summary: camelizeKeys(summary),
          formatRanking,
          timeDistribution,
        };
      },
      DEFAULT_DASHBOARD_TTL_MS
    );

    const duration = Math.round((performance.now ? performance.now() : Date.now()) - start);
    logger.info(`${SERVICE_TAG} Responded in ${duration}ms (cacheHit=${hit})`);
    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    logger.error(`${SERVICE_TAG} Error:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
