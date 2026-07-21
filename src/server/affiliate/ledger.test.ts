import { normalizedBalanceMap, summarizeAffiliateLedger } from './ledger';

describe('affiliate ledger reconciliation', () => {
  it('uses available commissions as the source of truth instead of a corrupt balance map', () => {
    const ledger = summarizeAffiliateLedger([
      { type: 'commission', status: 'available', currency: 'brl', amountCents: 2246 },
      { type: 'commission', status: 'pending', currency: 'brl', amountCents: 2495 },
    ]);

    expect(ledger.BRL).toMatchObject({ availableCents: 2246, pendingCents: 2495 });
    expect(normalizedBalanceMap({ brl: 11471761 }).BRL).toBe(11471761);
    expect(ledger.BRL!.availableCents).not.toBe(normalizedBalanceMap({ brl: 11471761 }).BRL);
  });

  it('accounts for refund adjustments and legacy manual redemptions', () => {
    const ledger = summarizeAffiliateLedger([
      { type: 'commission', status: 'available', currency: 'brl', amountCents: 5000 },
      { type: 'adjustment', status: 'reversed', currency: 'brl', amountCents: -1000 },
      { type: 'redeem', status: 'paid', currency: 'brl', amountCents: 2000 },
    ]);

    expect(ledger.BRL!.availableCents).toBe(2000);
  });
});
