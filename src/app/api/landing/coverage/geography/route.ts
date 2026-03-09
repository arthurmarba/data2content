import { NextRequest, NextResponse } from 'next/server';

import {
  fetchCoverageRegions,
  getCoverageRegionsFallback,
} from '@/app/lib/landing/coverageService';
import {
  executeWithLandingTimeout,
  resolveLandingInternalTimeoutMs,
} from '@/app/lib/landing/routeTimeout';
import { logger } from '@/app/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 5;

const PUBLIC_CACHE_CONTROL =
  'public, max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(27, Number(url.searchParams.get('limit') ?? '6')),
  );

  try {
    const fallbackItems = getCoverageRegionsFallback({ limit });
    const timeoutMs = resolveLandingInternalTimeoutMs(fallbackItems.length > 0);
    const result = await executeWithLandingTimeout({
      task: fetchCoverageRegions({ limit }),
      fallbackValue: fallbackItems,
      timeoutMs,
      onTimeout: () => {
        logger.warn('[landing][coverage][geography] Falling back after internal timeout.', {
          timeoutMs,
          limit,
          hasWarmFallbackData: fallbackItems.length > 0,
        });
      },
    });
    return NextResponse.json(
      { items: result.value },
      {
        headers: {
          'Cache-Control': PUBLIC_CACHE_CONTROL,
          'X-Landing-Data-Source': result.source,
        },
      },
    );
  } catch (error) {
    logger.error('[landing][coverage][geography] Failed to fetch regions', {
      error,
    });
    return NextResponse.json(
      { items: getCoverageRegionsFallback({ limit }) },
      {
        status: 200,
        headers: {
          'Cache-Control': PUBLIC_CACHE_CONTROL,
        },
      },
    );
  }
}
