type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

export interface CacheResult<T> {
  value: T;
  hit: boolean;
}

/**
 * Minimal in-memory TTL cache with promise de-duplication.
 */
export class SimpleTtlCache {
  private store = new Map<string, CacheEntry<unknown>>();

  async wrap<T>(key: string, factory: () => Promise<T> | T, ttlMs: number): Promise<CacheResult<T>> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (existing && existing.expiresAt > now) {
      if (existing.promise) {
        const value = await existing.promise;
        return { value: value as T, hit: true };
      }
      return { value: existing.value as T, hit: true };
    }

    // Clean up expired entry before creating a new one.
    if (existing && existing.expiresAt <= now) {
      this.store.delete(key);
    }

    const promise = Promise.resolve().then(factory).then((value) => {
      this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    }).catch((err) => {
      this.store.delete(key);
      throw err;
    });

    this.store.set(key, { promise, expiresAt: now + ttlMs });
    const value = await promise;
    return { value, hit: false };
  }

  clear(key?: string) {
    if (typeof key === 'string') {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }
}
