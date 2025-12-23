// src/app/api/billing/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import Stripe from "stripe";
import crypto from "crypto";
import { checkRateLimit } from "@/utils/rateLimit";
import { getOrCreateStripeCustomerId } from "@/utils/stripeHelpers";
import { resolveAffiliateCode as resolveAffiliateCodeHelper } from "@/app/lib/affiliate";
import { logger } from "@/app/lib/logger";

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

function buildIdempotencyKey(params: {
  scope: "sub_create" | "checkout_session";
  userId: string;
  priceId: string;
  plan: Plan;
  currency: Currency;
  affiliateCode?: string;
}) {
  const bucket = Math.floor(Date.now() / (1000 * 60 * 5)); // 5 min window
  const raw = [
    params.scope,
    params.userId,
    params.priceId,
    params.plan,
    params.currency,
    params.affiliateCode || "",
    String(bucket),
  ].join(":");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function getStripeRequestId(obj: unknown): string | null {
  return (obj as any)?.lastResponse?.requestId ?? null;
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

    if (!["monthly", "annual"].includes(plan) || !["BRL", "USD"].includes(currency)) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    const userId = String(user._id);
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
        } catch {
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

    if (dbStatus === "pending" || dbStatus === "incomplete") {
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

    const subsList = await stripe.subscriptions.list({
      customer: customerId!,
      status: "all",
      limit: 10,
    });

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

    let sub: Stripe.Subscription;
    let affiliateOwner: any = null;
    let discounts: Stripe.SubscriptionCreateParams.Discount[] | undefined = undefined;

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

      // --- INÍCIO DA CORREÇÃO 1 (COMISSÃO) ---
      // Atribui e salva a afiliação ANTES de criar a assinatura no Stripe
      if (!user.affiliateUsed) {
        user.affiliateUsed = affiliateCode!;
        await user.save(); // Garante que o dado esteja no DB para o webhook
      }
      // --- FIM DA CORREÇÃO 1 ---

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

    sub = await stripe.subscriptions.create({
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

    const affiliateApplied = Boolean(affiliateOwner);
    const usedCouponType = affiliateApplied ? "affiliate" : (typedCode ? "manual" : null);

    let checkoutUrl: string | null = null;
    let checkoutRequestId: string | null = null;

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
          metadata: {
            userId: String(user._id),
            plan,
            ...(affiliateOwner && affiliateCode
              ? { affiliateCode, affiliate_user_id: String(affiliateOwner._id) }
              : {}),
            ...(source ? { attribution_source: String(source) } : {}),
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
        }),
      });

      checkoutUrl = sessionCheckout.url ?? null;
      checkoutRequestId = getStripeRequestId(sessionCheckout);

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

    const statusForDb = sub.status === "incomplete" ? "pending" : (sub.status as any);

    user.planStatus = statusForDb as any;
    user.planType = plan;
    user.planInterval = planInterval;
    user.stripePriceId = priceId;
    user.cancelAtPeriodEnd = false;
    user.planExpiresAt = resolvedExpiresAt;
    (user as any).lastPaymentError = null;

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
