import { NextRequest, NextResponse } from 'next/server';

import { fetchCoverageSegments } from '@/app/lib/landing/coverageService';
import { logger } from '@/app/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(20, Number(url.searchParams.get('limit') ?? '6')),
  );

  try {
    const segments = await fetchCoverageSegments({ limit });
    return NextResponse.json({ items: segments });
  } catch (error) {
    logger.error('[landing][coverage][segments] Failed to fetch segments', {
      error,
    });
    return NextResponse.json(
      { error: 'Failed to fetch coverage segments' },
      { status: 500 },
    );
  }
}
