import { canRedeem } from './useAffiliateSummary';

describe('canRedeem', () => {
  const status = { payouts_enabled: true, default_currency: 'brl' } as any;
  const summary = {
    balances: { brl: 10000, usd: 0 },
    debt: { brl: 0 },
    min: { brl: 5000 }
  } as any;

  test('allows redeem when all conditions met', () => {
    expect(canRedeem(status, summary, 'brl')).toBe(true);
  });

  test('blocks when payouts disabled', () => {
    expect(canRedeem({ ...status, payouts_enabled: false }, summary, 'brl')).toBe(false);
  });

  test('blocks when debt exists', () => {
    const s = { ...summary, debt: { brl: 100 } };
    expect(canRedeem(status, s, 'brl')).toBe(false);
  });

  test('blocks when below minimum', () => {
    const s = { ...summary, balances: { brl: 1000 }, min: { brl: 5000 } };
    expect(canRedeem(status, s, 'brl')).toBe(false);
  });

  test('blocks when currency mismatch', () => {
    expect(canRedeem(status, summary, 'usd')).toBe(false);
  });
});
