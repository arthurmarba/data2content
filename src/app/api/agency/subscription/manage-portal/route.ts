import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
import { getAgencySession } from '@/lib/getAgencySession';
import AgencyModel from '@/app/models/Agency';

export const runtime = 'nodejs';
const SERVICE_TAG = '[api/agency/subscription/manage-portal]';

export async function POST(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[POST]`;
  try {
    const session = await getAgencySession(req);
    if (!session?.user?.agencyId) {
      logger.warn(`${TAG} unauthorized attempt`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agency = await AgencyModel.findById(session.user.agencyId).lean();
    if (!agency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    // TODO: Integrate with payment gateway customer portal using agency.paymentGatewaySubscriptionId
    const portalUrl = `https://pagamento.exemplo.com/manage/${agency.paymentGatewaySubscriptionId || ''}`;

    logger.info(`${TAG} portal session for agency ${agency._id}`);
    return NextResponse.json({ portalUrl });
  } catch (err: any) {
    logger.error(`${TAG} unexpected error`, err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
