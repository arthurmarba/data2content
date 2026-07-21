/** @jest-environment node */
import mongoose, { Types } from 'mongoose';
import { computeDelta, processAffiliateRefund } from '@/app/services/affiliate/refundCommission';
import AffiliateRefundProgress from '@/app/models/AffiliateRefundProgress';
import User from '@/app/models/User';

jest.mock('@/app/models/AffiliateRefundProgress', () => ({
  updateOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  collection: {
    findOne: jest.fn(),
  },
}));
jest.mock('@/app/models/User', () => ({
  findOne: jest.fn(),
}));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));

describe('affiliate refund', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(mongoose, 'startSession').mockResolvedValue({
      withTransaction: async (fn: () => Promise<void>) => fn(),
      endSession: jest.fn(),
    } as any);
  });

  it('delta idempotent', async () => {
    ((AffiliateRefundProgress as any).collection.findOne as jest.Mock)
      .mockResolvedValueOnce({ refundedPaidCentsTotal: 0 })
      .mockResolvedValueOnce({ refundedPaidCentsTotal: 1000 });
    const { delta } = await computeDelta('inv1', new Types.ObjectId(), 1000);
    expect(delta).toBe(1000);
    const { delta: delta2 } = await computeDelta('inv1', new Types.ObjectId(), 1000);
    expect(delta2).toBe(0);
  });

  it('paid commission increases debt and logs adjustment', async () => {
    const user = {
      _id: new Types.ObjectId(),
      commissionLog: [
        { type: 'commission', status: 'paid', invoiceId: 'inv1', currency: 'brl', amountCents: 500 },
      ],
      affiliateBalances: new Map<string, number>(),
      affiliateDebtByCurrency: new Map<string, number>(),
      save: jest.fn(),
      markModified: jest.fn(),
    } as any;
    const progress = { refundedPaidCentsTotal: 0, reversedCommissionCentsTotal: 0, save: jest.fn() };
    (AffiliateRefundProgress.findOneAndUpdate as jest.Mock).mockResolvedValue(progress);
    (User.findOne as jest.Mock).mockReturnValue({ session: jest.fn().mockResolvedValue(user) });
    await processAffiliateRefund('inv1', 1000);
    expect(user.affiliateDebtByCurrency.get('brl')).toBe(500);
    expect(
      user.commissionLog.some(
        (e: any) => e.type === 'adjustment' && e.status === 'reversed' && e.amountCents === -500
      )
    ).toBe(true);
    expect(progress.refundedPaidCentsTotal).toBe(1000);
    expect(progress.reversedCommissionCentsTotal).toBe(500);
  });

  it('uses the cumulative target so split refunds do not lose rounding cents', async () => {
    const user = {
      _id: new Types.ObjectId(),
      commissionLog: [
        {
          type: 'commission',
          status: 'pending',
          invoiceId: 'inv_split',
          currency: 'brl',
          amountCents: 1,
          commissionRateBps: 3333,
        },
      ],
      affiliateBalances: new Map<string, number>(),
      affiliateDebtByCurrency: new Map<string, number>(),
      save: jest.fn(),
      markModified: jest.fn(),
    } as any;
    const progress = {
      refundedPaidCentsTotal: 0,
      reversedCommissionCentsTotal: 0,
      save: jest.fn(),
    };
    (AffiliateRefundProgress.findOneAndUpdate as jest.Mock).mockResolvedValue(progress);
    (User.findOne as jest.Mock).mockReturnValue({ session: jest.fn().mockResolvedValue(user) });

    await processAffiliateRefund('inv_split', 1);
    expect(user.commissionLog[0].amountCents).toBe(1);
    await processAffiliateRefund('inv_split', 3);
    expect(user.commissionLog[0]).toMatchObject({ amountCents: 0, status: 'canceled' });
    expect(progress.reversedCommissionCentsTotal).toBe(1);
  });
});
