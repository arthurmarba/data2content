// src/app/api/billing/reactivate/route.ts
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

type UiPlanStatus =
  | 'pending'
  | 'active'
  | 'canceled'
  | 'inactive'
  | 'trial'
  | 'expired'
  | 'non_renewing'

/** Rótulo para a UI */
function toUiPlanStatus(s: string): UiPlanStatus {
  switch (s) {
    case 'trialing': return 'trial'
    case 'incomplete': return 'pending'
    case 'incomplete_expired': return 'expired'
    case 'past_due': return 'active' // UI trata erro via lastPaymentError
    case 'unpaid': return 'inactive'
    case 'canceled': return 'canceled'
    case 'non_renewing': return 'non_renewing'
    case 'active': return 'active'
    default: return 'inactive'
  }
}

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
  const raw =
    sub.items?.data?.[0]?.price?.recurring?.interval ??
    (sub.items?.data?.[0] as any)?.plan?.interval
  return raw === 'month' || raw === 'year' ? raw : undefined
}

/** “expira em”: cancel_at → itens.current_period_end → current_period_end (topo) */
function resolvePlanExpiresAt(sub: Stripe.Subscription): Date | null {
  const cancelAtSec =
    typeof (sub as any).cancel_at === 'number' ? (sub as any).cancel_at : null
  if (cancelAtSec != null) return new Date(cancelAtSec * 1000)

  const byItems = getMinCurrentPeriodEnd(sub)
  if (byItems) return byItems

  const cpe =
    typeof (sub as any).current_period_end === 'number'
      ? (sub as any).current_period_end
      : null
  return cpe != null ? new Date(cpe * 1000) : null
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
      return NextResponse.json({ ok: false, message: 'No subscription' }, { status: 400, headers: cacheHeader })
    }

    // 1) Busca assinatura atual (com price expandido)
    const current = (await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ['items.data.price'],
    })) as Stripe.Subscription

    const currentStatus = (current as any).status as string | undefined
    // Casos não reativáveis
    if (currentStatus === 'canceled' || currentStatus === 'incomplete_expired') {
      return NextResponse.json(
        { ok: false, message: 'Subscription is not reactivatable (canceled or expired).' },
        { status: 400, headers: cacheHeader }
      )
    }

    // 2) Se marcado para cancelar no fim do ciclo, retira o cancelamento
    const needsFlip = Boolean((current as any).cancel_at_period_end)
    const updated = needsFlip
      ? ((await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: false,
        })) as Stripe.Subscription)
      : current

    // 3) Persistência no DB (status REAL do Stripe)
    const firstItem = updated.items?.data?.[0]
    const stripePriceId = firstItem?.price?.id ?? null
    const planInterval = getInterval(updated)
    const planExpiresAt = resolvePlanExpiresAt(updated)
    const cancelAtPeriodEnd = Boolean((updated as any).cancel_at_period_end)

    user.stripeSubscriptionId = updated.id
    user.stripePriceId = stripePriceId
    user.planStatus = updated.status as any // enum do schema (active/trialing/past_due/...)
    if (planInterval !== undefined) user.planInterval = planInterval
    user.planExpiresAt = planExpiresAt
    ;(user as any).currentPeriodEnd = planExpiresAt
    user.cancelAtPeriodEnd = cancelAtPeriodEnd
    await user.save()

    // 4) Resposta para UI
    const uiStatus = toUiPlanStatus(cancelAtPeriodEnd ? 'non_renewing' : updated.status)

    return NextResponse.json(
      {
        ok: true,
        status: uiStatus,
        cancelAtPeriodEnd,
        planInterval,
        planExpiresAt,
      },
      { headers: cacheHeader }
    )
  } catch (err: any) {
    if (err instanceof (Stripe as any).errors?.StripeError) {
      const se = err as Stripe.errors.StripeError
      return NextResponse.json(
        { ok: false, message: se.message },
        { status: se.statusCode || 500, headers: cacheHeader }
      )
    }
    console.error('[billing/reactivate] error:', err)
    return NextResponse.json({ ok: false, message: 'Reactivate failed' }, { status: 400, headers: cacheHeader })
  }
}
