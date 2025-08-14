import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession({ req, ...authOptions });
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Se já estiver cancelada, simplesmente retorna o estado atual
    if (user.planStatus === "canceled") {
      return NextResponse.json({ ok: true });
    }

    let subscriptionId = user.stripeSubscriptionId;
    
    // LÓGICA DE AUTO-CORREÇÃO: Se não houver ID da assinatura no DB, busca no Stripe.
    if (!subscriptionId && user.stripeCustomerId) {
      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
        limit: 1,
      });
      subscriptionId = subs.data[0]?.id;
    }

    if (!subscriptionId) {
      return NextResponse.json({ error: "Assinatura Stripe não encontrada" }, { status: 404 });
    }

    // CANCELAMENTO NO STRIPE: Agenda o cancelamento para o final do período.
    const sub = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // ATUALIZAÇÃO NO BANCO DE DADOS
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          planStatus: "canceled",
          planInterval:
            sub.items.data[0]?.price.recurring?.interval ?? user.planInterval,
          planExpiresAt: sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : user.planExpiresAt,
          stripeSubscriptionId: sub.id,
        },
        $unset: { lastPaymentError: 1 },
      }
    );

    let upcoming: Stripe.UpcomingInvoice | null = null;
    try {
      upcoming = await stripe.invoices.retrieveUpcoming({
        customer: user.stripeCustomerId!,
        subscription: sub.id,
      });
    } catch {
      upcoming = null;
    }

    const paymentMethod = sub.default_payment_method as Stripe.PaymentMethod | null;
    const subscription = {
      planName: sub.items.data[0]?.plan?.nickname || "Pro",
      currency:
        upcoming?.currency?.toUpperCase() ||
        sub.items.data[0]?.plan?.currency?.toUpperCase() ||
        "BRL",
      nextInvoiceAmountCents: upcoming?.amount_due || undefined,
      nextInvoiceDate: upcoming?.next_payment_attempt
        ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
        : undefined,
      currentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : undefined,
      status: sub.status as any,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      paymentMethodLast4: paymentMethod?.card?.last4 || null,
      defaultPaymentMethodBrand: paymentMethod?.card?.brand || null,
    };

    return NextResponse.json({ ok: true, subscription });
  } catch (err: any) {
    console.error("[billing/cancel] error:", err);

    // MELHORIA: Tratamento de erro específico do Stripe para mensagens mais claras.
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode || 500 });
    }

    return NextResponse.json({ error: "Ocorreu um erro inesperado ao cancelar a renovação." }, { status: 500 });
  }
}
