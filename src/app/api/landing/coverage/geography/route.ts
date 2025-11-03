import { NextRequest, NextResponse } from 'next/server';

import { fetchCoverageRegions } from '@/app/lib/landing/coverageService';
import { logger } from '@/app/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(27, Number(url.searchParams.get('limit') ?? '6')),
  );

  try {
    const regions = await fetchCoverageRegions({ limit });
    return NextResponse.json({ items: regions });
  } catch (error) {
    logger.error('[landing][coverage][geography] Failed to fetch regions', {
      error,
    });
    return NextResponse.json(
      { error: 'Failed to fetch coverage regions' },
      { status: 500 },
    );
  }
}
