// /src/app/api/billing/preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import { getOrCreateStripeCustomerId } from "@/utils/stripeHelpers";
import { AffiliateBuyerCommissionIndex } from "@/server/db/models/AffiliateIndexes";
import {
  D2C_VIP_DISPLAY_CODE,
  isD2cVipPromotionCode,
  normalizePromotionCode,
} from "@/app/lib/billing/d2cVipPromotion";
import {
  checkVipCampaignWindow,
  vipCampaignMessage,
} from "@/app/lib/billing/d2cVipCampaign";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" } as const;

async function loadAuthOptions() {
  if (process.env.NODE_ENV === "test") {
    return {} as any;
  }
  const mod = await import("@/app/api/auth/[...nextauth]/route");
  return mod.authOptions as any;
}

// --- Tipos para clareza ---
type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";
type AffiliateCheckResult = {
  error?: "invalid_code" | "self_referral";
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
async function readAffiliateCookie(): Promise<string> {
  const mod = await import('next/headers');
  return normalizeCode((await mod.cookies()).get('d2c_ref')?.value || '');
}

async function resolveAffiliateFromRequest(
  req: NextRequest,
  bodyAffiliateCode?: string,
  sessionAffiliateUsed?: string
): Promise<{ code?: string; source?: "typed" | "url" | "cookie" | "session" }> {
  const typed = normalizeCode(bodyAffiliateCode);
  if (typed) return { code: typed, source: "typed" };

  // URL
  const url = new URL(req.url);
  const fromUrl = normalizeCode(url.searchParams.get("ref") || url.searchParams.get("aff"));
  if (fromUrl) return { code: fromUrl, source: "url" };

  // Cookie
  const fromCookie = await readAffiliateCookie();
  if (fromCookie) return { code: fromCookie, source: "cookie" };

  // Session
  const fromSession = normalizeCode(sessionAffiliateUsed);
  if (fromSession) return { code: fromSession, source: "session" };

  return {};
}

/**
 * Verifica a validade do código de afiliado.
 * Bloqueia self-referral (usuário não pode usar o próprio código).
 */
async function checkAffiliateCode(
  affiliateCode: string | undefined,
  currentUserId: string
): Promise<AffiliateCheckResult> {
  const code = normalizeCode(affiliateCode);
  if (!code) return {};

  // Dono do código
  const owner = await User.findOne({
    affiliateCode: code,
    $or: [{ affiliateStatus: "active" }, { affiliateStatus: null }],
  }).select("_id affiliateCode").lean();
  if (!owner) {
    return { error: "invalid_code", code };
  }

  // Bloqueio de self-referral
  if (String(owner._id) === String(currentUserId)) {
    return { error: "self_referral", code };
  }

  return { code };
}

/**
 * Um cupom com `first_time_transaction` só vale para quem nunca pagou nada.
 * Faturas de R$ 0 (o próprio benefício do cupom) não desqualificam ninguém.
 */
async function customerHasPaidBefore(customerId: string): Promise<boolean> {
  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      status: "paid",
      limit: 20,
    });
    return invoices.data.some((invoice) => (invoice.amount_paid ?? 0) > 0);
  } catch {
    return false;
  }
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
    const authOptions = await loadAuthOptions();
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: noStoreHeaders });
    }

    await connectToDatabase();

    const {
      plan,
      currency,
      affiliateCode: bodyAffiliateCode,
      promotionCode: bodyPromotionCode,
    } = await req.json();
    const planNorm = String(plan || "").toLowerCase() as Plan;
    const currencyNorm = (String(currency || "BRL").toUpperCase() === "USD" ? "USD" : "BRL") as Currency;
    const promotionCode = normalizePromotionCode(
      bodyPromotionCode || (isD2cVipPromotionCode(bodyAffiliateCode) ? bodyAffiliateCode : ""),
    );
    const affiliateCodeInput = promotionCode ? undefined : bodyAffiliateCode;

    if (!["monthly", "annual"].includes(planNorm) || !["BRL", "USD"].includes(currencyNorm)) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400, headers: noStoreHeaders });
    }

    if (isD2cVipPromotionCode(promotionCode) && planNorm !== "monthly") {
      return NextResponse.json(
        {
          code: "PROMOTION_NOT_AVAILABLE_FOR_PLAN",
          error: `O cupom ${D2C_VIP_DISPLAY_CODE} é válido apenas para o plano mensal.`,
          promotionApplied: false,
        },
        { status: 422, headers: noStoreHeaders },
      );
    }

    const buyer = await User.findById(session.user.id)
      .select("affiliateUsed affiliateFirstCommissionAt")
      .lean();

    const { code: requestedCode, source: requestedSource } = await resolveAffiliateFromRequest(
      req,
      affiliateCodeInput,
      (buyer as any)?.affiliateUsed || (session.user as any)?.affiliateUsed
    );

    // A primeira atribuição é canônica. Parâmetros/cookies posteriores não
    // podem trocar o afiliado que receberá a comissão.
    const existingCode = normalizeCode((buyer as any)?.affiliateUsed);
    const resolvedCode = existingCode || requestedCode;
    const source = existingCode ? "session" : requestedSource;

    if (resolvedCode) {
      const commissionAlreadyConsumed = Boolean(
        (buyer as any)?.affiliateFirstCommissionAt ||
          (await AffiliateBuyerCommissionIndex.exists({ buyerUserId: session.user.id }))
      );
      if (commissionAlreadyConsumed) {
        return NextResponse.json(
          {
            code: "AFFILIATE_BENEFIT_ALREADY_USED",
            error: "A indicação de afiliado já foi utilizada nesta conta.",
            affiliateApplied: false,
          },
          { status: 409, headers: noStoreHeaders },
        );
      }
    }

    const priceId = getPriceId(planNorm, currencyNorm);
    const customerId = await getOrCreateStripeCustomerId(session.user.id);

    // O código atribui a comissão ao afiliado, sem alterar o preço do plano.
    const affiliateCheck = await checkAffiliateCode(resolvedCode, session.user.id);

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
    let promotionCodeId: string | null = null;
    if (promotionCode) {
      const promotionCodes = await stripe.promotionCodes.list({
        code: promotionCode,
        active: true,
        limit: 1,
      });
      const foundPromotionCode = promotionCodes.data[0] ?? null;
      promotionCodeId = foundPromotionCode?.id ?? null;
      if (!promotionCodeId) {
        return NextResponse.json(
          { code: "INVALID_CODE", error: "Cupom inválido ou expirado.", promotionApplied: false },
          { status: 422, headers: noStoreHeaders },
        );
      }

      // Teto e validade da campanha vivem em env, não no Stripe: ele não aceita
      // acrescentá-los a um código já criado.
      if (isD2cVipPromotionCode(promotionCode)) {
        const window = checkVipCampaignWindow({ promotionCode: foundPromotionCode });
        if (!window.available) {
          return NextResponse.json(
            {
              code: "PROMOTION_CAMPAIGN_CLOSED",
              error: vipCampaignMessage(window.reason),
              promotionApplied: false,
            },
            { status: 422, headers: noStoreHeaders },
          );
        }
      }

      // Sem esta checagem o createPreview abaixo estoura e o usuário recebe
      // um 500 com a mensagem do Stripe em inglês.
      if (
        (foundPromotionCode as any)?.restrictions?.first_time_transaction &&
        (await customerHasPaidBefore(customerId))
      ) {
        return NextResponse.json(
          {
            code: "PROMOTION_NOT_ELIGIBLE",
            error: `O cupom ${D2C_VIP_DISPLAY_CODE} vale apenas para a primeira assinatura.`,
            promotionApplied: false,
          },
          { status: 422, headers: noStoreHeaders },
        );
      }
    }

    // ✅ Basil: usar Create Preview Invoice
    const invoice = await stripe.invoices.createPreview({
      customer: customerId,
      subscription_details: {
        items: [{ price: priceId, quantity: 1 }],
      },
      ...(promotionCodeId ? { discounts: [{ promotion_code: promotionCodeId }] } : {}),
    });

    // valor nominal do próximo ciclo (sem proration): usa o price direto
    const price = await stripe.prices.retrieve(priceId);
    const nextCycleAmount = price.unit_amount ?? 0;

    const currencyUpper = (invoice.currency || currencyNorm).toString().toUpperCase();

    return NextResponse.json(
      {
        currency: currencyUpper,
        subtotal: (invoice as any).subtotal ?? 0,
        discountsTotal: sumDiscounts(invoice),
        tax: (invoice as any).tax ?? 0,
        total: (invoice as any).total ?? 0,
        nextCycleAmount,
        affiliateApplied: Boolean(affiliateCheck.code),
        promotionApplied: Boolean(promotionCodeId),
        affiliateSource: source || null,
        affiliateCode: affiliateCheck.code || null,
        promotionCode: promotionCodeId ? D2C_VIP_DISPLAY_CODE : null,
      },
      { headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("[billing/preview] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders });
  }
}
