import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import MetricModel from '@/app/models/Metric';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';

const ALLOWED_CATEGORIES = ['format', 'proposal', 'context', 'tone', 'references'] as const;
type CategoryKey = typeof ALLOWED_CATEGORIES[number];

const ALLOWED_METRICS = [
  'posts',
  'views', 'reach', 'likes', 'comments', 'shares', 'total_interactions',
  'avg_views', 'avg_reach', 'avg_likes', 'avg_comments', 'avg_shares', 'avg_total_interactions',
] as const;
type CategoryRankingMetric = typeof ALLOWED_METRICS[number];

function isAllowedTimePeriod(period: any): period is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(period);
}

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  try {
    const { userId } = params;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: 'User ID inválido ou ausente.' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const categoryParam = (searchParams.get('category') || '').trim() as CategoryKey;
    const valueParam = (searchParams.get('value') || '').trim();
    const metricParam = (searchParams.get('metric') || 'avg_total_interactions').trim() as CategoryRankingMetric;
    const timePeriodParam = (searchParams.get('timePeriod') || 'last_90_days').trim();

    if (!ALLOWED_CATEGORIES.includes(categoryParam)) {
      return NextResponse.json({ error: `Categoria inválida. Use uma de: ${ALLOWED_CATEGORIES.join(', ')}` }, { status: 400 });
    }
    if (!valueParam) {
      return NextResponse.json({ error: 'Parâmetro "value" (id da categoria) é obrigatório.' }, { status: 400 });
    }
    if (!ALLOWED_METRICS.includes(metricParam)) {
      return NextResponse.json({ error: `Métrica inválida. Use uma de: ${ALLOWED_METRICS.join(', ')}` }, { status: 400 });
    }
    if (!isAllowedTimePeriod(timePeriodParam)) {
      return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
    }

    const periodInDays = timePeriodToDays(timePeriodParam);
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - periodInDays);

    // Monta acumulador de métrica
    let accumulator: any;
    let metricField: string | null = null;
    if (metricParam === 'posts') {
      accumulator = { $sum: 1 };
    } else if (metricParam.startsWith('avg_')) {
      metricField = metricParam.replace(/^avg_/, '');
      accumulator = { $avg: `$stats.${metricField}` };
    } else {
      metricField = metricParam;
      accumulator = { $sum: `$stats.${metricField}` };
    }

    const matchFilter: any = {
      postDate: { $gte: start, $lte: end },
      [categoryParam]: { $exists: true, $ne: [], $in: [valueParam] },
    };

    const pipeline: any[] = [
      { $match: matchFilter },
      {
        $group: {
          _id: '$user',
          metricValue: accumulator,
        },
      },
      { $sort: { metricValue: -1 } },
      {
        $group: {
          _id: null,
          users: { $push: '$_id' },
          values: { $push: '$metricValue' },
        },
      },
      {
        $project: {
          _id: 0,
          users: 1,
          values: 1,
          idx: { $indexOfArray: ['$users', new Types.ObjectId(userId)] },
          totalCreators: { $size: '$users' },
        },
      },
      {
        $project: {
          totalCreators: 1,
          rank: { $cond: [{ $eq: ['$idx', -1] }, null, { $add: ['$idx', 1] }] },
          metricValue: { $cond: [{ $eq: ['$idx', -1] }, null, { $arrayElemAt: ['$values', '$idx'] }] },
        },
      },
    ];

    const result = await MetricModel.aggregate(pipeline);
    const doc = result?.[0] || { totalCreators: 0, rank: null, metricValue: null };

    return NextResponse.json({
      category: categoryParam,
      value: valueParam,
      metric: metricParam,
      timePeriod: timePeriodParam,
      rank: doc.rank,
      totalCreators: doc.totalCreators,
      metricValue: doc.metricValue,
    });
  } catch (error) {
    console.error('[api/v1/users/[userId]/rankings/by-category] Error', error);
    return NextResponse.json({ error: 'Erro interno ao calcular ranking.' }, { status: 500 });
  }
}

