import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
import AgencyModel from '@/app/models/Agency';
import mercadopago from '@/app/lib/mercadopago';

export const runtime = 'nodejs';
const SERVICE_TAG = '[api/agency/subscription/webhook]';

interface PreapprovalEvent {
  type?: string;
  data?: {
    id?: string;
  };
}

export async function POST(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[POST]`;
  try {
    const body = (await req.json()) as PreapprovalEvent;
    logger.info(`${TAG} event received: ${body.type}`);

    if (body.type !== 'preapproval') {
      return NextResponse.json({ received: true });
    }

    const preapprovalId = body.data?.id;
    if (!preapprovalId) {
      logger.warn(`${TAG} missing preapproval id`);
      return NextResponse.json({ received: true });
    }

    const { body: preapproval } = await mercadopago.preapproval.get(preapprovalId);
    const agencyId = preapproval.external_reference;
    if (!agencyId) {
      logger.warn(`${TAG} preapproval ${preapprovalId} without external reference`);
      return NextResponse.json({ received: true });
    }

    const agency = await AgencyModel.findById(agencyId);
    if (!agency) {
      logger.warn(`${TAG} agency not found for preapproval ${preapprovalId}`);
      return NextResponse.json({ received: true });
    }

    agency.paymentGatewaySubscriptionId = preapprovalId;
    if (preapproval.status === 'authorized') {
      agency.planStatus = 'active';
    } else if (preapproval.status === 'cancelled') {
      agency.planStatus = 'canceled';
    } else if (preapproval.status === 'paused' || preapproval.status === 'suspended') {
      agency.planStatus = 'inactive';
    }
    await agency.save();
    logger.info(`${TAG} agency ${agency._id} updated to ${agency.planStatus}`);

    return NextResponse.json({ received: true });
  } catch (err: any) {
    logger.error(`${TAG} unexpected error`, err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
