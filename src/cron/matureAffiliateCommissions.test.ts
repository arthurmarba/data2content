/** @jest-environment node */

jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/lib/mongoTransient', () => ({
  withMongoTransientRetry: jest.fn(async (fn: any) => fn()),
  isTransientMongoError: jest.fn(() => false),
  getErrorMessage: jest.fn((error: any) => error?.message || String(error)),
}));
jest.mock('@/app/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/app/lib/telemetry', () => ({
  metrics: {
    affiliates_mature_promoted_total: { inc: jest.fn() },
    affiliates_mature_run_duration_ms: { observe: jest.fn() },
    affiliates_pending_count: { set: jest.fn() },
  },
  logAffiliateEvent: jest.fn(),
}));
jest.mock('@/app/models/User', () => ({ find: jest.fn(), updateOne: jest.fn(), countDocuments: jest.fn() }));

import User from '@/app/models/User';
import { matureAffiliateCommissions } from './matureAffiliateCommissions';

describe('matureAffiliateCommissions', () => {
  it('atomically targets the same pending entry that is credited', async () => {
    const dueAt = new Date('2026-01-01T00:00:00.000Z');
    (User as any).find.mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: 'affiliate-1',
            commissionLog: [
              { _id: 'entry-1', type: 'commission', status: 'pending', availableAt: dueAt, currency: 'brl', amountCents: 1000 },
            ],
          },
        ]),
      }),
    });
    (User as any).updateOne.mockResolvedValue({ modifiedCount: 1 });
    (User as any).countDocuments.mockResolvedValue(0);

    const result = await matureAffiliateCommissions({ maxUsers: 1 });

    expect(result.promotedCount).toBe(1);
    expect((User as any).updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        commissionLog: {
          $elemMatch: expect.objectContaining({ _id: 'entry-1', status: 'pending' }),
        },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ 'commissionLog.$[entry].status': 'available' }),
        $inc: { 'affiliateBalances.brl': 1000 },
      }),
      expect.objectContaining({
        arrayFilters: [expect.objectContaining({ 'entry._id': 'entry-1', 'entry.status': 'pending' })],
      }),
    );
  });
});
