import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";

export const runtime = "nodejs";

type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";

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
    const plan: Plan = body?.plan ?? "monthly";
    const currency: Currency = body?.currency ?? "BRL";
    const affiliateCode: string | undefined = body?.affiliateCode;

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });
    if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

    // Garante customer no Stripe
    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: String(user._id) },
      });
      user.stripeCustomerId = customer.id;
    }

    // (Opcional) valida cupom/afiliado e evita auto-uso
    if (affiliateCode) {
      const aff = await User.findOne({ affiliateCode });
      if (!aff) return NextResponse.json({ error: "Código de afiliado inválido." }, { status: 400 });
      if (String(aff._id) === String(user._id)) {
        return NextResponse.json({ error: "Você não pode usar seu próprio código." }, { status: 400 });
      }
      user.affiliateUsed = affiliateCode;
    }

    const priceId = getPriceId(plan, currency);

    // Se já tem assinatura Stripe, atualiza para o novo price (caso de “reativar/trocar” por aqui)
    if (user.stripeSubscriptionId) {
      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      const itemId = sub.items.data[0]?.id;
      if (!itemId) throw new Error("Item da assinatura não encontrado");

      const updated = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        items: [{ id: itemId, price: priceId }],
        payment_behavior: "default_incomplete",
        proration_behavior: "create_prorations",
        billing_cycle_anchor: "now",
        expand: ["latest_invoice.payment_intent"],
        metadata: { plan },
      });

      await user.save();

      const pi = (updated.latest_invoice as any)?.payment_intent;
      return NextResponse.json({
        subscriptionId: updated.id,
        clientSecret: pi?.client_secret || null,
        requiresAction: !!pi && ["requires_action", "requires_payment_method"].includes(pi.status),
      });
    }

    // Cria assinatura do zero
    const subParams: any = {
      customer: user.stripeCustomerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
      metadata: { plan },
    };
    if (affiliateCode) {
      subParams.coupon = process.env.STRIPE_PROMO_COUPON_ID_10OFF_ONCE;
    }
    const created = await stripe.subscriptions.create(subParams);

    user.stripeSubscriptionId = created.id;
    user.planType = plan;      // mantém coerência na sessão
    user.planStatus = "pending";
    await user.save();

    const pi = (created.latest_invoice as any)?.payment_intent;
    return NextResponse.json({
      subscriptionId: created.id,
      clientSecret: pi?.client_secret || null,
      requiresAction: !!pi && ["requires_action", "requires_payment_method"].includes(pi.status),
    });
  } catch (err: any) {
    console.error("[billing/subscribe] error:", err);
    return NextResponse.json({ error: err?.message || "Erro ao iniciar assinatura" }, { status: 500 });
  }
}

