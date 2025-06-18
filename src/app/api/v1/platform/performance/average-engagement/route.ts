import { NextResponse } from 'next/server';
import UserModel from '@/app/models/User';
import MetricModel, { IMetric } from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { getNestedValue } from '@/utils/dataAccessHelpers';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';

// Tipo local para agrupamento
type GroupingType = 'format' | 'context' | 'proposal';

// Constantes para validação e defaults
const ALLOWED_TIME_PERIODS = ['all_time', 'last_7_days', 'last_30_days', 'last_90_days', 'last_6_months', 'last_12_months'] as const;
type TimePeriod = typeof ALLOWED_TIME_PERIODS[number];

const ALLOWED_ENGAGEMENT_METRICS = ['stats.total_interactions', 'stats.views', 'stats.likes', 'stats.comments', 'stats.shares'] as const;
type EngagementMetricField = typeof ALLOWED_ENGAGEMENT_METRICS[number];

const ALLOWED_GROUPINGS: GroupingType[] = ['format', 'context', 'proposal'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod') as TimePeriod | null;
  const engagementMetricParam = searchParams.get('engagementMetricField') as EngagementMetricField | null;
  const groupByParam = searchParams.get('groupBy') as GroupingType | null;

  // Validar timePeriod
  const timePeriod: TimePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : 'last_30_days';
  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `timePeriod inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  // Validar engagementMetricField
  const engagementMetric: EngagementMetricField = engagementMetricParam && ALLOWED_ENGAGEMENT_METRICS.includes(engagementMetricParam)
    ? engagementMetricParam
    : 'stats.total_interactions';
  if (engagementMetricParam && !ALLOWED_ENGAGEMENT_METRICS.includes(engagementMetricParam)) {
    return NextResponse.json({ error: `engagementMetricField inválido. Permitidos: ${ALLOWED_ENGAGEMENT_METRICS.join(', ')}` }, { status: 400 });
  }

  // Validar groupBy
  const groupBy: GroupingType = groupByParam && ALLOWED_GROUPINGS.includes(groupByParam)
    ? groupByParam
    : 'format';
  if (groupByParam && !ALLOWED_GROUPINGS.includes(groupByParam)) {
    return NextResponse.json({ error: `groupBy inválido. Permitidos: ${ALLOWED_GROUPINGS.join(', ')}` }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const activeUsers = await UserModel.find({ planStatus: 'active' }).select('_id').lean();
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
      const groupKey = groupBy === 'format' ? post.format : groupBy === 'context' ? post.context : post.proposal;
      const metricValue = getNestedValue(post, engagementMetric);
      if (groupKey && metricValue !== null) {
        const key = groupKey.toString();
        if (!performanceByGroup[key]) {
          performanceByGroup[key] = { sumPerformance: 0, count: 0 };
        }
        performanceByGroup[key].sumPerformance += metricValue;
        performanceByGroup[key].count += 1;
      }
    }

    const results = Object.entries(performanceByGroup).map(([key, data]) => ({
      name: key,
      value: data.sumPerformance / data.count,
      postsCount: data.count,
    })).sort((a, b) => b.value - a.value);

    // Retorna dados
    return NextResponse.json({ chartData: results, metricUsed: engagementMetric, groupBy }, { status: 200 });
  } catch (error) {
    logger.error('[API PLATFORM/PERFORMANCE/AVERAGE-ENGAGEMENT] Error:', error);
    return NextResponse.json({ error: 'Erro ao processar engajamento médio agrupado.', details: (error as Error).message }, { status: 500 });
  }
}

