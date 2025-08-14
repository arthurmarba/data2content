// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import { logger } from "@/app/lib/logger";
import { normCur } from "@/utils/normCur";
import Redemption from "@/app/models/Redemption";
import {
  ensureInvoiceIdempotent,
  ensureSubscriptionFirstTime,
} from "@/app/services/affiliate/idempotency";
import { calcCommissionCents } from "@/app/services/affiliate/calcCommissionCents";
import { AFFILIATE_HOLD_DAYS } from "@/config/affiliates";
import {
  processAffiliateRefund,
  getRefundedPaidTotal,
} from "@/app/services/affiliate/refundCommission";
import { mapStripeAccountInfo } from "@/app/services/stripe/mapAccountInfo";
import type { Stripe as StripeTypes } from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// helpers
function addDays(d: Date, days: number) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt;
}
function adjustBalance(user: any, currency: string, deltaCents: number) {
  const cur = normCur(currency);
  const balances: Map<string, number> = user.affiliateBalances || new Map();
  const prev = balances.get(cur) ?? 0;
  balances.set(cur, prev + deltaCents);
  user.affiliateBalances = balances;
  if (typeof user.markModified === "function") user.markModified("affiliateBalances");
}

/**
 * Basil-safe resolver do SubscriptionId a partir da Invoice.
 */
function getInvoiceSubscriptionId(inv: any): string | undefined {
  const parent = inv?.parent;
  if (parent?.type === "subscription_details") {
    const sub = parent?.subscription_details?.subscription;
    if (typeof sub === "string") return sub;
    if (sub && typeof sub.id === "string") return sub.id;
  }
  const legacy = inv?.subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy.id === "string") return legacy.id;
  return undefined;
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: StripeTypes.Event;
  try {
    const payload = await req.text();
    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    logger.error("[stripe/webhook] signature error:", err?.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await connectToDatabase();

    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as any;
        const info = mapStripeAccountInfo(account);
        const acctId = account.id as string;

        const user = await User.findOne({ "paymentInfo.stripeAccountId": acctId });
        if (user) {
          user.paymentInfo ||= {};
          user.paymentInfo.stripeAccountDefaultCurrency = info.defaultCurrency;
          user.paymentInfo.stripeAccountPayoutsEnabled = info.payoutsEnabled;
          user.paymentInfo.stripeAccountDisabledReason = info.disabledReasonKey;
          user.paymentInfo.stripeAccountNeedsOnboarding = info.needsOnboarding;
          user.paymentInfo.stripeAccountCountry = info.accountCountry;
          user.markModified("paymentInfo");
          await user.save();
        }

        logger.info("[connect:account.updated]", {
          accountId: acctId,
          payouts_enabled: info.payoutsEnabled,
          default_currency: info.defaultCurrency,
          needsOnboarding: info.needsOnboarding,
          disabled_reason: info.disabledReasonKey,
        });
        break;
      }

      case "transfer.reversed": {
        const transfer = event.data.object as any;
        const transactionId = transfer.id as string;
        const redemption = await Redemption.findOne({ transactionId });
        if (redemption) {
          const user = await User.findById(redemption.userId);
          if (user) {
            adjustBalance(user, redemption.currency, redemption.amountCents);
            await user.save();
          }
          redemption.status = "rejected";
          redemption.notes = `Reversed by Stripe: ${transactionId}`;
          await redemption.save();
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as StripeTypes.Invoice;

        const customerId =
          typeof (invoice as any).customer === "string"
            ? (invoice as any).customer
            : (invoice as any).customer?.id;
        if (!customerId) break;

        const user = await User.findOne({ stripeCustomerId: customerId });

        if (!user) {
          logger.warn(
            `[stripe/webhook] Received payment for a deleted user. Canceling orphan subscription.`,
            { customerId }
          );
          const subId = getInvoiceSubscriptionId(invoice as any);
          if (subId) {
            try {
              await stripe.subscriptions.cancel(subId);
              logger.info(
                `[stripe/webhook] Canceled orphan subscription ${subId} for deleted user ${customerId}.`
              );
            } catch (e) {
              logger.error(
                `[stripe/webhook] Failed to cancel orphan subscription ${subId}.`,
                e
              );
            }
          }
          break;
        }

        if (user.lastProcessedEventId === event.id) break;
        user.lastProcessedEventId = event.id;

        const amountPaid = (invoice as any).amount_paid;
        if (amountPaid && amountPaid > 0) {
          const line = (invoice as any).lines?.data?.find((l: any) => l?.price?.recurring);
          const periodEnd = line?.period?.end ? new Date(line.period.end * 1000) : null;
          const intervalAll = line?.price?.recurring?.interval as
            | "day"
            | "week"
            | "month"
            | "year"
            | undefined;

          if (intervalAll === "month" || intervalAll === "year") {
            user.planInterval = intervalAll;
            user.planType = intervalAll === "year" ? "annual" : "monthly";
          }
          user.planStatus = "active";
          if (periodEnd) user.planExpiresAt = periodEnd;

          const subId = getInvoiceSubscriptionId(invoice as any);
          if (subId) user.stripeSubscriptionId = subId;
        }

        // Comissão (primeiro pagamento real)
        if (amountPaid && amountPaid > 0) {
          const firstGate = await User.findOneAndUpdate(
            { _id: user._id, affiliateFirstCommissionAt: { $exists: false } },
            { $set: { affiliateFirstCommissionAt: new Date() } },
            { new: false }
          );

          if (firstGate) {
            const affiliateCode =
              user.affiliateUsed ||
              (invoice as any)?.metadata?.affiliateCode ||
              null;

            if (affiliateCode) {
              const affiliateOwner = await User.findOne({ affiliateCode }).select(
                "_id affiliateCode commissionLog"
              );

              if (!affiliateOwner) {
                logger.warn(
                  "[stripe/webhook] Affiliate code not found, skipping commission.",
                  { affiliateCode, userId: String(user._id), invoiceId: (invoice as any).id }
                );
              } else if (String(affiliateOwner._id) === String(user._id)) {
                logger.warn("[stripe/webhook] Self-referral detected; skipping commission.", {
                  userId: String(user._id),
                  affiliateCode,
                  invoiceId: (invoice as any).id,
                });
              } else {
                const invCheck = await ensureInvoiceIdempotent(
                  (invoice as any).id,
                  affiliateOwner._id
                );
                if (!invCheck.ok) {
                  logger.info("[affiliate:idempotency] skip duplicate invoice", {
                    invoiceId: (invoice as any).id,
                    affiliateUserId: String(affiliateOwner._id),
                  });
                } else {
                  const subId = getInvoiceSubscriptionId(invoice as any);

                  let allowed = true;
                  if (subId) {
                    const subCheck = await ensureSubscriptionFirstTime(
                      subId,
                      affiliateOwner._id
                    );
                    if (!subCheck.ok) {
                      logger.info(
                        "[affiliate:business] skip subscription already commissioned",
                        {
                          subscriptionId: subId,
                          affiliateUserId: String(affiliateOwner._id),
                        }
                      );
                      allowed = false;
                    }
                  }

                  if (allowed) {
                    const commissionAmount = calcCommissionCents(invoice as any);
                    if (commissionAmount > 0) {
                      const currency = normCur((invoice as any).currency || "brl");
                      const availableAt = addDays(new Date(), AFFILIATE_HOLD_DAYS);

                      (affiliateOwner as any).commissionLog ||= [];
                      (affiliateOwner as any).commissionLog.push({
                        type: "commission",
                        status: "pending",
                        invoiceId: (invoice as any).id,
                        subscriptionId: subId,
                        affiliateUserId: affiliateOwner._id,
                        buyerUserId: user._id,
                        currency,
                        amountCents: commissionAmount,
                        availableAt,
                      } as any);

                      await affiliateOwner.save();

                      logger.info("[affiliate:commission] created pending", {
                        invoiceId: (invoice as any).id,
                        subscriptionId: subId,
                        affiliateUserId: String(affiliateOwner._id),
                        buyerUserId: String(user._id),
                        currency,
                        amountCents: commissionAmount,
                        availableAt,
                      });
                    }
                  }
                }
              }
            }
          }
        }

        user.lastPaymentError = undefined;
        await user.save();
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as StripeTypes.Invoice;
        const customerId =
          typeof (invoice as any).customer === "string"
            ? (invoice as any).customer
            : (invoice as any).customer?.id;
        if (!customerId) break;
        const user = await User.findOne({ stripeCustomerId: customerId });
        if (!user) break;
        if (user.lastProcessedEventId === event.id) break;
        user.lastProcessedEventId = event.id;

        user.lastPaymentError = {
          at: new Date(),
          paymentId: String((invoice as any).id),
          status: "failed",
          statusDetail: String((invoice as any).last_finalization_error?.message || "unknown"),
        };
        await user.save();
        break;
      }

      case "invoice.voided": {
        const invoice = event.data.object as StripeTypes.Invoice;
        const customerId =
          typeof (invoice as any).customer === "string"
            ? (invoice as any).customer
            : (invoice as any).customer?.id;
        if (!customerId) break;

        const buyer = await User.findOne({ stripeCustomerId: customerId });
        if (!buyer) break;

        const owner = await User.findOne({
          affiliateCode: (buyer as any).affiliateUsed || "__none__",
        });
        if (!owner) break;

        const idx = (owner.commissionLog || []).findIndex(
          (i: any) =>
            i.invoiceId === (invoice as any).id &&
            (i.status === "pending" || i.status === "available")
        );
        if (idx >= 0) {
          const e = (owner as any).commissionLog[idx];
          if (e.status === "available") {
            adjustBalance(owner, e.currency, -Math.abs(Number(e.amountCents || 0)));
          }
          e.status = "reversed";
          e.reversedAt = new Date();
          e.reversalReason = "invoice.voided";
          await owner.save();
        }
        break;
      }

      // 🧾 Reembolsos → tratar via charge.refunded
      case "charge.refunded": {
        const charge = event.data.object as any;
        const invId =
          typeof charge.invoice === "string" ? charge.invoice : charge.invoice?.id;
        if (!invId) break;
        const total = getRefundedPaidTotal(charge);
        await processAffiliateRefund(invId, total);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as StripeTypes.Subscription;
        const item = sub.items.data[0];
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!customerId) break;

        const user = await User.findOne({ stripeCustomerId: customerId });
        if (!user) {
          logger.warn(
            `[stripe/webhook] Ignoring subscription update for deleted user.`,
            { customerId, subscriptionId: sub.id }
          );
          break;
        }

        const rawInterval = item?.price?.recurring?.interval as
          | "day"
          | "week"
          | "month"
          | "year"
          | undefined;
        const safeInterval: "month" | "year" | undefined =
          rawInterval === "month" || rawInterval === "year" ? rawInterval : undefined;

        const update: any = {
          planStatus: (sub as any).cancel_at_period_end ? "canceled" : sub.status,
          stripeSubscriptionId: sub.id,
          stripePriceId: item?.price?.id,
          planInterval: safeInterval,
          lastProcessedEventId: event.id,
        };

        const ends = sub.items.data
          .map((it) => (it as any)?.current_period_end)
          .filter((n: any): n is number => typeof n === "number");
        if (ends.length > 0) {
          const minEnd = Math.min(...ends);
          update.planExpiresAt = new Date(minEnd * 1000);
        }

        await User.updateOne({ _id: user._id }, { $set: update });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as StripeTypes.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!customerId) break;

        const user = await User.findOne({ stripeCustomerId: customerId });
        if (!user || user.stripeSubscriptionId !== sub.id) {
          break;
        }

        if (user.lastProcessedEventId === event.id) break;

        user.planStatus = "inactive";
        user.planExpiresAt = null;
        user.lastProcessedEventId = event.id;
        await user.save();

        logger.info(
          `[stripe/webhook] Set plan to inactive for user due to subscription.deleted event.`,
          { userId: user._id, subscriptionId: sub.id }
        );
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    logger.error("[stripe/webhook] handler error:", err);
    return NextResponse.json({ received: true, error: "logged" }, { status: 200 });
  }
}
