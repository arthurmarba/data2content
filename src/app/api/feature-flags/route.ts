import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import { getErrorMessage, isTransientMongoError, withMongoTransientRetry } from '@/app/lib/mongoTransient';
import { logger } from '@/app/lib/logger';
import FeatureFlag from '@/app/models/FeatureFlag';
import { DEFAULT_FEATURE_FLAGS } from '@/lib/featureFlags';

const ALLOWED_ENVIRONMENTS = ['development', 'staging', 'production'] as const;
type FlagEnvironment = typeof ALLOWED_ENVIRONMENTS[number];
const FEATURE_FLAGS_CACHE_TTL_MS = (() => {
  const parsed = Number(process.env.FEATURE_FLAGS_CACHE_TTL_MS ?? 30_000);
  return Number.isFinite(parsed) && parsed >= 5_000 ? Math.floor(parsed) : 30_000;
})();
const FEATURE_FLAGS_CACHE_STALE_WHILE_ERROR_MS = (() => {
  const parsed = Number(process.env.FEATURE_FLAGS_CACHE_STALE_WHILE_ERROR_MS ?? 300_000);
  return Number.isFinite(parsed) && parsed >= 10_000 ? Math.floor(parsed) : 300_000;
})();

const featureFlagsCache = new Map<
  FlagEnvironment,
  { expiresAt: number; staleUntil: number; payload: { ok: true; env: FlagEnvironment; data: Record<string, boolean>; meta: { servedFromCache: boolean; stale: boolean } } }
>();

const normalizeEnvironment = (input?: string | null): FlagEnvironment => {
  const value = (input || '').toLowerCase();
  if (['dev', 'development', 'local'].includes(value)) return 'development';
  if (['stage', 'staging', 'preview'].includes(value)) return 'staging';
  if (['prod', 'production', 'live'].includes(value)) return 'production';
  const env = process.env.NEXT_PUBLIC_ANALYTICS_ENV || process.env.NODE_ENV || 'development';
  if (['stage', 'staging'].includes(env)) return 'staging';
  if (['prod', 'production'].includes(env)) return 'production';
  return 'development';
};

const resolveFlagValue = (flag: any, env: FlagEnvironment) => {
  if (!flag) return undefined;
  const envValue = flag.environments?.[env];
  if (typeof envValue === 'boolean') return envValue;
  return flag.defaultValue ?? false;
};

export async function GET(request: NextRequest) {
  const envParam = request.nextUrl.searchParams.get('env');
  const env = normalizeEnvironment(envParam);
  const nowTs = Date.now();
  const cached = featureFlagsCache.get(env);

  if (cached && cached.expiresAt > nowTs) {
    return NextResponse.json(cached.payload);
  }

  try {
    const docs = await withMongoTransientRetry(
      async () => {
        await connectToDatabase();
        return FeatureFlag.find().lean().exec();
      },
      {
        retries: 1,
        onRetry: (error, retryCount) => {
          logger.warn('[feature-flags] Retry para erro transitorio de Mongo.', {
            retryCount,
            error: getErrorMessage(error),
          });
        },
      }
    );

    const resolved: Record<string, boolean> = { ...DEFAULT_FEATURE_FLAGS };
    for (const flag of docs) {
      const value = resolveFlagValue(flag, env);
      if (typeof value === 'boolean') {
        resolved[flag.key] = value;
      }
    }

    const payload = {
      ok: true as const,
      env,
      data: resolved,
      meta: {
        servedFromCache: false,
        stale: false,
      },
    };
    featureFlagsCache.set(env, {
      payload,
      expiresAt: nowTs + FEATURE_FLAGS_CACHE_TTL_MS,
      staleUntil: nowTs + FEATURE_FLAGS_CACHE_STALE_WHILE_ERROR_MS,
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
      logger.warn('[feature-flags] Erro transitorio de Mongo ao carregar flags.', {
        error: getErrorMessage((error as any)?.cause ?? error),
      });
      if (cached && cached.staleUntil > nowTs) {
        return NextResponse.json({
          ...cached.payload,
          meta: {
            servedFromCache: true,
            stale: true,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        env,
        data: { ...DEFAULT_FEATURE_FLAGS },
        meta: {
          servedFromCache: true,
          stale: true,
        },
      });
    }

    logger.error('[feature-flags] Falha ao carregar feature flags.', error);
    return NextResponse.json({
      ok: true,
      env,
      data: { ...DEFAULT_FEATURE_FLAGS },
      meta: {
        servedFromCache: true,
        stale: true,
      },
    });
  }
}

export async function PATCH(request: NextRequest) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id || !['admin', 'internal', 'staff'].includes((session.user as any)?.role ?? '')) {
    return NextResponse.json({ ok: false, error: 'not_authorized' }, { status: 403 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const { key, env: envInput, enabled, defaultValue, description } = payload ?? {};
  if (typeof key !== 'string' || !key.trim()) {
    return NextResponse.json({ ok: false, error: 'invalid_key' }, { status: 400 });
  }

  const env = envInput ? normalizeEnvironment(envInput) : null;
  if (envInput && !ALLOWED_ENVIRONMENTS.includes(env!)) {
    return NextResponse.json({ ok: false, error: 'invalid_env' }, { status: 400 });
  }

  if (env && typeof enabled !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'missing_enabled' }, { status: 400 });
  }

  try {
    const doc = await withMongoTransientRetry(
      async () => {
        await connectToDatabase();

        const update: Record<string, any> = {
          updatedBy: session.user.id,
        };

        if (typeof description === 'string') {
          update.description = description;
        }

        if (typeof defaultValue === 'boolean' && !env) {
          update.defaultValue = defaultValue;
        }

        if (env) {
          update[`environments.${env}`] = enabled;
        } else if (typeof enabled === 'boolean') {
          update.defaultValue = enabled;
        }

        return FeatureFlag.findOneAndUpdate(
          { key },
          { $set: update },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        )
          .lean()
          .exec();
      },
      {
        retries: 1,
        onRetry: (error, retryCount) => {
          logger.warn('[feature-flags] Retry para erro transitorio de Mongo no PATCH.', {
            retryCount,
            error: getErrorMessage(error),
          });
        },
      }
    );

    featureFlagsCache.clear();

    const activeEnv = env ?? normalizeEnvironment(process.env.NEXT_PUBLIC_ANALYTICS_ENV || process.env.NODE_ENV || 'development');
    const value = resolveFlagValue(doc, activeEnv) ?? DEFAULT_FEATURE_FLAGS[key as keyof typeof DEFAULT_FEATURE_FLAGS] ?? false;

    return NextResponse.json({ ok: true, data: { key: doc.key, value, flag: doc } });
  } catch (error) {
    if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
      logger.warn('[feature-flags] Erro transitorio de Mongo no PATCH.', {
        error: getErrorMessage((error as any)?.cause ?? error),
      });
      return NextResponse.json({ ok: false, error: 'feature_flags_temporarily_unavailable' }, { status: 503 });
    }

    logger.error('[feature-flags] Falha ao atualizar feature flag.', error);
    return NextResponse.json({ ok: false, error: 'feature_flags_update_failed' }, { status: 500 });
  }
}
