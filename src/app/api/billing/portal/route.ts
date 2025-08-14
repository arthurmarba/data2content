import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-07-30.basil' })

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cacheHeader = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: cacheHeader });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id).lean();
    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Cliente Stripe não encontrado' },
        { status: 404, headers: cacheHeader }
      );
    }

    let returnUrl: string | undefined;
    try {
      const body = await req.json();
      returnUrl = body?.returnUrl;
    } catch {
      returnUrl = undefined;
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl || process.env.NEXTAUTH_URL || 'https://example.com',
    });

    return NextResponse.json({ url: portal.url }, { headers: cacheHeader });
  } catch (err: unknown) {
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode || 500, headers: cacheHeader }
      );
    }
    return NextResponse.json(
      { error: 'Não foi possível criar sessão do portal.' },
      { status: 500, headers: cacheHeader }
    );
  }
}
