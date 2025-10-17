import { NextRequest, NextResponse } from 'next/server';

import { fetchCommunityLandingStats } from '@/app/lib/landing/communityStatsService';
import { logger } from '@/app/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true';
    const payload = await fetchCommunityLandingStats({ forceRefresh });

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    logger.error('[api/landing/community-stats] Failed to build stats payload:', error);
    return NextResponse.json({ error: 'failed_to_fetch_stats' }, { status: 500 });
  }
}
