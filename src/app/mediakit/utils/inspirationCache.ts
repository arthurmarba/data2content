import { PlannerUISlot } from '@/hooks/usePlannerData';

type InspirationResult = {
    self: { id: string; caption: string; views?: number; thumbnailUrl?: string | null; postLink?: string | null } | null;
    community: { id: string; caption: string; views?: number; coverUrl?: string | null; postLink?: string | null } | null;
};

// Cache key generation
export const getInspirationCacheKey = (slot: PlannerUISlot) => {
    const theme = (slot.themeKeyword && slot.themeKeyword.trim()) || (slot.themes && slot.themes[0]) || '';
    return `${slot.dayOfWeek}-${slot.blockStartHour}-${theme}`;
};

// In-memory cache
const cache = new Map<string, InspirationResult>();
const pendingRequests = new Map<string, Promise<InspirationResult>>();

export async function fetchSlotInspirations(
    userId: string,
    slot: PlannerUISlot
): Promise<InspirationResult> {
    const key = getInspirationCacheKey(slot);

    // Return cached result if available
    if (cache.has(key)) {
        return cache.get(key)!;
    }

    // Return pending promise if request is in flight (deduplication)
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key)!;
    }

    // Create new request promise
    const promise = (async () => {
        try {
            const [selfRes, communityRes] = await Promise.allSettled([
                fetch('/api/planner/inspirations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        dayOfWeek: slot.dayOfWeek,
                        blockStartHour: slot.blockStartHour,
                        categories: slot.categories || {},
                        limit: 1,
                    }),
                }),
                fetch('/api/planner/inspirations/community', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        categories: slot.categories || {},
                        script: typeof slot.rationale === 'string' ? slot.rationale : slot.scriptShort || '',
                        themeKeyword: slot.themeKeyword,
                        limit: 1,
                    }),
                }),
            ]);

            let self: InspirationResult['self'] = null;
            let community: InspirationResult['community'] = null;

            if (selfRes.status === 'fulfilled' && selfRes.value.ok) {
                const data = await selfRes.value.json();
                const first = Array.isArray(data?.posts) && data.posts[0];
                if (first) {
                    self = {
                        id: String(first.id),
                        caption: String(first.caption || ''),
                        views: Number(first.views || 0),
                        thumbnailUrl: first.thumbnailUrl || null,
                        postLink: first.postLink || null,
                    };
                }
            }

            if (communityRes.status === 'fulfilled' && communityRes.value.ok) {
                const data = await communityRes.value.json();
                const first = Array.isArray(data?.posts) && data.posts[0];
                if (first) {
                    community = {
                        id: String(first.id),
                        caption: String(first.caption || ''),
                        views: Number(first.views || 0),
                        coverUrl: first.coverUrl || null,
                        postLink: first.postLink || null,
                    };
                }
            }

            const result = { self, community };
            cache.set(key, result);
            return result;
        } catch (error) {
            console.error('Error fetching inspirations:', error);
            return { self: null, community: null };
        } finally {
            pendingRequests.delete(key);
        }
    })();

    pendingRequests.set(key, promise);
    return promise;
}

export function prefillInspirationCache(
    slot: PlannerUISlot,
    result: Partial<InspirationResult>
) {
    const key = getInspirationCacheKey(slot);
    const existing = cache.get(key) || { self: null, community: null };
    cache.set(key, { ...existing, ...result });
}
