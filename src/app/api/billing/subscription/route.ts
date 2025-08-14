import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { connectToDatabase } from '@/app/lib/mongoose'
import User from '@/app/models/User'
import stripe from '@/app/lib/stripe'
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
    const user = await User.findById(session.user.id).lean()
    if (!user?.stripeSubscriptionId) {
      // Sem assinatura → 204 para o front renderizar Empty
      return new NextResponse(null, { status: 204, headers: cacheHeader })
    }

    const res = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ['default_payment_method', 'latest_invoice.payment_intent'],
    })

    // Normaliza o tipo (Response<T> → T)
    const sub = res as Stripe.Subscription

    const items = sub.items?.data ?? []
    const firstItem = items[0]
    const price = (firstItem?.price as Stripe.Price | undefined) ?? undefined

    // currency: preferir a do price; cair para a da sub; fallback 'BRL'
    const currency =
      (price?.currency ?? (sub as any).currency ?? 'brl').toString().toUpperCase()

    // Em basil, o fim do período está nos itens (current_period_end por item).
    // Pegamos o MENOR current_period_end entre os itens.
    const periodEnds = items
      .map((it) => (it as any)?.current_period_end)
      .filter((n): n is number => typeof n === 'number')

    const minPeriodEndSec = periodEnds.length ? Math.min(...periodEnds) : null
    const periodEndIso = minPeriodEndSec ? new Date(minPeriodEndSec * 1000).toISOString() : null

    // cancel_at_period_end pode não estar no tipo; manter como any-safe
    const cancelAtPeriodEnd = Boolean((sub as any).cancel_at_period_end)

    // default_payment_method pode ser string|object|null
    const pm =
      typeof sub.default_payment_method === 'object'
        ? (sub.default_payment_method as Stripe.PaymentMethod)
        : null

    // trial_end pode não existir; checar como any
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
