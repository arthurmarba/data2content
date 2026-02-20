import { NextRequest, NextResponse } from 'next/server';
import UserModel from '@/app/models/User';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';
import {
  ALLOWED_TIME_PERIODS,
  ALLOWED_ENGAGEMENT_METRICS,
  TimePeriod,
  EngagementMetricField,
} from '@/app/lib/constants/timePeriods';
import { getAdminSession } from '@/lib/getAdminSession';
import { resolveCreatorIdsByContext } from '@/app/lib/creatorContextHelper';
import { Types } from 'mongoose';
export const dynamic = 'force-dynamic';


// Tipo local para agrupamento
type GroupingType = 'format' | 'context' | 'proposal';

// Constantes para validação e defaults
const ALLOWED_GROUPINGS: GroupingType[] = ['format', 'context', 'proposal'];

export async function GET(request: NextRequest) {
  const session = (await getAdminSession(request)) as { user?: { name?: string } } | null;
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod') as TimePeriod | null;
  const engagementMetricParam = searchParams.get('engagementMetricField') as EngagementMetricField | null;
  const groupByParam = searchParams.get('groupBy') as GroupingType | null;
  // ✅ PASSO 1: LER O NOVO PARÂMETRO 'limit' DA URL
  const limitParam = searchParams.get('limit');
  const creatorContextParam = searchParams.get('creatorContext');

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

    const userQuery: any = { planStatus: 'active' };
    if (creatorContextParam) {
      const ctxIds = await resolveCreatorIdsByContext(creatorContextParam, { onlyActiveSubscribers: true });
      const ctxObjectIds = ctxIds.map((id) => new Types.ObjectId(id));
      if (!ctxObjectIds.length) {
        return NextResponse.json({ chartData: [], metricUsed: engagementMetric, groupBy }, { status: 200 });
      }
      userQuery._id = { $in: ctxObjectIds };
    }

    const activeIds = await UserModel.distinct('_id', userQuery);
    if (!activeIds.length) {
      return NextResponse.json({ chartData: [], metricUsed: engagementMetric, groupBy }, { status: 200 });
    }

    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startDate = getStartDateFromTimePeriod(today, timePeriod);

    const query: any = {};
    query.user = { $in: activeIds };
    if (timePeriod !== 'all_time') {
      query.postDate = { $gte: startDate, $lte: endDate };
    }

    const groupFieldPath =
      groupBy === 'format' ? '$format' : groupBy === 'context' ? '$context' : '$proposal';
    const metricFieldPath = `$${engagementMetric}`;
    const parsedLimit = limitParam ? parseInt(limitParam, 10) : null;

    const pipeline: any[] = [
      { $match: query },
      {
        $project: {
          metricValue: metricFieldPath,
          groupValues: {
            $let: {
              vars: { raw: groupFieldPath },
              in: {
                $cond: [
                  { $isArray: '$$raw' },
                  '$$raw',
                  {
                    $cond: [
                      { $and: [{ $ne: ['$$raw', null] }, { $ne: ['$$raw', ''] }] },
                      ['$$raw'],
                      [],
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      { $unwind: '$groupValues' },
      {
        $match: {
          groupValues: { $nin: [null, ''] },
          $expr: { $isNumber: '$metricValue' },
        },
      },
      {
        $group: {
          _id: '$groupValues',
          value: { $avg: '$metricValue' },
          postsCount: { $sum: 1 },
        },
      },
      { $sort: { value: -1 } },
    ];

    if (parsedLimit && parsedLimit > 0) {
      pipeline.push({ $limit: parsedLimit });
    }

    pipeline.push({ $project: { _id: 0, name: '$_id', value: 1, postsCount: 1 } });

    const results = await MetricModel.aggregate(pipeline).exec();

    // Retorna dados
    return NextResponse.json({ chartData: results, metricUsed: engagementMetric, groupBy }, { status: 200 });
  } catch (error) {
    logger.error('[API PLATFORM/PERFORMANCE/AVERAGE-ENGAGEMENT] Error:', error);
    return NextResponse.json({ error: 'Erro ao processar engajamento médio agrupado.', details: (error as Error).message }, { status: 500 });
  }
}
