import { NextResponse, NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import { createClient } from 'redis';
import { logger } from '@/app/lib/logger';
import { fetchFollowerDemographics } from '@/services/instagramInsightsService';

const redisUrl = process.env.REDIS_URL || '';
const redis = createClient({ url: redisUrl });
redis.on('error', err => logger.error('[demographics][Redis]', err));
redis.connect().catch(err => logger.error('[demographics][Redis] connect', err));

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;
  const TAG = '[API demographics]';

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'User ID inválido.' }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findById(userId)
    .select('instagramAccountId instagramAccessToken')
    .lean();

  if (!user?.instagramAccountId || !user?.instagramAccessToken) {
    return NextResponse.json({ error: 'Usuário não possui conta Instagram conectada.' }, { status: 404 });
  }

  const cacheKey = `demographics:${user.instagramAccountId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      await redis.quit();
      return NextResponse.json(parsed, { status: 200 });
    }
  } catch (e) {
    logger.warn(`${TAG} Falha ao ler cache:`, e);
  }

  try {
    const data = await fetchFollowerDemographics(user.instagramAccountId, user.instagramAccessToken);
    await redis.set(cacheKey, JSON.stringify(data), { EX: 60 * 60 * 24 });
    await redis.quit();
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    await redis.quit();
    logger.error(`${TAG} Erro ao obter demografia`, err);
    return NextResponse.json({ error: 'Falha ao obter dados de demografia.' }, { status: 500 });
  }
}
