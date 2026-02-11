import { connectToDatabase } from "@/app/lib/mongoose";
import FeatureFlag from "@/app/models/FeatureFlag";

const CACHE_TTL_MS = 60_000;
const FLAG_KEYS = {
  scriptsIntelligenceV2: "scripts_intelligence_v2",
  scriptsStyleTrainingV1: "scripts_style_training_v1",
} as const;

type CacheState = {
  value: boolean;
  expiresAt: number;
};

const cache = new Map<string, CacheState>();

function parseBoolean(input?: string | null): boolean | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
  return null;
}

export async function isScriptsIntelligenceV2Enabled(): Promise<boolean> {
  return getFlagValue({
    cacheKey: FLAG_KEYS.scriptsIntelligenceV2,
    envVar: process.env.SCRIPTS_INTELLIGENCE_V2,
  });
}

export async function isScriptsStyleTrainingV1Enabled(): Promise<boolean> {
  return getFlagValue({
    cacheKey: FLAG_KEYS.scriptsStyleTrainingV1,
    envVar: process.env.SCRIPTS_STYLE_TRAINING_V1,
  });
}

async function getFlagValue(params: { cacheKey: string; envVar?: string | null }): Promise<boolean> {
  const envOverride = parseBoolean(params.envVar);
  if (envOverride !== null) return envOverride;

  const now = Date.now();
  const cached = cache.get(params.cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    await connectToDatabase();
    const env = process.env.NODE_ENV || "development";
    const dbValue = await (FeatureFlag as any).getValue(params.cacheKey, env);
    const enabled = typeof dbValue === "boolean" ? dbValue : false;
    cache.set(params.cacheKey, { value: enabled, expiresAt: now + CACHE_TTL_MS });
    return enabled;
  } catch {
    cache.set(params.cacheKey, { value: false, expiresAt: now + CACHE_TTL_MS });
    return false;
  }
}

export function clearScriptsIntelligenceFlagCache() {
  cache.clear();
}
