// src/app/api/billing/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import Stripe from "stripe";
import crypto from "crypto";
import { checkRateLimit } from "@/utils/rateLimit";
import {
  getOrCreateStripeCustomerId,
  isStripeResourceMissingError,
  persistStaleStripeBillingPatch,
} from "@/utils/stripeHelpers";
import { resolveAffiliateCode as resolveAffiliateCodeHelper } from "@/app/lib/affiliate";
import { logger } from "@/app/lib/logger";
import { AffiliateBuyerCommissionIndex } from '@/server/db/models/AffiliateIndexes';
import {
  D2C_VIP_DISPLAY_CODE,
  isD2cVipPromotionCode,
  normalizePromotionCode,
} from "@/app/lib/billing/d2cVipPromotion";
import {
  checkVipCampaignWindow,
  vipCampaignMessage,
} from "@/app/lib/billing/d2cVipCampaign";
import { TAX_ID_INVALID_MESSAGE, parseTaxId } from "@/app/lib/billing/taxId";
import { formatChargeDate, resolveFirstChargeDate } from "@/app/lib/billing/firstCharge";
import { syncTaxIdToStripe } from "@/app/lib/billing/syncTaxIdToStripe";

export const runtime = "nodejs";

type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";

type SessionWithUserId = { user?: { id?: string | null; email?: string | null } } | null;

async function loadAuthOptions() {
  if (process.env.NODE_ENV === "test") {
    return {} as any;
  }
  const mod = await import("@/app/api/auth/[...nextauth]/route");
  return mod.authOptions as any;
}

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

function resolveCheckoutRedirectUrl(
  rawValue: unknown,
  options: { appBaseUrl: string; fallbackPath: string }
) {
  const fallbackUrl = new URL(options.fallbackPath, options.appBaseUrl).toString();
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return fallbackUrl;
  }

  try {
    const requestedUrl = new URL(rawValue, options.appBaseUrl);
    const allowedOrigin = new URL(options.appBaseUrl).origin;
    if (requestedUrl.origin !== allowedOrigin) {
      return fallbackUrl;
    }
    return requestedUrl.toString();
  } catch {
    return fallbackUrl;
  }
}

function resolveHostedCheckoutSuccessUrl(
  rawValue: unknown,
  options: { appBaseUrl: string }
) {
  const resolved = resolveCheckoutRedirectUrl(rawValue, {
    appBaseUrl: options.appBaseUrl,
    fallbackPath: "/billing/success?session_id={CHECKOUT_SESSION_ID}",
  });
  const url = new URL(resolved);
  if (!url.searchParams.has("session_id")) {
    url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  }
  // URLSearchParams codifica as chaves; a Stripe exige este placeholder literal.
  return url
    .toString()
    .replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}");
}

function buildIdempotencyKey(params: {
  scope: "sub_create" | "checkout_session";
  userId: string;
  priceId: string;
  plan: Plan;
  currency: Currency;
  affiliateCode?: string;
  promotionCode?: string;
}) {
  const bucket = Math.floor(Date.now() / (1000 * 60 * 5)); // 5 min window
  const raw = [
    params.scope,
    params.userId,
    params.priceId,
    params.plan,
    params.currency,
    params.affiliateCode || "",
    params.promotionCode || "",
    String(bucket),
  ].join(":");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function getStripeRequestId(obj: unknown): string | null {
  return (obj as any)?.lastResponse?.requestId ?? null;
}

/**
 * Coleta de CPF/CNPJ no Checkout hospedado. O `customer_update` é exigido pelo
 * Stripe para gravar o que foi coletado num customer que já existe — sem ele a
 * criação da sessão falha.
 */
const HOSTED_CHECKOUT_TAX_ID_COLLECTION = {
  tax_id_collection: { enabled: true, required: "if_supported" },
  customer_update: { name: "auto", address: "auto" },
} as const satisfies Partial<Stripe.Checkout.SessionCreateParams>;

/** Erro do Stripe ao recusar um cupom por restrição (elegibilidade, validade, produto). */
function isPromotionRestrictionError(error: unknown): boolean {
  const err = error as any;
  if (err?.type !== "StripeInvalidRequestError") return false;
  const param = String(err?.param ?? "");
  const message = String(err?.raw?.message ?? err?.message ?? "").toLowerCase();
  return (
    param.includes("discounts") ||
    param.includes("promotion_code") ||
    param.includes("coupon") ||
    message.includes("promotion code") ||
    message.includes("coupon")
  );
}

type ManualDiscountResolution =
  | { ok: true; discounts: Stripe.SubscriptionCreateParams.Discount[] }
  | { ok: false; reason: "not_found" | "first_time_only" | "expired" | "sold_out" };

/**
 * Um cupom com `first_time_transaction` só vale para quem nunca pagou nada.
 * O Stripe considera "transação" uma cobrança real, então uma fatura de R$ 0
 * (o próprio benefício do d2cVIP) não desqualifica ninguém.
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
    // Na dúvida, deixa o Stripe decidir no momento do checkout.
    return false;
  }
}

async function resolveManualDiscountFields(
  code: string,
  customerId?: string | null
): Promise<ManualDiscountResolution> {
  const trimmed = normalizeCode(code);
  if (!trimmed) return { ok: false, reason: "not_found" };

  try {
    const res = await stripe.promotionCodes.list({ code: trimmed, active: true, limit: 1 });
    const pc = res.data?.[0];
    if (pc?.id) {
      // Teto e validade da campanha são nossos: o Stripe não aceita acrescentá-los
      // a um código que já existe.
      if (isD2cVipPromotionCode(trimmed)) {
        const window = checkVipCampaignWindow({ promotionCode: pc });
        if (!window.available) {
          return { ok: false, reason: window.reason };
        }
      }
      const firstTimeOnly = Boolean((pc as any)?.restrictions?.first_time_transaction);
      if (firstTimeOnly && customerId && (await customerHasPaidBefore(customerId))) {
        return { ok: false, reason: "first_time_only" };
      }
      return { ok: true, discounts: [{ promotion_code: pc.id }] };
    }
  } catch { /* noop */ }

  try {
    const c = await stripe.coupons.retrieve(trimmed as string);
    const isDeleted = (c as any)?.deleted === true;
    if ((c as any)?.id && !isDeleted) {
      return { ok: true, discounts: [{ coupon: (c as any).id }] };
    }
  } catch { /* noop */ }

  return { ok: false, reason: "not_found" };
}

type ResolvedAffiliate =
  | { code: string | null; source: "typed" | "url" | "cookie" | null }
  | { code: undefined; source: undefined };

async function readAffiliateCookie(): Promise<string> {
  const mod = await import('next/headers');
  return normalizeCode((await mod.cookies()).get('d2c_ref')?.value || '');
}

async function resolveAffiliateCodeFallback(req: NextRequest, bodyCode?: string): Promise<ResolvedAffiliate> {
  const typed = normalizeCode(bodyCode);
  if (typed) return { code: typed, source: "typed" };

  const url = new URL(req.url);
  const fromUrl = normalizeCode(url.searchParams.get("ref") || url.searchParams.get("aff"));
  if (fromUrl) return { code: fromUrl, source: "url" };

  const fromCookie = await readAffiliateCookie();
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
    const authOptions = await loadAuthOptions();
    const session = (await getServerSession(authOptions as any)) as SessionWithUserId;
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
    const { allowed: lockAllowed } = await checkRateLimit(
      `subscribe_lock:${session.user.id}`,
      1,
      15
    );
    if (!lockAllowed) {
      logger.info("billing_subscribe_locked", {
        endpoint: "POST /api/billing/subscribe",
        userId: session.user.id,
        customerId: null,
        subscriptionId: null,
        statusDb: null,
        statusStripe: null,
        errorCode: "BILLING_IN_PROGRESS",
        stripeRequestId: null,
      });
      return NextResponse.json(
        {
          code: "BILLING_IN_PROGRESS",
          message: "Já existe uma tentativa de assinatura em andamento. Aguarde alguns segundos.",
        },
        { status: 409 }
      );
    }

    const body = await req.json();
    const plan: Plan = String(body.plan || "").toLowerCase() as Plan;
    const currency = String(body.currency || "").toUpperCase() as Currency;
    const requestedPromotionCode = normalizePromotionCode(body.promotionCode);

    if (!["monthly", "annual"].includes(plan) || !["BRL", "USD"].includes(currency)) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    if (isD2cVipPromotionCode(requestedPromotionCode) && plan !== "monthly") {
      return NextResponse.json(
        {
          code: "PROMOTION_NOT_AVAILABLE_FOR_PLAN",
          message: `O cupom ${D2C_VIP_DISPLAY_CODE} é válido apenas para o plano mensal.`,
        },
        { status: 422 },
      );
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    const userId = String(user._id);

    // CPF/CNPJ: sem documento não há nota fiscal, e o único momento em que dá
    // para pedir com a pessoa presente é agora. Aceita o que já está salvo,
    // para quem volta a assinar não precisar digitar de novo.
    const incomingTaxId = parseTaxId(body.taxId);
    if (body.taxId !== undefined && !incomingTaxId) {
      return NextResponse.json(
        { code: "INVALID_TAX_ID", message: TAX_ID_INVALID_MESSAGE },
        { status: 422 },
      );
    }
    if (incomingTaxId && (user as any).taxId !== incomingTaxId.value) {
      (user as any).taxId = incomingTaxId.value;
      (user as any).taxIdType = incomingTaxId.type;
      (user as any).taxIdUpdatedAt = new Date();
      await user.save();
    }

    const dbStatusRaw = (user as any).planStatus ?? null;
    const dbStatus = typeof dbStatusRaw === "string" ? dbStatusRaw.toLowerCase() : "";
    const dbCancelAtPeriodEnd = Boolean((user as any).cancelAtPeriodEnd);
    const dbStatusIsActive =
      dbStatus === "active" || dbStatus === "trialing" || dbStatus === "trial";
    const dbStatusIsTrial = dbStatus === "trial" || dbStatus === "trialing";

    if (dbStatus === "non_renewing" || dbCancelAtPeriodEnd) {
      let stripeStatus: string | null = null;
      let stripeCancelAtPeriodEnd = false;
      let shouldSave = false;

      if ((user as any).stripeSubscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve((user as any).stripeSubscriptionId, {
            expand: ["items.data.price"],
          } as any);
          stripeStatus = typeof sub.status === "string" ? sub.status : null;
          stripeCancelAtPeriodEnd = Boolean((sub as any).cancel_at_period_end);

          if (stripeStatus) {
            const normalizedStatus =
              stripeStatus === "incomplete" ? "pending" : stripeStatus;
            if ((user as any).planStatus !== normalizedStatus) {
              (user as any).planStatus = normalizedStatus as any;
              shouldSave = true;
            }
            if (stripeCancelAtPeriodEnd !== Boolean((user as any).cancelAtPeriodEnd)) {
              (user as any).cancelAtPeriodEnd = stripeCancelAtPeriodEnd;
              shouldSave = true;
            }
          }
        } catch (error) {
          if (isStripeResourceMissingError(error, "subscription")) {
            (user as any).stripeSubscriptionId = null;
            shouldSave = true;
          }
          stripeStatus = null;
        }
      }

      if (stripeStatus) {
        if (
          (stripeStatus === "active" || stripeStatus === "trialing") &&
          stripeCancelAtPeriodEnd
        ) {
          if (shouldSave) await user.save();
          logger.info("billing_subscribe_blocked_db_non_renewing", {
            endpoint: "POST /api/billing/subscribe",
            userId,
            customerId: (user as any).stripeCustomerId ?? null,
            subscriptionId: (user as any).stripeSubscriptionId ?? null,
            statusDb: dbStatus || "non_renewing",
            statusStripe: stripeStatus,
            errorCode: "SUBSCRIPTION_NON_RENEWING_DB",
            stripeRequestId: null,
          });
          return NextResponse.json(
            {
              code: "SUBSCRIPTION_NON_RENEWING_DB",
              message:
                "Sua assinatura está com cancelamento agendado. Reative em Billing antes de assinar novamente.",
            },
            { status: 409 }
          );
        }

        if (
          stripeStatus === "canceled" ||
          stripeStatus === "incomplete_expired" ||
          stripeStatus === "past_due" ||
          stripeStatus === "unpaid" ||
          stripeStatus === "incomplete" ||
          stripeStatus === "active" ||
          stripeStatus === "trialing"
        ) {
          if (shouldSave) await user.save();
        }
      }
    }

    if (dbStatusIsActive && !dbCancelAtPeriodEnd) {
      logger.info("billing_subscribe_blocked_db_active", {
        endpoint: "POST /api/billing/subscribe",
        userId,
        customerId: (user as any).stripeCustomerId ?? null,
        subscriptionId: (user as any).stripeSubscriptionId ?? null,
        statusDb: dbStatus || null,
        statusStripe: null,
        errorCode: "SUBSCRIPTION_ACTIVE_USE_CHANGE_PLAN",
        stripeRequestId: null,
      });
      return NextResponse.json(
        {
          code: "SUBSCRIPTION_ACTIVE_USE_CHANGE_PLAN",
          message: dbStatusIsTrial
            ? "Você está em período de teste. A troca de plano fica disponível após o trial."
            : "Você já possui uma assinatura ativa. Para trocar de plano, use a mudança de plano em Billing.",
          subscriptionId: (user as any).stripeSubscriptionId ?? null,
        },
        { status: 409 }
      );
    }

    if (dbStatus === "past_due" || dbStatus === "unpaid") {
      logger.info("billing_subscribe_blocked_db_payment_issue", {
        endpoint: "POST /api/billing/subscribe",
        userId,
        customerId: (user as any).stripeCustomerId ?? null,
        subscriptionId: (user as any).stripeSubscriptionId ?? null,
        statusDb: dbStatus,
        statusStripe: null,
        errorCode: "PAYMENT_ISSUE",
        stripeRequestId: null,
      });
      return NextResponse.json(
        {
          code: "PAYMENT_ISSUE",
          message:
            "Seu pagamento está pendente. Atualize o método de pagamento no portal de cobrança antes de assinar novamente.",
          subscriptionId: (user as any).stripeSubscriptionId ?? null,
        },
        { status: 409 }
      );
    }

    // Um checkout hospedado abandonado deixa o usuário "pending" sem assinatura
    // nenhuma para retomar. Nesse caso não há pendência real: limpa e segue,
    // em vez de trancá-lo fora da compra até achar "Resolver pendência".
    const hasOrphanPendingCheckout =
      (dbStatus === "pending" || dbStatus === "incomplete") &&
      !(user as any).stripeSubscriptionId;

    if (hasOrphanPendingCheckout) {
      (user as any).planStatus = "inactive";
      (user as any).pendingCheckoutSessionId = null;
      (user as any).pendingCheckoutExpiresAt = null;
      await user.save();
      logger.info("billing_subscribe_recovered_orphan_pending", {
        endpoint: "POST /api/billing/subscribe",
        userId,
        customerId: (user as any).stripeCustomerId ?? null,
        subscriptionId: null,
        statusDb: dbStatus,
        statusStripe: null,
        errorCode: null,
        stripeRequestId: null,
      });
    }

    if (!hasOrphanPendingCheckout && (dbStatus === "pending" || dbStatus === "incomplete")) {
      logger.info("billing_subscribe_blocked_db_pending", {
        endpoint: "POST /api/billing/subscribe",
        userId,
        customerId: (user as any).stripeCustomerId ?? null,
        subscriptionId: (user as any).stripeSubscriptionId ?? null,
        statusDb: dbStatus,
        statusStripe: null,
        errorCode: "BILLING_BLOCKED_PENDING_OR_INCOMPLETE",
        stripeRequestId: null,
      });
      return NextResponse.json(
        {
          code: "BILLING_BLOCKED_PENDING_OR_INCOMPLETE",
          message:
            "Existe um pagamento pendente. Retome o checkout ou aborte a tentativa em Billing.",
          subscriptionId: (user as any).stripeSubscriptionId ?? null,
        },
        { status: 409 }
      );
    }

    let resolved: ResolvedAffiliate = resolveAffiliateCodeHelper
      ? (await resolveAffiliateCodeHelper(req, body.affiliateCode) as ResolvedAffiliate)
      : { code: undefined, source: undefined };

    if (!resolved?.code) {
      resolved = await resolveAffiliateCodeFallback(req, body.affiliateCode);
    }

    const existingAffiliateCode = normalizeCode(user.affiliateUsed || undefined) || undefined;
    const affiliateCode: string | undefined =
      existingAffiliateCode || normalizeCode(resolved.code || undefined) || undefined;
    const source: "typed" | "url" | "cookie" | undefined = existingAffiliateCode
      ? undefined
      : (resolved as Extract<ResolvedAffiliate, { code: string | null }>).source || undefined;

    const typedCode = source === "typed" ? affiliateCode : undefined;
    const priceId = getPriceId(plan, currency);

    let customerId = await getOrCreateStripeCustomerId(user);

    // Documento no cliente do Stripe: aparece na fatura e no recibo dele.
    const storedTaxId = parseTaxId((user as any).taxId);
    if (storedTaxId) {
      await syncTaxIdToStripe(customerId, storedTaxId);
    }

    let subsList: Stripe.ApiList<Stripe.Subscription>;
    try {
      subsList = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });
    } catch (error) {
      if (!isStripeResourceMissingError(error, "customer")) {
        throw error;
      }

      await persistStaleStripeBillingPatch(user as any);
      customerId = await getOrCreateStripeCustomerId(user);
      subsList = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });
    }

    const activeSub = subsList.data.find((s) => ["active", "trialing"].includes(s.status));
    const nonRenewingSub = subsList.data.find(
      (s) =>
        ["active", "trialing"].includes(s.status) &&
        Boolean((s as any).cancel_at_period_end)
    );
    const delinquentSub = subsList.data.find((s) => ["past_due", "unpaid"].includes(s.status));
    const incompleteSub = subsList.data.find((s) => s.status === "incomplete");

    if (delinquentSub) {
      logger.info("billing_subscribe_blocked_payment_issue", {
        endpoint: "POST /api/billing/subscribe",
        userId,
        customerId,
        subscriptionId: delinquentSub.id,
        statusDb: dbStatus || null,
        statusStripe: delinquentSub.status,
        errorCode: "PAYMENT_ISSUE",
        stripeRequestId: getStripeRequestId(subsList),
      });
      return NextResponse.json(
        {
          code: "PAYMENT_ISSUE",
          message:
            "Seu pagamento está pendente. Atualize o método de pagamento no portal de cobrança antes de assinar novamente.",
          subscriptionId: delinquentSub.id,
        },
        { status: 409 }
      );
    }

    if (nonRenewingSub) {
      logger.info("billing_subscribe_blocked_non_renewing", {
        endpoint: "POST /api/billing/subscribe",
        userId,
        customerId,
        subscriptionId: nonRenewingSub.id,
        statusDb: dbStatus || null,
        statusStripe: nonRenewingSub.status,
        errorCode: "SUBSCRIPTION_NON_RENEWING",
        stripeRequestId: getStripeRequestId(subsList),
      });
      return NextResponse.json(
        {
          code: "SUBSCRIPTION_NON_RENEWING",
          message:
            "Sua assinatura está com cancelamento agendado. Reative em Billing antes de assinar novamente.",
          subscriptionId: nonRenewingSub.id,
        },
        { status: 409 }
      );
    }

    if (activeSub) {
      const code = dbStatusIsActive ? "SUBSCRIPTION_ACTIVE_USE_CHANGE_PLAN" : "SUBSCRIPTION_ACTIVE";
      const message = dbStatusIsActive
        ? dbStatusIsTrial
          ? "Você está em período de teste. A troca de plano fica disponível após o trial."
          : "Você já possui uma assinatura ativa. Para trocar de plano, use a mudança de plano em Billing."
        : "Você já possui uma assinatura ativa. Gerencie sua assinatura em Billing.";
      const logEvent = dbStatusIsActive ? "billing_subscribe_blocked_db_active" : "billing_subscribe_blocked_active";
      logger.info(logEvent, {
        endpoint: "POST /api/billing/subscribe",
        userId,
        customerId,
        subscriptionId: activeSub.id,
        statusDb: dbStatus || null,
        statusStripe: activeSub.status,
        errorCode: code,
        stripeRequestId: getStripeRequestId(subsList),
      });
      return NextResponse.json(
        {
          code,
          message,
          subscriptionId: activeSub.id,
        },
        { status: 409 }
      );
    }

    if (incompleteSub) {
      logger.info("billing_subscribe_blocked_incomplete", {
        endpoint: "POST /api/billing/subscribe",
        userId,
        customerId,
        subscriptionId: incompleteSub.id,
        statusDb: dbStatus || null,
        statusStripe: incompleteSub.status,
        errorCode: "BILLING_BLOCKED_PENDING_OR_INCOMPLETE",
        stripeRequestId: getStripeRequestId(subsList),
      });
      return NextResponse.json(
        {
          code: "BILLING_BLOCKED_PENDING_OR_INCOMPLETE",
          message: "Existe um pagamento pendente. Retome o checkout ou aborte a tentativa em Billing.",
          subscriptionId: incompleteSub.id,
        },
        { status: 409 }
      );
    }

    let affiliateOwner: any = null;
    let discounts: Stripe.SubscriptionCreateParams.Discount[] | undefined = undefined;

    // --- FLUXO DE NOVA ASSINATURA ---
    if (affiliateCode) {
      affiliateOwner = await User.findOne({
        affiliateCode,
        $or: [{ affiliateStatus: 'active' }, { affiliateStatus: null }],
      }).select("_id affiliateCode affiliateStatus").lean();
    }

    if (affiliateOwner) {
      if (String(affiliateOwner._id) === String(user._id)) {
        return NextResponse.json(
          { code: "SELF_REFERRAL", message: "Você não pode usar seu próprio código." },
          { status: 400 }
        );
      }

      const commissionAlreadyConsumed = Boolean(
        user.affiliateFirstCommissionAt ||
          (await AffiliateBuyerCommissionIndex.exists({ buyerUserId: user._id }))
      );
      if (commissionAlreadyConsumed) {
        return NextResponse.json(
          {
            code: 'AFFILIATE_BENEFIT_ALREADY_USED',
            message: 'A indicação de afiliado já foi utilizada por esta conta.',
          },
          { status: 409 },
        );
      }

      // Salva a afiliação antes de criar a assinatura para que o webhook encontre
      // o vínculo correto. O link não aplica desconto ao preço do assinante.
      if (!user.affiliateUsed) {
        user.affiliateUsed = affiliateCode!;
        await user.save();
      }
    }

    const legacyPromotionCode = !affiliateOwner ? typedCode : undefined;
    const promotionCode = requestedPromotionCode || legacyPromotionCode;

    if (isD2cVipPromotionCode(promotionCode) && plan !== "monthly") {
      return NextResponse.json(
        {
          code: "PROMOTION_NOT_AVAILABLE_FOR_PLAN",
          message: `O cupom ${D2C_VIP_DISPLAY_CODE} é válido apenas para o plano mensal.`,
        },
        { status: 422 },
      );
    }

    if (promotionCode) {
      const manual = await resolveManualDiscountFields(promotionCode, customerId);
      if (!manual.ok) {
        if (manual.reason === "expired" || manual.reason === "sold_out") {
          logger.info("billing_subscribe_promotion_campaign_closed", {
            endpoint: "POST /api/billing/subscribe",
            userId,
            customerId,
            subscriptionId: null,
            statusDb: dbStatus || null,
            statusStripe: null,
            promotionCode,
            errorCode: "PROMOTION_CAMPAIGN_CLOSED",
            stripeRequestId: null,
          });
          return NextResponse.json(
            {
              code: "PROMOTION_CAMPAIGN_CLOSED",
              message: vipCampaignMessage(manual.reason),
            },
            { status: 422 },
          );
        }
        if (manual.reason === "first_time_only") {
          logger.info("billing_subscribe_promotion_not_eligible", {
            endpoint: "POST /api/billing/subscribe",
            userId,
            customerId,
            subscriptionId: null,
            statusDb: dbStatus || null,
            statusStripe: null,
            promotionCode,
            errorCode: "PROMOTION_NOT_ELIGIBLE",
            stripeRequestId: null,
          });
          return NextResponse.json(
            {
              code: "PROMOTION_NOT_ELIGIBLE",
              message: `O cupom ${D2C_VIP_DISPLAY_CODE} vale apenas para a primeira assinatura.`,
            },
            { status: 422 },
          );
        }
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
    if (promotionCode) metadata.promotionCode = promotionCode;

    const affiliateApplied = Boolean(affiliateOwner);
    const usedCouponType = promotionCode ? "manual" : (affiliateApplied ? "affiliate" : null);

    // Uma assinatura com primeira fatura 100% descontada não gera PaymentIntent.
    // Para o d2cVIP usamos Checkout hospedado e forçamos a coleta do cartão,
    // garantindo a cobrança automática do segundo mês em diante.
    if (isD2cVipPromotionCode(promotionCode)) {
      const firstChargeLabel = formatChargeDate(resolveFirstChargeDate());
      // Lido do Stripe, não fixo no código: o preço já foi reajustado antes e
      // uma mensagem prometendo o valor errado é pior que nenhuma mensagem.
      const monthlyPriceLabel = await (async () => {
        try {
          const price = await stripe.prices.retrieve(priceId);
          const amount = price.unit_amount;
          if (typeof amount !== "number") return null;
          return new Intl.NumberFormat(currency === "USD" ? "en-US" : "pt-BR", {
            style: "currency",
            currency: (price.currency ?? currency).toUpperCase(),
          }).format(amount / 100);
        } catch {
          return null;
        }
      })();
      const appBaseUrl = process.env.NEXTAUTH_URL || new URL(req.url).origin;
      const successUrl = resolveHostedCheckoutSuccessUrl(body.successUrl, { appBaseUrl });
      const cancelUrl = resolveCheckoutRedirectUrl(body.cancelUrl, {
        appBaseUrl,
        fallbackPath: "/dashboard/billing",
      });

      let sessionCheckout: Stripe.Checkout.Session;
      try {
        sessionCheckout = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: customerId!,
          line_items: [{ price: priceId, quantity: 1 }],
          payment_method_collection: "always",
          discounts: discounts as Stripe.Checkout.SessionCreateParams.Discount[],
          subscription_data: {
            metadata,
            // Aparece no resumo do pedido, ao lado do preço cheio.
            description: `Primeiro mês gratuito. A primeira cobrança será em ${firstChargeLabel}.`,
          },
          // O Stripe já mostra "R$ 0,00 hoje", mas o preço cheio aparece no
          // subtotal e é lido como cobrança. Esta linha, logo acima do botão,
          // não deixa dúvida sobre quando o dinheiro sai.
          custom_text: {
            submit: {
              message: monthlyPriceLabel
                ? `Hoje você não paga nada. A primeira cobrança de ${monthlyPriceLabel} será em ${firstChargeLabel}, e você pode cancelar antes disso.`
                : `Hoje você não paga nada. A primeira cobrança será em ${firstChargeLabel}, e você pode cancelar antes disso.`,
            },
          },
          // Só pede se ainda não temos: quem já informou não digita de novo.
          ...(storedTaxId ? {} : HOSTED_CHECKOUT_TAX_ID_COLLECTION),
          success_url: successUrl,
          cancel_url: cancelUrl,
          client_reference_id: String(user._id),
        }, {
          idempotencyKey: buildIdempotencyKey({
            scope: "checkout_session",
            userId: String(user._id),
            priceId,
            plan,
            currency,
            affiliateCode,
            promotionCode,
          }),
        });
      } catch (error) {
        // Restrições do cupom (ex.: first_time_transaction) só estouram aqui.
        // Sem esta tradução a mensagem crua do Stripe, em inglês, vaza na tela.
        if (isPromotionRestrictionError(error)) {
          logger.info("billing_subscribe_promotion_rejected_by_stripe", {
            endpoint: "POST /api/billing/subscribe",
            userId,
            customerId,
            subscriptionId: null,
            statusDb: dbStatus || null,
            statusStripe: null,
            promotionCode,
            errorCode: "PROMOTION_NOT_ELIGIBLE",
            stripeRequestId: null,
          });
          return NextResponse.json(
            {
              code: "PROMOTION_NOT_ELIGIBLE",
              message: `O cupom ${D2C_VIP_DISPLAY_CODE} vale apenas para a primeira assinatura.`,
            },
            { status: 422 },
          );
        }
        throw error;
      }

      if (!sessionCheckout.url) {
        return NextResponse.json(
          {
            code: "SUBSCRIBE_CHECKOUT_FAILED",
            message: "Não foi possível iniciar o checkout. Tente novamente.",
          },
          { status: 500 },
        );
      }

      // O status só muda quando o webhook confirmar o pagamento. Marcar
      // "pending" aqui trancava quem fechava a aba do Stripe sem concluir.
      user.planType = plan;
      user.planInterval = "month";
      user.stripePriceId = priceId;
      user.cancelAtPeriodEnd = false;
      user.planExpiresAt = null;
      user.stripeSubscriptionId = null;
      (user as any).pendingCheckoutSessionId = sessionCheckout.id ?? null;
      (user as any).pendingCheckoutExpiresAt =
        typeof sessionCheckout.expires_at === "number"
          ? new Date(sessionCheckout.expires_at * 1000)
          : null;
      (user as any).lastPaymentError = null;
      await user.save();

      logger.info("billing_subscribe_vip_checkout_initialized", {
        endpoint: "POST /api/billing/subscribe",
        userId,
        customerId,
        subscriptionId: null,
        statusDb: (user as any).planStatus ?? null,
        statusStripe: null,
        promotionCode,
        errorCode: null,
        stripeRequestId: getStripeRequestId(sessionCheckout),
      });

      return NextResponse.json({
        checkoutUrl: sessionCheckout.url,
        subscriptionId: null,
        affiliateApplied,
        usedCouponType,
        promotionCode: D2C_VIP_DISPLAY_CODE,
      });
    }

    const sub = await stripe.subscriptions.create({
      customer: customerId!,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
      metadata,
      ...(discounts ? { discounts } : {}),
    }, {
      idempotencyKey: buildIdempotencyKey({
        scope: "sub_create",
        userId: String(user._id),
        priceId,
        plan,
        currency,
        affiliateCode,
        promotionCode,
      }),
    });

    let clientSecret = await extractClientSecretFromSubscription(sub);
    let refreshed: Stripe.Subscription | null = null;
    if (!clientSecret) {
      try {
        refreshed = await stripe.subscriptions.retrieve(sub.id, {
          expand: ["latest_invoice.payment_intent"],
        });
        clientSecret = await extractClientSecretFromSubscription(refreshed);
      } catch { /* noop */ }
    }

    let checkoutUrl: string | null = null;
    let checkoutRequestId: string | null = null;
    let checkoutSessionId: string | null = null;
    let checkoutExpiresAt: Date | null = null;

    if (!clientSecret) {
      if (sub.status !== "incomplete") {
        logger.warn("billing_subscribe_missing_client_secret", {
          endpoint: "POST /api/billing/subscribe",
          userId,
          customerId,
          subscriptionId: sub.id,
          statusDb: (user as any).planStatus ?? null,
          statusStripe: sub.status,
          errorCode: "SUBSCRIBE_NO_PAYMENT_INTENT",
          stripeRequestId: getStripeRequestId(refreshed ?? sub),
        });
        return NextResponse.json(
          {
            code: "SUBSCRIBE_NO_PAYMENT_INTENT",
            message: "Não foi possível iniciar o pagamento. Tente novamente.",
          },
          { status: 500 }
        );
      }

      try {
        await stripe.subscriptions.cancel(sub.id);
      } catch { /* noop */ }

      const appBaseUrl = process.env.NEXTAUTH_URL || new URL(req.url).origin;
      const successUrl = resolveHostedCheckoutSuccessUrl(body.successUrl, { appBaseUrl });
      const cancelUrl = resolveCheckoutRedirectUrl(body.cancelUrl, {
        appBaseUrl,
        fallbackPath: "/dashboard/billing",
      });

      const sessionCheckout = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId!,
        line_items: [{ price: priceId, quantity: 1 }],
        ...(discounts && discounts.length > 0
          ? { discounts: discounts as Stripe.Checkout.SessionCreateParams.Discount[] }
          : {}
        ),
        ...(storedTaxId ? {} : HOSTED_CHECKOUT_TAX_ID_COLLECTION),
        subscription_data: {
          metadata: {
            userId: String(user._id),
            plan,
            ...(affiliateOwner && affiliateCode
              ? { affiliateCode, affiliate_user_id: String(affiliateOwner._id) }
              : {}),
            ...(source ? { attribution_source: String(source) } : {}),
            ...(promotionCode ? { promotionCode } : {}),
          },
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: String(user._id),
      }, {
        idempotencyKey: buildIdempotencyKey({
          scope: "checkout_session",
          userId: String(user._id),
          priceId,
          plan,
          currency,
          affiliateCode,
          promotionCode,
        }),
      });

      checkoutUrl = sessionCheckout.url ?? null;
      checkoutRequestId = getStripeRequestId(sessionCheckout);
      checkoutSessionId = sessionCheckout.id ?? null;
      checkoutExpiresAt =
        typeof sessionCheckout.expires_at === "number"
          ? new Date(sessionCheckout.expires_at * 1000)
          : null;

      if (!checkoutUrl) {
        return NextResponse.json(
          {
            code: "SUBSCRIBE_CHECKOUT_FAILED",
            message: "Não foi possível iniciar o checkout. Tente novamente.",
          },
          { status: 500 }
        );
      }
    }

    const planInterval = plan === "annual" ? "year" : "month";
    const trialEndSec =
      typeof (sub as any).trial_end === "number" ? (sub as any).trial_end : null;
    const currentPeriodEndSec =
      typeof (sub as any).current_period_end === "number"
        ? (sub as any).current_period_end
        : null;
    const resolvedExpiresAt =
      sub.status === "incomplete"
        ? null
        : trialEndSec
        ? new Date(trialEndSec * 1000)
        : currentPeriodEndSec
        ? new Date(currentPeriodEndSec * 1000)
        : null;

    // Sem clientSecret a assinatura foi cancelada e o pagamento virou checkout
    // hospedado: não há nada para "retomar", então o status não vira pending.
    const statusForDb = clientSecret
      ? (sub.status === "incomplete" ? "pending" : (sub.status as any))
      : ((user as any).planStatus ?? "inactive");

    user.planStatus = statusForDb as any;
    user.planType = plan;
    user.planInterval = planInterval;
    user.stripePriceId = priceId;
    user.cancelAtPeriodEnd = false;
    user.planExpiresAt = resolvedExpiresAt;
    (user as any).lastPaymentError = null;
    (user as any).pendingCheckoutSessionId = clientSecret ? null : checkoutSessionId;
    (user as any).pendingCheckoutExpiresAt = clientSecret ? null : checkoutExpiresAt;

    user.stripeSubscriptionId = clientSecret ? sub.id : null;

    await user.save();

    logger.info("billing_subscribe_initialized", {
      endpoint: "POST /api/billing/subscribe",
      userId,
      customerId,
      subscriptionId: clientSecret ? sub.id : null,
      statusDb: statusForDb ?? (user as any).planStatus ?? null,
      statusStripe: sub.status ?? null,
      errorCode: null,
      stripeRequestId: clientSecret ? getStripeRequestId(refreshed ?? sub) : checkoutRequestId,
    });

    if (clientSecret) {
      return NextResponse.json({
        clientSecret,
        subscriptionId: sub.id,
        affiliateApplied,
        usedCouponType,
      });
    }

    return NextResponse.json({
      checkoutUrl,
      subscriptionId: null,
      affiliateApplied,
      usedCouponType,
    });
  } catch (err: any) {
    logger.error("[billing/subscribe] error", err);
    const msg =
      err?.raw?.message ||
      err?.message ||
      "Erro ao iniciar assinatura. Tente novamente.";
    return NextResponse.json({ code: "SubscribeError", message: msg }, { status: 400 });
  }
}
