import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import Stripe from "stripe";

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

    // AUTO-CORREÇÃO: Se não houver ID da assinatura no DB, busca no Stripe.
    if (!subscriptionId && user.stripeCustomerId) {
      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
        limit: 1,
      });
      subscriptionId = subs.data[0]?.id ?? null;
    }

    if (!subscriptionId) {
      return NextResponse.json({ error: "Assinatura Stripe não encontrada" }, { status: 404 });
    }

    // CANCELAMENTO NO STRIPE: agenda o cancelamento para o final do período.
    // Expand para garantir PaymentMethod e Price completos.
    const sub = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
      expand: ["default_payment_method", "items.data.price", "latest_invoice.payment_intent"],
    });

    // ATUALIZAÇÃO NO BANCO DE DADOS
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          planStatus: "canceled",
          planInterval: sub.items.data[0]?.price?.recurring?.interval ?? user.planInterval,
          planExpiresAt: sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : user.planExpiresAt,
          stripeSubscriptionId: sub.id,
        },
        $unset: { lastPaymentError: 1 },
      }
    );

    // Próxima fatura (pode não existir após marcar cancel_at_period_end)
    let upcoming: Stripe.UpcomingInvoice | null = null;
    try {
      upcoming = await stripe.invoices.retrieveUpcoming({
        customer: user.stripeCustomerId!,
        subscription: sub.id,
      });
    } catch {
      upcoming = null;
    }

    // Normaliza plan/currency com base no Price expandido (fallback para plan legacy)
    const item = sub.items.data[0];
    const price = item?.price as Stripe.Price | undefined;
    const planName = (price?.nickname ?? (item as any)?.plan?.nickname ?? "Pro") as string;
    const currency = (upcoming?.currency ?? price?.currency ?? "brl").toUpperCase();

    // PaymentMethod pode vir como objeto (com expand) ou string
    const paymentMethod = sub.default_payment_method as Stripe.PaymentMethod | string | null;
    const pmObj =
      paymentMethod && typeof paymentMethod === "object"
        ? (paymentMethod as Stripe.PaymentMethod)
        : null;

    const subscription = {
      planName,
      currency,
      nextInvoiceAmountCents: upcoming?.amount_due ?? undefined,
      nextInvoiceDate: upcoming?.next_payment_attempt
        ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
        : undefined,
      currentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : undefined,
      status: sub.status as string,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      paymentMethodLast4: pmObj?.card?.last4 ?? null,
      defaultPaymentMethodBrand: (pmObj?.card?.brand as string | null) ?? null,
    };

    return NextResponse.json({ ok: true, subscription });
  } catch (err: unknown) {
    console.error("[billing/cancel] error:", err);

    // Tratamento específico para erros Stripe sem depender de 'import type'
    const StripeErrorCtor = (Stripe as any)?.errors?.StripeError;
    if (StripeErrorCtor && err instanceof StripeErrorCtor) {
      const se = err as { message?: string; statusCode?: number };
      return NextResponse.json(
        { error: se.message ?? "Erro no Stripe" },
        { status: se.statusCode ?? 500 }
      );
    }

    return NextResponse.json(
      { error: "Ocorreu um erro inesperado ao cancelar a renovação." },
      { status: 500 }
    );
  }
}
