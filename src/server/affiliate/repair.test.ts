import { buildAffiliateRepairPlan } from './repair';

describe('affiliate repair plan', () => {
  it('keeps the first commission, cancels pending renewals, and rebuilds the balance', () => {
    const plan = buildAffiliateRepairPlan(
      [
        { _id: 'first', type: 'commission', status: 'available', buyerUserId: 'buyer-1', currency: 'brl', amountCents: 2246, createdAt: '2026-04-01' },
        { _id: 'renewal', type: 'commission', status: 'pending', buyerUserId: 'buyer-1', currency: 'brl', amountCents: 2495, createdAt: '2026-05-01' },
      ],
      { brl: 11471761 },
    );

    expect(plan.cancelPendingEntryIds).toEqual(['renewal']);
    expect(plan.nextBalances).toEqual({ brl: 2246 });
    expect(plan.balanceChanged).toBe(true);
    expect(plan.requiresManualReview).toBe(false);
  });

  it('does not automatically alter a duplicate that has already been paid', () => {
    const plan = buildAffiliateRepairPlan([
      { _id: 'first', type: 'commission', status: 'paid', buyerUserId: 'buyer-1', currency: 'brl', amountCents: 1000, createdAt: '2026-04-01' },
      { _id: 'duplicate', type: 'commission', status: 'available', buyerUserId: 'buyer-1', currency: 'brl', amountCents: 1000, createdAt: '2026-05-01' },
    ]);

    expect(plan.cancelPendingEntryIds).toEqual([]);
    expect(plan.requiresManualReview).toBe(true);
  });
});
