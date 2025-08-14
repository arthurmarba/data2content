import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import stripe from '@/app/lib/stripe';
import type Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email });
  if (!user?.stripeSubscriptionId) {
    return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 });
  }

  const sub = await stripe.subscriptions.update(user.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        planStatus: sub.status,
        planInterval:
          sub.items.data[0]?.price.recurring?.interval ?? user.planInterval,
        planExpiresAt: sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : user.planExpiresAt,
      },
    }
  );

  let upcoming: Stripe.UpcomingInvoice | null = null;
  try {
    upcoming = await stripe.invoices.retrieveUpcoming({
      customer: user.stripeCustomerId!,
      subscription: sub.id,
    });
  } catch {
    upcoming = null;
  }
  const paymentMethod = sub.default_payment_method as Stripe.PaymentMethod | null;
  const subscription = {
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

  return NextResponse.json({ ok: true, subscription });
}
