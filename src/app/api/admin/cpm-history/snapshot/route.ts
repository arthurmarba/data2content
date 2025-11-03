import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

import { connectToDatabase } from '@/app/lib/mongoose';
import { getDynamicCpmBySegment } from '@/app/lib/ai/cpmDynamicService';
import CpmHistory from '@/app/models/CpmHistory';
import { logger } from '@/app/lib/logger';
import { authorizeAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await authorizeAdminRequest(req);
  if (!auth.authorized) {
    logger.warn('[admin][cpm-history][snapshot] unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const map = await getDynamicCpmBySegment({ forceRefresh: true });
  const documents = Object.entries(map).map(([segment, entry]) => ({
    segment,
    cpm: entry.value,
    source: entry.source,
  }));

  if (documents.length === 0) {
    return NextResponse.json({ created: 0 }, { status: 200 });
  }

  await CpmHistory.insertMany(documents);

  const logMessage = `[CPM_HISTORY_SNAPSHOT] count=${documents.length}`;
  logger.info(logMessage);
  Sentry.captureMessage(logMessage, 'info');

  return NextResponse.json({ created: documents.length }, { status: 201 });
}
