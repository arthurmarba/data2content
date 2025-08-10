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

  const body = (await req.json()) as { plan: 'monthly' | 'annual'; currency?: string; affiliateCode?: string };
  const { plan, currency = 'BRL', affiliateCode } = body;

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email });
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  if (!user.stripeCustomerId) {
    const customer = await stripe.customers.create({ email: user.email });
    user.stripeCustomerId = customer.id;
  }

  const priceId = getPriceId(plan, currency);
  if (!priceId) {
    return NextResponse.json({ error: 'Plano indisponível' }, { status: 400 });
  }

  let subscription;
  if (user.stripeSubscriptionId) {
    subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      proration_behavior: 'create_prorations',
      expand: ['latest_invoice.payment_intent'],
    });
  } else {
    subscription = await stripe.subscriptions.create({
      customer: user.stripeCustomerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
    user.stripeSubscriptionId = subscription.id;
  }

  if (affiliateCode) {
    const aff = await User.findOne({ affiliateCode });
    if (aff && !aff._id.equals(user._id)) {
      user.affiliateUsed = affiliateCode;
    }
  }

  user.planType = plan;
  user.currency = currency;
  user.planStatus = 'pending';
  await user.save();

  const paymentIntent = (subscription.latest_invoice as any)?.payment_intent;
  return NextResponse.json({ clientSecret: paymentIntent?.client_secret || null });
}
