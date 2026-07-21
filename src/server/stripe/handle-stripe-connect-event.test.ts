/** @jest-environment node */
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/server/db/models/User', () => ({
  User: { findOne: jest.fn(), updateOne: jest.fn() },
}));
jest.mock('@/app/models/Redemption', () => ({ findOne: jest.fn() }));

import mongoose from 'mongoose';
import { User } from '@/server/db/models/User';
import Redemption from '@/app/models/Redemption';
import { handleStripeConnectEvent } from './handle-stripe-connect-event';

describe('handleStripeConnectEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(mongoose, 'startSession').mockResolvedValue({
      withTransaction: async (fn: () => Promise<void>) => fn(),
      endSession: jest.fn(),
    } as any);
  });

  it('credits only the new partial reversal amount using the destination account', async () => {
    const redemption = {
      _id: 'red_1',
      userId: 'user_1',
      amountCents: 1000,
      currency: 'brl',
      reversedAmountCents: 200,
      status: 'paid',
      reasonCode: null as string | null,
      accountId: 'acct_destination',
      save: jest.fn(),
    };
    (Redemption as any).findOne.mockReturnValue({
      session: jest.fn().mockResolvedValue(redemption),
    });
    (User as any).updateOne.mockResolvedValue({ modifiedCount: 1 });

    await handleStripeConnectEvent({
      type: 'transfer.reversed',
      data: {
        object: {
          id: 'tr_1',
          object: 'transfer',
          destination: 'acct_destination',
          amount: 1000,
          amount_reversed: 500,
          reversed: false,
          currency: 'brl',
        },
      },
    } as any);

    expect((User as any).updateOne).toHaveBeenCalledWith(
      { _id: 'user_1' },
      expect.objectContaining({
        $inc: { 'affiliateBalances.brl': 300 },
        $push: { commissionLog: expect.objectContaining({ amountCents: 300, transferId: 'tr_1' }) },
      }),
      expect.any(Object),
    );
    expect(redemption.reversedAmountCents).toBe(500);
    expect(redemption.reasonCode).toBe('transfer_partially_reversed');
  });

  it('does not re-credit a failed bank payout as affiliate balance', async () => {
    (User as any).updateOne.mockResolvedValue({ modifiedCount: 1 });

    await handleStripeConnectEvent({
      type: 'payout.failed',
      account: 'acct_1',
      data: { object: { object: 'payout', failure_code: 'account_closed' } },
    } as any);

    const update = (User as any).updateOne.mock.calls[0][1];
    expect(update.$inc).toBeUndefined();
    expect(update.$push).toBeUndefined();
    expect(update.$set['paymentInfo.stripeAccountDisabledReason']).toBe('account_closed');
  });
});
