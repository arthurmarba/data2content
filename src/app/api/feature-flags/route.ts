import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import FeatureFlag from '@/app/models/FeatureFlag';
import { DEFAULT_FEATURE_FLAGS } from '@/lib/featureFlags';

const ALLOWED_ENVIRONMENTS = ['development', 'staging', 'production'] as const;
type FlagEnvironment = typeof ALLOWED_ENVIRONMENTS[number];

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

  await connectToDatabase();
  const docs = await FeatureFlag.find().lean().exec();

  const resolved: Record<string, boolean> = { ...DEFAULT_FEATURE_FLAGS };
  for (const flag of docs) {
    const value = resolveFlagValue(flag, env);
    if (typeof value === 'boolean') {
      resolved[flag.key] = value;
    }
  }

  return NextResponse.json({ ok: true, env, data: resolved });
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

  const doc = await FeatureFlag.findOneAndUpdate(
    { key },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
    .lean()
    .exec();

  const activeEnv = env ?? normalizeEnvironment(process.env.NEXT_PUBLIC_ANALYTICS_ENV || process.env.NODE_ENV || 'development');
  const value = resolveFlagValue(doc, activeEnv) ?? DEFAULT_FEATURE_FLAGS[key as keyof typeof DEFAULT_FEATURE_FLAGS] ?? false;

  return NextResponse.json({ ok: true, data: { key: doc.key, value, flag: doc } });
}
