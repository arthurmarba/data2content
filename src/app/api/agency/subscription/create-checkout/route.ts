import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { getAgencySession } from '@/lib/getAgencySession';

export const runtime = 'nodejs';
const SERVICE_TAG = '[api/agency/subscription/create-checkout]';

const bodySchema = z.object({
  planId: z.string(),
});

export async function POST(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[POST]`;
  try {
    const session = await getAgencySession(req);
    if (!session || !session.user) {
      logger.warn(`${TAG} unauthorized attempt`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    // TODO: Integrate with payment gateway (Stripe/Mercado Pago)
    const checkoutUrl = `https://pagamento.exemplo.com/checkout?plan=${validation.data.planId}&agency=${session.user.agencyId}`;

    logger.info(`${TAG} checkout session created for agency ${session.user.agencyId}`);
    return NextResponse.json({ checkoutUrl });
  } catch (err: any) {
    logger.error(`${TAG} unexpected error`, err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
