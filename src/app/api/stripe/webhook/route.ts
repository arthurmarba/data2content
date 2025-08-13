// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import { logger } from "@/app/lib/logger";
import { normCur } from "@/utils/normCur";
import Redemption from "@/app/models/Redemption";
import type { Stripe as StripeTypes } from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---- Config de comissão / hold ----
const AFFILIATE_BPS = Number(process.env.AFFILIATE_BPS || 1000); // 1000 = 10%
const HOLD_DAYS = Number(process.env.AFFILIATE_HOLD_DAYS || 7);

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
function commissionBaseCents(invoice: any): number {
  return Math.max(
    0,
    Math.floor(
      invoice.subtotal_excluding_tax ??
        invoice.subtotal ??
        invoice.amount_paid ??
        invoice.total ??
        0
    )
  );
}
function calcCommissionCents(baseCents: number) {
  return Math.floor((baseCents * AFFILIATE_BPS) / 10_000);
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: StripeTypes.Event;
  try {
    // App Router: precisa do RAW body (req.text())
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
        const acctId = account.id as string;

        const destCurrency = (account.default_currency || "").toLowerCase() || null;
        let status: "verified" | "pending" | "disabled" = "pending";
        if (account.charges_enabled && account.payouts_enabled) status = "verified";
        if (account.requirements?.disabled_reason) status = "disabled";

        const user = await User.findOne({ "paymentInfo.stripeAccountId": acctId });
        if (user) {
          user.paymentInfo ||= {};
          user.paymentInfo.stripeAccountStatus = status;
          user.paymentInfo.stripeAccountDefaultCurrency = destCurrency || undefined;
          await user.save();
        }
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

        // ——— Proteções e resgate do usuário ———
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const user = await User.findOne({ stripeCustomerId: customerId });

        // Usuário não existe mais → cancela a assinatura "órfã"
        if (!user) {
          logger.warn(
            `[stripe/webhook] Received payment for a deleted user. Canceling orphan subscription.`,
            { customerId }
          );
          const subId =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : invoice.subscription?.id;
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

        // Idempotência por evento (por usuário)
        if (user.lastProcessedEventId === event.id) break;
        user.lastProcessedEventId = event.id;

        // ——— Ativação do plano ———
        if (invoice.amount_paid && invoice.amount_paid > 0) {
          const line = invoice.lines?.data?.find((l) => l?.price?.recurring);
          const periodEnd = line?.period?.end ? new Date(line.period.end * 1000) : null;
          const interval = line?.price?.recurring?.interval as "month" | "year" | undefined;

          if (interval) {
            user.planInterval = interval;
            user.planType = interval === "year" ? "annual" : "monthly";
          }
          user.planStatus = "active";
          if (periodEnd) user.planExpiresAt = periodEnd;
          const subId =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : invoice.subscription?.id;
          if (subId) user.stripeSubscriptionId = subId;
        }

        // ——— Comissão de Afiliado (10% só na PRIMEIRA cobrança do assinante) ———
        if (invoice.amount_paid && invoice.amount_paid > 0) {
          // Gate atômico: garante uma única primeira comissão por comprador
          const firstGate = await User.findOneAndUpdate(
            { _id: user._id, affiliateFirstCommissionAt: { $exists: false } },
            { $set: { affiliateFirstCommissionAt: new Date() } },
            { new: false }
          );

          if (firstGate) {
            const affiliateCode =
              user.affiliateUsed ||
              // fallback via metadata
              (invoice as any)?.metadata?.affiliateCode ||
              null;

            if (affiliateCode) {
              const affiliateOwner = await User.findOne({ affiliateCode }).select(
                "_id affiliateCode commissionLog"
              );

              if (!affiliateOwner) {
                logger.warn(
                  "[stripe/webhook] Affiliate code not found, skipping commission.",
                  { affiliateCode, userId: String(user._id), invoiceId: invoice.id }
                );
              } else if (String(affiliateOwner._id) === String(user._id)) {
                logger.warn("[stripe/webhook] Self-referral detected; skipping commission.", {
                  userId: String(user._id),
                  affiliateCode,
                  invoiceId: invoice.id,
                });
              } else {
                // evita duplicado por fatura
                const already = (affiliateOwner.commissionLog || []).some(
                  (i: any) =>
                    i.invoiceId === invoice.id && i.source === "affiliate_first_payment"
                );
                if (!already) {
                  const base = commissionBaseCents(invoice as any);
                  const commissionAmount = calcCommissionCents(base);
                  if (commissionAmount > 0) {
                    const currency = normCur(invoice.currency || "brl");
                    const availableAt = addDays(new Date(), HOLD_DAYS);

                    (affiliateOwner as any).commissionLog ||= [];
                    (affiliateOwner as any).commissionLog.push({
                      date: new Date(),
                      description: `Comissão (1ª cobrança) de ${user.email || user._id}`,
                      status: "pending", // ficará "available" no cron
                      currency,
                      amountCents: commissionAmount,
                      buyerId: String(user._id),
                      invoiceId: invoice.id,
                      availableAt,
                      source: "affiliate_first_payment",
                    });

                    await affiliateOwner.save();

                    logger.info("[stripe/webhook] Commission registered as pending.", {
                      affiliateUserId: String(affiliateOwner._id),
                      affiliateCode,
                      invoiceId: invoice.id,
                      amount: commissionAmount,
                      currency,
                      availableAt,
                    });
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
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        const user = await User.findOne({ stripeCustomerId: customerId });
        if (!user) break;
        if (user.lastProcessedEventId === event.id) break;
        user.lastProcessedEventId = event.id;

        user.lastPaymentError = {
          at: new Date(),
          paymentId: String(invoice.id),
          status: "failed",
          statusDetail: String(invoice.last_finalization_error?.message || "unknown"),
        };
        await user.save();
        break;
      }

      case "invoice.voided": {
        // Fatura anulada → reverte comissão se existir
        const invoice = event.data.object as StripeTypes.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const buyer = await User.findOne({ stripeCustomerId: customerId });
        if (!buyer) break;

        const owner = await User.findOne({
          affiliateCode: (buyer as any).affiliateUsed || "__none__",
        });
        if (!owner) break;

        const idx = (owner.commissionLog || []).findIndex(
          (i: any) =>
            i.invoiceId === invoice.id &&
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

      case "charge.refunded": {
        const charge = event.data.object as any;
        const customerId =
          typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
        if (!customerId) break;

        const buyer = await User.findOne({ stripeCustomerId: customerId });
        if (!buyer) break;

        const owner = await User.findOne({
          affiliateCode: (buyer as any).affiliateUsed || "__none__",
        });
        if (!owner) break;

        const invId = typeof charge.invoice === "string" ? charge.invoice : charge.invoice?.id;

        const idx = (owner.commissionLog || []).findIndex((i: any) => {
          if (invId) {
            return (
              i.invoiceId === invId &&
              (i.status === "pending" || i.status === "available")
            );
          }
          return (
            String(i.buyerId || "") === String(buyer._id) &&
            (i.status === "pending" || i.status === "available")
          );
        });

        if (idx >= 0) {
          const e = (owner as any).commissionLog[idx];
          if (e.status === "available") {
            adjustBalance(owner, e.currency, -Math.abs(Number(e.amountCents || 0)));
          }
          e.status = "reversed";
          e.reversedAt = new Date();
          e.reversalReason = "charge.refunded";
          await owner.save();
        }
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

        const update: any = {
          planStatus: sub.cancel_at_period_end ? "canceled" : sub.status,
          stripeSubscriptionId: sub.id,
          stripePriceId: item?.price?.id,
          planInterval: item?.price?.recurring?.interval,
          lastProcessedEventId: event.id,
        };
        if (sub.current_period_end) {
          update.planExpiresAt = new Date(sub.current_period_end * 1000);
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
    // 200 para evitar reentrega infinita quando já logamos erro interno
    return NextResponse.json({ received: true, error: "logged" }, { status: 200 });
  }
}

// Tipos Stripe (evita import global pesado)
declare namespace Stripe {
  export interface Invoice {
    id: string;
    total: number | null;
    amount_paid?: number | null;
    currency?: string;
    subscription: string | { id: string } | null;
    customer: string | { id: string } | null;
    billing_reason?: string;
    last_finalization_error?: { message?: string };
    lines: {
      data: Array<{
        period: { start: number; end: number };
        price?: { recurring?: { interval?: "day" | "week" | "month" | "year" } };
      }>;
    };
    metadata?: Record<string, string>;
  }
  export interface Subscription {
    id: string;
    customer: string | { id: string };
    status:
      | "active"
      | "trialing"
      | "past_due"
      | "unpaid"
      | "canceled"
      | "incomplete"
      | "incomplete_expired"
      | "paused";
    cancel_at_period_end: boolean | null;
    current_period_end: number;
    items: {
      data: Array<{
        id: string;
        price: { id: string; recurring?: { interval?: "day" | "week" | "month" | "year" } };
      }>;
    };
  }
}
