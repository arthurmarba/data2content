// src/app/api/billing/subscribe/route.ts
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

// Resolve código digitado para Promotion Code (preferência) ou Coupon ID
async function resolveManualDiscountFields(
  code: string
): Promise<Partial<Pick<Stripe.SubscriptionCreateParams, "coupon" | "promotion_code">> | null> {
  const trimmed = (code || "").trim();
  if (!trimmed) return null;

  // 1) tentar como Promotion Code (código amigável)
  try {
    const res = await stripe.promotionCodes.list({ code: trimmed, active: true, limit: 1 });
    const pc = res.data?.[0];
    if (pc?.id) return { promotion_code: pc.id };
  } catch {
    /* noop */
  }

  // 2) fallback: tentar como ID de Coupon
  try {
    const c: any = await stripe.coupons.retrieve(trimmed);
    if (c?.id && !c?.deleted) return { coupon: c.id };
  } catch {
    /* noop */
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { allowed } = await checkRateLimit(`subscribe:${session.user.id}`, 3, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas, tente novamente mais tarde." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const plan: Plan = body.plan;
    const currency = String(body.currency || "").toUpperCase() as Currency;
    let manualCoupon: string | undefined = body.manualCoupon?.trim() || undefined;

    // prioridade: digitado > URL (?ref|?aff) > cookie (90 dias)
    let { code: resolvedCode, source } = resolveAffiliateCode(req, body.affiliateCode);
    let affiliateCode: string | undefined = resolvedCode || undefined;

    if (!plan || (currency !== "BRL" && currency !== "USD")) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Se o usuário digitou um affiliate code no campo de cupom, reinterpreta como afiliado
    if (manualCoupon) {
      const affOwner = await User.findOne({ affiliateCode: manualCoupon.toUpperCase() }).select(
        "_id affiliateCode"
      );
      if (affOwner) {
        if (String(affOwner._id) === String(user._id)) {
          return NextResponse.json(
            { error: "Você não pode usar seu próprio código." },
            { status: 400 }
          );
        }
        affiliateCode = affOwner.affiliateCode; // vira afiliado "typed"
        source = "typed";
        manualCoupon = undefined; // não tratar mais como cupom
      }
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
        /* ignore */
      }
    }
    if (!existing) {
      const list = await stripe.subscriptions.list({
        customer: customerId!,
        status: "all",
        limit: 10,
      });
      const reuse = list.data.find(
        (s) =>
          s.items.data.some((i) => i.price.id === priceId) &&
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
      // ——— Regra de prioridade: AFILIADO > cupom manual ———
      let affiliateValid = false;
      let affiliateUserId: string | undefined;

      if (affiliateCode) {
        affiliateCode = affiliateCode.toUpperCase();
        const owner = await User.findOne({ affiliateCode }).select("_id affiliateCode");
        if (owner) {
          if (String(owner._id) === String(user._id)) {
            return NextResponse.json(
              { error: "Você não pode usar seu próprio código." },
              { status: 400 }
            );
          }
          affiliateValid = true; // sempre que houver afiliado válido, ele vence
          affiliateUserId = String(owner._id);
          user.affiliateUsed = owner.affiliateCode ?? null; // usado no webhook
        } else {
          affiliateCode = undefined;
        }
      }

      // Guard: cupom interno de afiliado precisa existir se for aplicar
      if (affiliateValid) {
        const affCoupon =
          currency === "BRL"
            ? process.env.STRIPE_COUPON_AFFILIATE10_ONCE_BRL
            : process.env.STRIPE_COUPON_AFFILIATE10_ONCE_USD;
        if (!affCoupon) {
          return NextResponse.json(
            {
              error: "AffiliateCouponMissing",
              message: `Cupom interno de afiliado ausente para ${currency}. Configure STRIPE_COUPON_AFFILIATE10_ONCE_${currency}.`,
            },
            { status: 500 }
          );
        }
      }

      // metadata
      const metadata: Record<string, string> = {
        userId: String(user._id),
        plan,
      };
      if (affiliateValid && affiliateCode && affiliateUserId) {
        metadata.affiliateCode = affiliateCode;
        metadata.affiliate_user_id = affiliateUserId;
        if (source) metadata.attribution_source = source;
      }

      // Se afiliado válido => IGNORA qualquer cupom manual
      // Senão, tenta resolver o cupom manual (promotion_code / coupon)
      const manualDiscountFields =
        !affiliateValid && manualCoupon ? await resolveManualDiscountFields(manualCoupon) : null;

      // montar params top-level (API 2022-11-15): coupon/promotion_code
      const discountTopLevel: Partial<
        Pick<Stripe.SubscriptionCreateParams, "coupon" | "promotion_code">
      > = manualDiscountFields
        ? manualDiscountFields
        : affiliateValid
        ? {
            coupon:
              currency === "BRL"
                ? (process.env.STRIPE_COUPON_AFFILIATE10_ONCE_BRL as string)
                : (process.env.STRIPE_COUPON_AFFILIATE10_ONCE_USD as string),
          }
        : {};

      const createParams: Stripe.SubscriptionCreateParams = {
        customer: customerId!,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
        metadata,
        ...discountTopLevel, // aplica OU manual (promotion_code/coupon) OU afiliado (coupon)
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

    const affiliateApplied = Boolean(user.affiliateUsed); // se aplicamos afiliado, affiliateUsed foi setado
    return NextResponse.json({
      clientSecret,
      subscriptionId: sub.id,
      affiliateApplied,
      usedCouponType: affiliateApplied ? "affiliate" : (body.manualCoupon ? "manual" : null),
    });
  } catch (err: any) {
    console.error("[billing/subscribe] error:", err);
    const msg =
      err?.raw?.message ||
      err?.message ||
      "Erro ao iniciar assinatura. Tente novamente.";
    return NextResponse.json({ error: "SubscribeError", message: msg }, { status: 400 });
  }
}
