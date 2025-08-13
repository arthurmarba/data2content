/**
 * @jest-environment node
 */
import { Types } from 'mongoose';
import { calcCommissionCents } from '@/app/services/affiliate/calcCommissionCents';
import { AFFILIATE_HOLD_DAYS } from '@/config/affiliates';
import { normCur } from '@/utils/normCur';

function addDays(d: Date, days: number) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt;
}

describe('pending commission entry', () => {
  it('creates pending entry with lowercased currency and hold days', () => {
    const now = new Date();
    const invoice: any = { amount_paid: 1000, currency: 'USD', id: 'inv1', subscription: 'sub1' };
    const amount = calcCommissionCents(invoice);
    const entry = {
      type: 'commission',
      status: 'pending',
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      affiliateUserId: new Types.ObjectId(),
      buyerUserId: new Types.ObjectId(),
      currency: normCur(invoice.currency),
      amountCents: amount,
      availableAt: addDays(now, AFFILIATE_HOLD_DAYS),
    };
    expect(entry.status).toBe('pending');
    expect(entry.currency).toBe('usd');
    const diffDays = Math.round((entry.availableAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(AFFILIATE_HOLD_DAYS);
  });
});
