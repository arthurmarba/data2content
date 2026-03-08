import { calcCommissionCents, getCommissionRateBps } from './calcCommissionCents';

describe('calcCommissionCents', () => {
  test('calculates 50% of amount paid', () => {
    expect(
      calcCommissionCents({
        amount_paid: 9000,
      } as any)
    ).toBe(4500);
    expect(getCommissionRateBps()).toBe(5000);
  });

  test('returns zero when invoice has no paid amount', () => {
    expect(calcCommissionCents({ amount_paid: 0 } as any)).toBe(0);
  });
});
