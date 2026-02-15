import { connectToDatabase } from '@/app/lib/mongoose';
import FeatureFlag from '@/app/models/FeatureFlag';

const CACHE_TTL_MS = 60_000;
const FLAG_KEY = 'pricing.brand_risk_v1';
const CALIBRATION_FLAG_KEY = 'pricing.calibration_v1';

type CacheState = {
  value: boolean;
  expiresAt: number;
};

const cache: CacheState = {
  value: false,
  expiresAt: 0,
};

const calibrationCache: CacheState = {
  value: true,
  expiresAt: 0,
};

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled']);

function parseBoolean(input?: string | null): boolean | null {
  if (typeof input !== 'string') return null;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

function resolveEnvironment(): 'development' | 'staging' | 'production' {
  const raw = (process.env.NEXT_PUBLIC_ANALYTICS_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  if (['stage', 'staging', 'preview'].includes(raw)) return 'staging';
  if (['prod', 'production', 'live'].includes(raw)) return 'production';
  return 'development';
}

export async function isPricingBrandRiskV1Enabled(): Promise<boolean> {
  const envOverride = parseBoolean(process.env.PRICING_BRAND_RISK_V1);
  if (envOverride !== null) return envOverride;

  const now = Date.now();
  if (cache.expiresAt > now) {
    return cache.value;
  }

  try {
    await connectToDatabase();
    const env = resolveEnvironment();
    const dbValue = await (FeatureFlag as any).getValue(FLAG_KEY, env);
    const enabled = typeof dbValue === 'boolean' ? dbValue : false;
    cache.value = enabled;
    cache.expiresAt = now + CACHE_TTL_MS;
    return enabled;
  } catch {
    cache.value = false;
    cache.expiresAt = now + CACHE_TTL_MS;
    return false;
  }
}

export async function isPricingCalibrationV1Enabled(): Promise<boolean> {
  const envOverride = parseBoolean(process.env.PRICING_CALIBRATION_V1);
  if (envOverride !== null) return envOverride;

  const now = Date.now();
  if (calibrationCache.expiresAt > now) {
    return calibrationCache.value;
  }

  try {
    await connectToDatabase();
    const env = resolveEnvironment();
    const dbValue = await (FeatureFlag as any).getValue(CALIBRATION_FLAG_KEY, env);
    const enabled = typeof dbValue === 'boolean' ? dbValue : true;
    calibrationCache.value = enabled;
    calibrationCache.expiresAt = now + CACHE_TTL_MS;
    return enabled;
  } catch {
    calibrationCache.value = true;
    calibrationCache.expiresAt = now + CACHE_TTL_MS;
    return true;
  }
}

export function clearPricingBrandRiskFlagCache() {
  cache.value = false;
  cache.expiresAt = 0;
  calibrationCache.value = true;
  calibrationCache.expiresAt = 0;
}
