import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { dashboardCache, DEFAULT_DASHBOARD_TTL_MS } from '@/app/lib/cache/dashboardCache';
import { getAdminSession } from '@/lib/getAdminSession';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import UserModel from '@/app/models/User';
import MetricModel from '@/app/models/Metric';
import getFollowerTrendChartData from '@/charts/getFollowerTrendChartData';
import getFollowerDailyChangeData from '@/charts/getFollowerDailyChangeData';
import { getUserReachInteractionTrendChartData } from '@/charts/getReachInteractionTrendChartData';
import { getCategoryWithSubcategoryIds, getCategoryById } from '@/app/lib/classification';
import { resolveCreatorIdsByContext } from '@/app/lib/creatorContextHelper';
import { addDays, formatDateYYYYMMDD } from '@/utils/dateHelpers';

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

async function aggregateFollowerTrend(
  userIds: Types.ObjectId[],
  timePeriod: TimePeriod,
  granularity: FollowerGranularity
): Promise<FollowerTrendResponse> {
  const BATCH_SIZE = 50;
  const userTrendResults: PromiseSettledResult<FollowerTrendResponse>[] = [];
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batchIds = userIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batchIds.map((id) => getFollowerTrendChartData(id.toString(), timePeriod, granularity))
    );
    userTrendResults.push(...batchResults);
  }

  const aggregatedFollowersByDate = new Map<string, number>();
  userTrendResults.forEach((result) => {
    if (result.status === 'fulfilled' && result.value?.chartData) {
      result.value.chartData.forEach((d) => {
        if (d.value !== null && d.date) {
          const current = aggregatedFollowersByDate.get(d.date) || 0;
          aggregatedFollowersByDate.set(d.date, current + d.value);
        }
      });
    } else if (result.status === 'rejected') {
      logger.error('Erro ao buscar dados de tendencia para um usuario:', result.reason);
    }
  });

  if (aggregatedFollowersByDate.size === 0) {
    return {
      chartData: [],
      insightSummary: 'Nenhum dado de seguidores encontrado para os usuarios no periodo.',
    };
  }

  const chartData: FollowerTrendDataPoint[] = Array.from(aggregatedFollowersByDate.entries())
    .map(([date, total]) => ({ date, value: total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let insight = 'Dados de tendencia de seguidores dos usuarios da plataforma.';
  if (chartData.length > 0) {
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    if (first && last && first.value !== null && last.value !== null) {
      const diff = last.value - first.value;
      const periodText = timePeriod
        .replace('last_', 'ultimos ')
        .replace('_days', ' dias')
        .replace('_months', ' meses');
      const displayPeriod = timePeriod === 'all_time' ? 'todo o periodo' : `nos ${periodText}`;
      if (diff > 0) {
        insight = `Os usuarios ganharam ${diff.toLocaleString()} seguidores ${displayPeriod}.`;
      } else if (diff < 0) {
        insight = `Os usuarios perderam ${Math.abs(diff).toLocaleString()} seguidores ${displayPeriod}.`;
      } else {
        insight = `Sem mudanca no total de seguidores ${displayPeriod}.`;
      }
    } else if (last && last.value !== null) {
      insight = `Total de ${last.value.toLocaleString()} seguidores ao final do periodo.`;
    }
  }

  return { chartData, insightSummary: insight };
}

async function aggregateFollowerChange(
  userIds: Types.ObjectId[],
  timePeriod: TimePeriod
): Promise<FollowerChangeResponse> {
  const BATCH_SIZE = 50;
  const results: PromiseSettledResult<FollowerChangeResponse>[] = [];
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batchIds = userIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batchIds.map((id) => getFollowerDailyChangeData(id.toString(), timePeriod))
    );
    results.push(...batchResults);
  }

  const aggregatedByDate = new Map<string, number>();
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value?.chartData) {
      result.value.chartData.forEach((point) => {
        if (point.change !== null) {
          const current = aggregatedByDate.get(point.date) || 0;
          aggregatedByDate.set(point.date, current + point.change);
        }
      });
    } else if (result.status === 'rejected') {
      logger.error('Erro ao buscar mudanca de seguidores para um usuario:', result.reason);
    }
  });

  if (aggregatedByDate.size === 0) {
    return {
      chartData: [],
      insightSummary: 'Nenhum dado de seguidores encontrado para os usuarios no periodo.',
    };
  }

  const chartData: FollowerChangeDataPoint[] = Array.from(aggregatedByDate.entries())
    .map(([date, change]) => ({ date, change }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let insight = 'Dados de variacao diaria de seguidores da plataforma.';
  if (chartData.length > 0) {
    const totalChange = chartData.reduce((acc, point) => acc + (point.change ?? 0), 0);
    const periodText =
      timePeriod === 'all_time'
        ? 'todo o periodo'
        : timePeriod.replace('last_', 'ultimos ').replace('_days', ' dias').replace('_months', ' meses');
    if (totalChange > 0) {
      insight = `A plataforma ganhou ${totalChange.toLocaleString()} seguidores nos ${periodText}.`;
    } else if (totalChange < 0) {
      insight = `A plataforma perdeu ${Math.abs(totalChange).toLocaleString()} seguidores nos ${periodText}.`;
    } else {
      insight = `Sem mudanca no total de seguidores da plataforma nos ${periodText}.`;
    }
  }

  return { chartData, insightSummary: insight };
}

async function aggregateReachEngagement(
  userIds: Types.ObjectId[],
  timePeriod: TimePeriod,
  granularity: ReachGranularity
): Promise<ReachEngagementResponse> {
  const BATCH_SIZE = 30;
  const results: PromiseSettledResult<ReachEngagementResponse>[] = [];
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((id) => getUserReachInteractionTrendChartData(id.toString(), timePeriod, granularity))
    );
    results.push(...batchResults);
  }

  const aggregated = new Map<string, { reachValues: number[]; interactionValues: number[] }>();
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value?.chartData) {
      result.value.chartData.forEach((point) => {
        const entry = aggregated.get(point.date) || { reachValues: [], interactionValues: [] };
        if (point.reach !== null) entry.reachValues.push(point.reach);
        if (point.totalInteractions !== null) entry.interactionValues.push(point.totalInteractions);
        aggregated.set(point.date, entry);
      });
    } else if (result.status === 'rejected') {
      logger.error('Erro ao buscar trend para usuario:', result.reason);
    }
  });

  if (aggregated.size === 0) {
    return {
      chartData: [],
      insightSummary: 'Nenhum dado encontrado para os usuarios.',
    };
  }

  const chartData: ReachEngagementDataPoint[] = Array.from(aggregated.entries())
    .map(([date, data]) => {
      const avgReach = data.reachValues.length
        ? data.reachValues.reduce((acc, value) => acc + value, 0) / data.reachValues.length
        : null;
      const avgInteractions = data.interactionValues.length
        ? data.interactionValues.reduce((acc, value) => acc + value, 0) / data.interactionValues.length
        : null;
      return { date, reach: avgReach, totalInteractions: avgInteractions };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const valid = chartData.filter((point) => point.reach !== null || point.totalInteractions !== null);
  let insight = 'Dados de tendencia de alcance e interacoes.';
  if (valid.length) {
    const avgReach = valid.reduce((sum, point) => sum + (point.reach ?? 0), 0) / valid.length;
    const avgInteractions = valid.reduce((sum, point) => sum + (point.totalInteractions ?? 0), 0) / valid.length;
    const periodText =
      timePeriod === 'all_time'
        ? 'todo o periodo'
        : timePeriod.replace('last_', 'ultimos ').replace('_days', ' dias').replace('_months', ' meses');
    insight = `Media de alcance: ${avgReach.toFixed(0)}, interacoes: ${avgInteractions.toFixed(0)} por ${
      granularity === 'daily' ? 'dia' : 'semana'
    } nos ${periodText}.`;
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

        const [followerTrend, followerChange, reachEngagement, movingAverage] = await Promise.all([
          aggregateFollowerTrend(userIds, timePeriod, followerGranularity),
          aggregateFollowerChange(userIds, timePeriod),
          aggregateReachEngagement(userIds, timePeriod, reachGranularity),
          aggregateMovingAverage(userIds, dataWindowInDays, movingWindow),
        ]);

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
