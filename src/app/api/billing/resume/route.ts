// src/app/api/billing/resume/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import type Stripe from "stripe";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cacheHeader = { "Cache-Control": "no-store, max-age=0" } as const;

type SessionWithUserId = { user?: { id?: string | null } } | null;

async function loadAuthOptions() {
  if (process.env.NODE_ENV === "test") {
    return {} as any;
  }
  const mod = await import("@/app/api/auth/[...nextauth]/route");
  return mod.authOptions as any;
}

type InvoiceMaybePI = Stripe.Invoice & {
  payment_intent?: Stripe.PaymentIntent | string | null;
};

function getStripeRequestId(obj: unknown): string | null {
  return (obj as any)?.lastResponse?.requestId ?? null;
}

function coerceInterval(sub: Stripe.Subscription): "month" | "year" | null {
  const raw =
    sub.items?.data?.[0]?.price?.recurring?.interval ??
    (sub.items?.data?.[0] as any)?.plan?.interval;
  return raw === "month" || raw === "year" ? raw : null;
}

function getMinCurrentPeriodEnd(sub: Stripe.Subscription): Date | null {
  const secs = (sub.items?.data ?? [])
    .map((it) => (it as any)?.current_period_end)
    .filter((n: unknown): n is number => typeof n === "number");
  if (!secs.length) return null;
  return new Date(Math.min(...secs) * 1000);
}

function resolvePlanExpiresAt(sub: Stripe.Subscription): Date | null {
  const cancelAtSec = typeof (sub as any).cancel_at === "number" ? (sub as any).cancel_at : null;
  if (cancelAtSec != null) return new Date(cancelAtSec * 1000);

  const byItems = getMinCurrentPeriodEnd(sub);
  if (byItems) return byItems;

  const cpe = typeof (sub as any).current_period_end === "number" ? (sub as any).current_period_end : null;
  return cpe != null ? new Date(cpe * 1000) : null;
}

function syncUserFromSubscription(user: any, sub: Stripe.Subscription, opts?: { statusOverride?: string }) {
  const planInterval = coerceInterval(sub);
  const planExpiresAt = resolvePlanExpiresAt(sub);
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const planType =
    planInterval === "year" ? "annual" : planInterval === "month" ? "monthly" : undefined;

  user.stripeSubscriptionId = sub.id;
  user.stripePriceId = priceId;
  if (planInterval) user.planInterval = planInterval;
  if (planType) user.planType = planType;
  user.planStatus = (opts?.statusOverride ?? sub.status) as any;
  user.planExpiresAt = planExpiresAt ?? null;
  user.currentPeriodEnd = planExpiresAt ?? null;
  user.cancelAtPeriodEnd = Boolean((sub as any).cancel_at_period_end);
}

async function extractClientSecretFromSubscription(
  sub: Stripe.Subscription
): Promise<string | null> {
  try {
    if (sub.latest_invoice && typeof sub.latest_invoice !== "string") {
      const latestInv = sub.latest_invoice as InvoiceMaybePI;
      const pi = latestInv.payment_intent;
      if (pi && typeof pi !== "string" && pi.client_secret) return pi.client_secret;
    }

    const invoiceId =
      typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice?.id;

    if (invoiceId) {
      const invoice = (await stripe.invoices.retrieve(invoiceId, {
        expand: ["payment_intent"],
      })) as InvoiceMaybePI;
      const pi = invoice.payment_intent;
      if (pi && typeof pi !== "string" && pi.client_secret) return pi.client_secret;
    }
  } catch {
    /* noop */
  }

  return null;
}

function pickLatest(subs: Stripe.Subscription[]) {
  return subs.sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0] ?? null;
}

export async function POST() {
  try {
    const authOptions = await loadAuthOptions();
    const session = (await getServerSession(authOptions as any)) as SessionWithUserId;
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401, headers: cacheHeader });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ ok: false, message: "User not found" }, { status: 404, headers: cacheHeader });
    }

    let customerId = (user as any).stripeCustomerId ?? null;
    let subscription: Stripe.Subscription | null = null;
    let stripeRequestId: string | null = null;

    if (user.stripeSubscriptionId) {
      try {
        const sub = (await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ["latest_invoice.payment_intent", "items.data.price"],
        } as any)) as Stripe.Subscription;
        subscription = sub;
        if (!customerId && typeof sub.customer === "string") {
          customerId = sub.customer;
        }
        stripeRequestId = getStripeRequestId(sub);
      } catch {
        subscription = null;
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { ok: false, code: "NO_STRIPE_CUSTOMER", message: "Cliente Stripe não encontrado." },
        { status: 400, headers: cacheHeader }
      );
    }

    if (subscription) {
      if (subscription.status === "past_due" || subscription.status === "unpaid") {
        syncUserFromSubscription(user, subscription);
        (user as any).stripeCustomerId = customerId;
        await user.save();
        return NextResponse.json(
          {
            ok: false,
            code: "PAYMENT_ISSUE",
            message: "Pagamento pendente. Atualize o método de pagamento no portal de cobrança.",
          },
          { status: 409, headers: cacheHeader }
        );
      }
      if (subscription.status === "active" || subscription.status === "trialing") {
        syncUserFromSubscription(user, subscription);
        (user as any).stripeCustomerId = customerId;
        await user.save();
        return NextResponse.json(
          {
            ok: false,
            code: "SUBSCRIPTION_ACTIVE",
            message: "Assinatura já está ativa. Não há checkout pendente para retomar.",
          },
          { status: 409, headers: cacheHeader }
        );
      }
      if (subscription.status === "incomplete_expired") {
        syncUserFromSubscription(user, subscription);
        (user as any).planStatus = "incomplete_expired";
        (user as any).stripeCustomerId = customerId;
        await user.save();
        return NextResponse.json(
          {
            ok: false,
            code: "SUBSCRIPTION_INCOMPLETE_EXPIRED",
            message: "Tentativa expirada. Inicie um novo checkout.",
          },
          { status: 409, headers: cacheHeader }
        );
      }
      if (subscription.status !== "incomplete") {
        return NextResponse.json(
          {
            ok: false,
            code: "BILLING_RESUME_NOT_PENDING",
            message: "Nao ha checkout pendente para retomar. Inicie um novo checkout.",
          },
          { status: 409, headers: cacheHeader }
        );
      }
    }

    if (!subscription) {
      const list = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
        expand: ["data.latest_invoice.payment_intent", "data.items.data.price"],
      } as any);

      const active = list.data.find((s) => s.status === "active" || s.status === "trialing");
      const delinquent = list.data.find((s) => s.status === "past_due" || s.status === "unpaid");
      const pending = list.data.filter((s) => s.status === "incomplete");
      const expired = list.data.filter((s) => s.status === "incomplete_expired");

      stripeRequestId = getStripeRequestId(list);

      if (active) {
        syncUserFromSubscription(user, active);
        (user as any).stripeCustomerId = customerId;
        await user.save();
        return NextResponse.json(
          {
            ok: false,
            code: "SUBSCRIPTION_ACTIVE",
            message: "Assinatura já está ativa. Não há checkout pendente para retomar.",
          },
          { status: 409, headers: cacheHeader }
        );
      }
      if (delinquent) {
        syncUserFromSubscription(user, delinquent);
        (user as any).stripeCustomerId = customerId;
        await user.save();
        return NextResponse.json(
          {
            ok: false,
            code: "PAYMENT_ISSUE",
            message: "Pagamento pendente. Atualize o método de pagamento no portal de cobrança.",
          },
          { status: 409, headers: cacheHeader }
        );
      }

      subscription = pickLatest(pending) || pickLatest(expired);

      if (!subscription) {
        return NextResponse.json(
          {
            ok: false,
            code: "BILLING_RESUME_NOT_PENDING",
            message: "Nao ha checkout pendente para retomar. Inicie um novo checkout.",
          },
          { status: 409, headers: cacheHeader }
        );
      }
    }

    if (subscription.status === "incomplete_expired") {
      syncUserFromSubscription(user, subscription);
      (user as any).planStatus = "incomplete_expired";
      (user as any).stripeCustomerId = customerId;
      await user.save();
      return NextResponse.json(
        {
          ok: false,
          code: "SUBSCRIPTION_INCOMPLETE_EXPIRED",
          message: "Tentativa expirada. Inicie um novo checkout.",
        },
        { status: 409, headers: cacheHeader }
      );
    }

    const clientSecret = await extractClientSecretFromSubscription(subscription);
    if (!clientSecret) {
      logger.warn("billing_resume_missing_client_secret", {
        endpoint: "POST /api/billing/resume",
        userId: String(user._id),
        customerId,
        subscriptionId: subscription.id,
        statusDb: (user as any).planStatus ?? null,
        statusStripe: subscription.status ?? null,
        errorCode: "RESUME_NO_PAYMENT_INTENT",
        stripeRequestId: stripeRequestId ?? getStripeRequestId(subscription),
      });
      return NextResponse.json(
        {
          ok: false,
          code: "RESUME_NO_PAYMENT_INTENT",
          message: "Não foi possível retomar o pagamento. Tente novamente.",
        },
        { status: 500, headers: cacheHeader }
      );
    }

    syncUserFromSubscription(user, subscription, { statusOverride: "pending" });
    (user as any).stripeCustomerId = customerId;
    (user as any).planExpiresAt = null;
    (user as any).currentPeriodEnd = null;
    (user as any).cancelAtPeriodEnd = false;
    (user as any).lastPaymentError = null;
    await user.save();

    logger.info("billing_resume_success", {
      endpoint: "POST /api/billing/resume",
      userId: String(user._id),
      customerId,
      subscriptionId: subscription.id,
      statusDb: (user as any).planStatus ?? null,
      statusStripe: subscription.status ?? null,
      errorCode: null,
      stripeRequestId: stripeRequestId ?? getStripeRequestId(subscription),
    });

    return NextResponse.json(
      { ok: true, clientSecret, subscriptionId: subscription.id },
      { headers: cacheHeader }
    );
  } catch (err: any) {
    const message = err?.message || "Resume failed";
    logger.error("[billing/resume] error", err);
    return NextResponse.json({ ok: false, message }, { status: 400, headers: cacheHeader });
  }
}
