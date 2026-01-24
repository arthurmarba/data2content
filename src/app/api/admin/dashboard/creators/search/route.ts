import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { dashboardCache, SHORT_DASHBOARD_TTL_MS } from '@/app/lib/cache/dashboardCache';
import { getAdminSession } from '@/lib/getAdminSession';

export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/creators/search]';

const querySchema = z.object({
  q: z.string().optional().default(''),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
  onlyActiveSubscribers: z.enum(['true', 'false']).optional().default('false').transform(value => value === 'true'),
});

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeQuery = (value: string) => value.trim().replace(/\s+/g, ' ');

const resolveRegistrationDate = (user: {
  registrationDate?: Date | null;
  createdAt?: Date | null;
  _id?: Types.ObjectId;
}) => {
  if (user.registrationDate instanceof Date) return user.registrationDate;
  if (user.createdAt instanceof Date) return user.createdAt;
  if (user._id && typeof user._id.getTimestamp === 'function') {
    try {
      return user._id.getTimestamp();
    } catch {
      /* ignore */
    }
  }
  return new Date(0);
};

const mapCreator = (user: any) => ({
  _id: user._id?.toString?.() ?? '',
  name: user.name ?? '',
  email: user.email ?? '',
  profilePictureUrl: user.profile_picture_url ?? user.profilePictureUrl ?? user.image ?? null,
  adminStatus: user.adminStatus ?? 'active',
  registrationDate: resolveRegistrationDate(user),
});

export async function GET(request: NextRequest) {
  const requestStartedAt = Date.now();
  const session = (await getAdminSession(request)) as { user?: { name?: string } } | null;
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const validationResult = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!validationResult.success) {
    const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    logger.warn(`${SERVICE_TAG} Invalid query params: ${errorMessage}`);
    return NextResponse.json({ error: `Parâmetros de consulta inválidos: ${errorMessage}` }, { status: 400 });
  }

  const { q, limit, onlyActiveSubscribers } = validationResult.data;
  const queryTerm = normalizeQuery(q);

  if (queryTerm.length < 2) {
    return NextResponse.json({ creators: [] }, { status: 200 });
  }

  const cacheKey = `creator-search:${queryTerm.toLowerCase()}:limit=${limit}:active=${onlyActiveSubscribers ? '1' : '0'}`;

  try {
    let dbDurationMs: number | null = null;
    const { value: creators, hit } = await dashboardCache.wrap(
      cacheKey,
      async () => {
        await connectToDatabase();
        const dbStartedAt = Date.now();

        const baseFilter: Record<string, unknown> = {};
        if (onlyActiveSubscribers) {
          baseFilter.planStatus = 'active';
        }

        const projection: Record<string, 1> = {
          name: 1,
          email: 1,
          profile_picture_url: 1,
          profilePictureUrl: 1,
          adminStatus: 1,
          registrationDate: 1,
          createdAt: 1,
        };

        const isObjectId = queryTerm.length === 24 && Types.ObjectId.isValid(queryTerm);
        if (isObjectId) {
          const results = await UserModel.find(
            { ...baseFilter, _id: new Types.ObjectId(queryTerm) },
            projection
          ).limit(limit).lean();
          const mapped = results.map(mapCreator).filter((creator: any) => creator._id && creator.name);
          dbDurationMs = Date.now() - dbStartedAt;
          return mapped;
        }

        const shouldUseTextSearch = queryTerm.length >= 3 && !queryTerm.includes('@');
        if (shouldUseTextSearch) {
          const textProjection: Record<string, any> = { ...projection, score: { $meta: 'textScore' } };
          const textResults = await UserModel.find(
            { ...baseFilter, $text: { $search: queryTerm } },
            textProjection
          ).sort({ score: { $meta: 'textScore' } }).limit(limit).lean();

          if (textResults.length > 0) {
            const mapped = textResults.map(mapCreator).filter((creator: any) => creator._id && creator.name);
            dbDurationMs = Date.now() - dbStartedAt;
            return mapped;
          }
        }

        const safeRegex = new RegExp(escapeRegExp(queryTerm), 'i');
        const regexResults = await UserModel.find(
          {
            ...baseFilter,
            $or: [
              { name: safeRegex },
              { email: safeRegex },
              { username: safeRegex },
            ],
          },
          projection
        ).sort({ name: 1 }).limit(limit).lean();

        const mapped = regexResults.map(mapCreator).filter((creator: any) => creator._id && creator.name);
        dbDurationMs = Date.now() - dbStartedAt;
        return mapped;
      },
      SHORT_DASHBOARD_TTL_MS
    );

    const totalDurationMs = Date.now() - requestStartedAt;
    const timingParts = [`total;dur=${totalDurationMs}`];
    if (hit) {
      timingParts.push('cache;desc="hit"');
    } else if (dbDurationMs !== null) {
      timingParts.push(`db;dur=${dbDurationMs}`);
    }

    const response = NextResponse.json({ creators }, { status: 200 });
    response.headers.set('Server-Timing', timingParts.join(', '));
    return response;
  } catch (error) {
    logger.error(`${SERVICE_TAG} Error while searching creators:`, error);
    return NextResponse.json({ error: 'Erro ao buscar criadores.' }, { status: 500 });
  }
}
