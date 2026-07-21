import { User } from "@/server/db/models/User";
import {
  AffiliateInvoiceIndex,
  AffiliateSubscriptionIndex,
  AffiliateBuyerCommissionIndex,
} from "@/server/db/models/AffiliateIndexes";
import type Stripe from "stripe";
import { withMongoTransientRetry } from "@/app/lib/mongoTransient";
import { calcCommissionCents as calcAffiliateCommissionCents } from "@/app/services/affiliate/calcCommissionCents";

let buyerCommissionIndexReady: Promise<unknown> | null = null;

function ensureBuyerCommissionIndex() {
  buyerCommissionIndexReady ||= AffiliateBuyerCommissionIndex.createIndexes();
  return buyerCommissionIndexReady;
}

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
 * Reservas existentes continuam válidas para permitir retomada após falha.
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
  // Existing reservation is resumable. The ledger write itself is guarded by
  // invoiceId, so a crash after reserving the key cannot permanently lose a
  // commission and a replay still cannot duplicate it.
  return (res.upsertedCount ?? 0) > 0 || (res.matchedCount ?? 0) > 0;
}

/**
 * Garante que uma assinatura só gere comissão na primeira fatura.
 * A gravação atômica no ledger é a barreira final contra duplicação.
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
  return (res.upsertedCount ?? 0) > 0 || (res.matchedCount ?? 0) > 0;
}

/** Garante a comissão única para o criador indicado, inclusive após uma nova assinatura. */
export async function ensureBuyerFirstCommission(
  buyerUserId: string,
  affiliateUserId: string,
  invoiceId: string,
) {
  await ensureBuyerCommissionIndex();
  const res = await withMongoTransientRetry(
    () =>
      AffiliateBuyerCommissionIndex.updateOne(
        { buyerUserId },
        { $setOnInsert: { buyerUserId, affiliateUserId, invoiceId, createdAt: new Date() } },
        { upsert: true },
      ),
    { retries: 1 },
  );
  if ((res.upsertedCount ?? 0) > 0) return true;

  const existing = await (AffiliateBuyerCommissionIndex as any)
    .findOne({ buyerUserId })
    .lean();
  return Boolean(
    existing &&
      String(existing.affiliateUserId) === String(affiliateUserId) &&
      existing.invoiceId === invoiceId
  );
}

export function calcCommissionCents(invoice: Stripe.Invoice) {
  return calcAffiliateCommissionCents(invoice);
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
