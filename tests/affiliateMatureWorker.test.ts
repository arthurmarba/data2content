/**
 * @jest-environment node
 */
import matureAffiliateCommissions from '@/cron/matureAffiliateCommissions';
import User from '@/app/models/User';

jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/app/models/User', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    updateOne: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

const mockFind = (User as any).find as jest.Mock;
const mockUpdateOne = (User as any).updateOne as jest.Mock;
const mockCount = (User as any).countDocuments as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockCount.mockResolvedValue(0);
});

describe('matureAffiliateCommissions', () => {
  it('promotes entries and is idempotent', async () => {
    const user = {
      _id: 'u1',
      commissionLog: [
        { _id: 'e1', status: 'pending', currency: 'brl', amountCents: 449, availableAt: new Date() },
        { _id: 'e2', status: 'pending', currency: 'usd', amountCents: 299, availableAt: new Date() },
        { _id: 'e3', status: 'pending', currency: 'brl', amountCents: 999, availableAt: new Date() },
      ],
    };
    mockFind.mockResolvedValue([user]);
    mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

    const first = await matureAffiliateCommissions({ maxUsers: 1, maxEntriesPerUser: 10 });
    expect(first.promotedCount).toBe(3);
    expect(first.byCurrency).toEqual({ brl: 2, usd: 1 });
    expect(mockUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'u1', 'commissionLog._id': 'e1' }),
      expect.objectContaining({ $inc: { 'affiliateBalances.brl': 449 } })
    );

    mockUpdateOne.mockResolvedValue({ modifiedCount: 0 });
    const second = await matureAffiliateCommissions({ maxUsers: 1, maxEntriesPerUser: 10 });
    expect(second.promotedCount).toBe(0);
  });

  it('supports dry-run without updating', async () => {
    const user = {
      _id: 'u2',
      commissionLog: [
        { _id: 'e1', status: 'pending', currency: 'brl', amountCents: 100, availableAt: new Date() },
      ],
    };
    mockFind.mockResolvedValue([user]);
    const res = await matureAffiliateCommissions({ dryRun: true });
    expect(res.promotedCount).toBe(1);
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it('handles concurrent calls safely', async () => {
    const user = {
      _id: 'u3',
      commissionLog: [
        { _id: 'e1', status: 'pending', currency: 'brl', amountCents: 100, availableAt: new Date() },
      ],
    };
    mockFind.mockResolvedValue([user]);
    mockUpdateOne
      .mockResolvedValueOnce({ modifiedCount: 1 })
      .mockResolvedValueOnce({ modifiedCount: 0 });

    const [r1, r2] = await Promise.all([
      matureAffiliateCommissions({ maxUsers: 1, maxEntriesPerUser: 1 }),
      matureAffiliateCommissions({ maxUsers: 1, maxEntriesPerUser: 1 }),
    ]);

    expect(r1.promotedCount + r2.promotedCount).toBe(1);
    expect(mockUpdateOne).toHaveBeenCalledTimes(2);
  });
});
