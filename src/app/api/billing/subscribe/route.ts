// src/app/api/billing/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import Stripe from "stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import { cancelBlockingIncompleteSubs } from "@/utils/stripeHelpers";
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

/**
 * Resolve código digitado para Discount(s):
 * - Tenta Promotion Code primeiro
 * - Cai para Coupon ID se existir
 * Retorna SEMPRE array (evita o union '' | Discount[] do SDK)
 */
async function resolveManualDiscountFields(
  code: string
): Promise<{ discounts: Stripe.SubscriptionCreateParams.Discount[] } | null> {
  const trimmed = normalizeCode(code);
  if (!trimmed) return null;

  // 1) Promotion Code
  try {
    const res = await stripe.promotionCodes.list({ code: trimmed, active: true, limit: 1 });
    const pc = res.data?.[0];
    if (pc?.id) {
      return { discounts: [{ promotion_code: pc.id }] };
    }
  } catch {
    /* noop */
  }

  // 2) Coupon ID
  try {
    const c = await stripe.coupons.retrieve(trimmed as string);
    const isDeleted = (c as any)?.deleted === true;
    if ((c as any)?.id && !isDeleted) {
      return { discounts: [{ coupon: (c as any).id }] };
    }
  } catch {
    /* noop */
  }

  return null;
}

/** Union alinhado entre helper e fallback */
type ResolvedAffiliate =
  | { code: string | null; source: "typed" | "url" | "cookie" | null }
  | { code: undefined; source: undefined };

// Fallback local se o helper externo não retornar nada
function resolveAffiliateCodeFallback(req: NextRequest, bodyCode?: string): ResolvedAffiliate {
  const typed = normalizeCode(bodyCode);
  if (typed) return { code: typed, source: "typed" };

  const url = new URL(req.url);
  const fromUrl = normalizeCode(url.searchParams.get("ref") || url.searchParams.get("aff"));
  if (fromUrl) return { code: fromUrl, source: "url" };

  const cookieStore = cookies();
  const fromCookie = normalizeCode(cookieStore.get("d2c_ref")?.value || "");
  if (fromCookie) return { code: fromCookie, source: "cookie" };

  // Nada encontrado
  return { code: undefined, source: undefined };
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

    let manualCoupon: string | undefined = normalizeCode(body.manualCoupon || undefined);

    // prioridade: digitado/typed > URL (?ref|?aff) > cookie (90 dias)
    let resolved: ResolvedAffiliate = resolveAffiliateCodeHelper
      ? (resolveAffiliateCodeHelper(req, body.affiliateCode) as ResolvedAffiliate)
      : { code: undefined, source: undefined };

    if (!resolved?.code) {
      resolved = resolveAffiliateCodeFallback(req, body.affiliateCode);
    }

    const affiliateCode: string | undefined =
      normalizeCode(resolved.code || undefined) || undefined;

    const source: "typed" | "url" | "cookie" | undefined =
      (resolved as Extract<ResolvedAffiliate, { code: string | null }>).source || undefined;

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

    // Limpa tentativas pendentes (evita travar INCOMPLETE)
    if (customerId) {
      try {
        await cancelBlockingIncompleteSubs(customerId);
      } catch {}
    }

    // Reaproveita assinatura existente do mesmo price (se fizer sentido pro seu fluxo)
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
      // Atualiza o price na assinatura atual (sem aplicar novo desconto)
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
        const owner = await User.findOne({ affiliateCode }).select("_id affiliateCode");
        if (owner) {
          if (String(owner._id) === String(user._id)) {
            return NextResponse.json(
              { error: "Você não pode usar seu próprio código." },
              { status: 400 }
            );
          }
          affiliateValid = true;
          affiliateUserId = String(owner._id);
          // congela a atribuição no usuário (usada no webhook para pagar comissão)
          user.affiliateUsed = owner.affiliateCode ?? null;
        }
      }

      // Se afiliado válido, exigimos que o cupom interno exista
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

      // metadata para auditoria e webhook
      const metadata: Record<string, string> = {
        userId: String(user._id),
        plan,
      };
      if (affiliateValid && affiliateCode && affiliateUserId) {
        metadata.affiliateCode = affiliateCode;
        metadata.affiliate_user_id = affiliateUserId;
        if (source) metadata.attribution_source = String(source);
      }

      // Se afiliado válido => ignora cupom manual
      const manualDiscountFields =
        !affiliateValid && manualCoupon ? await resolveManualDiscountFields(manualCoupon) : null;

      // Montagem de descontos (sempre array ou undefined)
      let discounts: Stripe.SubscriptionCreateParams.Discount[] | undefined = undefined;

      if (manualDiscountFields && Array.isArray(manualDiscountFields.discounts) && manualDiscountFields.discounts.length > 0) {
        discounts = manualDiscountFields.discounts;
      } else if (affiliateValid) {
        const couponId =
          currency === "BRL"
            ? (process.env.STRIPE_COUPON_AFFILIATE10_ONCE_BRL as string)
            : (process.env.STRIPE_COUPON_AFFILIATE10_ONCE_USD as string);
        discounts = [{ coupon: couponId }];
      }

      const createParams: Stripe.SubscriptionCreateParams = {
        customer: customerId!,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
        metadata,
        ...(discounts ? { discounts } : {}),
      };

      sub = await stripe.subscriptions.create(createParams);
    }

    // Atualiza usuário
    user.stripeSubscriptionId = sub.id;
    user.planType = plan;
    user.planStatus = "pending";
    user.planInterval = plan === "annual" ? "year" : "month";
    user.stripePriceId = priceId;
    await user.save();

    const clientSecret = (sub.latest_invoice as any)?.payment_intent?.client_secret;
    const affiliateApplied = Boolean(user.affiliateUsed);

    return NextResponse.json({
      clientSecret,
      subscriptionId: sub.id,
      affiliateApplied,
      usedCouponType: affiliateApplied ? "affiliate" : (manualCoupon ? "manual" : null),
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
