import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getAdminSession } from "@/lib/getAdminSession";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" } as const;

const STRIPE_STATUS_PRIORITY = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "incomplete_expired",
];

function pickBestSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  if (!subs?.length) return null;
  for (const status of STRIPE_STATUS_PRIORITY) {
    const match = subs.find((s) => s.status === status);
    if (match) return match;
  }
  return subs[0] ?? null;
}

function resolvePlanExpiresAt(sub: Stripe.Subscription): Date | null {
  const cancelAtSec =
    typeof (sub as any).cancel_at === "number" ? (sub as any).cancel_at : null;
  if (cancelAtSec) return new Date(cancelAtSec * 1000);

  const itemEnds =
    sub.items?.data
      ?.map((it: any) => it?.current_period_end)
      ?.filter((n: any) => typeof n === "number") ?? [];
  if (itemEnds.length) return new Date(Math.min(...itemEnds) * 1000);

  const cpe =
    typeof (sub as any).current_period_end === "number"
      ? (sub as any).current_period_end
      : null;
  return cpe ? new Date(cpe * 1000) : null;
}

function normalizeFromSubscription(sub: Stripe.Subscription) {
  const baseStatus = typeof sub.status === "string" ? sub.status : "inactive";
  const trialEndSec =
    typeof (sub as any).trial_end === "number" ? (sub as any).trial_end : null;
  const isTrialing =
    baseStatus === "trialing" || (trialEndSec && trialEndSec * 1000 > Date.now());

  const item = sub.items?.data?.[0];
  const intervalRaw = item?.price?.recurring?.interval;
  const planInterval = intervalRaw === "month" || intervalRaw === "year" ? intervalRaw : null;
  const stripePriceId = item?.price?.id ?? null;
  const currency =
    item?.price?.currency ? String(item.price.currency).toUpperCase() : null;

  return {
    planStatus: isTrialing ? "trial" : baseStatus,
    planInterval,
    planExpiresAt: resolvePlanExpiresAt(sub),
    cancelAtPeriodEnd: Boolean((sub as any).cancel_at_period_end),
    stripePriceId,
    currency,
  };
}

function getPlanType(interval: "month" | "year" | null): "monthly" | "annual" | null {
  if (interval === "month") return "monthly";
  if (interval === "year") return "annual";
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const { searchParams } = new URL(req.url);
  const userId = (body?.userId || searchParams.get("userId") || "").toString().trim();
  const dryRunRaw = body?.dryRun ?? searchParams.get("dryRun");
  const dryRun = dryRunRaw === true || dryRunRaw === "true";

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400, headers: noStoreHeaders });
  }

  await connectToDatabase();
  const user: any = await User.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404, headers: noStoreHeaders });
  }

  const before = {
    planStatus: user.planStatus ?? null,
    stripeSubscriptionId: user.stripeSubscriptionId ?? null,
    stripeCustomerId: user.stripeCustomerId ?? null,
    stripePriceId: user.stripePriceId ?? null,
    planInterval: user.planInterval ?? null,
    planExpiresAt: user.planExpiresAt ?? null,
    cancelAtPeriodEnd: Boolean(user.cancelAtPeriodEnd),
    currency: user.currency ?? null,
  };

  let subscription: Stripe.Subscription | null = null;
  let source: "subscription_id" | "customer_lookup" | "none" = "none";
  let stripeRequestId: string | null = null;

  if (user.stripeSubscriptionId) {
    try {
      subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
        expand: ["items.data.price"],
      } as any);
      source = "subscription_id";
      stripeRequestId = (subscription as any)?.lastResponse?.requestId ?? null;
    } catch (err) {
      logger.warn("billing_reconcile_retrieve_failed", {
        endpoint: "POST /api/admin/billing/reconcile",
        adminUserId: session.user.id ?? null,
        userId: String(user._id),
        subscriptionId: user.stripeSubscriptionId ?? null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!subscription && user.stripeCustomerId) {
    try {
      const list = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "all",
        limit: 10,
        expand: ["data.items.data.price"],
      } as any);
      subscription = pickBestSubscription(list.data);
      source = subscription ? "customer_lookup" : "none";
      stripeRequestId = (list as any)?.lastResponse?.requestId ?? stripeRequestId;
    } catch (err) {
      logger.warn("billing_reconcile_list_failed", {
        endpoint: "POST /api/admin/billing/reconcile",
        adminUserId: session.user.id ?? null,
        userId: String(user._id),
        customerId: user.stripeCustomerId ?? null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const updates: Record<string, any> = {};

  if (!subscription) {
    updates.planStatus = "inactive";
    updates.stripeSubscriptionId = null;
    updates.stripePriceId = null;
    updates.planInterval = null;
    updates.planExpiresAt = null;
    updates.cancelAtPeriodEnd = false;
  } else {
    const normalized = normalizeFromSubscription(subscription);
    updates.planStatus = normalized.planStatus;
    updates.planInterval = normalized.planInterval;
    updates.planExpiresAt = normalized.planExpiresAt;
    updates.cancelAtPeriodEnd = normalized.cancelAtPeriodEnd;
    updates.stripeSubscriptionId = subscription.id;
    updates.stripePriceId = normalized.stripePriceId;
    if (normalized.currency) updates.currency = normalized.currency;
    const planType = getPlanType(normalized.planInterval);
    if (planType) updates.planType = planType;

    if (typeof subscription.customer === "string") {
      updates.stripeCustomerId = subscription.customer;
    }
  }

  const changedKeys = Object.keys(updates).filter((key) => {
    const current = user[key];
    const next = updates[key];
    if (current instanceof Date && next instanceof Date) {
      return current.getTime() !== next.getTime();
    }
    return current !== next;
  });

  if (!dryRun && changedKeys.length > 0) {
    user.set(updates);
    await user.save();
  }

  logger.info("billing_reconcile_done", {
    endpoint: "POST /api/admin/billing/reconcile",
    adminUserId: session.user.id ?? null,
    userId: String(user._id),
    customerId: updates.stripeCustomerId ?? user.stripeCustomerId ?? null,
    subscriptionId: updates.stripeSubscriptionId ?? user.stripeSubscriptionId ?? null,
    statusDb: updates.planStatus ?? user.planStatus ?? null,
    statusStripe: subscription?.status ?? null,
    errorCode: null,
    stripeRequestId,
    dryRun,
    changedKeys,
    source,
  });

  return NextResponse.json(
    {
      ok: true,
      dryRun,
      source,
      stripeStatus: subscription?.status ?? null,
      stripeRequestId,
      changedKeys,
      before,
      after: {
        ...before,
        ...updates,
      },
    },
    { headers: noStoreHeaders }
  );
}
