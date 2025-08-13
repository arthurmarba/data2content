import { mapStripeAccountInfo } from '@/app/services/stripe/mapAccountInfo';

describe('mapStripeAccountInfo', () => {
  it('maps verified account', () => {
    const account: any = {
      id: 'acct_1',
      payouts_enabled: true,
      charges_enabled: true,
      default_currency: 'BRL',
      requirements: { currently_due: [], past_due: [], disabled_reason: null },
      capabilities: { card_payments: 'active', transfers: 'active' },
    };
    const info = mapStripeAccountInfo(account);
    expect(info.stripeAccountStatus).toBe('verified');
    expect(info.needsOnboarding).toBe(false);
  });

  it('maps pending account when requirements due', () => {
    const account: any = {
      id: 'acct_2',
      payouts_enabled: false,
      charges_enabled: true,
      default_currency: 'BRL',
      requirements: { currently_due: ['external_account'], past_due: [] },
      capabilities: { card_payments: 'pending', transfers: 'inactive' },
    };
    const info = mapStripeAccountInfo(account);
    expect(info.stripeAccountStatus).toBe('pending');
    expect(info.needsOnboarding).toBe(true);
  });

  it('maps disabled account when disabled_reason present', () => {
    const account: any = {
      id: 'acct_3',
      payouts_enabled: true,
      charges_enabled: true,
      default_currency: 'BRL',
      requirements: { currently_due: [], past_due: [], disabled_reason: 'requirements.past_due' },
      capabilities: { card_payments: 'active', transfers: 'active' },
    };
    const info = mapStripeAccountInfo(account);
    expect(info.stripeAccountStatus).toBe('disabled');
    expect(info.disabled_reason).toBe('requirements.past_due');
  });
});
