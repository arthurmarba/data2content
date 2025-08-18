import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { connectToDatabase } from '@/app/lib/mongoose'
import User from '@/app/models/User'
import { stripe } from '@/app/lib/stripe'
import Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const cacheHeader = { 'Cache-Control': 'no-store, max-age=0' } as const

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401, headers: cacheHeader }
      )
    }

    await connectToDatabase()
    const user = await User.findById(session.user.id)
    if (!user?.stripeSubscriptionId) {
      // Sem assinatura → 204 para o front renderizar Empty
      return new NextResponse(null, { status: 204, headers: cacheHeader })
    }

    const res = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      // GARANTIR que price venha completo no Basil
      expand: ['items.data.price', 'default_payment_method', 'latest_invoice.payment_intent'],
    })

    const sub = res as Stripe.Subscription

    if (sub.status === 'incomplete' || sub.status === 'incomplete_expired') {
      try {
        await stripe.subscriptions.cancel(sub.id)
      } catch {}
      user.stripeSubscriptionId = undefined
      user.planStatus = 'inactive'
      user.stripePriceId = null
      user.planInterval = undefined
      user.planExpiresAt = null
      user.cancelAtPeriodEnd = false
      await user.save()
      return new NextResponse(null, { status: 204, headers: cacheHeader })
    }

    const items = sub.items?.data ?? []
    const firstItem = items[0]
    const price = (firstItem?.price as Stripe.Price | undefined) ?? undefined

    // currency: preferir a do price; cair para a da sub; fallback 'BRL'
    const currency = (price?.currency ?? (sub as any).currency ?? 'brl')
      .toString()
      .toUpperCase()

    // Fim do período:
    // 1) se houver cancel_at, usar como “expira em” (mais fiel ao UI de cancelamento)
    // 2) senão, pegar o menor current_period_end entre os itens
    const cancelAtSec: number | null =
      typeof (sub as any).cancel_at === 'number' ? (sub as any).cancel_at : null

    const periodEnds = items
      .map((it) => (it as any)?.current_period_end)
      .filter((n): n is number => typeof n === 'number')

    const minItemEndSec = periodEnds.length ? Math.min(...periodEnds) : null
    const endSec = cancelAtSec ?? minItemEndSec
    const periodEndIso = endSec ? new Date(endSec * 1000).toISOString() : null

    const cancelAtPeriodEnd = Boolean((sub as any).cancel_at_period_end)

    // default_payment_method pode ser string|obj|null; só usamos se vier expandido (obj)
    const pm =
      typeof sub.default_payment_method === 'object'
        ? (sub.default_payment_method as Stripe.PaymentMethod)
        : null

    const trialEndSec: number | null =
      typeof (sub as any).trial_end === 'number' ? (sub as any).trial_end : null
    const trialEndIso = trialEndSec ? new Date(trialEndSec * 1000).toISOString() : null

    const body = {
      planName: price?.nickname || 'Plano',
      currency,
      nextInvoiceAmountCents: price?.unit_amount ?? 0,
      nextInvoiceDate: periodEndIso, // compat: antes usava sub.current_period_end
      currentPeriodEnd: periodEndIso, // idem
      status: sub.status,
      cancelAtPeriodEnd,
      paymentMethodLast4: pm?.card?.last4 ?? null,
      defaultPaymentMethodBrand: (pm?.card?.brand as string | undefined) || null,
      trialEnd: trialEndIso,
    }

    return NextResponse.json(body, { headers: cacheHeader })
  } catch (err: unknown) {
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode || 500, headers: cacheHeader }
      )
    }
    return NextResponse.json(
      { error: 'Não foi possível carregar a assinatura.' },
      { status: 500, headers: cacheHeader }
    )
  }
}
