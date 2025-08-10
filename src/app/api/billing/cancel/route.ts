import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import stripe from '@/app/lib/stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getServerSession({ req, ...authOptions });
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email });
  if (!user || !user.stripeSubscriptionId) {
    return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 });
  }

  await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true });
  user.planStatus = 'non_renewing';
  await user.save();

  return NextResponse.json({ ok: true });
}
