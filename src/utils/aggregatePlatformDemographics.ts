// src/utils/aggregatePlatformDemographics.ts

import AudienceDemographicSnapshotModel, { IAudienceDemographics } from '@/app/models/demographics/AudienceDemographicSnapshot';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { PipelineStage } from 'mongoose'; // 1. Importar o tipo PipelineStage

export interface PlatformDemographicsAggregation {
  follower_demographics: {
    country: Record<string, number>;
    city: Record<string, number>;
    age: Record<string, number>;
    gender: Record<string, number>;
  };
}

export default async function aggregatePlatformDemographics(): Promise<PlatformDemographicsAggregation> {
  const initial: PlatformDemographicsAggregation = {
    follower_demographics: { country: {}, city: {}, age: {}, gender: {} },
  };

  try {
    await connectToDatabase();
    const activeUsers = await UserModel.find({ planStatus: 'active' }).select('_id').lean();
    if (!activeUsers.length) return initial;

    const userIds = activeUsers.map(u => u._id);

    // 2. Aplicar o tipo explícito à pipeline
    const pipeline: PipelineStage[] = [
      { $match: { user: { $in: userIds } } },
      { $sort: { user: 1, recordedAt: -1 } },
      { $group: { _id: '$user', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $project: { demographics: 1 } },
    ];

    const snapshots = await AudienceDemographicSnapshotModel.aggregate(pipeline);

    const result = initial;

    const addToMap = (map: Record<string, number>, data?: Record<string, number>) => {
      if (!data) return;
      for (const [k, v] of Object.entries(data)) {
        map[k] = (map[k] || 0) + v;
      }
    };

    for (const snap of snapshots) {
      const follower = (snap.demographics as IAudienceDemographics)?.follower_demographics || {};
      addToMap(result.follower_demographics.country, follower.country);
      addToMap(result.follower_demographics.city, follower.city);
      addToMap(result.follower_demographics.age, follower.age);
      addToMap(result.follower_demographics.gender, follower.gender);
    }

    const sortMap = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
    result.follower_demographics.country = sortMap(result.follower_demographics.country);
    result.follower_demographics.city = sortMap(result.follower_demographics.city);
    result.follower_demographics.age = sortMap(result.follower_demographics.age);
    result.follower_demographics.gender = sortMap(result.follower_demographics.gender);

    return result;
  } catch (error) {
    logger.error('Error aggregating platform demographics:', error);
    return initial;
  }
}