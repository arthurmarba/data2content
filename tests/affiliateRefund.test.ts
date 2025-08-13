/** @jest-environment node */
import { Types } from 'mongoose';
import { computeDelta, processAffiliateRefund } from '@/app/services/affiliate/refundCommission';
import AffiliateRefundProgress from '@/app/models/AffiliateRefundProgress';
import User from '@/app/models/User';

jest.mock('@/app/models/AffiliateRefundProgress', () => ({
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('@/app/models/User', () => ({
  findOne: jest.fn(),
}));

describe('affiliate refund', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delta idempotent', async () => {
    (AffiliateRefundProgress.findOneAndUpdate as jest.Mock)
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
    (AffiliateRefundProgress.findOneAndUpdate as jest.Mock).mockResolvedValue({ refundedPaidCentsTotal: 0 });
    (AffiliateRefundProgress.updateOne as jest.Mock).mockResolvedValue({});
    (User.findOne as jest.Mock).mockResolvedValue(user);
    await processAffiliateRefund('inv1', 1000);
    expect(user.affiliateDebtByCurrency.get('brl')).toBe(100);
    expect(
      user.commissionLog.some(
        (e: any) => e.type === 'adjustment' && e.status === 'reversed' && e.amountCents === -100
      )
    ).toBe(true);
  });
});
