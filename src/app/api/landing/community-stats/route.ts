import { NextRequest, NextResponse } from 'next/server';

import {
  fetchCommunityLandingStats,
  getCommunityLandingStatsFallback,
} from '@/app/lib/landing/communityStatsService';
import {
  executeWithLandingTimeout,
  resolveLandingInternalTimeoutMs,
} from '@/app/lib/landing/routeTimeout';
import { logger } from '@/app/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 5;

const PUBLIC_CACHE_CONTROL =
  'public, max-age=60, s-maxage=600, stale-while-revalidate=3600, stale-if-error=86400';
const BYPASS_CACHE_CONTROL = 'no-store';

export async function GET(req: NextRequest) {
  try {
    const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true';
    const fallbackPayload = getCommunityLandingStatsFallback();
    const hasWarmFallbackData =
      Boolean(fallbackPayload.lastUpdatedIso) ||
      fallbackPayload.ranking.length > 0 ||
      fallbackPayload.categories.length > 0;
    const timeoutMs = resolveLandingInternalTimeoutMs(hasWarmFallbackData);
    const result = await executeWithLandingTimeout({
      task: fetchCommunityLandingStats({ forceRefresh }),
      fallbackValue: fallbackPayload,
      timeoutMs,
      onTimeout: () => {
        logger.warn('[api/landing/community-stats] Falling back after internal timeout.', {
          timeoutMs,
          forceRefresh,
          hasWarmFallbackData,
        });
      },
    });

    return NextResponse.json(result.value, {
      headers: {
        'Cache-Control': forceRefresh ? BYPASS_CACHE_CONTROL : PUBLIC_CACHE_CONTROL,
        'X-Landing-Data-Source': result.source,
      },
    });
  } catch (error: any) {
    logger.error('[api/landing/community-stats] Failed to build stats payload:', error);
    return NextResponse.json(getCommunityLandingStatsFallback(), {
      status: 200,
      headers: {
        'Cache-Control': PUBLIC_CACHE_CONTROL,
      },
    });
  }
}
