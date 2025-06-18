// ---------- src/app/api/v1/platform/charts/monthly-engagement-stacked/route.ts ----------

import { NextResponse } from 'next/server';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import dateHelpers from '@/utils/dateHelpers';
import { ALLOWED_TIME_PERIODS as BASE_ALLOWED_TIME_PERIODS } from '@/app/lib/constants/timePeriods';

interface MonthlyEngagementDataPoint {
  month: string;
  likes: number;
  comments: number;
  shares: number;
  saved?: number;
  total: number;
}

interface PlatformMonthlyEngagementResponse {
  chartData: MonthlyEngagementDataPoint[];
  insightSummary?: string;
}

const ALLOWED_TIME_PERIODS = [
  ...BASE_ALLOWED_TIME_PERIODS,
  'last_3_months',
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');

  // Normaliza last_3_months para last_90_days
  let effectiveTimePeriod = timePeriodParam;
  if (timePeriodParam === 'last_3_months') effectiveTimePeriod = 'last_90_days';

  const timePeriod =
    effectiveTimePeriod && ALLOWED_TIME_PERIODS.includes(effectiveTimePeriod)
      ? effectiveTimePeriod
      : 'last_6_months';

  if (
    timePeriodParam &&
    !ALLOWED_TIME_PERIODS.includes(timePeriodParam) &&
    !(effectiveTimePeriod && ALLOWED_TIME_PERIODS.includes(effectiveTimePeriod))
  ) {
    return NextResponse.json(
      { error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();

    const today = new Date();
    const endDateQuery = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23, 59, 59, 999
    );

    const startDateQuery =
      timePeriod === 'all_time'
        ? new Date(0)
        : dateHelpers.getStartDateFromTimePeriod(today, timePeriod);

    const match: any = {};
    if (timePeriod !== 'all_time') {
      match.postDate = { $gte: startDateQuery, $lte: endDateQuery };
    }

    const aggregationResult: MonthlyEngagementDataPoint[] = await MetricModel.aggregate([
      { $match: match },
      {
        $project: {
          month: { $dateToString: { format: '%Y-%m', date: '$postDate' } },
          likes: { $ifNull: ['$stats.likes', 0] },
          comments: { $ifNull: ['$stats.comments', 0] },
          shares: { $ifNull: ['$stats.shares', 0] },
          saved: { $ifNull: ['$stats.saved', 0] },
        },
      },
      {
        $group: {
          _id: '$month',
          likes: { $sum: '$likes' },
          comments: { $sum: '$comments' },
          shares: { $sum: '$shares' },
          saved: { $sum: '$saved' },
          total: { $sum: { $add: ['$likes', '$comments', '$shares', '$saved'] } },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          month: '$_id',
          likes: 1,
          comments: 1,
          shares: 1,
          saved: 1,
          total: 1,
          _id: 0,
        },
      },
    ]);

    // Preencher meses faltantes com zeros se necessário...

    const response: PlatformMonthlyEngagementResponse = {
      chartData: aggregationResult,
      insightSummary: `Engajamento mensal da plataforma (${timePeriod.replace('last_','').replace(/_/g,' ')}).`,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    logger.error('[API PLATFORM/CHARTS/MONTHLY-ENGAGEMENT-STACKED] Error:', err);
    return NextResponse.json(
      { error: 'Erro ao processar sua solicitação.', details: (err as Error).message },
      { status: 500 }
    );
  }
}
