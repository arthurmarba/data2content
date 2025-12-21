import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/getAdminSession";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" } as const;

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value as any);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function maskEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const [local, domain] = value.split("@");
  if (!domain) return value;
  if (!local) return `***@${domain}`;
  const maskedLocal = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

function sanitizePaymentError(value: unknown): { status: string | null; at: string | null } | null {
  if (!value) return null;
  if (typeof value === "string") {
    return { status: "unknown", at: null };
  }
  if (typeof value === "object") {
    const anyVal = value as any;
    const status = (anyVal.status ?? anyVal.code ?? anyVal.type ?? null) as string | null;
    const at = toIsoDate(anyVal.at ?? anyVal.created ?? null);
    return { status, at };
  }
  return null;
}

function summarizeSubscription(sub: any) {
  if (!sub) return null;
  const item = sub.items?.data?.[0];
  const planInterval = item?.price?.recurring?.interval ?? null;
  const latestInvoice = sub.latest_invoice ?? null;
  const paymentIntent =
    latestInvoice && typeof latestInvoice === "object"
      ? (latestInvoice as any).payment_intent ?? null
      : null;

  return {
    id: sub.id ?? null,
    status: sub.status ?? null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    priceId: item?.price?.id ?? null,
    planInterval: planInterval === "month" || planInterval === "year" ? planInterval : null,
    currentPeriodEnd: typeof sub.current_period_end === "number"
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    trialEnd: typeof sub.trial_end === "number" ? new Date(sub.trial_end * 1000).toISOString() : null,
    latestInvoiceStatus: typeof latestInvoice?.status === "string" ? latestInvoice.status : null,
    paymentIntentStatus:
      paymentIntent && typeof paymentIntent === "object" ? (paymentIntent as any).status ?? null : null,
    stripeRequestId: sub?.lastResponse?.requestId ?? null,
  };
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ error: "Missing query" }, { status: 400, headers: noStoreHeaders });
  }

  await connectToDatabase();

  let user: any = null;
  const lowered = q.toLowerCase();

  if (lowered.includes("@")) {
    user = await User.findOne({ email: lowered });
  } else if (q.startsWith("cus_")) {
    user = await User.findOne({ stripeCustomerId: q });
  } else if (q.startsWith("sub_")) {
    user = await User.findOne({ stripeSubscriptionId: q });
  } else {
    user = await User.findById(q);
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404, headers: noStoreHeaders });
  }

  const customerId = user.stripeCustomerId ?? null;
  const subscriptionId = user.stripeSubscriptionId ?? null;

  let subscription: any = null;
  let stripeRequestId: string | null = null;

  try {
    if (subscriptionId) {
      subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price", "latest_invoice.payment_intent"],
      } as any);
      stripeRequestId = subscription?.lastResponse?.requestId ?? null;
    }

    if (!subscription && customerId) {
      const list = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 5,
        expand: ["data.items.data.price", "data.latest_invoice.payment_intent"],
      } as any);
      subscription = list.data.find((s: any) => s.status === "active" || s.status === "trialing") ?? list.data[0] ?? null;
      stripeRequestId = list?.lastResponse?.requestId ?? stripeRequestId;
    }
  } catch (err) {
    logger.error("[admin/billing/debug] stripe_fetch_failed", err);
  }

  const payload = {
    ok: true,
    db: {
      userId: String(user._id),
      emailMasked: maskEmail(user.email ?? null),
      planStatus: user.planStatus ?? null,
      planInterval: user.planInterval ?? null,
      planType: user.planType ?? null,
      stripeCustomerId: user.stripeCustomerId ?? null,
      stripeSubscriptionId: user.stripeSubscriptionId ?? null,
      stripePriceId: user.stripePriceId ?? null,
      cancelAtPeriodEnd: Boolean(user.cancelAtPeriodEnd),
      planExpiresAt: toIsoDate(user.planExpiresAt ?? null),
      lastPaymentError: sanitizePaymentError(user.lastPaymentError ?? null),
    },
    stripe: subscription ? summarizeSubscription(subscription) : null,
    stripeRequestId,
  };

  logger.info("[admin/billing/debug] fetched", {
    endpoint: "GET /api/admin/billing/debug",
    adminUserId: session.user.id ?? null,
    userId: String(user._id),
    customerId,
    subscriptionId,
    stripeRequestId,
  });

  return NextResponse.json(payload, { headers: noStoreHeaders });
}
