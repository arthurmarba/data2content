/** @jest-environment node */
jest.mock('@/app/lib/mongoTransient', () => ({
  withMongoTransientRetry: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}));
jest.mock('@/server/db/models/User', () => ({ User: {} }));
jest.mock('@/server/db/models/AffiliateIndexes', () => ({
  AffiliateInvoiceIndex: { updateOne: jest.fn() },
  AffiliateSubscriptionIndex: { updateOne: jest.fn() },
  AffiliateBuyerCommissionIndex: {
    createIndexes: jest.fn().mockResolvedValue(undefined),
    updateOne: jest.fn(),
    findOne: jest.fn(),
  },
}));

import {
  AffiliateBuyerCommissionIndex,
  AffiliateInvoiceIndex,
} from '@/server/db/models/AffiliateIndexes';
import {
  ensureBuyerFirstCommission,
  ensureInvoiceIdempotent,
} from './webhook-helpers';

describe('affiliate webhook reservations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows an existing invoice reservation to resume the ledger write', async () => {
    (AffiliateInvoiceIndex.updateOne as jest.Mock).mockResolvedValue({
      upsertedCount: 0,
      matchedCount: 1,
    });
    await expect(ensureInvoiceIdempotent('in_1', 'owner_1')).resolves.toBe(true);
  });

  it('resumes only the same buyer/affiliate/invoice reservation', async () => {
    (AffiliateBuyerCommissionIndex.updateOne as jest.Mock).mockResolvedValue({ upsertedCount: 0 });
    (AffiliateBuyerCommissionIndex.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        buyerUserId: 'buyer_1',
        affiliateUserId: 'owner_1',
        invoiceId: 'in_1',
      }),
    });

    await expect(ensureBuyerFirstCommission('buyer_1', 'owner_1', 'in_1')).resolves.toBe(true);
    await expect(ensureBuyerFirstCommission('buyer_1', 'owner_2', 'in_2')).resolves.toBe(false);
  });
});
