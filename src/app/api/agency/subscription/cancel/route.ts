import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
import { getAgencySession } from '@/lib/getAgencySession';
import AgencyModel from '@/app/models/Agency';
import mercadopago from '@/app/lib/mercadopago';

export const runtime = 'nodejs';
const SERVICE_TAG = '[api/agency/subscription/cancel]';

export async function POST(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[POST]`;
  try {
    const session = await getAgencySession(req);
    if (!session?.user?.agencyId) {
      logger.warn(`${TAG} unauthorized attempt`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agency = await AgencyModel.findById(session.user.agencyId);
    if (!agency || !agency.paymentGatewaySubscriptionId) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    await mercadopago.preapproval.update(agency.paymentGatewaySubscriptionId, { status: 'cancelled' });
    agency.planStatus = 'canceled';
    await agency.save();

    logger.info(`${TAG} subscription cancelled for agency ${agency._id}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error(`${TAG} unexpected error`, err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
