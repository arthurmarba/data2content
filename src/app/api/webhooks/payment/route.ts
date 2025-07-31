import { NextRequest, NextResponse } from 'next/server';
import AgencyModel from '@/app/models/Agency';
import { logger } from '@/app/lib/logger';
import mercadopago from '@/app/lib/mercadopago';

export const runtime = 'nodejs';
const SERVICE_TAG = '[api/webhooks/payment]';

interface PaymentEvent {
  type: string;
  action?: string;
  data?: {
    id?: string;
    subscriptionId?: string;
  };
}

export async function POST(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[POST]`;
  try {
    const body = (await req.json()) as PaymentEvent;
    logger.info(`${TAG} event received: ${body.type}`);

    if (body.type === 'preapproval') {
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
    } else {
      const subscriptionId = body.data?.subscriptionId;
      if (!subscriptionId) {
        logger.warn(`${TAG} missing subscriptionId`);
        return NextResponse.json({ received: true });
      }

      const agency = await AgencyModel.findOne({ paymentGatewaySubscriptionId: subscriptionId });
      if (!agency) {
        logger.warn(`${TAG} agency not found for subscription ${subscriptionId}`);
        return NextResponse.json({ received: true });
      }

      if (body.type === 'checkout.session.completed' || body.type === 'subscription.active') {
        agency.planStatus = 'active';
        agency.paymentGatewaySubscriptionId = subscriptionId;
        await agency.save();
        logger.info(`${TAG} agency ${agency._id} activated`);
      } else if (body.type === 'invoice.payment_failed') {
        agency.planStatus = 'inactive';
        await agency.save();
        logger.info(`${TAG} agency ${agency._id} marked inactive`);
      } else if (body.type === 'customer.subscription.deleted') {
        agency.planStatus = 'canceled';
        await agency.save();
        logger.info(`${TAG} agency ${agency._id} canceled`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    logger.error(`${TAG} unexpected error`, err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
