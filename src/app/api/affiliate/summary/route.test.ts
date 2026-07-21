/** @jest-environment node */
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }), { virtual: true });
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ findById: jest.fn() }));
jest.mock('@/app/models/Redemption', () => ({ find: jest.fn() }));

import { getServerSession } from 'next-auth/next';
import User from '@/app/models/User';
import Redemption from '@/app/models/Redemption';
import { GET } from './route';

describe('GET /api/affiliate/summary', () => {
  it('reconciles a balance already reserved by an active redemption', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user_1' } });
    (User.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: 'user_1',
        affiliateBalances: new Map([['brl', 0]]),
        affiliateDebtByCurrency: new Map(),
        commissionLog: [
          { type: 'commission', status: 'available', currency: 'brl', amountCents: 5000 },
        ],
      }),
    });
    (Redemption.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{
          _id: 'red_1',
          currency: 'brl',
          amountCents: 5000,
          balanceReservedAt: new Date(),
        }]),
      }),
    });

    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).byCurrency.BRL).toMatchObject({
      availableCents: 5000,
      storedAvailableCents: 0,
      reconciliationStatus: 'reconciled',
      activeRedemption: { id: 'red_1', amountCents: 5000, balanceReserved: true },
    });
  });
});
