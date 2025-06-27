import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';

const DEFAULT_VIDEO_TYPES = ['REEL', 'VIDEO'];

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'User ID inválido ou ausente.' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod') as TimePeriod | null;
  const sortBy = searchParams.get('sortBy') || 'postDate';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  const timePeriod: TimePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : 'last_90_days';

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json(
      { error: `timePeriod inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();
    const userObjectId = new Types.ObjectId(userId);
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startDate = getStartDateFromTimePeriod(today, timePeriod);

    const matchStage: any = { user: userObjectId, type: { $in: DEFAULT_VIDEO_TYPES } };
    if (timePeriod !== 'all_time') {
      matchStage.postDate = { $gte: startDate, $lte: endDate };
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const pipeline = [
      { $match: matchStage },
      {
        $addFields: {
          average_video_watch_time_seconds: {
            $cond: {
              if: { $gt: [{ $ifNull: ['$stats.ig_reels_avg_watch_time', 0] }, 0] },
              then: { $divide: ['$stats.ig_reels_avg_watch_time', 1000] },
              else: null
            }
          },
          retention_rate: {
            $cond: {
              if: {
                $and: [
                  { $gt: [{ $ifNull: ['$stats.ig_reels_avg_watch_time', 0] }, 0] },
                  { $gt: [{ $ifNull: ['$stats.video_duration_seconds', 0] }, 0] }
                ]
              },
              then: {
                $divide: [
                  { $divide: ['$stats.ig_reels_avg_watch_time', 1000] },
                  '$stats.video_duration_seconds'
                ]
              },
              else: null
            }
          }
        }
      },
      { $sort: { [sortBy]: sortDirection } },
      {
        $facet: {
          videos: [ { $skip: skip }, { $limit: limit } ],
          totalCount: [ { $count: 'count' } ]
        }
      }
    ];

    const [agg] = await MetricModel.aggregate(pipeline);
    const videos = agg?.videos || [];
    const totalVideos = agg?.totalCount?.[0]?.count || 0;
    const totalPages = Math.ceil(totalVideos / limit) || 1;

    return NextResponse.json({
      videos,
      pagination: {
        currentPage: page,
        totalPages,
        totalVideos
      }
    });
  } catch (error) {
    console.error('[API USER/VIDEOS/LIST] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao buscar vídeos.', details: message }, { status: 500 });
  }
}
