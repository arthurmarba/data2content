import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import { stripe } from '@/app/lib/stripe';

export const runtime = 'nodejs';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  user.paymentInfo ||= {};
  let accountId = user.paymentInfo.stripeAccountId as string | undefined;

  if (!accountId) {
    const acct = await stripe.accounts.create({
      type: 'express',
      email: user.email ?? undefined,
      capabilities: { transfers: { requested: true } },
      metadata: { userId: String(user._id) },
    });
    accountId = acct.id;
    user.paymentInfo.stripeAccountId = accountId;
    await user.save();
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';
  const returnUrl = `${origin}/dashboard?connect=done`;
  const refreshUrl = `${origin}/dashboard?connect=refresh`;

  const link = await stripe.accountLinks.create({
    account: accountId!,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: link.url });
}
