import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/getAdminSession';
import { getPlanGuardMetrics } from '@/app/lib/planGuard';
import { logger } from '@/app/lib/logger';
export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    logger.warn('[planGuardMetrics] unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(getPlanGuardMetrics(), { status: 200 });
}
