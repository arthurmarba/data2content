import { NextResponse } from 'next/server';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { getCategoryWithSubcategoryIds, getCategoryById } from '@/app/lib/classification';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';
import { Types } from 'mongoose';

export const dynamic = 'force-dynamic';

function isAllowedTimePeriod(period: any): period is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(period);
}

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json(
      { error: 'User ID inválido ou ausente.' },
      { status: 400 }
    );
  }
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const format = searchParams.get('format') || undefined;
  const proposal = searchParams.get('proposal') || undefined;
  const context = searchParams.get('context') || undefined;
  const metric = searchParams.get('metric') || 'stats.total_interactions';
  const dayOfWeek = parseInt(searchParams.get('dayOfWeek') || '', 10);
  const timeBlock = searchParams.get('timeBlock');
  const hourParam = searchParams.get('hour');
  const hour = hourParam !== null ? parseInt(hourParam, 10) : NaN;
  const limit = parseInt(searchParams.get('limit') || '5', 10);

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : 'last_90_days';

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  if (!dayOfWeek || (isNaN(hour) && !timeBlock)) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios: dayOfWeek e (hour ou timeBlock).' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startDate = getStartDateFromTimePeriod(today, timePeriod);

    const match: any = {
      user: new Types.ObjectId(userId),
      postDate: { $gte: startDate, $lte: endDate },
    };
    if (format) {
      const ids = getCategoryWithSubcategoryIds(format, 'format');
      const labels = ids.map(id => getCategoryById(id, 'format')?.label || id);
      match.format = { $in: labels };
    }
    if (proposal) {
      const ids = getCategoryWithSubcategoryIds(proposal, 'proposal');
      const labels = ids.map(id => getCategoryById(id, 'proposal')?.label || id);
      match.proposal = { $in: labels };
    }
    if (context) {
      const ids = getCategoryWithSubcategoryIds(context, 'context');
      const labels = ids.map(id => getCategoryById(id, 'context')?.label || id);
      match.context = { $in: labels };
    }

    const pipeline: any[] = [
      { $match: match },
      {
        $addFields: {
          dayOfWeek: { $dayOfWeek: { date: '$postDate', timezone: 'America/Sao_Paulo' } },
          hour: { $hour: { date: '$postDate', timezone: 'America/Sao_Paulo' } },
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
      ...(isNaN(hour)
        ? [{ $match: { dayOfWeek, timeBlock } }]
        : [{ $match: { dayOfWeek, hour } }]
      ),
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'creator',
          pipeline: [{ $project: { name: 1, profile_picture_url: 1 } }]
        }
      },
      { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          description: 1,
          postLink: 1,
          coverUrl: 1,
          format: 1,
          proposal: 1,
          context: 1,
          tone: 1,
          references: 1,
          stats: 1,
          postDate: 1,
          creatorName: '$creator.name',
          creatorPhotoUrl: '$creator.profile_picture_url',
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
    console.error('[API USER/TIME-DISTRIBUTION/POSTS] Error:', error);
    return NextResponse.json({ error: 'Erro ao buscar posts.' }, { status: 500 });
  }
}
