import { NextRequest, NextResponse } from 'next/server';
import matureAffiliateCommissions from '@/cron/matureAffiliateCommissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cron job endpoint to mature pending affiliate commissions.
 * Requires `x-cron-secret` header matching `CRON_SECRET` env var.
 */
export async function POST(req: NextRequest) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return new NextResponse('forbidden', { status: 403 });
  }

  const result = await matureAffiliateCommissions();
  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
