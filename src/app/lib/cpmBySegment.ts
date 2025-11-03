import 'server-only';

import * as Sentry from '@sentry/nextjs';

import { getDynamicCpmBySegment, DEFAULT_CPM } from '@/app/lib/ai/cpmDynamicService';
import { logger } from '@/app/lib/logger';

export interface ResolvedCpm {
  value: number;
  source: 'seed' | 'dynamic';
}

type CpmCache = {
  data: Record<string, ResolvedCpm>;
  updatedAt: number;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
let cache: CpmCache | null = null;

function isCacheFresh(now: number): boolean {
  if (!cache) return false;
  return now - cache.updatedAt < CACHE_TTL_MS;
}

export async function resolveSegmentCpm(
  segment?: string | null,
  options?: { forceRefresh?: boolean }
): Promise<ResolvedCpm> {
  const normalized = segment?.trim().toLowerCase() || 'default';
  const now = Date.now();
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh && isCacheFresh(now)) {
    const cachedEntry = cache!.data[normalized] ?? cache!.data.default;
    if (cachedEntry) return cachedEntry;
    return { value: DEFAULT_CPM, source: 'dynamic' };
  }

  try {
    const data = await getDynamicCpmBySegment({ forceRefresh });
    cache = { data, updatedAt: now };
    const entry = data[normalized] ?? data.default;
    if (entry) return entry;
    return { value: DEFAULT_CPM, source: 'dynamic' };
  } catch (error) {
    logger.error('[CPM_DYNAMIC] Failed to resolve segment CPM', error);
    Sentry.captureException(error);
    return { value: DEFAULT_CPM, source: 'dynamic' };
  }
}

export { DEFAULT_CPM };
