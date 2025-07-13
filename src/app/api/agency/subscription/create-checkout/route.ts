import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { getAgencySession } from '@/lib/getAgencySession';
import AgencyModel from '@/app/models/Agency';
import mercadopago from '@/app/lib/mercadopago';

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

    const agency = await AgencyModel.findById(session.user.agencyId);
    if (!agency) {
      logger.warn(`${TAG} agency not found ${session.user.agencyId}`);
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    const preapprovalData = {
      reason: 'Plano Agência Data2Content',
      back_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''}/agency/subscription`,
      external_reference: agency._id.toString(),
      payer_email: session.user.email || agency.contactEmail || undefined,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: Number(process.env.AGENCY_MONTHLY_PRICE || 99),
        currency_id: 'BRL',
      },
    } as any;

    const response = await mercadopago.preapproval.create(preapprovalData);
    const initPoint = response.body.init_point;

    agency.planStatus = 'pending';
    await agency.save();

    logger.info(`${TAG} checkout session created for agency ${agency._id}`);
    return NextResponse.json({ initPoint });
  } catch (err: any) {
    logger.error(`${TAG} unexpected error`, err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
