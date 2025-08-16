import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { connectToDatabase } from '@/app/lib/mongoose'
import User from '@/app/models/User'
import Stripe from 'stripe'
import { stripe } from '@/app/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const cacheHeader = { 'Cache-Control': 'no-store, max-age=0' } as const

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: cacheHeader })
    }

    await connectToDatabase()
    const user = await User.findById(session.user.id)
    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ message: 'No active subscription' }, { status: 400, headers: cacheHeader })
    }

    // 1. First, we retrieve the subscription to check its current status
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

    let finalSubscription: Stripe.Subscription;

    // 2. We decide the action based on the status
    if (subscription.status === 'past_due' || subscription.status === 'incomplete') {
      // If the subscription is overdue or incomplete, we cancel it immediately.
      finalSubscription = await stripe.subscriptions.cancel(user.stripeSubscriptionId);
    } else {
      // If it's active or in another state, we just schedule the cancellation.
      finalSubscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    // CORRECTION: Use the correct, type-safe properties for the cancellation date
    const cancelAtUnix = finalSubscription.canceled_at ?? finalSubscription.cancel_at;
    const cancelAt = cancelAtUnix ? new Date(cancelAtUnix * 1000) : null;

    return NextResponse.json(
      {
        ok: true,
        cancelAt,
        status: finalSubscription.status,
      },
      { headers: cacheHeader }
    )
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { ok: false, message: err.message },
        { status: err.statusCode || 500, headers: cacheHeader }
      )
    }
    console.error("[billing/cancel] error:", err);
    return NextResponse.json(
      { ok: false, message: 'Cancel failed' },
      { status: 400, headers: cacheHeader }
    )
  }
}