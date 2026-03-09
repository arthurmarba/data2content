type ScriptsListCacheEntry = {
  expiresAt: number;
  staleUntil: number;
  payload: any;
};

declare global {
  // eslint-disable-next-line no-var
  var __d2cScriptsListCache: Map<string, ScriptsListCacheEntry> | undefined;
}

export const scriptsListCache =
  globalThis.__d2cScriptsListCache ?? (globalThis.__d2cScriptsListCache = new Map<string, ScriptsListCacheEntry>());

export function invalidateScriptsListCacheForUser(userId: string) {
  const normalizedUserId = typeof userId === "string" ? userId.trim() : "";
  if (!normalizedUserId) return;

  for (const key of scriptsListCache.keys()) {
    if (key.startsWith(`${normalizedUserId}|`)) {
      scriptsListCache.delete(key);
    }
  }
}
