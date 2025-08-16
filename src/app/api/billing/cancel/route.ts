// src/app/api/billing/cancel/route.ts
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

/** Menor current_period_end entre os itens (compat “basil”) */
function getMinCurrentPeriodEnd(sub: Stripe.Subscription): Date | null {
  const secs = (sub.items?.data ?? [])
    .map((it) => (it as any)?.current_period_end)
    .filter((n: unknown): n is number => typeof n === 'number')
  if (!secs.length) return null
  return new Date(Math.min(...secs) * 1000)
}

/** Intervalo month/year do primeiro item */
function getInterval(sub: Stripe.Subscription): 'month' | 'year' | undefined {
  const raw = sub.items?.data?.[0]?.price?.recurring?.interval
  return raw === 'month' || raw === 'year' ? raw : undefined
}

/** “expira em”: cancel_at → itens.current_period_end → current_period_end (topo) */
function resolvePlanExpiresAt(sub: Stripe.Subscription): Date | null {
  const canceledAtSec = (sub as any).canceled_at as number | undefined
  if (canceledAtSec != null) return new Date(canceledAtSec * 1000)

  const cancelAtSec = (sub as any).cancel_at as number | undefined
  if (cancelAtSec != null) return new Date(cancelAtSec * 1000)

  const byItems = getMinCurrentPeriodEnd(sub)
  if (byItems) return byItems

  const cpe = (sub as any).current_period_end as number | undefined
  return typeof cpe === 'number' ? new Date(cpe * 1000) : null
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401, headers: cacheHeader })
    }

    await connectToDatabase()
    const user = await User.findById(session.user.id)
    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ ok: false, message: 'No active subscription' }, { status: 400, headers: cacheHeader })
    }

    // 1) Estado atual
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ['items.data.price'],
    })

    // 2) Ação: cancela na hora se estiver problemática, senão agenda no fim do ciclo
    let finalSubscription: Stripe.Subscription
    if (subscription.status === 'past_due' || subscription.status === 'incomplete') {
      finalSubscription = await stripe.subscriptions.cancel(user.stripeSubscriptionId)
    } else {
      finalSubscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      })
    }

    // 3) Datas/flags
    const cancelAt = resolvePlanExpiresAt(finalSubscription)
    const cancelAtPeriodEnd = Boolean((finalSubscription as any).cancel_at_period_end)

    // 4) Persistência
    const firstItem = finalSubscription.items?.data?.[0]
    const stripePriceId = firstItem?.price?.id ?? null
    const planInterval = getInterval(finalSubscription) // 'month' | 'year' | undefined
    const currency = firstItem?.price?.currency ? String(firstItem.price.currency).toUpperCase() : undefined

    // Se agendou para o fim do ciclo, gravamos "non_renewing" (UI/guardas dependem disso).
    // Caso tenha cancelado imediatamente, mantemos o status real do Stripe (ex: "canceled").
    let computedStatus = finalSubscription.status as
      | 'active' | 'trialing' | 'past_due' | 'incomplete' | 'incomplete_expired'
      | 'unpaid' | 'canceled' | 'paused' | 'past_due' // tipos do Stripe podem variar por versão
    if (
      cancelAtPeriodEnd &&
      (finalSubscription.status === 'active' || finalSubscription.status === 'trialing')
    ) {
      // status lógico de app para "vai encerrar no fim do ciclo"
      computedStatus = 'non_renewing' as any
    }

    user.stripeSubscriptionId = finalSubscription.id
    user.stripePriceId = stripePriceId
    user.planStatus = computedStatus as any
    if (planInterval !== undefined) user.planInterval = planInterval
    user.planExpiresAt = cancelAt ?? user.planExpiresAt ?? null
    ;(user as any).currentPeriodEnd = user.planExpiresAt
    user.cancelAtPeriodEnd = cancelAtPeriodEnd
    if (currency) (user as any).currency = currency

    await user.save()

    return NextResponse.json(
      {
        ok: true,
        status: finalSubscription.status,         // status cru do Stripe (para referência)
        effectiveStatus: user.planStatus,         // status efetivo (pode ser "non_renewing")
        cancelAt,
        cancelAtPeriodEnd,
      },
      { headers: cacheHeader }
    )
  } catch (err: any) {
    // StripeError nem sempre está disponível no path statico; tratamos genericamente
    const message = err?.message || 'Cancel failed'
    const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500
    console.error('[billing/cancel] error:', message)
    return NextResponse.json({ ok: false, message }, { status: statusCode, headers: cacheHeader })
  }
}
