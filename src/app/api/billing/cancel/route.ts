import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { connectToDatabase } from '@/app/lib/mongoose'
import User from '@/app/models/User'
import Stripe from 'stripe'

// Você pode remover apiVersion e deixar "latest" do SDK.
// Mantive explícito para alinhar ao que já está no projeto.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
})

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const cacheHeader = { 'Cache-Control': 'no-store, max-age=0' } as const

export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: cacheHeader })
    }

    await connectToDatabase()
    const user = await User.findById(session.user.id).lean()
    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404, headers: cacheHeader })
    }

    // Atualiza para cancelar ao fim do período vigente.
    const res = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    const sub = res as Stripe.Subscription

    // Em basil, não existe mais subscription.current_period_end.
    // 1) Se o Stripe já resolveu uma data de cancelamento, use-a:
    let cancelAtTs: number | null =
      typeof sub.cancel_at === 'number' ? sub.cancel_at : null

    // 2) Senão, derive do MENOR current_period_end entre os itens.
    if (!cancelAtTs && sub.items && Array.isArray(sub.items.data)) {
      const candidates = sub.items.data
        .map((it) => (typeof (it as any).current_period_end === 'number' ? (it as any).current_period_end as number : null))
        .filter((v): v is number => v != null)

      if (candidates.length > 0) {
        cancelAtTs = Math.min(...candidates)
      }
    }

    // Se ainda assim não houver data, não falhe: retorne null (front pode exibir cópia genérica).
    const currentPeriodEnd = cancelAtTs
      ? new Date(cancelAtTs * 1000).toISOString()
      : null

    return NextResponse.json(
      { ok: true, cancelAtPeriodEnd: true, currentPeriodEnd },
      { headers: cacheHeader }
    )
  } catch (err: unknown) {
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode || 500, headers: cacheHeader }
      )
    }
    return NextResponse.json(
      { error: 'Não foi possível cancelar a assinatura.' },
      { status: 500, headers: cacheHeader }
    )
  }
}
