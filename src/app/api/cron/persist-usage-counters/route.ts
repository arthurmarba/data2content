import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { logger } from '@/app/lib/logger';
import persistUsageCounters from '@/cron/persistUsageCounters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

let receiver: Receiver | null = null;
let initError: string | null = null;

if (!currentSigningKey || !nextSigningKey) {
  initError = 'QStash signing keys not configured.';
  logger.error(`[Cron PersistUsageCounters Init] ${initError}`);
} else {
  receiver = new Receiver({ currentSigningKey, nextSigningKey });
}

export async function POST(request: NextRequest) {
  const TAG = '[Cron PersistUsageCounters]';

  if (!receiver) {
    logger.error(`${TAG} Receiver init error: ${initError}`);
    return NextResponse.json({ error: initError }, { status: 500 });
  }

  try {
    const signature = request.headers.get('upstash-signature');
    if (!signature) {
      logger.error(`${TAG} Missing signature header`);
      return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }
    const bodyText = await request.text();
    const isValid = await receiver.verify({ signature, body: bodyText });
    if (!isValid) {
      logger.error(`${TAG} Invalid signature`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    await persistUsageCounters();
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error(`${TAG} Unexpected error`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
