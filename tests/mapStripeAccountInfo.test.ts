import { mapStripeAccountInfo } from '@/app/services/stripe/mapAccountInfo';

describe('mapStripeAccountInfo', () => {
  it('maps verified account', () => {
    const account: any = {
      id: 'acct_1',
      payouts_enabled: true,
      default_currency: 'BRL',
      country: 'BR',
      requirements: { currently_due: [], past_due: [], disabled_reason: null },
    };
    const info = mapStripeAccountInfo(account);
    expect(info.payoutsEnabled).toBe(true);
    expect(info.needsOnboarding).toBe(false);
    expect(info.defaultCurrency).toBe('BRL');
  });

  it('maps pending account when requirements due', () => {
    const account: any = {
      id: 'acct_2',
      payouts_enabled: false,
      default_currency: 'BRL',
      requirements: { currently_due: ['external_account'], past_due: [] },
    };
    const info = mapStripeAccountInfo(account);
    expect(info.payoutsEnabled).toBe(false);
    expect(info.needsOnboarding).toBe(true);
  });

  it('maps disabled account when disabled_reason present', () => {
    const account: any = {
      id: 'acct_3',
      payouts_enabled: true,
      default_currency: 'BRL',
      requirements: { currently_due: [], past_due: [], disabled_reason: 'requirements.past_due' },
    };
    const info = mapStripeAccountInfo(account);
    expect(info.disabledReasonKey).toBe('requirements.past_due');
    expect(info.isUnderReview).toBe(false);
  });
});
