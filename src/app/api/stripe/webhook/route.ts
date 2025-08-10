import { NextRequest, NextResponse } from 'next/server';
import stripe from '@/app/lib/stripe';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature') || '';
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  await connectToDatabase();

  switch (event.type) {
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as any;
      const user = await User.findOne({ stripeCustomerId: invoice.customer });
      if (user && user.lastProcessedEventId !== event.id) {
        user.lastProcessedEventId = event.id;
        user.planStatus = 'active';
        const interval = invoice.lines.data[0].price?.recurring?.interval;
        user.planType = interval === 'year' ? 'annual' : 'monthly';
        user.planExpiresAt = new Date(invoice.lines.data[0].period.end * 1000);
        if (invoice.billing_reason === 'subscription_create' && user.affiliateUsed) {
          const commission = (invoice.total / 100) * 0.1;
          user.affiliateBalance = (user.affiliateBalance || 0) + commission;
          user.commissionLog = user.commissionLog || [];
          user.commissionLog.push({
            date: new Date(),
            amount: commission,
            description: 'Affiliate commission',
            sourcePaymentId: invoice.id,
            referredUserId: user._id,
          });
          user.affiliateUsed = undefined;
        }
        await user.save();
      }
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as any;
      const user = await User.findOne({ stripeCustomerId: invoice.customer });
      if (user && user.lastProcessedEventId !== event.id) {
        user.lastProcessedEventId = event.id;
        user.lastPaymentError = {
          at: new Date(),
          status: 'failed',
          statusDetail: invoice.last_payment_error?.message || 'unknown',
        } as any;
        await user.save();
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as any;
      const user = await User.findOne({ stripeCustomerId: sub.customer });
      if (user && user.lastProcessedEventId !== event.id) {
        user.lastProcessedEventId = event.id;
        user.planStatus = 'inactive';
        user.planExpiresAt = null;
        user.stripeSubscriptionId = null;
        await user.save();
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
