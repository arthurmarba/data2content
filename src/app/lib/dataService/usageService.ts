import { PipelineStage, Types } from 'mongoose';
import { connectToDatabase } from './connection';
import UserUsageSnapshot from '@/app/models/UserUsageSnapshot';

export async function fetchTopActiveUsers(since: Date, limit = 10) {
  await connectToDatabase();

  const pipeline: PipelineStage[] = [
    { $match: { date: { $gte: since } } },
    { $group: { _id: '$user', messageCount: { $sum: '$messageCount' } } },
    { $sort: { messageCount: -1 } },
    { $limit: limit },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        messageCount: 1,
        name: '$user.name',
        profilePictureUrl: '$user.profile_picture_url',
      },
    },
  ];

  return UserUsageSnapshot.aggregate(pipeline);
}

export async function fetchUserUsageTrend(userId: string, days = 30) {
  await connectToDatabase();
  const uid = new Types.ObjectId(userId);
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - days);
  startDate.setUTCHours(0, 0, 0, 0);

  const pipeline: PipelineStage[] = [
    { $match: { user: uid, date: { $gte: startDate } } },
    { $sort: { date: 1 } },
    { $project: { _id: 0, date: 1, messageCount: 1 } },
  ];

  return UserUsageSnapshot.aggregate(pipeline);
}
