import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import stripe from '@/app/lib/stripe';

export const runtime = 'nodejs';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email });
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: 'Cliente Stripe não encontrado' }, { status: 404 });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: process.env.NEXTAUTH_URL || 'https://example.com',
  });

  return NextResponse.json({ url: portal.url });
}
