import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import Stripe from "stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import { cancelBlockingIncompleteSubs } from "@/utils/stripeHelpers";
import { resolveAffiliateCode } from "@/app/lib/affiliate";

export const runtime = "nodejs";

type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";

function getPriceId(plan: Plan, currency: Currency) {
  if (plan === "monthly" && currency === "BRL") return process.env.STRIPE_PRICE_MONTHLY_BRL!;
  if (plan === "annual" && currency === "BRL") return process.env.STRIPE_PRICE_ANNUAL_BRL!;
  if (plan === "monthly" && currency === "USD") return process.env.STRIPE_PRICE_MONTHLY_USD!;
  if (plan === "annual" && currency === "USD") return process.env.STRIPE_PRICE_ANNUAL_USD!;
  throw new Error("PriceId não configurado para este plano/moeda");
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { allowed } = await checkRateLimit(`subscribe:${session.user.id}`, 3, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Muitas tentativas, tente novamente mais tarde." }, { status: 429 });
    }

    const body = await req.json();
    const plan: Plan = body.plan;
    const currency = String(body.currency || "").toUpperCase() as Currency;
    const manualCoupon: string | undefined = body.manualCoupon?.trim() || undefined;
    // prioridade: digitado > URL (?ref|?aff) > cookie (90 dias)
    const { code: resolvedCode, source } = resolveAffiliateCode(req, body.affiliateCode);
    let affiliateCode: string | undefined = resolvedCode || undefined;
    let affiliateValid = false;

    if (!plan || (currency !== "BRL" && currency !== "USD")) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const priceId = getPriceId(plan, currency);

    // garante cliente
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: String(user._id) },
      });
      customerId = customer.id;
      user.stripeCustomerId = customer.id;
    }

    // evita "blocking incomplete" antigas
    await cancelBlockingIncompleteSubs(stripe, customerId!);

    // tenta reaproveitar assinatura existente do mesmo price
    let existing: Stripe.Subscription | null = null;
    if (user.stripeSubscriptionId) {
      try {
        existing = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      } catch {
        // ignora se não existir
      }
    }
    if (!existing) {
      const list = await stripe.subscriptions.list({ customer: customerId!, status: "all", limit: 10 });
      const reuse = list.data.find(
        s =>
          s.items.data.some(i => i.price.id === priceId) &&
          s.status !== "incomplete_expired"
      );
      if (reuse) existing = reuse;
    }

    let sub: Stripe.Subscription;

    if (existing && ["active", "trialing"].includes(existing.status) && existing.items.data[0]) {
      // Atualiza o price na assinatura atual
      const itemId = existing.items.data[0].id;
      sub = await stripe.subscriptions.update(existing.id, {
        items: [{ id: itemId, price: priceId }],
        payment_behavior: "default_incomplete",
        proration_behavior: "create_prorations",
        billing_cycle_anchor: "now",
        expand: ["latest_invoice.payment_intent"],
      });
    } else {
      // Afiliado: validar (bloquear self-referral) e preparar desconto interno (sem stacking com cupom manual)
      let affiliateUserId: string | undefined;
      if (affiliateCode) {
        affiliateCode = affiliateCode.toUpperCase();
        const owner = await User.findOne({ affiliateCode }).select("_id affiliateCode");
        if (owner) {
          if (String(owner._id) === String(user._id)) {
            return NextResponse.json({ error: "Você não pode usar seu próprio código." }, { status: 400 });
          }
          affiliateValid = !manualCoupon; // somente se NÃO houver cupom manual
          if (affiliateValid) {
            affiliateUserId = String(owner._id);
            user.affiliateUsed = owner.affiliateCode; // usado pelo webhook
          }
        }
      }

      const metadata: Record<string, string> = {
        userId: String(user._id),
        plan,
      };
      if (affiliateValid && affiliateCode && affiliateUserId) {
        metadata.affiliateCode = affiliateCode;
        metadata.affiliate_user_id = affiliateUserId;
        if (source) metadata.attribution_source = source;
      }

      const createParams: Stripe.SubscriptionCreateParams = {
        customer: customerId!,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
        metadata,
        // Desconto de afiliado (10% once) SEM cumulatividade com cupom manual
        discounts: manualCoupon
          ? [{ coupon: manualCoupon }]
          : (affiliateValid
              ? [{ coupon: currency === "BRL"
                    ? (process.env.STRIPE_COUPON_AFFILIATE10_ONCE_BRL as string)
                    : (process.env.STRIPE_COUPON_AFFILIATE10_ONCE_USD as string)
                 }]
              : undefined),
      };

      sub = await stripe.subscriptions.create(createParams);
    }

    // atualiza usuário
    user.stripeSubscriptionId = sub.id;
    user.planType = plan;
    user.planStatus = "pending";
    user.planInterval = plan === "annual" ? "year" : "month";
    user.stripePriceId = priceId;
    await user.save();

    const clientSecret = (sub.latest_invoice as any)?.payment_intent?.client_secret;
    return NextResponse.json({
      clientSecret,
      subscriptionId: sub.id,
      affiliateApplied: Boolean(affiliateValid),
      usedCouponType: manualCoupon ? 'manual' : (affiliateValid ? 'affiliate' : null)
    });
  } catch (err: any) {
    console.error("[billing/subscribe] error:", err);
    return NextResponse.json(
      { error: err?.message || "Erro ao iniciar assinatura" },
      { status: 500 }
    );
  }
}
