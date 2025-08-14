import type Stripe from "stripe";
import { processAffiliateRefund as legacyProcessAffiliateRefund, getRefundedPaidTotal } from "@/app/services/affiliate/refundCommission";

export async function processAffiliateRefund(invoiceId: string, refundedPaidCentsTotal?: number, charge?: Stripe.Charge) {
  let total = refundedPaidCentsTotal;
  if (total == null) {
    total = getRefundedPaidTotal(charge as any);
  }
  if (total == null) return;
  await legacyProcessAffiliateRefund(invoiceId, total);
}
