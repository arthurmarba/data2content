const ALERT_UNREAD_CACHE_TTL_MS = (() => {
  const parsed = Number(process.env.ALERT_UNREAD_CACHE_TTL_MS ?? 20_000);
  return Number.isFinite(parsed) && parsed >= 2_000 ? Math.floor(parsed) : 20_000;
})();

const ALERT_UNREAD_CACHE_MAX_ENTRIES = (() => {
  const parsed = Number(process.env.ALERT_UNREAD_CACHE_MAX_ENTRIES ?? 10_000);
  return Number.isFinite(parsed) && parsed >= 500 ? Math.floor(parsed) : 10_000;
})();

const ALERT_LEGACY_BACKFILL_CHECK_TTL_MS = (() => {
  const parsed = Number(process.env.ALERT_LEGACY_BACKFILL_CHECK_TTL_MS ?? 60 * 60 * 1000);
  return Number.isFinite(parsed) && parsed >= 60_000 ? Math.floor(parsed) : 60 * 60 * 1000;
})();

const ALERT_LEGACY_BACKFILL_CHECK_MAX_ENTRIES = (() => {
  const parsed = Number(process.env.ALERT_LEGACY_BACKFILL_CHECK_MAX_ENTRIES ?? 20_000);
  return Number.isFinite(parsed) && parsed >= 1_000 ? Math.floor(parsed) : 20_000;
})();

const unreadCountCache = new Map<string, { value: number; expiresAt: number }>();
const legacyBackfillCheckedAt = new Map<string, number>();

function pruneUnreadCountCache(nowTs: number) {
  for (const [key, entry] of unreadCountCache.entries()) {
    if (entry.expiresAt <= nowTs) unreadCountCache.delete(key);
  }
  if (unreadCountCache.size <= ALERT_UNREAD_CACHE_MAX_ENTRIES) return;
  const overflow = unreadCountCache.size - ALERT_UNREAD_CACHE_MAX_ENTRIES;
  const keys = Array.from(unreadCountCache.keys());
  for (let i = 0; i < overflow; i += 1) {
    const key = keys[i];
    if (!key) break;
    unreadCountCache.delete(key);
  }
}

function pruneLegacyBackfillCache(nowTs: number) {
  for (const [key, checkedAt] of legacyBackfillCheckedAt.entries()) {
    if (checkedAt + ALERT_LEGACY_BACKFILL_CHECK_TTL_MS <= nowTs) {
      legacyBackfillCheckedAt.delete(key);
    }
  }
  if (legacyBackfillCheckedAt.size <= ALERT_LEGACY_BACKFILL_CHECK_MAX_ENTRIES) return;
  const overflow = legacyBackfillCheckedAt.size - ALERT_LEGACY_BACKFILL_CHECK_MAX_ENTRIES;
  const keys = Array.from(legacyBackfillCheckedAt.keys());
  for (let i = 0; i < overflow; i += 1) {
    const key = keys[i];
    if (!key) break;
    legacyBackfillCheckedAt.delete(key);
  }
}

export function getCachedUnreadCount(userId: string): number | null {
  const nowTs = Date.now();
  pruneUnreadCountCache(nowTs);
  const entry = unreadCountCache.get(userId);
  if (!entry || entry.expiresAt <= nowTs) return null;
  return entry.value;
}

export function setCachedUnreadCount(userId: string, value: number): void {
  const nowTs = Date.now();
  pruneUnreadCountCache(nowTs);
  unreadCountCache.set(userId, {
    value,
    expiresAt: nowTs + ALERT_UNREAD_CACHE_TTL_MS,
  });
}

export function invalidateCachedUnreadCount(userId: string): void {
  unreadCountCache.delete(userId);
}

export function hasRecentLegacyBackfillCheck(userId: string): boolean {
  const nowTs = Date.now();
  pruneLegacyBackfillCache(nowTs);
  const checkedAt = legacyBackfillCheckedAt.get(userId);
  return typeof checkedAt === "number" && checkedAt + ALERT_LEGACY_BACKFILL_CHECK_TTL_MS > nowTs;
}

export function markLegacyBackfillChecked(userId: string): void {
  const nowTs = Date.now();
  pruneLegacyBackfillCache(nowTs);
  legacyBackfillCheckedAt.set(userId, nowTs);
}
