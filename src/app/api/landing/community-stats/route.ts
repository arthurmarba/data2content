import { NextRequest, NextResponse } from 'next/server';

import { fetchCommunityLandingStats } from '@/app/lib/landing/communityStatsService';
import { logger } from '@/app/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 5;

const PUBLIC_CACHE_CONTROL =
  'public, max-age=60, s-maxage=600, stale-while-revalidate=3600, stale-if-error=86400';
const BYPASS_CACHE_CONTROL = 'no-store';

export async function GET(req: NextRequest) {
  try {
    const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true';
    const payload = await fetchCommunityLandingStats({ forceRefresh });

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': forceRefresh ? BYPASS_CACHE_CONTROL : PUBLIC_CACHE_CONTROL,
      },
    });
  } catch (error: any) {
    logger.error('[api/landing/community-stats] Failed to build stats payload:', error);
    return NextResponse.json({ error: 'failed_to_fetch_stats' }, { status: 500 });
  }
}
