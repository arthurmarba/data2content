import { NextResponse, NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import { createClient } from 'redis';
import { logger } from '@/app/lib/logger';
import { fetchFollowerDemographics } from '@/services/instagramInsightsService';
import AudienceDemographicSnapshotModel from '@/app/models/demographics/AudienceDemographicSnapshot';

const redisUrl = process.env.REDIS_URL?.trim() || null;
let redisClientPromise: Promise<ReturnType<typeof createClient> | null> | null = null;

async function getRedisClient() {
  if (!redisUrl) return null;
  if (!redisClientPromise) {
    const client = createClient({ url: redisUrl });
    client.on('error', err => logger.error('[demographics][Redis]', err));
    redisClientPromise = client
      .connect()
      .then(() => client)
      .catch(err => {
        logger.error('[demographics][Redis] connect', err);
        redisClientPromise = null;
        return null;
      });
  }
  return redisClientPromise;
}

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;
  const TAG = '[API demographics]';

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'User ID inválido.' }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findById(userId)
    .select('_id instagramAccountId instagramAccessToken')
    .lean();

  if (!user?.instagramAccountId || !user?.instagramAccessToken) {
    return NextResponse.json({ error: 'Usuário não possui conta Instagram conectada.' }, { status: 404 });
  }

  const cacheKey = `demographics:${user.instagramAccountId}`;
  const redis = await getRedisClient();
  try {
    const cached = redis ? await redis.get(cacheKey) : null;
    if (cached) {
      const parsed = JSON.parse(cached);
      return NextResponse.json(parsed, { status: 200 });
    }
  } catch (e) {
    logger.warn(`${TAG} Falha ao ler cache:`, e);
  }

  try {
    const data = await fetchFollowerDemographics(user.instagramAccountId, user.instagramAccessToken);
    if (redis) {
      await redis.set(cacheKey, JSON.stringify(data), { EX: 60 * 60 * 24 });
    }
    
    // CORREÇÃO: Envolve os dados na estrutura correta que o schema espera.
    await AudienceDemographicSnapshotModel.create({
      user: user._id,
      instagramAccountId: user.instagramAccountId,
      recordedAt: new Date(),
      demographics: {
        follower_demographics: data.follower_demographics,
      },
    });

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    logger.error(`${TAG} Erro ao obter demografia`, err);
    return NextResponse.json({ error: 'Falha ao obter dados de demografia.' }, { status: 500 });
  }
}
