import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import Stripe from 'stripe';
import { stripe } from '@/app/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cacheHeader = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: cacheHeader });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id).lean();
    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404, headers: cacheHeader });
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    return NextResponse.json(
      { ok: true, cancelAtPeriodEnd: false },
      { headers: cacheHeader }
    );
  } catch (err: unknown) {
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode || 500, headers: cacheHeader }
      );
    }
    return NextResponse.json(
      { error: 'Não foi possível reativar a assinatura.' },
      { status: 500, headers: cacheHeader }
    );
  }
}
