import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { dashboardCache, DEFAULT_DASHBOARD_TTL_MS } from '@/app/lib/cache/dashboardCache';
import { getAdminSession } from '@/lib/getAdminSession';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import UserModel from '@/app/models/User';
import MetricModel from '@/app/models/Metric';
import AccountInsightModel from '@/app/models/AccountInsight';
import { getCategoryWithSubcategoryIds, getCategoryById } from '@/app/lib/classification';
import { resolveCreatorIdsByContext } from '@/app/lib/creatorContextHelper';
import {
  addDays,
  formatDateYYYYMMDD,
  getStartDateFromTimePeriod,
  getYearWeek,
} from '@/utils/dateHelpers';

export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/trends/batch]';
const DEFAULT_TIME_PERIOD: TimePeriod = 'last_30_days';
const DEFAULT_DATA_WINDOW_DAYS = 30;
const DEFAULT_MOVING_AVERAGE_WINDOW_DAYS = 7;
const MAX_DATA_WINDOW_DAYS = 365;
const MAX_MOVING_AVERAGE_WINDOW_DAYS = 90;
const FOLLOWER_GRANULARITIES = ['daily', 'monthly'] as const;
const REACH_GRANULARITIES = ['daily', 'weekly'] as const;

type FollowerGranularity = (typeof FOLLOWER_GRANULARITIES)[number];
type ReachGranularity = (typeof REACH_GRANULARITIES)[number];

interface FollowerTrendDataPoint {
  date: string;
  value: number | null;
}

interface FollowerTrendResponse {
  chartData: FollowerTrendDataPoint[];
  insightSummary?: string;
}

interface FollowerChangeDataPoint {
  date: string;
  change: number | null;
}

interface FollowerChangeResponse {
  chartData: FollowerChangeDataPoint[];
  insightSummary?: string;
}

interface ReachEngagementDataPoint {
  date: string;
  reach: number | null;
  totalInteractions: number | null;
}

interface ReachEngagementResponse {
  chartData: ReachEngagementDataPoint[];
  insightSummary?: string;
}

interface MovingAverageDataPoint {
  date: string;
  movingAverageEngagement: number | null;
}

interface MovingAverageResponse {
  series: MovingAverageDataPoint[];
  insightSummary?: string;
}

interface TrendsBatchResponse {
  followerTrend: FollowerTrendResponse;
  followerChange: FollowerChangeResponse;
  reachEngagement: ReachEngagementResponse;
  movingAverage: MovingAverageResponse;
}

function isAllowedTimePeriod(period: any): period is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(period);
}

function createEmptyResponse(message: string): TrendsBatchResponse {
  return {
    followerTrend: { chartData: [], insightSummary: message },
    followerChange: { chartData: [], insightSummary: message },
    reachEngagement: { chartData: [], insightSummary: message },
    movingAverage: { series: [], insightSummary: message },
  };
}

async function resolveUserIds(
  onlyActiveSubscribers: boolean,
  contextParam?: string | null,
  creatorContextParam?: string | null
): Promise<{ userIds: Types.ObjectId[]; emptyMessage?: string }> {
  const userQuery: { _id?: { $in: Types.ObjectId[] }; planStatus?: string } = {};

  if (onlyActiveSubscribers) {
    userQuery.planStatus = 'active';
  }

  if (contextParam) {
    const ids = getCategoryWithSubcategoryIds(contextParam, 'context');
    const labels = ids.map((id) => getCategoryById(id, 'context')?.label || id);
    const contextUsers = await MetricModel.distinct('user', { context: { $in: [...ids, ...labels] } });
    if (!contextUsers.length) {
      return { userIds: [], emptyMessage: 'Nenhum usuario encontrado para o nicho selecionado.' };
    }
    userQuery._id = { $in: contextUsers as Types.ObjectId[] };
  }

  if (creatorContextParam) {
    const contextIds = await resolveCreatorIdsByContext(creatorContextParam, { onlyActiveSubscribers });
    const contextObjectIds = contextIds.map((id) => new Types.ObjectId(id));
    if (!contextObjectIds.length) {
      return { userIds: [], emptyMessage: 'Nenhum usuario encontrado para o nicho selecionado.' };
    }
    if (userQuery._id?.$in) {
      const existing = userQuery._id.$in;
      userQuery._id = { $in: existing.filter((id) => contextObjectIds.some((cid) => cid.equals(id))) };
    } else {
      userQuery._id = { $in: contextObjectIds };
    }
  }

  if (userQuery._id?.$in && userQuery._id.$in.length === 0) {
    return { userIds: [], emptyMessage: 'Nenhum usuario encontrado para o nicho selecionado.' };
  }

  const users = await UserModel.find(userQuery).select('_id').lean();
  if (!users.length) {
    return { userIds: [], emptyMessage: 'Nenhum usuario encontrado para agregar dados.' };
  }

  return { userIds: users.map((u) => u._id as Types.ObjectId) };
}

function formatPeriodText(timePeriod: TimePeriod): string {
  return timePeriod === 'all_time'
    ? 'todo o periodo'
    : timePeriod.replace('last_', 'ultimos ').replace('_days', ' dias').replace('_months', ' meses');
}

async function buildFollowerDailySeries(
  userIds: Types.ObjectId[],
  timePeriod: TimePeriod
): Promise<FollowerTrendDataPoint[]> {
  if (!userIds.length) return [];

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  let startDate = getStartDateFromTimePeriod(today, timePeriod);

  if (timePeriod === 'all_time' || startDate.getTime() === 0) {
    const earliest = await AccountInsightModel.findOne({
      user: { $in: userIds },
      followersCount: { $type: 'number' },
    })
      .sort({ recordedAt: 1 })
      .select('recordedAt')
      .lean();
    if (earliest?.recordedAt) {
      startDate = new Date(earliest.recordedAt);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(endDate);
      startDate.setHours(0, 0, 0, 0);
    }
  }

  const baseline = await AccountInsightModel.aggregate<{
    _id: Types.ObjectId;
    followersCount: number;
  }>([
    {
      $match: {
        user: { $in: userIds },
        recordedAt: { $lt: startDate },
        followersCount: { $type: 'number' },
      },
    },
    { $sort: { user: 1, recordedAt: -1 } },
    {
      $group: {
        _id: '$user',
        followersCount: { $first: '$followersCount' },
      },
    },
  ]).exec();

  const snapshots = await AccountInsightModel.aggregate<{
    user: Types.ObjectId;
    dayKey: string;
    followersCount: number;
  }>([
    {
      $match: {
        user: { $in: userIds },
        recordedAt: { $gte: startDate, $lte: endDate },
        followersCount: { $type: 'number' },
      },
    },
    {
      $project: {
        _id: 0,
        user: 1,
        dayKey: { $dateToString: { format: '%Y-%m-%d', date: '$recordedAt' } },
        followersCount: 1,
        recordedAt: 1,
      },
    },
    { $sort: { user: 1, recordedAt: 1 } },
  ]).exec();

  const userState = new Map<string, number | null>(userIds.map((id) => [id.toString(), null]));
  baseline.forEach((item) => {
    userState.set(item._id.toString(), Number(item.followersCount));
  });

  const followersByUserByDay = new Map<string, Map<string, number>>();
  snapshots.forEach((item) => {
    const userId = item.user.toString();
    const current = followersByUserByDay.get(userId) ?? new Map<string, number>();
    current.set(item.dayKey, Number(item.followersCount));
    followersByUserByDay.set(userId, current);
  });

  const dailySeries: FollowerTrendDataPoint[] = [];
  for (let cursor = new Date(startDate); cursor <= endDate; cursor = addDays(cursor, 1)) {
    const dayKey = formatDateYYYYMMDD(cursor);
    let total = 0;
    let hasValue = false;

    for (const userId of userState.keys()) {
      const dayValue = followersByUserByDay.get(userId)?.get(dayKey);
      if (typeof dayValue === 'number') {
        userState.set(userId, dayValue);
      }
      const current = userState.get(userId);
      if (typeof current === 'number') {
        total += current;
        hasValue = true;
      }
    }

    dailySeries.push({ date: dayKey, value: hasValue ? total : null });
  }

  return dailySeries;
}

function buildFollowerResponses(
  dailySeries: FollowerTrendDataPoint[],
  timePeriod: TimePeriod,
  granularity: FollowerGranularity
): { followerTrend: FollowerTrendResponse; followerChange: FollowerChangeResponse } {
  if (!dailySeries.length) {
    return {
      followerTrend: {
        chartData: [],
        insightSummary: 'Nenhum dado de seguidores encontrado para os usuarios no periodo.',
      },
      followerChange: {
        chartData: [],
        insightSummary: 'Nenhum dado de seguidores encontrado para os usuarios no periodo.',
      },
    };
  }

  const trendChartData: FollowerTrendDataPoint[] =
    granularity === 'monthly'
      ? Array.from(
          dailySeries.reduce((acc, point) => {
            acc.set(point.date.slice(0, 7), point.value);
            return acc;
          }, new Map<string, number | null>())
        ).map(([date, value]) => ({ date, value }))
      : dailySeries;

  const firstTrendWithValue = trendChartData.find((point) => point.value !== null);
  const lastTrendWithValue = [...trendChartData].reverse().find((point) => point.value !== null);
  let trendInsight = 'Dados de tendencia de seguidores dos usuarios da plataforma.';
  if (firstTrendWithValue && lastTrendWithValue && firstTrendWithValue.value !== null && lastTrendWithValue.value !== null) {
    const diff = lastTrendWithValue.value - firstTrendWithValue.value;
    const displayPeriod = timePeriod === 'all_time' ? 'todo o periodo' : `nos ${formatPeriodText(timePeriod)}`;
    if (diff > 0) {
      trendInsight = `Os usuarios ganharam ${diff.toLocaleString()} seguidores ${displayPeriod}.`;
    } else if (diff < 0) {
      trendInsight = `Os usuarios perderam ${Math.abs(diff).toLocaleString()} seguidores ${displayPeriod}.`;
    } else {
      trendInsight = `Sem mudanca no total de seguidores ${displayPeriod}.`;
    }
  } else if (lastTrendWithValue && lastTrendWithValue.value !== null) {
    trendInsight = `Total de ${lastTrendWithValue.value.toLocaleString()} seguidores ao final do periodo.`;
  }

  let previousValue: number | null = null;
  const followerChangeChart: FollowerChangeDataPoint[] = dailySeries.map((point) => {
    let change: number | null = null;
    if (point.value !== null && previousValue !== null) {
      change = point.value - previousValue;
    }
    if (point.value !== null) {
      previousValue = point.value;
    }
    return { date: point.date, change };
  });

  const totalChange = followerChangeChart.reduce((acc, point) => acc + (point.change ?? 0), 0);
  let changeInsight = 'Dados de variacao diaria de seguidores da plataforma.';
  if (totalChange > 0) {
    changeInsight = `A plataforma ganhou ${totalChange.toLocaleString()} seguidores nos ${formatPeriodText(timePeriod)}.`;
  } else if (totalChange < 0) {
    changeInsight = `A plataforma perdeu ${Math.abs(totalChange).toLocaleString()} seguidores nos ${formatPeriodText(timePeriod)}.`;
  } else {
    changeInsight = `Sem mudanca no total de seguidores da plataforma nos ${formatPeriodText(timePeriod)}.`;
  }

  return {
    followerTrend: { chartData: trendChartData, insightSummary: trendInsight },
    followerChange: { chartData: followerChangeChart, insightSummary: changeInsight },
  };
}

async function aggregateFollowerData(
  userIds: Types.ObjectId[],
  timePeriod: TimePeriod,
  granularity: FollowerGranularity
): Promise<{ followerTrend: FollowerTrendResponse; followerChange: FollowerChangeResponse }> {
  const dailySeries = await buildFollowerDailySeries(userIds, timePeriod);
  return buildFollowerResponses(dailySeries, timePeriod, granularity);
}

async function aggregateReachEngagement(
  userIds: Types.ObjectId[],
  timePeriod: TimePeriod,
  granularity: ReachGranularity
): Promise<ReachEngagementResponse> {
  if (!userIds.length) {
    return { chartData: [], insightSummary: 'Nenhum dado encontrado para os usuarios.' };
  }

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  let startDate = getStartDateFromTimePeriod(today, timePeriod);

  if (timePeriod === 'all_time' || startDate.getTime() === 0) {
    const earliest = await MetricModel.findOne({ user: { $in: userIds } })
      .sort({ postDate: 1 })
      .select('postDate')
      .lean();
    if (earliest?.postDate) {
      startDate = new Date(earliest.postDate);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(endDate);
      startDate.setHours(0, 0, 0, 0);
    }
  }

  const dailyTotals = await MetricModel.aggregate<{
    _id: string;
    totalReach: number;
    totalInteractions: number;
  }>([
    {
      $match: {
        user: { $in: userIds },
        postDate: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$postDate' } },
        totalReach: {
          $sum: {
            $ifNull: ['$stats.reach', { $ifNull: ['$stats.views', { $ifNull: ['$stats.impressions', 0] }] }],
          },
        },
        totalInteractions: { $sum: { $ifNull: ['$stats.total_interactions', 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]).exec();

  const userCount = userIds.length;
  const dailyTotalsByDate = new Map(
    dailyTotals.map((item) => [item._id, { reach: Number(item.totalReach ?? 0), interactions: Number(item.totalInteractions ?? 0) }])
  );

  const dailySeries: ReachEngagementDataPoint[] = [];
  const weeklySeriesMap = new Map<string, { reach: number; totalInteractions: number }>();
  for (let cursor = new Date(startDate); cursor <= endDate; cursor = addDays(cursor, 1)) {
    const dateKey = formatDateYYYYMMDD(cursor);
    const totals = dailyTotalsByDate.get(dateKey) ?? { reach: 0, interactions: 0 };
    const dailyPoint = {
      date: dateKey,
      reach: totals.reach / userCount,
      totalInteractions: totals.interactions / userCount,
    };
    dailySeries.push(dailyPoint);

    const weekKey = getYearWeek(cursor);
    const week = weeklySeriesMap.get(weekKey) ?? { reach: 0, totalInteractions: 0 };
    week.reach += dailyPoint.reach ?? 0;
    week.totalInteractions += dailyPoint.totalInteractions ?? 0;
    weeklySeriesMap.set(weekKey, week);
  }

  const chartData: ReachEngagementDataPoint[] =
    granularity === 'weekly'
      ? Array.from(weeklySeriesMap.entries())
          .map(([date, values]) => ({ date, reach: values.reach, totalInteractions: values.totalInteractions }))
          .sort((a, b) => a.date.localeCompare(b.date))
      : dailySeries;

  const valid = chartData.filter((point) => point.reach !== null || point.totalInteractions !== null);
  let insight = 'Dados de tendencia de alcance e interacoes.';
  if (valid.length) {
    const avgReach = valid.reduce((sum, point) => sum + (point.reach ?? 0), 0) / valid.length;
    const avgInteractions = valid.reduce((sum, point) => sum + (point.totalInteractions ?? 0), 0) / valid.length;
    insight = `Media de alcance: ${avgReach.toFixed(0)}, interacoes: ${avgInteractions.toFixed(0)} por ${
      granularity === 'daily' ? 'dia' : 'semana'
    } nos ${formatPeriodText(timePeriod)}.`;
  }

  return { chartData, insightSummary: insight };
}

async function aggregateMovingAverage(
  userIds: Types.ObjectId[],
  dataWindowInDays: number,
  movingWindow: number
): Promise<MovingAverageResponse> {
  if (!userIds.length) {
    return { series: [], insightSummary: 'Nenhum usuario encontrado.' };
  }

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDateForQuery = new Date(today);
  startDateForQuery.setDate(startDateForQuery.getDate() - (dataWindowInDays + movingWindow));
  startDateForQuery.setHours(0, 0, 0, 0);

  const agg = await MetricModel.aggregate([
    { $match: { user: { $in: userIds }, postDate: { $gte: startDateForQuery, $lte: endDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$postDate' } },
        dailyEngagement: {
          $sum: {
            $add: [
              { $ifNull: ['$stats.likes', 0] },
              { $ifNull: ['$stats.comments', 0] },
              { $ifNull: ['$stats.shares', 0] },
              { $ifNull: ['$stats.saved', 0] },
            ],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const dailyMap = new Map<string, number>(agg.map((item) => [item._id, item.dailyEngagement]));
  const completeSeries: { date: string; total: number }[] = [];
  let cursor = new Date(startDateForQuery);
  while (cursor <= endDate) {
    const key = formatDateYYYYMMDD(cursor);
    completeSeries.push({ date: key, total: dailyMap.get(key) || 0 });
    cursor = addDays(cursor, 1);
  }

  const series: MovingAverageDataPoint[] = [];
  for (let i = movingWindow - 1; i < completeSeries.length; i += 1) {
    const windowSlice = completeSeries.slice(i - movingWindow + 1, i + 1);
    const sum = windowSlice.reduce((acc, value) => acc + value.total, 0);
    const currentEntry = completeSeries[i];
    if (currentEntry) {
      series.push({ date: currentEntry.date, movingAverageEngagement: sum / movingWindow });
    }
  }

  const displayStart = new Date(today);
  displayStart.setDate(displayStart.getDate() - dataWindowInDays + 1);
  displayStart.setHours(0, 0, 0, 0);

  const finalSeries = series.filter((point) => new Date(point.date) >= displayStart);
  const insight = `Media movel de ${movingWindow} dias do engajamento diario das contas nos ultimos ${dataWindowInDays} dias.`;

  return {
    series: finalSeries,
    insightSummary: finalSeries.length ? insight : 'Dados insuficientes para calcular a media movel.',
  };
}

export async function GET(request: NextRequest) {
  const start = performance.now ? performance.now() : Date.now();
  const session = await getAdminSession(request);

  if (!session || !session.user) {
    logger.warn(`${SERVICE_TAG} Unauthorized access attempt.`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const followerGranularityParam = searchParams.get('followerGranularity');
  const reachGranularityParam = searchParams.get('reachGranularity');
  const onlyActiveSubscribers = searchParams.get('onlyActiveSubscribers') === 'true';
  const contextParam = searchParams.get('context');
  const creatorContextParam = searchParams.get('creatorContext');

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam) ? timePeriodParam : DEFAULT_TIME_PERIOD;
  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json(
      { error: `Invalid timePeriod. Allowed: ${ALLOWED_TIME_PERIODS.join(', ')}` },
      { status: 400 }
    );
  }

  const followerGranularity: FollowerGranularity = followerGranularityParam && FOLLOWER_GRANULARITIES.includes(followerGranularityParam as FollowerGranularity)
    ? (followerGranularityParam as FollowerGranularity)
    : 'daily';
  if (followerGranularityParam && !FOLLOWER_GRANULARITIES.includes(followerGranularityParam as FollowerGranularity)) {
    return NextResponse.json(
      { error: `Invalid followerGranularity. Allowed: ${FOLLOWER_GRANULARITIES.join(', ')}` },
      { status: 400 }
    );
  }

  const reachGranularity: ReachGranularity = reachGranularityParam && REACH_GRANULARITIES.includes(reachGranularityParam as ReachGranularity)
    ? (reachGranularityParam as ReachGranularity)
    : 'daily';
  if (reachGranularityParam && !REACH_GRANULARITIES.includes(reachGranularityParam as ReachGranularity)) {
    return NextResponse.json(
      { error: `Invalid reachGranularity. Allowed: ${REACH_GRANULARITIES.join(', ')}` },
      { status: 400 }
    );
  }

  let dataWindowInDays = DEFAULT_DATA_WINDOW_DAYS;
  const dataWindowParam = searchParams.get('dataWindowInDays');
  if (dataWindowParam) {
    const parsed = parseInt(dataWindowParam, 10);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_DATA_WINDOW_DAYS) {
      return NextResponse.json(
        { error: `Invalid dataWindowInDays. Must be a positive number up to ${MAX_DATA_WINDOW_DAYS}.` },
        { status: 400 }
      );
    }
    dataWindowInDays = parsed;
  }

  let movingWindow = DEFAULT_MOVING_AVERAGE_WINDOW_DAYS;
  const movingWindowParam = searchParams.get('movingAverageWindowInDays');
  if (movingWindowParam) {
    const parsed = parseInt(movingWindowParam, 10);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_MOVING_AVERAGE_WINDOW_DAYS) {
      return NextResponse.json(
        { error: `Invalid movingAverageWindowInDays. Must be a positive number up to ${MAX_MOVING_AVERAGE_WINDOW_DAYS}.` },
        { status: 400 }
      );
    }
    movingWindow = parsed;
  }

  if (movingWindow > dataWindowInDays) {
    return NextResponse.json(
      { error: 'movingAverageWindowInDays cannot be greater than dataWindowInDays.' },
      { status: 400 }
    );
  }

  try {
    const cacheKey = `${SERVICE_TAG}:${JSON.stringify({
      timePeriod,
      followerGranularity,
      reachGranularity,
      dataWindowInDays,
      movingWindow,
      onlyActiveSubscribers,
      contextParam: contextParam || '',
      creatorContextParam: creatorContextParam || '',
    })}`;

    const { value: results, hit } = await dashboardCache.wrap(
      cacheKey,
      async () => {
        await connectToDatabase();

        const { userIds, emptyMessage } = await resolveUserIds(
          onlyActiveSubscribers,
          contextParam,
          creatorContextParam
        );

        if (!userIds.length) {
          return createEmptyResponse(emptyMessage || 'Nenhum usuario encontrado.');
        }

        const [followerAggregates, reachEngagement, movingAverage] = await Promise.all([
          aggregateFollowerData(userIds, timePeriod, followerGranularity),
          aggregateReachEngagement(userIds, timePeriod, reachGranularity),
          aggregateMovingAverage(userIds, dataWindowInDays, movingWindow),
        ]);

        const { followerTrend, followerChange } = followerAggregates;

        return { followerTrend, followerChange, reachEngagement, movingAverage };
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
