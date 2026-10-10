/** @jest-environment node */
import { DELETE } from './route';
import { getServerSession } from 'next-auth';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import Redemption from '@/app/models/Redemption';
import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import { deleteMcpDataForUser } from '@/app/lib/mcp/accountDeletion';
import { anonymizeCreatorInCommunityReports } from '@/app/lib/account/accountDataDeletion';
import { enqueueAccountDataDeletion } from '@/app/lib/account/accountDataDeletionQueue';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ findById: jest.fn(), findOne: jest.fn(), deleteOne: jest.fn() }));
jest.mock('@/app/models/Redemption', () => ({ findOne: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }), { virtual: true });
jest.mock('@/app/lib/stripe', () => ({
  stripe: {
    subscriptions: { retrieve: jest.fn(), list: jest.fn() },
  },
}));
jest.mock('@/utils/rateLimit', () => ({ checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }) }));
jest.mock('@/utils/stripeHelpers', () => ({ cancelBlockingIncompleteSubs: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/mcp/accountDeletion', () => ({ deleteMcpDataForUser: jest.fn().mockResolvedValue({}) }));
jest.mock('@/app/lib/account/accountDataDeletion', () => ({ anonymizeCreatorInCommunityReports: jest.fn().mockResolvedValue(0) }));
jest.mock('@/app/lib/account/accountDataDeletionQueue', () => ({ enqueueAccountDataDeletion: jest.fn().mockResolvedValue(true) }));

const mockGetServerSession = getServerSession as jest.Mock;
const mockFindById = (User as any).findById as jest.Mock;
const mockDeleteOne = (User as any).deleteOne as jest.Mock;
const makeRequest = () => new NextRequest('http://localhost/api/account/delete');

beforeEach(() => {
  jest.clearAllMocks();
  (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
  (Redemption.findOne as jest.Mock).mockReturnValue({
    lean: jest.fn().mockResolvedValue(null),
  });
  jest.spyOn(mongoose, 'startSession').mockResolvedValue({
    withTransaction: async (fn: () => Promise<void>) => fn(),
    endSession: jest.fn(),
  } as any);
});

describe('DELETE /api/account/delete', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await DELETE(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 404 when user not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockFindById.mockResolvedValue(null);
    const res = await DELETE(makeRequest());
    expect(res.status).toBe(404);
  });

  it('returns 409 when subscription active', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockFindById.mockResolvedValue({ _id: 'u1', planStatus: 'active' });
    const res = await DELETE(makeRequest());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({ error: 'ERR_ACTIVE_SUBSCRIPTION', message: 'Cancele sua assinatura ativa antes de excluir a conta.' });
  });

  it('deletes user when permitted', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockFindById.mockResolvedValue({ _id: 'u1', planStatus: 'inactive', affiliateBalances: {} });
    (User.findOne as jest.Mock).mockResolvedValue({ _id: 'u1', name: 'Simone', affiliateBalances: {}, affiliateDebtByCurrency: {}, commissionLog: [] });
    mockDeleteOne.mockResolvedValue({});
    const res = await DELETE(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(mockDeleteOne).toHaveBeenCalledWith({ _id: 'u1' }, expect.objectContaining({ session: expect.any(Object) }));
    // A conexão do conector e os registros de uso saem na mesma transação que a conta.
    expect(deleteMcpDataForUser).toHaveBeenCalledWith('u1', expect.any(Object));
    // O nome sai dos relatórios da comunidade na transação; o resto vai para a fila.
    expect(anonymizeCreatorInCommunityReports).toHaveBeenCalledWith('Simone', expect.any(Object));
    expect(enqueueAccountDataDeletion).toHaveBeenCalledWith('u1');
  });

  it('blocks deletion while affiliate money or a redemption is pending', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockFindById.mockResolvedValue({
      _id: 'u1',
      planStatus: 'inactive',
      affiliateBalances: { brl: 0 },
      affiliateDebtByCurrency: {},
      commissionLog: [
        { type: 'commission', status: 'pending', currency: 'brl', amountCents: 500, availableAt: new Date() },
      ],
    });
    (Redemption.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: 'red1', status: 'requested' }),
    });

    const res = await DELETE(makeRequest());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'ERR_AFFILIATE_BALANCE' });
    expect(mockDeleteOne).not.toHaveBeenCalled();
  });

  it('preserves settled affiliate history for future refunds and audit', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockFindById.mockResolvedValue({
      _id: 'u1',
      planStatus: 'inactive',
      affiliateBalances: { brl: 0 },
      affiliateDebtByCurrency: {},
      commissionLog: [
        { type: 'commission', status: 'paid', currency: 'brl', amountCents: 500 },
      ],
    });

    const res = await DELETE(makeRequest());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'ERR_AFFILIATE_HISTORY' });
    expect(mockDeleteOne).not.toHaveBeenCalled();
    expect(deleteMcpDataForUser).not.toHaveBeenCalled();
    expect(enqueueAccountDataDeletion).not.toHaveBeenCalled();
  });
});
