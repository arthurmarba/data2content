import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/getAdminSession";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import { cancelBlockingIncompleteSubs } from "@/utils/stripeHelpers";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" } as const;

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const { searchParams } = new URL(req.url);
  const userId = (body?.userId || searchParams.get("userId") || "").toString().trim();
  const subscriptionId = (body?.subscriptionId || "").toString().trim();

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400, headers: noStoreHeaders });
  }

  await connectToDatabase();
  const user: any = await User.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404, headers: noStoreHeaders });
  }

  const customerId = user.stripeCustomerId ?? null;
  const cleaned: string[] = [];

  if (!customerId) {
    user.planStatus = "inactive";
    user.stripeSubscriptionId = null;
    user.stripePriceId = null;
    user.planInterval = null;
    user.planExpiresAt = null;
    user.cancelAtPeriodEnd = false;
    await user.save();

    logger.info("billing_admin_abort_no_customer", {
      endpoint: "POST /api/admin/billing/abort",
      adminUserId: session.user.id ?? null,
      userId: String(user._id),
      customerId: null,
      subscriptionId: null,
      statusDb: user.planStatus ?? null,
      statusStripe: null,
      errorCode: null,
      stripeRequestId: null,
    });

    return NextResponse.json({ ok: true, cleaned, status: "no_customer" }, { headers: noStoreHeaders });
  }

  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      if (sub && (sub.status === "incomplete" || sub.status === "incomplete_expired")) {
        await stripe.subscriptions.cancel(sub.id);
        cleaned.push(sub.id);
        logger.info("billing_admin_abort_cancelled_sub", {
          endpoint: "POST /api/admin/billing/abort",
          adminUserId: session.user.id ?? null,
          userId: String(user._id),
          customerId,
          subscriptionId: sub.id,
          statusDb: user.planStatus ?? null,
          statusStripe: sub.status,
          errorCode: null,
          stripeRequestId: (sub as any)?.lastResponse?.requestId ?? null,
        });
      }
    } catch {
      // ignore invalid sub id
    }
  }

  const res = await cancelBlockingIncompleteSubs(customerId);
  cleaned.push(...res.canceled);

  try {
    const listed = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
      expand: ["data.items.data.price"],
    } as any);

    const pick = listed.data.find((s: any) => {
      const st = s?.status;
      const cape = Boolean((s as any)?.cancel_at_period_end);
      return st === "active" || st === "trialing" || (cape && (st === "active" || st === "trialing"));
    });

    if (pick) {
      const firstItem: any = pick.items?.data?.[0];
      const interval = firstItem?.price?.recurring?.interval;
      const planInterval = interval === "month" || interval === "year" ? interval : undefined;
      const cancelAtPeriodEnd = Boolean((pick as any)?.cancel_at_period_end);
      const ends = (pick.items?.data ?? [])
        .map((it: any) => it?.current_period_end)
        .filter((n: any) => typeof n === "number");
      const planExpiresAt =
        typeof (pick as any).cancel_at === "number"
          ? new Date((pick as any).cancel_at * 1000)
          : ends.length
          ? new Date(Math.min(...ends) * 1000)
          : typeof (pick as any).current_period_end === "number"
          ? new Date((pick as any).current_period_end * 1000)
          : null;

      user.stripeSubscriptionId = pick.id;
      user.stripePriceId = firstItem?.price?.id ?? null;
      if (planInterval !== undefined) user.planInterval = planInterval;
      user.planExpiresAt = planExpiresAt;
      user.currentPeriodEnd = planExpiresAt;
      user.cancelAtPeriodEnd = cancelAtPeriodEnd;
      user.planStatus = pick.status;
      await user.save();

      logger.info("billing_admin_abort_reattached", {
        endpoint: "POST /api/admin/billing/abort",
        adminUserId: session.user.id ?? null,
        userId: String(user._id),
        customerId,
        subscriptionId: pick.id,
        statusDb: user.planStatus ?? null,
        statusStripe: pick.status ?? null,
        errorCode: null,
        stripeRequestId: (pick as any)?.lastResponse?.requestId ?? null,
      });

      return NextResponse.json(
        { ok: true, cleaned, reattachedSubscriptionId: pick.id },
        { headers: noStoreHeaders }
      );
    }
  } catch {
    // fall through to reset
  }

  user.planStatus = "inactive";
  user.stripeSubscriptionId = null;
  user.stripePriceId = null;
  user.planInterval = null;
  user.planExpiresAt = null;
  user.cancelAtPeriodEnd = false;
  await user.save();

  logger.info("billing_admin_abort_reset", {
    endpoint: "POST /api/admin/billing/abort",
    adminUserId: session.user.id ?? null,
    userId: String(user._id),
    customerId,
    subscriptionId: null,
    statusDb: user.planStatus ?? null,
    statusStripe: null,
    errorCode: null,
    stripeRequestId: null,
  });

  return NextResponse.json({ ok: true, cleaned }, { headers: noStoreHeaders });
}
