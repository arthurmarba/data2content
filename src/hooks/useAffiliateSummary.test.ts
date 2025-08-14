import { canRedeem } from './useAffiliateSummary';
import { AffiliateSummary, AffiliateStatus } from '@/types/affiliate';
import { REDEEM_BLOCK_MESSAGES } from '@/copy/affiliates';

describe('canRedeem', () => {
  const status: AffiliateStatus = { payoutsEnabled: true, defaultCurrency: 'BRL' } as any;
  const summary: AffiliateSummary = {
    byCurrency: {
      BRL: { availableCents: 10000, pendingCents: 0, debtCents: 0, nextMatureAt: null, minRedeemCents: 5000 },
      USD: { availableCents: 0, pendingCents: 0, debtCents: 0, nextMatureAt: null, minRedeemCents: 0 },
    },
  };

  test('allows redeem when all conditions met', () => {
    expect(canRedeem(status, summary, 'BRL')).toBe(true);
  });

  test('blocks when payouts disabled', () => {
    expect(canRedeem({ ...status, payoutsEnabled: false }, summary, 'BRL')).toBe(false);
  });

  test('blocks when debt exists', () => {
    const s: AffiliateSummary = {
      byCurrency: { ...summary.byCurrency, BRL: { ...summary.byCurrency.BRL, debtCents: 100 } },
    };
    expect(canRedeem(status, s, 'BRL')).toBe(false);
  });

  test('blocks when below minimum', () => {
    const s: AffiliateSummary = {
      byCurrency: { ...summary.byCurrency, BRL: { ...summary.byCurrency.BRL, availableCents: 1000 } },
    };
    expect(canRedeem(status, s, 'BRL')).toBe(false);
  });

  test('blocks when currency mismatch', () => {
    expect(canRedeem(status, summary, 'USD')).toBe(false);
  });
});

describe('redeem block messages', () => {
  test('snapshot of messages', () => {
    expect(REDEEM_BLOCK_MESSAGES).toMatchSnapshot();
  });
});
