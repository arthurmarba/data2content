import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import stripe from '@/app/lib/stripe';
import type Stripe from 'stripe';

export const runtime = 'nodejs';

function mapSubscription(
  sub: Stripe.Subscription,
  upcoming: Stripe.UpcomingInvoice | null
) {
  const paymentMethod = sub.default_payment_method as Stripe.PaymentMethod | null;
  return {
    planName: sub.items.data[0]?.plan?.nickname || 'Pro',
    currency:
      upcoming?.currency?.toUpperCase() ||
      sub.items.data[0]?.plan?.currency?.toUpperCase() ||
      'BRL',
    nextInvoiceAmountCents: upcoming?.amount_due || undefined,
    nextInvoiceDate: upcoming?.next_payment_attempt
      ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
      : undefined,
    currentPeriodEnd: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : undefined,
    status: sub.status as any,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    paymentMethodLast4: paymentMethod?.card?.last4 || null,
    defaultPaymentMethodBrand: paymentMethod?.card?.brand || null,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id).lean();
  if (!user?.stripeSubscriptionId) {
    return NextResponse.json(null);
  }

  const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
    expand: ['default_payment_method'],
  });
  let upcoming: Stripe.UpcomingInvoice | null = null;
  try {
    upcoming = await stripe.invoices.retrieveUpcoming({
      customer: user.stripeCustomerId!,
      subscription: sub.id,
    });
  } catch {
    upcoming = null;
  }

  return NextResponse.json(mapSubscription(sub, upcoming));
}
