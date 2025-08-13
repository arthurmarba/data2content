import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
import matureAffiliateCommissions from '@/cron/matureAffiliateCommissions';
import {
  MATURATION_BATCH_USERS,
  MATURATION_MAX_ENTRIES_PER_USER,
  MATURATION_CRON_ENABLED,
} from '@/config/affiliates';
import { checkRateLimit } from '@/utils/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const TAG = '[api internal affiliate mature]';
  const secret = req.headers.get('x-job-secret');
  const expected = process.env.AFFILIATE_JOB_SECRET;
  if (!secret || secret !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { allowed } = await checkRateLimit('affiliate_mature', 10, 60);
  if (!allowed) {
    return NextResponse.json({ error: 'rate limit exceeded' }, { status: 429 });
  }

  if (!MATURATION_CRON_ENABLED) {
    logger.warn(`${TAG} disabled`);
    return NextResponse.json({ ok: false, disabled: true });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const dryRun = body.dryRun ?? false;
  const maxUsers = body.maxUsers ?? MATURATION_BATCH_USERS;
  const maxEntriesPerUser =
    body.maxEntriesPerUser ?? MATURATION_MAX_ENTRIES_PER_USER;

  const result = await matureAffiliateCommissions({
    dryRun,
    maxUsers,
    maxEntriesPerUser,
  });

  return NextResponse.json(result);
}
