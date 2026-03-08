import { getAffiliateCouponValidationError, AFFILIATE_COUPON_DURATION } from './affiliateCouponRules';

describe('affiliate coupon rules', () => {
  test('accepts a 10% once coupon', () => {
    expect(
      getAffiliateCouponValidationError({
        id: 'coupon_aff',
        object: 'coupon',
        amount_off: null,
        applies_to: null,
        created: 0,
        currency: null,
        currency_options: {},
        duration: AFFILIATE_COUPON_DURATION,
        duration_in_months: null,
        livemode: false,
        max_redemptions: null,
        metadata: {},
        name: 'Affiliate 10 once',
        percent_off: 10,
        redeem_by: null,
        times_redeemed: 0,
        valid: true,
      } as any)
    ).toBeNull();
  });

  test('rejects coupon with wrong discount percent', () => {
    expect(
      getAffiliateCouponValidationError({
        id: 'coupon_aff',
        object: 'coupon',
        duration: AFFILIATE_COUPON_DURATION,
        percent_off: 15,
      } as any)
    ).toContain('10%');
  });

  test('rejects coupon with recurring duration', () => {
    expect(
      getAffiliateCouponValidationError({
        id: 'coupon_aff',
        object: 'coupon',
        duration: 'forever',
        percent_off: 10,
      } as any)
    ).toContain('primeira cobrança');
  });
});
