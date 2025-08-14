import { canRedeem, AffiliateSummary, AffiliateStatus } from './useAffiliateSummary';
import { REDEEM_BLOCK_MESSAGES } from '@/copy/affiliates';

describe('canRedeem', () => {
  const status: AffiliateStatus = { payoutsEnabled: true, defaultCurrency: 'brl' } as any;
  const summary: AffiliateSummary = {
    balances: { brl: 10000, usd: 0 },
    debt: { brl: 0 },
    min: { brl: 5000 },
    pending: {},
    byCurrency: {
      brl: { availableCents: 10000, pendingCents: 0, debtCents: 0, minRedeemCents: 5000 },
      usd: { availableCents: 0, pendingCents: 0, debtCents: 0 },
    },
  } as any;

  test('allows redeem when all conditions met', () => {
    expect(canRedeem(status, summary, 'brl')).toBe(true);
  });

  test('blocks when payouts disabled', () => {
    expect(canRedeem({ ...status, payoutsEnabled: false }, summary, 'brl')).toBe(false);
  });

  test('blocks when debt exists', () => {
    const s = {
      ...summary,
      byCurrency: { ...summary.byCurrency, brl: { ...summary.byCurrency.brl, debtCents: 100 } },
    };
    expect(canRedeem(status, s, 'brl')).toBe(false);
  });

  test('blocks when below minimum', () => {
    const s = {
      ...summary,
      byCurrency: { ...summary.byCurrency, brl: { ...summary.byCurrency.brl, availableCents: 1000 } },
    };
    expect(canRedeem(status, s, 'brl')).toBe(false);
  });

  test('blocks when currency mismatch', () => {
    expect(canRedeem(status, summary, 'usd')).toBe(false);
  });
});

describe('redeem block messages', () => {
  test('snapshot of messages', () => {
    expect(REDEEM_BLOCK_MESSAGES).toMatchSnapshot();
  });
});
