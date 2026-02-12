import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { getAdminSession } from '@/lib/getAdminSession';
import { dashboardCache, DEFAULT_DASHBOARD_TTL_MS } from '@/app/lib/cache/dashboardCache';
import { connectToDatabase } from '@/app/lib/mongoose';
import MetricModel from '@/app/models/Metric';
import AudienceDemographicSnapshot from '@/app/models/demographics/AudienceDemographicSnapshot';
import aggregateUserPerformanceHighlights from '@/utils/aggregateUserPerformanceHighlights';
import aggregateUserDayPerformance from '@/utils/aggregateUserDayPerformance';
import { aggregateUserTimePerformance } from '@/utils/aggregateUserTimePerformance';
import calculatePlatformAverageMetric from '@/utils/calculatePlatformAverageMetric';
import calculateFollowerGrowthRate from '@/utils/calculateFollowerGrowthRate';
import calculateAverageEngagementPerPost from '@/utils/calculateAverageEngagementPerPost';
import calculateWeeklyPostingFrequency from '@/utils/calculateWeeklyPostingFrequency';
import calculateAverageVideoMetrics from '@/utils/calculateAverageVideoMetrics';
import getAverageEngagementByGrouping from '@/utils/getAverageEngagementByGrouping';
import aggregateAudienceByRegion from '@/utils/aggregateAudienceByRegion';
import { fetchUserAlerts } from '@/app/lib/dataService/userService';
import { addDays, getStartDateFromTimePeriod } from '@/utils/dateHelpers';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';
import { getCategoryById } from '@/app/lib/classification';
import { triggerDataRefresh } from '@/app/lib/instagram';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';

export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/users/widgets/batch]';
const DEFAULT_TIME_PERIOD: TimePeriod = 'last_90_days';
const DEFAULT_COMPARISON_PERIOD = 'last_30d_vs_previous_30d';
const DEFAULT_ALERTS_LIMIT = 3;
const DEFAULT_ENGAGEMENT_METRIC = 'stats.total_interactions';
const DEFAULT_PERFORMANCE_METRIC = 'stats.total_interactions';
const DEFAULT_PERFORMANCE_METRIC_LABEL = 'Interacoes (media por post)';
const DEFAULT_HEATMAP_METRIC = 'stats.total_interactions';
const MAX_API_VIDEO_METRIC_AGE_HOURS = 24;

const ALLOWED_REGIONS = new Set(['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']);
const ALLOWED_GENDERS = new Set(['F', 'M', 'U']);
const ALLOWED_AGE_RANGES = new Set(['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+']);

const ALLOWED_COMPARISON_PERIODS: Record<string, { currentPeriodDays: number; periodNameCurrent: string; periodNamePrevious: string }> = {
  month_vs_previous: { currentPeriodDays: 30, periodNameCurrent: 'Este Mes', periodNamePrevious: 'Mes Passado' },
  last_7d_vs_previous_7d: { currentPeriodDays: 7, periodNameCurrent: 'Ultimos 7 Dias', periodNamePrevious: '7 Dias Anteriores' },
  last_30d_vs_previous_30d: { currentPeriodDays: 30, periodNameCurrent: 'Ultimos 30 Dias', periodNamePrevious: '30 Dias Anteriores' },
  last_60d_vs_previous_60d: { currentPeriodDays: 60, periodNameCurrent: 'Ultimos 60 Dias', periodNamePrevious: '60 Dias Anteriores' },
  last_90d_vs_previous_90d: { currentPeriodDays: 90, periodNameCurrent: 'Ultimos 90 Dias', periodNamePrevious: '90 Dias Anteriores' },
};

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

interface UserPeriodicComparisonResponse {
  followerGrowth: KPIComparisonData;
  engagementRate: KPIComparisonData;
  totalEngagement: KPIComparisonData;
  postingFrequency: KPIComparisonData;
}

interface PerformanceHighlightItem {
  name: string;
  metricName: string;
  value: number;
  valueFormatted: string;
  postsCount?: number;
  platformAverage?: number;
  platformAverageFormatted?: string;
  changePercentage?: number;
}

interface PerformanceSummaryResponse {
  topPerformingFormat: PerformanceHighlightItem | null;
  lowPerformingFormat: PerformanceHighlightItem | null;
  topPerformingContext: PerformanceHighlightItem | null;
  topPerformingProposal: PerformanceHighlightItem | null;
  topPerformingTone: PerformanceHighlightItem | null;
  topPerformingReference: PerformanceHighlightItem | null;
  bestDay: { dayOfWeek: number; average: number } | null;
  insightSummary: string;
}

interface FormatRankingResponse {
  chartData: Array<{ name: string; value: number; postsCount: number }>;
  metricUsed: string;
  groupBy: string;
}

interface DemographicsData {
  follower_demographics: {
    country: Record<string, number>;
    city: Record<string, number>;
    age: Record<string, number>;
    gender: Record<string, number>;
  };
}

interface StateBreakdown {
  state: string;
  count: number;
  density?: number;
  gender: Record<string, number>;
  age: Record<string, number>;
  cities: Record<string, { count: number; gender: Record<string, number>; age: Record<string, number> }>;
}

interface VideoMetricsResponse {
  averageViews: number;
  averageWatchTimeSeconds: number;
  averageLikes: number;
  averageComments: number;
  numberOfVideoPosts: number;
  averageShares: number;
  averageSaves: number;
  insightSummary?: string;
}

interface AlertResponseItem {
  alertId: string;
  type: string;
  date: string;
  title: string;
  finalUserMessage: string;
  details: any;
}

interface UserAlertsResponse {
  alerts: AlertResponseItem[];
  totalAlerts: number;
  insightSummary?: string;
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

function getPortugueseWeekdayName(day: number): string {
  const days = ['Domingo', 'Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado'];
  return days[day - 1] || '';
}

function calculatePercentageChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return current > 0 ? Infinity : current === 0 ? 0 : -Infinity;
  return ((current - previous) / previous) * 100;
}

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

async function fetchUserKpis(userId: string, comparisonPeriod: string): Promise<UserPeriodicComparisonResponse> {
  const comparisonConfig = ALLOWED_COMPARISON_PERIODS[comparisonPeriod];
  if (!comparisonConfig) {
    throw new Error(`Invalid comparison period: ${comparisonPeriod}`);
  }

  const { currentPeriodDays, periodNameCurrent, periodNamePrevious } = comparisonConfig;
  const today = new Date();
  const currentEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const currentStartDate = getStartDateFromTimePeriod(today, `last_${currentPeriodDays}_days`);
  const previousEndDate = addDays(new Date(currentStartDate), -1);
  previousEndDate.setHours(23, 59, 59, 999);
  const previousStartDate = addDays(new Date(previousEndDate), -(currentPeriodDays - 1));
  previousStartDate.setHours(0, 0, 0, 0);

  await connectToDatabase();
  const resolvedUserId = new Types.ObjectId(userId);

  const latestApiVideoMetric = await MetricModel.findOne({
    user: resolvedUserId,
    source: 'api',
    type: { $in: ['REEL', 'VIDEO'] },
    instagramMediaId: { $exists: true, $nin: [null, ''] },
  })
    .sort({ updatedAt: -1 })
    .select('updatedAt')
    .lean();
  const isStale =
    !latestApiVideoMetric?.updatedAt ||
    Date.now() - new Date(latestApiVideoMetric.updatedAt).getTime() >
      MAX_API_VIDEO_METRIC_AGE_HOURS * 60 * 60 * 1000;
  if (isStale) {
    try {
      await triggerDataRefresh(userId);
    } catch (error) {
      logger.warn(`${SERVICE_TAG} refresh failed for user ${userId}:`, error);
    }
  }

  const [
    fgDataCurrent,
    fgDataOverall,
    engCurrentResult,
    engPreviousResult,
    freqData,
  ] = await Promise.all([
    calculateFollowerGrowthRate(resolvedUserId, currentPeriodDays),
    calculateFollowerGrowthRate(resolvedUserId, currentPeriodDays * 2),
    calculateAverageEngagementPerPost(resolvedUserId, { startDate: currentStartDate, endDate: currentEndDate }),
    calculateAverageEngagementPerPost(resolvedUserId, { startDate: previousStartDate, endDate: previousEndDate }),
    calculateWeeklyPostingFrequency(resolvedUserId, currentPeriodDays),
  ]);

  const fgT0 = fgDataCurrent.currentFollowers;
  const fgT1 = fgDataCurrent.previousFollowers;
  const fgT2 = fgDataOverall.previousFollowers;

  const currentFollowerGain = fgT0 !== null && fgT1 !== null ? fgT0 - fgT1 : null;
  const previousFollowerGain = fgT1 !== null && fgT2 !== null ? fgT1 - fgT2 : null;

  const totalReachCurrent = (engCurrentResult as any)?.sumReach ?? 0;
  const denomCurrent = totalReachCurrent > 0 ? totalReachCurrent : null;
  const currentEngagementRate =
    engCurrentResult.totalEngagement !== null && denomCurrent && denomCurrent > 0
      ? (engCurrentResult.totalEngagement / denomCurrent) * 100
      : null;

  const totalReachPrev = (engPreviousResult as any)?.sumReach ?? 0;
  const denomPrev = totalReachPrev > 0 ? totalReachPrev : null;
  const previousEngagementRate =
    engPreviousResult.totalEngagement !== null && denomPrev && denomPrev > 0
      ? (engPreviousResult.totalEngagement / denomPrev) * 100
      : null;

  const periodNames = { current: periodNameCurrent, previous: periodNamePrevious };

  return {
    followerGrowth: createKpiDataObject(currentFollowerGain, previousFollowerGain, periodNames),
    engagementRate: createKpiDataObject(currentEngagementRate, previousEngagementRate, periodNames),
    totalEngagement: createKpiDataObject(engCurrentResult.totalEngagement, engPreviousResult.totalEngagement, periodNames),
    postingFrequency: createKpiDataObject(freqData.currentWeeklyFrequency, freqData.previousWeeklyFrequency, periodNames),
  };
}

async function fetchPerformanceSummary(userId: string, timePeriod: TimePeriod): Promise<PerformanceSummaryResponse> {
  const periodInDaysValue = timePeriodToDays(timePeriod);
  const performanceMetricField = DEFAULT_PERFORMANCE_METRIC;
  const performanceMetricLabel = DEFAULT_PERFORMANCE_METRIC_LABEL;

  const today = new Date();
  const [aggResult, dayAgg] = await Promise.all([
    aggregateUserPerformanceHighlights(userId, periodInDaysValue, performanceMetricField, today),
    aggregateUserDayPerformance(userId, periodInDaysValue, performanceMetricField, {}, today),
  ]);

  const prevReference = new Date(today);
  prevReference.setDate(prevReference.getDate() - periodInDaysValue);
  const prevAgg = await aggregateUserPerformanceHighlights(
    userId,
    periodInDaysValue,
    performanceMetricField,
    prevReference
  );

  const platformAverage = await calculatePlatformAverageMetric(
    periodInDaysValue,
    performanceMetricField,
    today
  );

  const bestDay = dayAgg.bestDays[0] || null;

  const response: PerformanceSummaryResponse = {
    topPerformingFormat: aggResult.topFormat
      ? {
          name: aggResult.topFormat.name as string,
          metricName: performanceMetricLabel,
          value: aggResult.topFormat.average,
          valueFormatted: formatPerformanceValue(aggResult.topFormat.average, performanceMetricField),
          postsCount: aggResult.topFormat.count,
          platformAverage,
          platformAverageFormatted: formatPerformanceValue(platformAverage, performanceMetricField),
          changePercentage:
            prevAgg.topFormat && prevAgg.topFormat.average !== 0
              ? ((aggResult.topFormat.average - prevAgg.topFormat.average) / prevAgg.topFormat.average) * 100
              : undefined,
        }
      : null,
    lowPerformingFormat: aggResult.lowFormat
      ? {
          name: aggResult.lowFormat.name as string,
          metricName: performanceMetricLabel,
          value: aggResult.lowFormat.average,
          valueFormatted: formatPerformanceValue(aggResult.lowFormat.average, performanceMetricField),
          postsCount: aggResult.lowFormat.count,
          platformAverage,
          platformAverageFormatted: formatPerformanceValue(platformAverage, performanceMetricField),
          changePercentage:
            prevAgg.lowFormat && prevAgg.lowFormat.average !== 0
              ? ((aggResult.lowFormat.average - prevAgg.lowFormat.average) / prevAgg.lowFormat.average) * 100
              : undefined,
        }
      : null,
    topPerformingContext: aggResult.topContext
      ? {
          name: aggResult.topContext.name as string,
          metricName: performanceMetricLabel,
          value: aggResult.topContext.average,
          valueFormatted: formatPerformanceValue(aggResult.topContext.average, performanceMetricField),
          postsCount: aggResult.topContext.count,
          platformAverage,
          platformAverageFormatted: formatPerformanceValue(platformAverage, performanceMetricField),
          changePercentage:
            prevAgg.topContext && prevAgg.topContext.average !== 0
              ? ((aggResult.topContext.average - prevAgg.topContext.average) / prevAgg.topContext.average) * 100
              : undefined,
        }
      : null,
    topPerformingProposal: aggResult.topProposal
      ? {
          name: aggResult.topProposal.name as string,
          metricName: performanceMetricLabel,
          value: aggResult.topProposal.average,
          valueFormatted: formatPerformanceValue(aggResult.topProposal.average, performanceMetricField),
          postsCount: aggResult.topProposal.count,
          platformAverage,
          platformAverageFormatted: formatPerformanceValue(platformAverage, performanceMetricField),
        }
      : null,
    topPerformingTone: aggResult.topTone
      ? {
          name: aggResult.topTone.name as string,
          metricName: performanceMetricLabel,
          value: aggResult.topTone.average,
          valueFormatted: formatPerformanceValue(aggResult.topTone.average, performanceMetricField),
          postsCount: aggResult.topTone.count,
          platformAverage,
          platformAverageFormatted: formatPerformanceValue(platformAverage, performanceMetricField),
        }
      : null,
    topPerformingReference: aggResult.topReference
      ? {
          name: aggResult.topReference.name as string,
          metricName: performanceMetricLabel,
          value: aggResult.topReference.average,
          valueFormatted: formatPerformanceValue(aggResult.topReference.average, performanceMetricField),
          postsCount: aggResult.topReference.count,
          platformAverage,
          platformAverageFormatted: formatPerformanceValue(platformAverage, performanceMetricField),
        }
      : null,
    bestDay: bestDay ? { dayOfWeek: bestDay.dayOfWeek, average: bestDay.average } : null,
    insightSummary: '',
  };

  const insights: string[] = [];
  if (response.topPerformingFormat) {
    insights.push(
      `Seu formato de melhor performance e ${response.topPerformingFormat.name} com ${response.topPerformingFormat.valueFormatted} de ${performanceMetricLabel} em media.`
    );
  } else {
    insights.push(`Nao foi possivel identificar um formato de melhor performance com base em ${performanceMetricLabel}.`);
  }
  if (response.topPerformingContext) {
    insights.push(
      `${response.topPerformingContext.name} e seu contexto de melhor performance com ${response.topPerformingContext.valueFormatted} de ${performanceMetricLabel} em media.`
    );
  }
  if (response.topPerformingProposal) {
    insights.push(
      `${response.topPerformingProposal.name} e a proposta de melhor desempenho (${response.topPerformingProposal.valueFormatted} de media).`
    );
  }
  if (response.topPerformingTone) {
    insights.push(
      `${response.topPerformingTone.name} e o tom de melhor desempenho (${response.topPerformingTone.valueFormatted} de media).`
    );
  }
  if (response.topPerformingReference) {
    insights.push(
      `${response.topPerformingReference.name} e a referencia de melhor desempenho (${response.topPerformingReference.valueFormatted} de media).`
    );
  }
  if (response.bestDay) {
    const dayName = getPortugueseWeekdayName(response.bestDay.dayOfWeek);
    insights.push(`O melhor dia para postar e ${dayName}, com media de ${response.bestDay.average.toFixed(1)} interacoes por post.`);
  }
  if (response.lowPerformingFormat && response.lowPerformingFormat.name !== response.topPerformingFormat?.name) {
    insights.push(
      `O formato ${response.lowPerformingFormat.name} tem apresentado uma performance mais baixa (${response.lowPerformingFormat.valueFormatted}).`
    );
  }
  response.insightSummary = insights.length
    ? insights.join(' ')
    : `Analise de performance por formato e contexto no periodo de ${timePeriod.replace('last_', '').replace('_', ' ')}.`;

  return response;
}

async function fetchFormatRanking(userId: string, timePeriod: TimePeriod): Promise<FormatRankingResponse> {
  const results = await getAverageEngagementByGrouping(
    userId,
    timePeriod,
    DEFAULT_ENGAGEMENT_METRIC,
    'format'
  );
  return { chartData: results, metricUsed: DEFAULT_ENGAGEMENT_METRIC, groupBy: 'format' };
}

async function fetchDemographics(userId: string): Promise<DemographicsData | null> {
  await connectToDatabase();
  const snapshot = await AudienceDemographicSnapshot.findOne({ user: new Types.ObjectId(userId) })
    .sort({ recordedAt: -1 })
    .lean();
  return (snapshot?.demographics as DemographicsData) ?? null;
}

async function fetchRegionSummary(
  userId: string,
  region?: string,
  gender?: string,
  ageRange?: string
): Promise<Record<string, StateBreakdown>> {
  const data = await aggregateAudienceByRegion({
    region,
    gender: gender as 'F' | 'M' | 'U' | undefined,
    ageRange: ageRange as '13-17' | '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+' | undefined,
    userId,
  });
  return data.reduce((acc, state) => {
    acc[state.state] = state;
    return acc;
  }, {} as Record<string, StateBreakdown>);
}

async function fetchVideoMetrics(userId: string, timePeriod: TimePeriod): Promise<VideoMetricsResponse> {
  const periodInDaysValue = timePeriodToDays(timePeriod);
  const videoMetrics = await calculateAverageVideoMetrics(userId, periodInDaysValue);
  const response: VideoMetricsResponse = {
    averageViews: videoMetrics.averageViews,
    averageWatchTimeSeconds: videoMetrics.averageWatchTimeSeconds,
    averageLikes: videoMetrics.averageLikes,
    averageComments: videoMetrics.averageComments,
    numberOfVideoPosts: videoMetrics.numberOfVideoPosts,
    averageShares: videoMetrics.averageShares,
    averageSaves: videoMetrics.averageSaves,
    insightSummary: `Nos ${timePeriod.replace('last_', '').replace('_', ' ')}, a retencao media dos seus videos e de ${videoMetrics.averageRetentionRate.toFixed(1)}% e o tempo medio de visualizacao e de ${videoMetrics.averageWatchTimeSeconds.toFixed(0)}s, baseado em ${videoMetrics.numberOfVideoPosts} videos.`,
  };
  if (videoMetrics.numberOfVideoPosts === 0) {
    response.insightSummary = `Nenhum post de video encontrado para o periodo selecionado (${timePeriod.replace('last_', '').replace('_', ' ')}).`;
  }
  return response;
}

async function fetchAlerts(userId: string, limit: number): Promise<UserAlertsResponse> {
  const { alerts, totalAlerts } = await fetchUserAlerts(userId, {
    limit,
    dedupeNoEventAlerts: true,
  });

  const deriveTitle = (a: any) => {
    const details = (a?.details || {}) as any;
    const bodyCandidate = (a?.finalUserMessage || a?.messageForAI || '').split(/[.!?]/)[0]?.trim();
    return details.title || details.reason || bodyCandidate || a?.type || 'Alerta';
  };

  const mappedAlerts: AlertResponseItem[] = alerts.map((a) => ({
    alertId: (a._id ?? new Types.ObjectId()).toString(),
    type: a.type,
    date: (a.date instanceof Date ? a.date : new Date(a.date)).toISOString().split('T')[0]!,
    title: deriveTitle(a),
    finalUserMessage: a.finalUserMessage,
    details: a.details,
  }));

  const response: UserAlertsResponse = {
    alerts: mappedAlerts,
    totalAlerts,
    insightSummary: mappedAlerts.length > 0
      ? `Voce tem ${totalAlerts > limit ? 'pelo menos ' : ''}${mappedAlerts.length} alerta(s) relevante(s).`
      : 'Nenhum alerta novo.',
  };

  if (mappedAlerts.length > 0 && mappedAlerts.length < totalAlerts) {
    response.insightSummary += ` Mostrando os ${mappedAlerts.length} mais recentes de ${totalAlerts} alertas correspondentes.`;
  }

  return response;
}

async function fetchTimeDistribution(
  userId: string,
  timePeriod: TimePeriod,
  metricField: string,
  format?: string,
  proposal?: string,
  context?: string
): Promise<TimeDistributionResponse> {
  const periodInDaysValue = timePeriodToDays(timePeriod);
  const result = await aggregateUserTimePerformance(userId, periodInDaysValue, metricField, {
    format: format || undefined,
    proposal: proposal || undefined,
    context: context || undefined,
  });

  const best = result.bestSlots[0];
  const worst = result.worstSlots[0];
  let summary = '';
  if (best) {
    const dayName = getPortugueseWeekdayName(best.dayOfWeek).toLowerCase();
    const bestAvg = best.average.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    summary += `O pico de performance ocorre ${dayName} as ${best.hour}h, com uma media de ${bestAvg} de engajamento por post.`;
  }
  if (worst) {
    const dayName = getPortugueseWeekdayName(worst.dayOfWeek).toLowerCase();
    summary += ` O menor desempenho e ${dayName} as ${worst.hour}h.`;
  }

  const filterLabels: string[] = [];
  if (format) filterLabels.push(getCategoryById(format, 'format')?.label || format);
  if (proposal) filterLabels.push(getCategoryById(proposal, 'proposal')?.label || proposal);
  if (context) filterLabels.push(getCategoryById(context, 'context')?.label || context);
  if (filterLabels.length > 0 && summary) {
    summary = `Para posts sobre ${filterLabels.join(' e ')}, ${summary.charAt(0).toLowerCase() + summary.slice(1)}`;
  }

  return {
    ...result,
    insightSummary: summary,
  };
}

async function safeFetch<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.warn(`${SERVICE_TAG} ${label} failed:`, error);
    return fallback;
  }
}

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const start = performance.now ? performance.now() : Date.now();
  const { userId } = params;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'Invalid or missing userId.' }, { status: 400 });
  }

  const session = await getAdminSession(req);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const comparisonPeriodParam = searchParams.get('comparisonPeriod') || DEFAULT_COMPARISON_PERIOD;
  const alertsLimitParam = searchParams.get('alertsLimit');
  const regionParam = searchParams.get('region') || undefined;
  const genderParam = searchParams.get('gender') || undefined;
  const ageRangeParam = searchParams.get('ageRange') || undefined;
  const heatmapMetricParam = searchParams.get('heatmapMetric') || undefined;
  const heatmapFormatParam = searchParams.get('heatmapFormat') || undefined;
  const heatmapProposalParam = searchParams.get('heatmapProposal') || undefined;
  const heatmapContextParam = searchParams.get('heatmapContext') || undefined;

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam) ? timePeriodParam! : DEFAULT_TIME_PERIOD;
  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Invalid timePeriod. Allowed: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  if (!ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam]) {
    return NextResponse.json(
      { error: `Invalid comparisonPeriod. Allowed: ${Object.keys(ALLOWED_COMPARISON_PERIODS).join(', ')}` },
      { status: 400 }
    );
  }

  let alertsLimit = DEFAULT_ALERTS_LIMIT;
  if (alertsLimitParam) {
    const parsed = parseInt(alertsLimitParam, 10);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 20) {
      return NextResponse.json({ error: 'Invalid alertsLimit. Must be a positive integer up to 20.' }, { status: 400 });
    }
    alertsLimit = parsed;
  }

  if (regionParam && !ALLOWED_REGIONS.has(regionParam)) {
    return NextResponse.json({ error: `Invalid region. Allowed: ${Array.from(ALLOWED_REGIONS).join(', ')}` }, { status: 400 });
  }
  if (genderParam && !ALLOWED_GENDERS.has(genderParam)) {
    return NextResponse.json({ error: `Invalid gender. Allowed: ${Array.from(ALLOWED_GENDERS).join(', ')}` }, { status: 400 });
  }
  if (ageRangeParam && !ALLOWED_AGE_RANGES.has(ageRangeParam)) {
    return NextResponse.json({ error: `Invalid ageRange. Allowed: ${Array.from(ALLOWED_AGE_RANGES).join(', ')}` }, { status: 400 });
  }

  const heatmapMetric = heatmapMetricParam || DEFAULT_HEATMAP_METRIC;

  try {
    const cacheKey = `${SERVICE_TAG}:${JSON.stringify({
      userId,
      timePeriod,
      comparisonPeriod: comparisonPeriodParam,
      alertsLimit,
      region: regionParam || '',
      gender: genderParam || '',
      ageRange: ageRangeParam || '',
      heatmapMetric,
      heatmapFormat: heatmapFormatParam || '',
      heatmapProposal: heatmapProposalParam || '',
      heatmapContext: heatmapContextParam || '',
    })}`;

    const { value: results, hit } = await dashboardCache.wrap(
      cacheKey,
      async () => {
        const [kpis, performanceSummary, formatRanking, demographics, regionSummary, videoMetrics, alerts, timeDistribution] = await Promise.all([
          safeFetch('kpis', () => fetchUserKpis(userId, comparisonPeriodParam), null),
          safeFetch('performanceSummary', () => fetchPerformanceSummary(userId, timePeriod), null),
          safeFetch('formatRanking', () => fetchFormatRanking(userId, timePeriod), { chartData: [], metricUsed: DEFAULT_ENGAGEMENT_METRIC, groupBy: 'format' }),
          safeFetch('demographics', () => fetchDemographics(userId), null),
          safeFetch('regionSummary', () => fetchRegionSummary(userId, regionParam, genderParam, ageRangeParam), {}),
          safeFetch('videoMetrics', () => fetchVideoMetrics(userId, timePeriod), null),
          safeFetch('alerts', () => fetchAlerts(userId, alertsLimit), { alerts: [], totalAlerts: 0, insightSummary: 'Nenhum alerta novo.' }),
          safeFetch('timeDistribution', () => fetchTimeDistribution(userId, timePeriod, heatmapMetric, heatmapFormatParam, heatmapProposalParam, heatmapContextParam), null),
        ]);

        return {
          kpis,
          performanceSummary,
          formatRanking,
          demographics,
          regionSummary,
          videoMetrics,
          alerts,
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
