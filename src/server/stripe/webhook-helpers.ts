import { User } from "@/server/db/models/User";
import {
  AffiliateInvoiceIndex,
  AffiliateSubscriptionIndex,
} from "@/server/db/models/AffiliateIndexes";
import type Stripe from "stripe";
import { withMongoTransientRetry } from "@/app/lib/mongoTransient";
import { calcCommissionCents as calcAffiliateCommissionCents } from "@/app/services/affiliate/calcCommissionCents";

export async function findUserByCustomerId(customerId: string) {
  return withMongoTransientRetry(
    () => User.findOne({ stripeCustomerId: customerId }),
    { retries: 1 }
  );
}

type MarkEventOptions = {
  commit?: boolean;
};

export async function markEventIfNew(
  user: any,
  eventId: string,
  opts?: MarkEventOptions
): Promise<boolean> {
  if (!eventId) return true;
  if (user.lastProcessedEventId === eventId) return false;
  if (opts?.commit === false) return true;
  user.lastProcessedEventId = eventId;
  return true;
}

/**
 * Garante idempotência por fatura + afiliado.
 * Retorna true se CRIOU o índice agora; false se já existia.
 */
export async function ensureInvoiceIdempotent(invoiceId: string, affiliateUserId: string) {
  const res = await withMongoTransientRetry(
    () =>
      AffiliateInvoiceIndex.updateOne(
        { invoiceId, affiliateUserId },
        { $setOnInsert: { invoiceId, affiliateUserId, createdAt: new Date() } },
        { upsert: true }
      ),
    { retries: 1 }
  );
  return (res.upsertedCount ?? 0) > 0;
}

/**
 * Garante que uma assinatura só gere comissão na primeira fatura.
 * Retorna true se CRIOU o índice agora; false se já existia.
 */
export async function ensureSubscriptionFirstTime(subscriptionId: string, affiliateUserId: string) {
  const res = await withMongoTransientRetry(
    () =>
      AffiliateSubscriptionIndex.updateOne(
        { subscriptionId, affiliateUserId },
        { $setOnInsert: { subscriptionId, affiliateUserId, createdAt: new Date() } },
        { upsert: true }
      ),
    { retries: 1 }
  );
  return (res.upsertedCount ?? 0) > 0;
}

export function calcCommissionCents(invoice: Stripe.Invoice) {
  return calcAffiliateCommissionCents(invoice);
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
