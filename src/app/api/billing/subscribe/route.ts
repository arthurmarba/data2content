import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import Stripe from "stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import crypto from "crypto";

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
    // normaliza moeda vinda do front ("brl"/"usd")
    const currency = String(body.currency || "").toUpperCase() as Currency;
    const coupon: string | undefined = body.coupon;
    const promotion_code: string | undefined = body.promotion_code;
    let affiliateCode: string | undefined = body.affiliateCode;

    if (!plan || (currency !== "BRL" && currency !== "USD")) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    let existing: Stripe.Subscription | null = null;
    if (user.stripeSubscriptionId) {
      try {
        existing = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      } catch {}
    }

    const priceId = getPriceId(plan, currency);

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
    if (!existing) {
      const list = await stripe.subscriptions.list({ customer: customerId!, status: "all", limit: 10 });
      const reuse =
        list.data.find(
          s =>
            s.items.data.some(i => i.price.id === priceId) &&
            s.status !== "incomplete_expired"
        );
      if (reuse) {
        existing = reuse;
      }
    }

    let sub: Stripe.Subscription;

    if (existing && !["canceled", "incomplete_expired"].includes(existing.status) && existing.items.data[0]) {
      // Atualiza price em assinatura existente
      const itemId = existing.items.data[0].id;
      sub = await stripe.subscriptions.update(existing.id, {
        items: [{ id: itemId, price: priceId }],
        payment_behavior: "default_incomplete",
        proration_behavior: "create_prorations",
        billing_cycle_anchor: "now",
        expand: ["latest_invoice.payment_intent"],
      }, { idempotencyKey: `sub_update_${user._id}_${priceId}` });
    } else {
      if (affiliateCode) {
        affiliateCode = affiliateCode.toUpperCase();
        if (affiliateCode !== user.affiliateCode) {
          const owner = await User.findOne({ affiliateCode }).select("_id");
          if (owner) {
            user.affiliateUsed = affiliateCode;
          }
        }
      }

      const params: Stripe.SubscriptionCreateParams = {
        customer: customerId!,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
      };
      if (coupon || promotion_code) {
        (params as any).discounts = [coupon ? { coupon } : { promotion_code }];
      }

      const idemRaw = JSON.stringify({
        customerId,
        items: params.items,
        discounts: (params as any).discounts ?? null,
        behavior: params.payment_behavior,
        expand: params.expand,
      });
      const idemKey =
        "sub_" + crypto.createHash("sha256").update(idemRaw).digest("hex").slice(0, 24);

      try {
        sub = await stripe.subscriptions.create(params, { idempotencyKey: idemKey });
      } catch (e: any) {
        if (e.rawType === "idempotency_error") {
          const list = await stripe.subscriptions.list({ customer: customerId!, status: "all", limit: 10 });
          const reuse =
            list.data.find(
              s =>
                s.items.data.some(i => i.price.id === priceId) &&
                s.status !== "incomplete_expired"
            );
          if (reuse) {
            sub = reuse;
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }
    }

    user.stripeSubscriptionId = sub.id;
    user.planType = plan;
    user.planStatus = "pending";
    user.planInterval = plan === "annual" ? "year" : "month";
    user.stripePriceId = priceId;

    if (user.paymentInfo?.stripeAccountStatus === null) {
      delete (user as any).paymentInfo.stripeAccountStatus;
    }
    await user.save();

    const clientSecret = (sub.latest_invoice as any)?.payment_intent?.client_secret;
    return NextResponse.json({ clientSecret, subscriptionId: sub.id });
  } catch (err: any) {
    console.error("[billing/subscribe] error:", err);
    return NextResponse.json({ error: err?.message || "Erro ao iniciar assinatura" }, { status: 500 });
  }
}
