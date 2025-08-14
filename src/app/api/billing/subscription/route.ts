import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cacheHeader = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401, headers: cacheHeader }
      );
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id).lean();
    if (!user?.stripeSubscriptionId) {
      return new NextResponse(null, { status: 204, headers: cacheHeader });
    }

    const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ['default_payment_method', 'latest_invoice.payment_intent'],
    });

    const item = sub.items.data[0];
    const price = item?.price as Stripe.Price | undefined;
    const pm =
      typeof sub.default_payment_method === 'object'
        ? (sub.default_payment_method as Stripe.PaymentMethod)
        : null;

    const body = {
      planName: price?.nickname || 'Plano',
      currency: (sub.currency || 'brl').toUpperCase(),
      nextInvoiceAmountCents: price?.unit_amount || 0,
      nextInvoiceDate: new Date(sub.current_period_end * 1000).toISOString(),
      currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
      status: sub.status,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      paymentMethodLast4: pm?.card?.last4 ?? null,
      defaultPaymentMethodBrand: (pm?.card?.brand as string | undefined) || null,
      trialEnd: sub.trial_end
        ? new Date(sub.trial_end * 1000).toISOString()
        : null,
    };

    return NextResponse.json(body, { headers: cacheHeader });
  } catch (err: unknown) {
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode || 500, headers: cacheHeader }
      );
    }
    return NextResponse.json(
      { error: 'Não foi possível carregar a assinatura.' },
      { status: 500, headers: cacheHeader }
    );
  }
}

