import { Types } from 'mongoose';
import AffiliateRefundProgress from '@/app/models/AffiliateRefundProgress';
import User from '@/app/models/User';
import { COMMISSION_RATE } from '@/config/affiliates';
import { logger } from '@/app/lib/logger';

/** Utility: obtain total refunded paid amount from Stripe invoice or charge */
export function getRefundedPaidTotal(obj: any): number {
  if (!obj) return 0;
  if (obj.object === 'invoice') {
    if (typeof obj.amount_paid_refunded === 'number') return obj.amount_paid_refunded;
    // fallback: sum refunds from charges
    if (Array.isArray(obj.charge)) {
      return obj.charge.reduce((s: number, c: any) => s + (c.amount_refunded || 0), 0);
    }
    return 0;
  }
  if (obj.object === 'charge') {
    return obj.amount_refunded || 0;
  }
  return 0;
}

async function computeDelta(invoiceId: string, affiliateUserId: Types.ObjectId, eventTotal: number) {
  const progress = await AffiliateRefundProgress.findOneAndUpdate(
    { invoiceId, affiliateUserId },
    { $setOnInsert: { refundedPaidCentsTotal: 0 } },
    { upsert: true, new: true }
  );
  const prev = progress?.refundedPaidCentsTotal || 0;
  const delta = Math.max(0, eventTotal - prev);
  return { progress, prev, delta };
}

export async function processAffiliateRefund(invoiceId: string, refundedPaidTotalCents: number) {
  if (!invoiceId) return;

  const owner = await User.findOne({ 'commissionLog.invoiceId': invoiceId });
  if (!owner) return;

  const entry = (owner.commissionLog || []).find((e: any) => e.invoiceId === invoiceId && e.type === 'commission');
  if (!entry) return;

  const affiliateUserId = owner._id as Types.ObjectId;

  const { delta } = await computeDelta(invoiceId, affiliateUserId, refundedPaidTotalCents);
  logger.info('[affiliate:refund] delta', { invoiceId, affiliateUserId: String(affiliateUserId), delta });
  if (delta === 0) return;

  const rate = entry.commissionRateBps ? entry.commissionRateBps / 10000 : COMMISSION_RATE;
  let reverse = Math.round(delta * rate);

  const alreadyReversed = (owner.commissionLog || [])
    .filter((e: any) => e.invoiceId === invoiceId && e.type === 'adjustment' && e.status === 'reversed')
    .reduce((s: number, e: any) => s + Math.abs(Number(e.amountCents || 0)), 0);
  const origCommission = Math.abs(Number(entry.amountCents || 0));
  const maxReversable = origCommission - alreadyReversed;
  if (maxReversable <= 0) {
    await AffiliateRefundProgress.updateOne(
      { invoiceId, affiliateUserId },
      { $set: { refundedPaidCentsTotal: refundedPaidTotalCents } }
    );
    return;
  }
  reverse = Math.min(reverse, maxReversable);
  if (reverse <= 0) return;

  const cur = entry.currency;
  owner.affiliateBalances ||= new Map();
  owner.affiliateDebtByCurrency ||= new Map();

  if (entry.status === 'pending') {
    if (reverse >= entry.amountCents) {
      entry.amountCents = 0;
      entry.status = 'canceled';
    } else {
      entry.amountCents -= reverse;
    }
  } else if (entry.status === 'available') {
    const prevBal = owner.affiliateBalances.get(cur) ?? 0;
    let balDec = reverse;
    let debtInc = 0;
    if (prevBal < reverse) {
      balDec = prevBal;
      debtInc = reverse - prevBal;
    }
    owner.affiliateBalances.set(cur, Math.max(prevBal - balDec, 0));
    if (debtInc > 0) {
      const prevDebt = owner.affiliateDebtByCurrency.get(cur) ?? 0;
      owner.affiliateDebtByCurrency.set(cur, prevDebt + debtInc);
      owner.markModified('affiliateDebtByCurrency');
    }
    owner.markModified('affiliateBalances');
    owner.commissionLog.push({
      type: 'adjustment',
      status: 'reversed',
      invoiceId,
      affiliateUserId,
      currency: cur,
      amountCents: -reverse,
      note: 'refund partial/total',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  } else if (entry.status === 'paid') {
    const prevDebt = owner.affiliateDebtByCurrency.get(cur) ?? 0;
    owner.affiliateDebtByCurrency.set(cur, prevDebt + reverse);
    owner.markModified('affiliateDebtByCurrency');
    owner.commissionLog.push({
      type: 'adjustment',
      status: 'reversed',
      invoiceId,
      affiliateUserId,
      currency: cur,
      amountCents: -reverse,
      note: 'refund partial/total',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  await owner.save();
  await AffiliateRefundProgress.updateOne(
    { invoiceId, affiliateUserId },
    { $set: { refundedPaidCentsTotal: refundedPaidTotalCents } }
  );
}

export { computeDelta };
