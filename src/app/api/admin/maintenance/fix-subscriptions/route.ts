import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import { getAdminSession } from "@/lib/getAdminSession";
import { logger } from "@/app/lib/logger";

export const dynamic = "force-dynamic";
const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" } as const;

const STATUSES_TO_RECONCILE = [
    "expired",
    "inactive",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "past_due",
    "unpaid",
    "pending",
    "non_renewing",
];

const STRIPE_STATUS_PRIORITY = [
    "active",
    "trialing",
    "past_due",
    "unpaid",
    "incomplete",
    "incomplete_expired",
];

const normalizePlanStatus = (stripeStatus: string, cancelAtPeriodEnd: boolean) => {
    if (stripeStatus === "active" && cancelAtPeriodEnd) return "non_renewing";
    return stripeStatus;
};

const pickBestSubscription = (subs: any[]) => {
    if (!subs?.length) return null;
    for (const status of STRIPE_STATUS_PRIORITY) {
        const match = subs.find((s) => s.status === status);
        if (match) return match;
    }
    return subs[0];
};

export async function GET(request: NextRequest) {
    try {
        const session = await getAdminSession(request);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders });
        }

        await connectToDatabase();

        const searchParams = new URL(request.url).searchParams;
        const dryRun = searchParams.get("dryRun") !== "false"; // Default to true for safety

        // Bring any non-active users that have Stripe references to sync them against Stripe (source of truth)
        const users = await User.find({
            planStatus: { $in: STATUSES_TO_RECONCILE },
            $or: [
                { stripeCustomerId: { $exists: true, $ne: null } },
                { stripeSubscriptionId: { $exists: true, $ne: null } },
            ],
        });

        const results = [];

        for (const user of users) {
            if (!user.stripeCustomerId && !user.stripeSubscriptionId) {
                results.push({
                    email: user.email,
                    id: user._id,
                    status: "skipped_no_customer_id"
                });
                continue;
            }

            try {
                let activeSub = null;
                let source = "unknown";
                const lookupErrors: any[] = [];

                // 1) Prefer the explicit subscriptionId saved in the DB (we want Stripe as source of truth)
                if (user.stripeSubscriptionId) {
                    try {
                        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
                            expand: ["items.data.price"],
                        });
                        activeSub = sub;
                        source = "subscription_id";
                    } catch (err: any) {
                        lookupErrors.push({
                            via: "subscription_id",
                            error: err?.message || String(err),
                        });
                    }
                }

                // 2) Fallback: list subscriptions by customer (no status filter) and pick the best candidate
                if (!activeSub && user.stripeCustomerId) {
                    try {
                        const subs = await stripe.subscriptions.list({
                            customer: user.stripeCustomerId,
                            limit: 10,
                            expand: ["data.items.data.price"],
                        });
                        const candidate = pickBestSubscription(subs.data);
                        if (candidate) {
                            activeSub = candidate;
                            source = "customer_lookup";
                        }
                    } catch (err: any) {
                        lookupErrors.push({
                            via: "customer_lookup",
                            error: err?.message || String(err),
                        });
                    }
                }

                if (!activeSub) {
                    results.push({
                        email: user.email,
                        id: user._id,
                        status: "skipped_no_active_sub_found_in_stripe",
                        lookupErrors,
                    });
                    continue;
                }

                if (activeSub) {
                    // Sync DB to Stripe status
                    const normalizedStatus = normalizePlanStatus(activeSub.status, activeSub.cancel_at_period_end);
                    const isStatusMismatch = user.planStatus !== normalizedStatus;
                    const isSubMismatch = user.stripeSubscriptionId !== activeSub.id;
                    const isCustomerMismatch = typeof activeSub.customer === "string" && user.stripeCustomerId !== activeSub.customer;

                    if (!isStatusMismatch && !isSubMismatch && !isCustomerMismatch) {
                        results.push({
                            email: user.email,
                            id: user._id,
                            status: "skipped_already_correct",
                            stripeStatus: activeSub.status,
                            source
                        });
                        continue;
                    }

                    const periodEnd = typeof activeSub.current_period_end === "number"
                        ? new Date(activeSub.current_period_end * 1000)
                        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                    const updates: any = {
                        stripeSubscriptionId: activeSub.id,
                        planStatus: normalizedStatus,
                        cancelAtPeriodEnd: activeSub.cancel_at_period_end,
                        currentPeriodEnd: periodEnd,
                        planExpiresAt: periodEnd,
                    };

                    // Fix customer ID if it was wrong or missing
                    if (typeof activeSub.customer === "string" && activeSub.customer !== user.stripeCustomerId) {
                        updates.stripeCustomerId = activeSub.customer;
                    }

                    const item = activeSub.items.data[0];
                    if (item?.price?.id) {
                        updates.stripePriceId = item.price.id;
                    }
                    if (item?.price?.recurring?.interval && item.price.recurring.interval !== user.planInterval) {
                        updates.planInterval = item.price.recurring.interval;
                    }

                    if (!dryRun) {
                        user.set(updates);
                        await user.save();
                    }

                    results.push({
                        email: user.email,
                        id: user._id,
                        status: dryRun ? "would_fix" : "fixed",
                        oldStatus: user.planStatus,
                        newStatus: normalizedStatus,
                        stripeStatus: activeSub.status,
                        oldSub: user.stripeSubscriptionId,
                        newSub: activeSub.id,
                        source,
                        customerIdUpdated: updates.stripeCustomerId ? true : false,
                    });
                } else {
                    results.push({
                        email: user.email,
                        id: user._id,
                        status: "skipped_no_active_sub_found_in_stripe"
                    });
                }
            } catch (err) {
                results.push({
                    email: user.email,
                    id: user._id,
                    status: "error",
                    error: String(err)
                });
            }
        }

        logger.info("admin_fix_subscriptions_done", {
            endpoint: "GET /api/admin/maintenance/fix-subscriptions",
            adminUserId: session.user.id ?? null,
            count: results.length,
            fixedCount: results.filter(r => r.status === "fixed" || r.status === "would_fix").length,
        });

        return NextResponse.json({
            ok: true,
            dryRun,
            count: results.length,
            fixedCount: results.filter(r => r.status === "fixed" || r.status === "would_fix").length,
            results
        }, { headers: noStoreHeaders });
    } catch (error) {
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500, headers: noStoreHeaders });
    }
}
