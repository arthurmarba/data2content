import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";

export const runtime = "nodejs";

type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";
type When = "now" | "period_end";

function getPriceId(plan: Plan, currency: Currency) {
  if (plan === "monthly" && currency === "BRL") return process.env.STRIPE_PRICE_MONTHLY_BRL!;
  if (plan === "annual"  && currency === "BRL") return process.env.STRIPE_PRICE_ANNUAL_BRL!;
  if (plan === "monthly" && currency === "USD") return process.env.STRIPE_PRICE_MONTHLY_USD!;
  if (plan === "annual"  && currency === "USD") return process.env.STRIPE_PRICE_ANNUAL_USD!;
  throw new Error("PriceId não configurado para este plano/moeda");
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession({ req, ...authOptions });
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const toPlan: Plan = body?.to ?? body?.newPlan;
    const when: When = body?.when ?? "now";

    if (!toPlan) {
      return NextResponse.json({ error: "Destino do plano (to) é obrigatório" }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });
    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ error: "Assinatura Stripe não encontrada" }, { status: 404 });
    }
    const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    const currentCurrency = sub.items.data[0]?.price?.currency?.toUpperCase() as Currency | undefined;
    const currency: Currency = body?.currency === "USD" ? "USD" : (currentCurrency === "USD" ? "USD" : "BRL");
    const priceId = getPriceId(toPlan, currency);
    const itemId = sub.items.data[0]?.id;
    if (!itemId) throw new Error("Item da assinatura não encontrado");

    if (when === "now") {
      const updated = await stripe.subscriptions.update(sub.id, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: "create_prorations",
        billing_cycle_anchor: "now",
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
        metadata: { plan: toPlan },
      });

      // Deixe o webhook ajustar planType/planExpiresAt quando a invoice for paga.

      const pi = (updated.latest_invoice as any)?.payment_intent;
      return NextResponse.json({
        subscriptionId: updated.id,
        clientSecret: pi?.client_secret || null,
        requiresAction: !!pi && ["requires_action", "requires_payment_method"].includes(pi.status),
      });
    }

    // when === "period_end" → agenda com Subscription Schedules (fase futura)
    try {
      // CORREÇÃO APLICADA AQUI
      const currentItem = sub.items.data[0];
      if (!currentItem?.price?.id) {
        throw new Error("Item da assinatura atual não encontrado para o agendamento.");
      }

      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: sub.id,
        end_behavior: "release",
        phases: [
          {
            // mantém o preço atual por 1 ciclo
            items: [{ price: currentItem.price.id, quantity: 1 }],
            iterations: 1,
          },
          {
            // troca para o novo price no próximo ciclo
            items: [{ price: priceId, quantity: 1 }],
          },
        ],
      });

      return NextResponse.json({ scheduled: true, scheduleId: schedule.id });
    } catch (e: any) {
      if (String(e?.message || "").includes("active subscription schedule")) {
        return NextResponse.json({ error: "Já existe uma troca agendada para o fim do ciclo atual." }, { status: 409 });
      }
      throw e;
    }
  } catch (err: any) {
    console.error("[billing/change-plan] error:", err);
    return NextResponse.json({ error: err?.message || "Erro ao mudar de plano" }, { status: 500 });
  }
}
