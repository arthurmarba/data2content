// src/app/api/billing/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import Stripe from "stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import {
  cancelBlockingIncompleteSubs,
  getOrCreateStripeCustomerId,
} from "@/utils/stripeHelpers";
import { resolveAffiliateCode as resolveAffiliateCodeHelper } from "@/app/lib/affiliate";

export const runtime = "nodejs";

type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";

function normalizeCode(v?: string | null) {
  return (v || "").trim().toUpperCase();
}

function getPriceId(plan: Plan, currency: Currency) {
  if (plan === "monthly" && currency === "BRL") return process.env.STRIPE_PRICE_MONTHLY_BRL!;
  if (plan === "annual" && currency === "BRL") return process.env.STRIPE_PRICE_ANNUAL_BRL!;
  if (plan === "monthly" && currency === "USD") return process.env.STRIPE_PRICE_MONTHLY_USD!;
  if (plan === "annual" && currency === "USD") return process.env.STRIPE_PRICE_ANNUAL_USD!;
  throw new Error("PriceId não configurado para este plano/moeda");
}

async function resolveManualDiscountFields(
  code: string
): Promise<{ discounts: Stripe.SubscriptionCreateParams.Discount[] } | null> {
  const trimmed = normalizeCode(code);
  if (!trimmed) return null;

  try {
    const res = await stripe.promotionCodes.list({ code: trimmed, active: true, limit: 1 });
    const pc = res.data?.[0];
    if (pc?.id) return { discounts: [{ promotion_code: pc.id }] };
  } catch { /* noop */ }

  try {
    const c = await stripe.coupons.retrieve(trimmed as string);
    const isDeleted = (c as any)?.deleted === true;
    if ((c as any)?.id && !isDeleted) {
      return { discounts: [{ coupon: (c as any).id }] };
    }
  } catch { /* noop */ }

  return null;
}

type ResolvedAffiliate =
  | { code: string | null; source: "typed" | "url" | "cookie" | null }
  | { code: undefined; source: undefined };

function resolveAffiliateCodeFallback(req: NextRequest, bodyCode?: string): ResolvedAffiliate {
  const typed = normalizeCode(bodyCode);
  if (typed) return { code: typed, source: "typed" };

  const url = new URL(req.url);
  const fromUrl = normalizeCode(url.searchParams.get("ref") || url.searchParams.get("aff"));
  if (fromUrl) return { code: fromUrl, source: "url" };

  const cookieStore = cookies();
  const fromCookie = normalizeCode(cookieStore.get("d2c_ref")?.value || "");
  if (fromCookie) return { code: fromCookie, source: "cookie" };

  return { code: undefined, source: undefined };
}

type InvoiceMaybePI = Stripe.Invoice & {
  payment_intent?: Stripe.PaymentIntent | string | null;
};

function asInvoice(resp: unknown): InvoiceMaybePI {
  const anyResp = resp as any;
  if (anyResp && typeof anyResp === "object" && "data" in anyResp) {
    return anyResp.data as InvoiceMaybePI;
  }
  return anyResp as InvoiceMaybePI;
}

async function extractClientSecretFromSubscription(sub: Stripe.Subscription): Promise<string | undefined> {
  try {
    if (sub.latest_invoice && typeof sub.latest_invoice !== "string") {
      const latestInv = sub.latest_invoice as InvoiceMaybePI;
      const pi = latestInv.payment_intent;
      if (pi && typeof pi !== "string" && pi.client_secret) return pi.client_secret;
    }

    const invoiceId =
      typeof sub.latest_invoice === "string"
        ? sub.latest_invoice
        : sub.latest_invoice?.id;

    if (invoiceId) {
      const invResp = await stripe.invoices.retrieve(invoiceId, { expand: ["payment_intent"] });
      const invoice = asInvoice(invResp);
      const pi = invoice.payment_intent;
      if (pi && typeof pi !== "string" && pi.client_secret) return pi.client_secret;
    }
  } catch { /* noop */ }

  return undefined;
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
    const plan: Plan = String(body.plan || "").toLowerCase() as Plan;
    const currency = String(body.currency || "").toUpperCase() as Currency;

    if (!["monthly", "annual"].includes(plan) || !["BRL", "USD"].includes(currency)) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    let resolved: ResolvedAffiliate = resolveAffiliateCodeHelper
      ? (resolveAffiliateCodeHelper(req, body.affiliateCode) as ResolvedAffiliate)
      : { code: undefined, source: undefined };

    if (!resolved?.code) {
      resolved = resolveAffiliateCodeFallback(req, body.affiliateCode);
    }

    const affiliateCode: string | undefined = normalizeCode(resolved.code || undefined) || undefined;
    const source: "typed" | "url" | "cookie" | undefined =
      (resolved as Extract<ResolvedAffiliate, { code: string | null }>).source || undefined;

    const typedCode = source === "typed" ? affiliateCode : undefined;
    const priceId = getPriceId(plan, currency);

    const customerId = await getOrCreateStripeCustomerId(user);
    try {
      await cancelBlockingIncompleteSubs(customerId);
    } catch {}

    // === TRIAL (em dias) — mantém o Checkout mostrando “7 dias grátis” ===
    const trialDays = Number.parseInt(process.env.TRIAL_DAYS ?? "7", 10);

    // Tenta reaproveitar sub existente
    let existing: Stripe.Subscription | null = null;
    if (user.stripeSubscriptionId) {
      try {
        existing = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      } catch { /* ignore */ }
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
    let affiliateOwner: any = null;
    let discounts: Stripe.SubscriptionCreateParams.Discount[] | undefined = undefined;

    if (existing && ["active", "trialing"].includes(existing.status) && existing.items.data[0]) {
      // --- FLUXO DE UPGRADE/DOWNGRADE ---
      const itemId = existing.items.data[0].id;

      const isTrialing =
        existing.status === "trialing" &&
        typeof existing.trial_end === "number" &&
        existing.trial_end > Math.floor(Date.now() / 1000);

      // ⚠️ Se estiver em trial, NÃO forçar billing_cycle_anchor: "now"
      const updateParams: Stripe.SubscriptionUpdateParams = {
        items: [{ id: itemId, price: priceId }],
        payment_behavior: "default_incomplete",
        proration_behavior: "create_prorations",
        expand: ["latest_invoice.payment_intent"],
        ...(isTrialing ? {} : { billing_cycle_anchor: "now" as const }),
      };

      sub = await stripe.subscriptions.update(existing.id, updateParams);
    } else {
      // --- FLUXO DE NOVA ASSINATURA ---
      if (affiliateCode) {
        affiliateOwner = await User.findOne({ affiliateCode }).select("_id affiliateCode").lean();
      }

      if (affiliateOwner) {
        if (String(affiliateOwner._id) === String(user._id)) {
          return NextResponse.json(
            { code: "SELF_REFERRAL", message: "Você não pode usar seu próprio código." },
            { status: 400 }
          );
        }

        // salva a afiliação ANTES de criar a assinatura (webhook-friendly)
        if (!user.affiliateUsed) {
          user.affiliateUsed = affiliateCode!;
          await user.save();
        }

        const couponEnv =
          currency === "BRL"
            ? process.env.STRIPE_COUPON_AFFILIATE10_ONCE_BRL
            : process.env.STRIPE_COUPON_AFFILIATE10_ONCE_USD;

        if (!couponEnv) {
          return NextResponse.json(
            {
              code: "AFFILIATE_COUPON_MISSING",
              message: "Cupom de afiliado não configurado. Contate o suporte.",
            },
            { status: 500 }
          );
        }
        discounts = [{ coupon: couponEnv }];
      } else if (typedCode) {
        const manual = await resolveManualDiscountFields(typedCode);
        if (!manual) {
          return NextResponse.json(
            { code: "INVALID_CODE", message: "Código inválido ou expirado." },
            { status: 422 }
          );
        }
        discounts = manual.discounts;
      }

      const metadata: Record<string, string> = { userId: String(user._id), plan };
      if (affiliateOwner && affiliateCode) {
        metadata.affiliateCode = affiliateCode;
        metadata.affiliate_user_id = String(affiliateOwner._id);
        if (source) metadata.attribution_source = String(source);
      }

      // ✅ Criação alinhada ao Checkout: usar trial_period_days (inteiro)
      sub = await stripe.subscriptions.create({
        customer: customerId!,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
        metadata,
        ...(discounts ? { discounts } : {}),
      });
    }

    // --- Persistência e retorno ---
    user.stripeSubscriptionId = sub.id;
    user.planType = plan;
    user.planStatus = "pending";
    user.planInterval = plan === "annual" ? "year" : "month";
    user.stripePriceId = priceId;
    await user.save();

    let clientSecret = await extractClientSecretFromSubscription(sub);
    if (!clientSecret) {
      try {
        const refreshed = await stripe.subscriptions.retrieve(sub.id, {
          expand: ["latest_invoice.payment_intent"],
        });
        clientSecret = await extractClientSecretFromSubscription(refreshed);
      } catch { /* noop */ }
    }

    const affiliateApplied = Boolean(affiliateOwner);
    const usedCouponType = affiliateApplied ? "affiliate" : (typedCode ? "manual" : null);

    if (clientSecret) {
      return NextResponse.json({
        clientSecret,
        subscriptionId: sub.id,
        affiliateApplied,
        usedCouponType,
      });
    }

    // Fallback para Checkout Session (raro)
    try {
      if (sub.status === "incomplete" && (!existing || existing.id !== sub.id)) {
        await stripe.subscriptions.cancel(sub.id);
      }
    } catch { /* noop */ }

    const successUrl = `${process.env.NEXTAUTH_URL}/dashboard/billing/thanks?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.NEXTAUTH_URL}/dashboard/billing`;

    const sessionCheckout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId!,
      line_items: [{ price: priceId, quantity: 1 }],
      ...(discounts && discounts.length > 0
        ? { discounts: discounts as Stripe.Checkout.SessionCreateParams.Discount[] }
        : { allow_promotion_codes: true }
      ),
      subscription_data: {
        // Informar trial e desconto aqui garante que o Checkout hospedado mostre
        // "Após X dias: R$ yy com desconto" de forma consistente.
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
        ...(discounts && discounts.length > 0 ? { discounts } : {}),
        metadata: {
          userId: String(user._id),
          plan,
          ...(affiliateOwner && affiliateCode
            ? { affiliateCode, affiliate_user_id: String(affiliateOwner._id) }
            : {}),
          ...(source ? { attribution_source: String(source) } : {}),
        },
      },
      locale: "auto",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: String(user._id),
    });

    return NextResponse.json({
      checkoutUrl: sessionCheckout.url,
      subscriptionId: sub.id,
      affiliateApplied,
      usedCouponType,
    });
  } catch (err: any) {
    console.error("[billing/subscribe] error:", err);
    const msg =
      err?.raw?.message ||
      err?.message ||
      "Erro ao iniciar assinatura. Tente novamente.";
    return NextResponse.json({ code: "SubscribeError", message: msg }, { status: 400 });
  }
}
