import { User } from "@/server/db/models/User";
import {
  AffiliateInvoiceIndex,
  AffiliateSubscriptionIndex,
  AffiliateRefundProgress,
} from "@/server/db/models/AffiliateIndexes";
import type Stripe from "stripe";

export async function findUserByCustomerId(customerId: string) {
  return User.findOne({ stripeCustomerId: customerId });
}

export async function markEventIfNew(user: any, eventId: string): Promise<boolean> {
  if (user.lastProcessedEventId === eventId) return false;
  user.lastProcessedEventId = eventId;
  await user.save();
  return true;
}

/**
 * Garante idempotência por fatura + afiliado.
 * Retorna true se CRIOU o índice agora; false se já existia.
 */
export async function ensureInvoiceIdempotent(invoiceId: string, affiliateUserId: string) {
  const res = await AffiliateInvoiceIndex.updateOne(
    { invoiceId, affiliateUserId },
    { $setOnInsert: { invoiceId, affiliateUserId, createdAt: new Date() } },
    { upsert: true }
  );
  return (res.upsertedCount ?? 0) > 0;
}

/**
 * Garante que uma assinatura só gere comissão na primeira fatura.
 * Retorna true se CRIOU o índice agora; false se já existia.
 */
export async function ensureSubscriptionFirstTime(subscriptionId: string, affiliateUserId: string) {
  const res = await AffiliateSubscriptionIndex.updateOne(
    { subscriptionId, affiliateUserId },
    { $setOnInsert: { subscriptionId, affiliateUserId, createdAt: new Date() } },
    { upsert: true }
  );
  return (res.upsertedCount ?? 0) > 0;
}

export function cents(n: number) {
  return Math.round(n ?? 0);
}

export function calcCommissionCents(invoice: Stripe.Invoice) {
  const rate = Number(process.env.COMMISSION_RATE_BPS ?? "1000") / 10000; // default 10%
  const paid = Number(invoice.amount_paid ?? 0);
  return cents(paid * rate);
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
