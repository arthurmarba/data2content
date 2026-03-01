type MemoryEntry = {
  expiresAt: number;
  payload: unknown;
};

const DEFAULT_TTL_MS = 45_000;
const DEFAULT_MAX_ENTRIES = 250;

const MEMORY_CACHE_TTL_MS = Math.max(
  1_000,
  Number.parseInt(process.env.PLANNER_BATCH_MEMORY_CACHE_TTL_MS || `${DEFAULT_TTL_MS}`, 10) || DEFAULT_TTL_MS
);
const MEMORY_CACHE_MAX_ENTRIES = Math.max(
  20,
  Number.parseInt(process.env.PLANNER_BATCH_MEMORY_CACHE_MAX_ENTRIES || `${DEFAULT_MAX_ENTRIES}`, 10) ||
    DEFAULT_MAX_ENTRIES
);

const recommendationMemoryCache = new Map<string, MemoryEntry>();
const recommendationInFlight = new Map<string, Promise<unknown>>();

function pruneRecommendationMemoryCache(nowEpochMs: number) {
  for (const [key, entry] of recommendationMemoryCache.entries()) {
    if (entry.expiresAt <= nowEpochMs) {
      recommendationMemoryCache.delete(key);
    }
  }

  while (recommendationMemoryCache.size > MEMORY_CACHE_MAX_ENTRIES) {
    const oldestKey = recommendationMemoryCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    recommendationMemoryCache.delete(oldestKey);
  }
}

export function buildPlannerRecommendationMemoryKey(params: {
  scope: string;
  userId: string;
  weekStart: Date | string;
  periodDays: number;
  targetSlotsPerWeek: number;
  freezeEnabled: boolean;
  includeThemes?: boolean;
  algoVersion: number;
}) {
  const weekStartISO =
    params.weekStart instanceof Date ? params.weekStart.toISOString() : String(params.weekStart);
  return [
    params.scope,
    params.userId,
    weekStartISO,
    String(params.periodDays),
    String(params.targetSlotsPerWeek),
    params.freezeEnabled ? "1" : "0",
    params.includeThemes === undefined ? "themes?" : params.includeThemes ? "themes1" : "themes0",
    `algo${params.algoVersion}`,
  ].join("|");
}

export function readPlannerRecommendationMemory<T>(key: string): T | null {
  const nowEpochMs = Date.now();
  pruneRecommendationMemoryCache(nowEpochMs);
  const entry = recommendationMemoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= nowEpochMs) {
    recommendationMemoryCache.delete(key);
    return null;
  }
  return entry.payload as T;
}

export function writePlannerRecommendationMemory<T>(key: string, payload: T) {
  pruneRecommendationMemoryCache(Date.now());
  recommendationMemoryCache.set(key, {
    payload,
    expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
  });
}

export function getPlannerRecommendationInFlight<T>(key: string): Promise<T> | null {
  return (recommendationInFlight.get(key) as Promise<T> | undefined) ?? null;
}

export function setPlannerRecommendationInFlight<T>(key: string, promise: Promise<T>) {
  recommendationInFlight.set(key, promise as Promise<unknown>);
}

export function clearPlannerRecommendationInFlight(key: string) {
  recommendationInFlight.delete(key);
}

export function invalidatePlannerRecommendationMemory(params: {
  userId: string;
  weekStart?: Date | string;
}) {
  const targetUserId = params.userId.trim();
  if (!targetUserId) return 0;
  const weekStartISO =
    params.weekStart instanceof Date
      ? params.weekStart.toISOString()
      : typeof params.weekStart === "string" && params.weekStart
      ? params.weekStart
      : null;

  let removed = 0;
  for (const key of recommendationMemoryCache.keys()) {
    const matchesUser = key.includes(`|${targetUserId}|`);
    const matchesWeek = weekStartISO ? key.includes(`|${weekStartISO}|`) : true;
    if (matchesUser && matchesWeek) {
      recommendationMemoryCache.delete(key);
      removed += 1;
    }
  }

  for (const key of recommendationInFlight.keys()) {
    const matchesUser = key.includes(`|${targetUserId}|`);
    const matchesWeek = weekStartISO ? key.includes(`|${weekStartISO}|`) : true;
    if (matchesUser && matchesWeek) {
      recommendationInFlight.delete(key);
    }
  }

  return removed;
}
