import { connectToDatabase } from "@/app/lib/mongoose";
import FeatureFlag from "@/app/models/FeatureFlag";

const FLAG_KEY = "scripts_intelligence_v2";
const CACHE_TTL_MS = 60_000;

type CacheState = {
  value: boolean;
  expiresAt: number;
};

let cache: CacheState | null = null;

function parseBoolean(input?: string | null): boolean | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
  return null;
}

export async function isScriptsIntelligenceV2Enabled(): Promise<boolean> {
  const envOverride = parseBoolean(process.env.SCRIPTS_INTELLIGENCE_V2);
  if (envOverride !== null) {
    return envOverride;
  }

  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.value;
  }

  try {
    await connectToDatabase();
    const env = process.env.NODE_ENV || "development";
    const dbValue = await (FeatureFlag as any).getValue(FLAG_KEY, env);
    const enabled = typeof dbValue === "boolean" ? dbValue : false;
    cache = { value: enabled, expiresAt: now + CACHE_TTL_MS };
    return enabled;
  } catch {
    cache = { value: false, expiresAt: now + CACHE_TTL_MS };
    return false;
  }
}

export function clearScriptsIntelligenceFlagCache() {
  cache = null;
}
