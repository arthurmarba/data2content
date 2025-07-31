import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { getAgencySession } from '@/lib/getAgencySession';
import AgencyModel from '@/app/models/Agency';
import mercadopago from '@/app/lib/mercadopago';
import {
  AGENCY_ANNUAL_MONTHLY_PRICE,
  AGENCY_MONTHLY_PRICE,
} from '@/config/pricing.config';

export const runtime = 'nodejs';
const SERVICE_TAG = '[api/agency/subscription/create-checkout]';

const bodySchema = z.object({
  planId: z.enum(['basic', 'annual']).default('basic'),
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

    const price =
      validation.data.planId === 'annual'
        ? AGENCY_ANNUAL_MONTHLY_PRICE
        : AGENCY_MONTHLY_PRICE;

    const preapprovalData = {
      reason: 'Plano Agência Data2Content',
      back_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''}/agency/subscription`,
      external_reference: agency._id.toString(),
      payer_email: session.user.email || agency.contactEmail || undefined,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: price,
        currency_id: 'BRL',
      },
    } as any;

    const response = await mercadopago.preapproval.create(preapprovalData);

    if (response.body.init_point) {
      agency.planStatus = 'pending';
      agency.paymentGatewaySubscriptionId = response.body.id;
      await agency.save();

      logger.info(`${TAG} checkout session created for agency ${agency._id}`);
      return NextResponse.json({ initPoint: response.body.init_point });
    } else {
      throw new Error('Mercado Pago não retornou um link de pagamento.');
    }
  } catch (err: any) {
    logger.error(`${TAG} Erro da API do Mercado Pago:`, err?.cause ?? err);
    const errorMessage = err?.cause?.message || 'Falha ao criar assinatura no Mercado Pago.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
