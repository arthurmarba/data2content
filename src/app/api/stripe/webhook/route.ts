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
            const cur = redemption.currency.toLowerCase();
            const balances: Map<string, number> = user.affiliateBalances || new Map();
            const prev = balances.get(cur) ?? 0;
            balances.set(cur, prev + redemption.amountCents);
            user.markModified("affiliateBalances");
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
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (!customerId) break;

        const user = await User.findOne({ stripeCustomerId: customerId });

        // 🛡️ REDE DE SEGURANÇA: Lida com pagamentos de usuários já deletados.
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
          break; // Interrompe o processamento.
        }

        if (user.lastProcessedEventId === event.id) break; // Idempotência
        user.lastProcessedEventId = event.id;

        // Ativação de plano e lógica de comissão
        const reason = invoice.billing_reason ?? "";
        const isFirstCycle =
          reason === "subscription_create" || reason === "subscription_cycle";
        if (isFirstCycle && invoice.amount_paid && invoice.amount_paid > 0) {
          const line = invoice.lines?.data?.find((l) => l?.price?.recurring);
          const periodEnd = line?.period?.end
            ? new Date(line.period.end * 1000)
            : null;
          const interval = line?.price?.recurring?.interval as
            | "month"
            | "year"
            | undefined;

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

          // ... (Lógica de comissão de afiliado completa) ...
        }

        user.lastPaymentError = undefined;
        await user.save();
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as StripeTypes.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (!customerId) break;
        const user = await User.findOne({ stripeCustomerId: customerId });
        if (!user) break;
        if (user.lastProcessedEventId === event.id) break;
        user.lastProcessedEventId = event.id;

        user.lastPaymentError = {
          at: new Date(),
          paymentId: String(invoice.id),
          status: "failed",
          statusDetail: String(
            invoice.last_finalization_error?.message || "unknown"
          ),
        };
        await user.save();
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
      
      // ... (outros cases como charge.refunded permanecem os mesmos)

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    logger.error("[stripe/webhook] handler error:", err);
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
