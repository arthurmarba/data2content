// /src/app/api/billing/preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import { getOrCreateStripeCustomerId } from "@/utils/stripeHelpers";
import type Stripe from "stripe";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" } as const;

// --- Tipos para clareza ---
type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";
type AffiliateCheckResult = {
  couponId?: string;
  error?: "invalid_code" | "coupon_not_configured" | "self_referral";
  source?: "typed" | "url" | "cookie" | "session";
  code?: string;
};

// --- Funções Auxiliares ---

function normalizeCode(v?: string | null) {
  return (v || "").trim().toUpperCase();
}

function getPriceId(plan: Plan, currency: Currency): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${currency.toUpperCase()}`;
  const priceId = process.env[key as keyof NodeJS.ProcessEnv] as string | undefined;
  if (!priceId) throw new Error(`Price ID não configurado para ${key}`);
  return priceId;
}

/**
 * Resolve o código de afiliado considerando:
 * 1) Body (typed)
 * 2) URL (?ref|?aff)
 * 3) Cookie d2c_ref
 * 4) Session.user.affiliateUsed (fallback)
 */
function resolveAffiliateFromRequest(
  req: NextRequest,
  bodyAffiliateCode?: string,
  sessionAffiliateUsed?: string
): { code?: string; source?: "typed" | "url" | "cookie" | "session" } {
  const typed = normalizeCode(bodyAffiliateCode);
  if (typed) return { code: typed, source: "typed" };

  // URL
  const url = new URL(req.url);
  const fromUrl = normalizeCode(url.searchParams.get("ref") || url.searchParams.get("aff"));
  if (fromUrl) return { code: fromUrl, source: "url" };

  // Cookie
  const cookieStore = cookies();
  const fromCookie = normalizeCode(cookieStore.get("d2c_ref")?.value || "");
  if (fromCookie) return { code: fromCookie, source: "cookie" };

  // Session
  const fromSession = normalizeCode(sessionAffiliateUsed);
  if (fromSession) return { code: fromSession, source: "session" };

  return {};
}

/**
 * Verifica a validade do código e a configuração do cupom (10% once).
 * Bloqueia self-referral (usuário não pode usar o próprio código).
 */
async function checkAffiliateCode(
  affiliateCode: string | undefined,
  currency: Currency,
  currentUserId: string
): Promise<AffiliateCheckResult> {
  const code = normalizeCode(affiliateCode);
  if (!code) return {};

  // Dono do código
  const owner = await User.findOne({ affiliateCode: code }).select("_id affiliateCode").lean();
  if (!owner) {
    return { error: "invalid_code", code };
  }

  // Bloqueio de self-referral
  if (String(owner._id) === String(currentUserId)) {
    return { error: "self_referral", code };
  }

  const couponEnvKey = `STRIPE_COUPON_AFFILIATE10_ONCE_${currency.toUpperCase()}`;
  const couponId = process.env[couponEnvKey as keyof NodeJS.ProcessEnv] as string | undefined;

  if (!couponId) {
    console.error(
      `[billing/preview] CRITICAL: Cupom de afiliado não configurado para ${currency}. Defina ${couponEnvKey}.`
    );
    return { error: "coupon_not_configured", code };
  }

  return { couponId, code };
}

function sumDiscounts(inv: any): number {
  const a: any[] = Array.isArray(inv?.discount_amounts) ? inv.discount_amounts : [];
  const b: any[] = Array.isArray(inv?.total_discount_amounts) ? inv.total_discount_amounts : [];
  const sa = a.reduce((acc, d) => acc + (d?.amount ?? 0), 0);
  const sb = b.reduce((acc, d) => acc + (d?.amount ?? 0), 0);
  return sa || sb || 0;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: noStoreHeaders });
    }

    await connectToDatabase();

    const { plan, currency, affiliateCode: bodyAffiliateCode } = await req.json();
    const planNorm = String(plan || "").toLowerCase() as Plan;
    const currencyNorm = (String(currency || "BRL").toUpperCase() === "USD" ? "USD" : "BRL") as Currency;

    if (!["monthly", "annual"].includes(planNorm) || !["BRL", "USD"].includes(currencyNorm)) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400, headers: noStoreHeaders });
    }

    const { code: resolvedCode, source } = resolveAffiliateFromRequest(
      req,
      bodyAffiliateCode,
      (session.user as any)?.affiliateUsed
    );

    const priceId = getPriceId(planNorm, currencyNorm);
    const customerId = await getOrCreateStripeCustomerId(session.user.id);

    // Validação do código + cupom
    const affiliateCheck = await checkAffiliateCode(resolvedCode, currencyNorm, session.user.id);

    if (affiliateCheck.error === "invalid_code") {
      return NextResponse.json(
        { code: "INVALID_CODE", error: "Código de afiliado inválido.", affiliateApplied: false },
        { status: 400, headers: noStoreHeaders }
      );
    }
    if (affiliateCheck.error === "self_referral") {
      return NextResponse.json(
        { code: "SELF_REFERRAL", error: "Você não pode usar seu próprio código de afiliado.", affiliateApplied: false },
        { status: 400, headers: noStoreHeaders }
      );
    }
    if (affiliateCheck.error === "coupon_not_configured") {
      return NextResponse.json(
        { code: "COUPON_NOT_CONFIGURED", error: "O sistema de cupons não está configurado corretamente." },
        { status: 500, headers: noStoreHeaders }
      );
    }

    const affiliateCouponId = affiliateCheck.couponId;

    // ✅ trial_end a partir do env TRIAL_DAYS (apenas se > 0)
    const trialDays = Number.parseInt(process.env.TRIAL_DAYS ?? "7", 10);
    const trialEnd =
      Number.isFinite(trialDays) && trialDays > 0
        ? Math.floor(Date.now() / 1000) + trialDays * 24 * 60 * 60
        : undefined;

    // ✅ Basil: usar Create Preview Invoice (API 2025-07-30.basil)
    // Forçamos o tipo para o overload correto usando `satisfies`.
    const params = {
      customer: customerId,
      subscription_details: {
        items: [{ price: priceId, quantity: 1 }],
        ...(trialEnd ? { trial_end: trialEnd } : {}),
        ...(affiliateCouponId ? { discounts: [{ coupon: affiliateCouponId }] } : {}),
      },
    } satisfies Stripe.InvoiceCreatePreviewParams;

    const invoice = await stripe.invoices.createPreview(params);

    // valor nominal do próximo ciclo (sem proration): usa o price direto
    const price = await stripe.prices.retrieve(priceId);
    let nextCycleAmount = price.unit_amount ?? 0;

    // Se houver cupom de afiliado, aplica o desconto manualmente
    if (affiliateCouponId) {
      try {
        const coupon = await stripe.coupons.retrieve(affiliateCouponId);
        if (coupon.percent_off) {
          nextCycleAmount = Math.round(
            nextCycleAmount * (1 - coupon.percent_off / 100)
          );
        } else if (coupon.amount_off) {
          const priceCurrency = (price.currency || "").toString().toUpperCase();
          const couponCurrency = (coupon.currency || "").toString().toUpperCase();
          if (!couponCurrency || couponCurrency === priceCurrency) {
            nextCycleAmount = Math.max(nextCycleAmount - coupon.amount_off, 0);
          }
        }
      } catch (err) {
        console.error("[billing/preview] failed to retrieve coupon", err);
      }
    }

    const currencyUpper = (invoice.currency || currencyNorm).toString().toUpperCase();

    return NextResponse.json(
      {
        currency: currencyUpper,
        subtotal: (invoice as any).subtotal ?? 0,
        discountsTotal: sumDiscounts(invoice),
        tax: (invoice as any).tax ?? 0,
        total: (invoice as any).total ?? 0,
        nextCycleAmount,
        affiliateApplied: !!affiliateCouponId,
        affiliateSource: source || null,
        affiliateCode: affiliateCheck.code || null,
      },
      { headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("[billing/preview] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders });
  }
}
