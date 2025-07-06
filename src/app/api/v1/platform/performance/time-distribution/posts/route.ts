import { NextResponse } from 'next/server';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';

export const dynamic = 'force-dynamic';

function isAllowedTimePeriod(period: any): period is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(period);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const format = searchParams.get('format') || undefined;
  const proposal = searchParams.get('proposal') || undefined;
  const context = searchParams.get('context') || undefined;
  const metric = searchParams.get('metric') || 'stats.total_interactions';
  const dayOfWeek = parseInt(searchParams.get('dayOfWeek') || '', 10);
  const timeBlock = searchParams.get('timeBlock');
  const limit = parseInt(searchParams.get('limit') || '5', 10);

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : 'last_90_days';

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  if (!dayOfWeek || !timeBlock) {
    return NextResponse.json({ error: 'Parâmetros dayOfWeek e timeBlock são obrigatórios.' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startDate = getStartDateFromTimePeriod(today, timePeriod);

    const match: any = {
      postDate: { $gte: startDate, $lte: endDate },
    };
    if (format) match.format = format;
    if (proposal) match.proposal = proposal;
    if (context) match.context = context;

    const pipeline: any[] = [
      { $match: match },
      {
        $addFields: {
          dayOfWeek: { $dayOfWeek: '$postDate' },
          hour: { $hour: '$postDate' },
        },
      },
      {
        $addFields: {
          timeBlock: {
            $switch: {
              branches: [
                { case: { $lte: ['$hour', 5] }, then: '0-6' },
                { case: { $lte: ['$hour', 11] }, then: '6-12' },
                { case: { $lte: ['$hour', 17] }, then: '12-18' },
                { case: { $lte: ['$hour', 23] }, then: '18-24' },
              ],
              default: 'unknown',
            },
          },
        },
      },
      { $match: { dayOfWeek, timeBlock } },
      {
        $project: {
          description: 1,
          postLink: 1,
          coverUrl: 1,
          metricValue: `$${metric}`,
        },
      },
      { $match: { metricValue: { $ne: null } } },
      { $sort: { metricValue: -1 } },
      { $limit: limit },
    ];

    const posts = await MetricModel.aggregate(pipeline).exec();

    return NextResponse.json({ posts }, { status: 200 });
  } catch (error: any) {
    console.error('[API PLATFORM/TIME-DISTRIBUTION/POSTS] Error:', error);
    return NextResponse.json({ error: 'Erro ao buscar posts.' }, { status: 500 });
  }
}
