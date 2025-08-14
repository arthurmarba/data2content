import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import Stripe from 'stripe';
import { stripe } from '@/app/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cacheHeader = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: cacheHeader });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id).lean();
    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { message: 'No Stripe customer' },
        { status: 400, headers: cacheHeader }
      );
    }

    const returnUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000/dashboard/billing';
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portal.url }, { headers: cacheHeader });
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { message: err.message },
        { status: err.statusCode || 500, headers: cacheHeader }
      );
    }
    return NextResponse.json(
      { message: 'Portal error' },
      { status: 400, headers: cacheHeader }
    );
  }
}
