/**
 * @jest-environment node
 */
import { calcCommissionCents } from '@/app/services/affiliate/calcCommissionCents';

describe('calcCommissionCents', () => {
  it('calculates 10% of amount_paid with rounding', () => {
    const invoice: any = { amount_paid: 105 }; // R$1.05 -> commission 10.5 -> 11
    expect(calcCommissionCents(invoice)).toBe(11);
  });

  it('returns zero when amount_paid is 0', () => {
    const invoice: any = { amount_paid: 0 };
    expect(calcCommissionCents(invoice)).toBe(0);
  });
});
