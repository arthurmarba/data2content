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

    const sub = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    const cancelAt =
      (sub as any).cancel_at
        ? new Date((sub as any).cancel_at * 1000)
        : sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null

    return NextResponse.json(
      {
        ok: true,
        cancelAt,
        status: sub.cancel_at_period_end ? 'canceled' : sub.status,
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
    return NextResponse.json(
      { ok: false, message: 'Cancel failed' },
      { status: 400, headers: cacheHeader }
    )
  }
}
