import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import stripe from '@/app/lib/stripe';

export const runtime = 'nodejs';

function getPriceId(plan: 'monthly' | 'annual', currency: string): string | null {
  const key = `STRIPE_PRICE_${plan === 'monthly' ? 'MONTHLY' : 'ANNUAL'}_${currency}`.toUpperCase();
  return process.env[key] || null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession({ req, ...authOptions });
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = (await req.json()) as { to: 'annual' | 'monthly'; when?: 'now' | 'period_end' };
  const { to, when = 'now' } = body;

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email });
  if (!user || !user.stripeSubscriptionId) {
    return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 });
  }

  const priceId = getPriceId(to, user.currency || 'BRL');
  if (!priceId) {
    return NextResponse.json({ error: 'Plano indisponível' }, { status: 400 });
  }

  const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

  const params: any = {
    items: [{ id: subscription.items.data[0].id, price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  };

  if (when === 'now') {
    params.proration_behavior = 'create_prorations';
    params.billing_cycle_anchor = 'now';
  } else {
    params.proration_behavior = 'none';
  }

  const updated = await stripe.subscriptions.update(user.stripeSubscriptionId, params);

  user.planType = to;
  user.planStatus = 'pending';
  await user.save();

  const paymentIntent = (updated.latest_invoice as any)?.payment_intent;
  return NextResponse.json({ clientSecret: paymentIntent?.client_secret || null });
}
