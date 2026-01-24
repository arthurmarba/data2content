import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { getAdminSession } from '@/lib/getAdminSession';
import { dashboardCache, DEFAULT_DASHBOARD_TTL_MS } from '@/app/lib/cache/dashboardCache';
import { getUserReachInteractionTrendChartData } from '@/charts/getReachInteractionTrendChartData';
import getEngagementDistributionByFormatChartData from '@/charts/getEngagementDistributionByFormatChartData';
import { aggregateUserTimePerformance } from '@/utils/aggregateUserTimePerformance';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';
import getAverageEngagementByGrouping from '@/utils/getAverageEngagementByGrouping';
import { ALLOWED_TIME_PERIODS, ALLOWED_ENGAGEMENT_METRICS, EngagementMetricField, TimePeriod } from '@/app/lib/constants/timePeriods';

export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/users/planning/batch]';
const DEFAULT_TIME_PERIOD: TimePeriod = 'last_90_days';
const DEFAULT_GRANULARITY: 'daily' | 'weekly' = 'weekly';
const DEFAULT_METRIC_FIELD = 'stats.total_interactions';
const DEFAULT_MAX_SLICES = 7;

const DEFAULT_FORMAT_MAPPING: Record<string, string> = {
  IMAGE: 'Imagem',
  VIDEO: 'Video',
  REEL: 'Reel',
  CAROUSEL_ALBUM: 'Carrossel',
};

function isAllowedTimePeriod(period: any): period is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(period);
}

function isAllowedEngagementMetric(metric: any): metric is EngagementMetricField {
  return ALLOWED_ENGAGEMENT_METRICS.includes(metric);
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
  const granularityParam = searchParams.get('granularity');
  const metricParam = searchParams.get('metric');
  const engagementMetricParam = searchParams.get('engagementMetricField');
  const maxSlicesParam = searchParams.get('maxSlices');

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : DEFAULT_TIME_PERIOD;
  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Invalid timePeriod. Allowed: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  const granularity: 'daily' | 'weekly' =
    granularityParam === 'daily' || granularityParam === 'weekly'
      ? granularityParam
      : DEFAULT_GRANULARITY;
  if (granularityParam && granularityParam !== 'daily' && granularityParam !== 'weekly') {
    return NextResponse.json({ error: 'Invalid granularity. Allowed: daily, weekly.' }, { status: 400 });
  }

  const engagementMetricField: EngagementMetricField = isAllowedEngagementMetric(engagementMetricParam)
    ? engagementMetricParam
    : (DEFAULT_METRIC_FIELD as EngagementMetricField);
  if (engagementMetricParam && !isAllowedEngagementMetric(engagementMetricParam)) {
    return NextResponse.json({ error: `Invalid engagementMetricField. Allowed: ${ALLOWED_ENGAGEMENT_METRICS.join(', ')}` }, { status: 400 });
  }

  let maxSlices = DEFAULT_MAX_SLICES;
  if (maxSlicesParam) {
    const parsed = parseInt(maxSlicesParam, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json({ error: 'Invalid maxSlices. Must be a positive integer.' }, { status: 400 });
    }
    maxSlices = parsed;
  }

  const metricField = metricParam || DEFAULT_METRIC_FIELD;
  const periodInDaysValue = timePeriodToDays(timePeriod);

  try {
    const cacheKey = `${SERVICE_TAG}:${JSON.stringify({
      userId,
      timePeriod,
      granularity,
      metricField,
      engagementMetricField,
      maxSlices,
    })}`;

    const { value: results, hit } = await dashboardCache.wrap(
      cacheKey,
      async () => {
        const [
          trendData,
          timeData,
          formatData,
          proposalChartData,
          toneChartData,
          referenceChartData,
        ] = await Promise.all([
          getUserReachInteractionTrendChartData(userId, timePeriod, granularity, {}),
          aggregateUserTimePerformance(userId, periodInDaysValue, metricField, {}),
          getEngagementDistributionByFormatChartData(userId, timePeriod, engagementMetricField, DEFAULT_FORMAT_MAPPING, maxSlices),
          getAverageEngagementByGrouping(userId, timePeriod, engagementMetricField, 'proposal'),
          getAverageEngagementByGrouping(userId, timePeriod, engagementMetricField, 'tone'),
          getAverageEngagementByGrouping(userId, timePeriod, engagementMetricField, 'references'),
        ]);

        return {
          trendData,
          timeData,
          formatData,
          proposalData: { chartData: proposalChartData, metricUsed: engagementMetricField, groupBy: 'proposal' },
          toneData: { chartData: toneChartData, metricUsed: engagementMetricField, groupBy: 'tone' },
          referenceData: { chartData: referenceChartData, metricUsed: engagementMetricField, groupBy: 'references' },
        };
      },
      DEFAULT_DASHBOARD_TTL_MS
    );

    const duration = Math.round((performance.now ? performance.now() : Date.now()) - start);
    logger.info(`${SERVICE_TAG} Responded in ${duration}ms (cacheHit=${hit})`);
    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    logger.error(`${SERVICE_TAG} Unexpected error:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
