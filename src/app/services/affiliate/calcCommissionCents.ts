import type { Stripe } from 'stripe';
import { COMMISSION_RATE, COMMISSION_BASE } from '@/config/affiliates';

/**
 * Calculate commission amount in cents based on a Stripe invoice.
 * All arithmetic uses integers to avoid float errors.
 */
export function calcCommissionCents(invoice: Stripe.Invoice): number {
  let baseCents = 0;
  if (COMMISSION_BASE === 'amount_paid') {
    baseCents = invoice.amount_paid ?? 0;
  } else {
    const subtotal = invoice.subtotal_excluding_tax ?? invoice.subtotal ?? 0;
    const discountTotal = Array.isArray((invoice as any).total_discount_amounts)
      ? (invoice as any).total_discount_amounts.reduce(
          (sum: number, d: any) => sum + (d.amount || 0),
          0,
        )
      : 0;
    baseCents = subtotal - discountTotal;
  }
  if (baseCents <= 0) return 0;
  return Math.round(baseCents * COMMISSION_RATE);
}
