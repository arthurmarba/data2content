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

/** Rótulo para a UI (sem non_renewing; isso agora é um flag separado) */
function toUiPlanStatus(s: string): UiPlanStatus {
  switch (s) {
    case 'trialing': return 'trial'
    case 'incomplete': return 'pending'
    case 'incomplete_expired': return 'expired'
    case 'past_due': return 'active'      // UI trata erro via lastPaymentError, se precisar
    case 'unpaid': return 'inactive'
    case 'canceled': return 'canceled'
    case 'active': return 'active'
    default: return 'inactive'
  }
}

/** Menor current_period_end entre os itens (compat) */
function getMinCurrentPeriodEnd(sub: Stripe.Subscription): Date | null {
  const secs = (sub.items?.data ?? [])
    .map((it) => (it as any)?.current_period_end)
    .filter((n: unknown): n is number => typeof n === 'number')
  if (!secs.length) return null
  return new Date(Math.min(...secs) * 1000)
}

/** Intervalo month/year do primeiro item (compat price/plan) */
function getInterval(sub: Stripe.Subscription): 'month' | 'year' | undefined {
  const raw =
    sub.items?.data?.[0]?.price?.recurring?.interval ??
    (sub.items?.data?.[0] as any)?.plan?.interval
  return raw === 'month' || raw === 'year' ? raw : undefined
}

/** “expira em”: cancel_at → itens.current_period_end → current_period_end (topo) */
function resolvePlanExpiresAt(sub: Stripe.Subscription): Date | null {
  const cancelAtSec = typeof (sub as any).cancel_at === 'number' ? (sub as any).cancel_at : null
  if (cancelAtSec != null) return new Date(cancelAtSec * 1000)

  const byItems = getMinCurrentPeriodEnd(sub)
  if (byItems) return byItems

  const cpe = typeof (sub as any).current_period_end === 'number'
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
    const current = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ['items.data.price'],
    }) as Stripe.Subscription

    const currentStatus = (current as any).status as string | undefined
    // Casos não reativáveis
    if (currentStatus === 'canceled' || currentStatus === 'incomplete_expired') {
      return NextResponse.json(
        { ok: false, message: 'Subscription is not reactivatable (canceled or expired).' },
        { status: 400, headers: cacheHeader }
      )
    }

    // 2) Se estava marcado para cancelar no fim do ciclo, retira o cancelamento
    const needsFlip = Boolean((current as any).cancel_at_period_end)
    const updated = needsFlip
      ? await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: false }) as Stripe.Subscription
      : current

    // 3) Persistência no DB (status REAL do Stripe)
    const firstItem = updated.items?.data?.[0]
    const stripePriceId = firstItem?.price?.id ?? null
    const planInterval = getInterval(updated)
    const planExpiresAt = resolvePlanExpiresAt(updated)
    const cancelAtPeriodEnd = Boolean((updated as any).cancel_at_period_end)

    user.stripeSubscriptionId = updated.id
    user.stripePriceId = stripePriceId
    user.planStatus = updated.status as any  // active/trialing/past_due/...
    if (planInterval !== undefined) user.planInterval = planInterval
    user.planExpiresAt = planExpiresAt
    ;(user as any).currentPeriodEnd = planExpiresAt
    user.cancelAtPeriodEnd = cancelAtPeriodEnd
    await user.save()

    // 4) Resposta para UI (sem non_renewing; usar flag cancelAtPeriodEnd)
    return NextResponse.json(
      {
        ok: true,
        shouldUpdateSession: true,
        status: toUiPlanStatus(updated.status),
        cancelAtPeriodEnd,
        planInterval,
        planExpiresAtISO: planExpiresAt ? planExpiresAt.toISOString() : null,
      },
      { headers: cacheHeader }
    )
  } catch (err: any) {
    // StripeError pode não estar tipado aqui em runtime/edge; tratar genericamente
    const message = err?.message || 'Reactivate failed'
    const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 400
    console.error('[billing/reactivate] error:', err)
    return NextResponse.json({ ok: false, message }, { status: statusCode, headers: cacheHeader })
  }
}
