/** @jest-environment node */
import { POST } from '@/app/api/internal/affiliate/mature/route';

jest.mock('@/server/db/connect', () => ({ connectMongo: jest.fn() }));
jest.mock('@/server/db/models/User', () => ({ User: { find: jest.fn() } }));
jest.mock('@/server/db/models/CronLock', () => ({ CronLock: { findOneAndUpdate: jest.fn() } }));

const { User } = require('@/server/db/models/User');
const { CronLock } = require('@/server/db/models/CronLock');

function mockRequest(body: any = {}, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/internal/affiliate/mature', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/internal/affiliate/mature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_CRON_SECRET = 's3cr3t';
    (CronLock.findOneAndUpdate as jest.Mock).mockImplementation((_f: any, update: any) => ({
      owner: update.$set.owner,
      expiresAt: update.$set.expiresAt,
    }));
  });

  it('rejects unauthorized', async () => {
    const res = await POST(mockRequest());
    expect(res.status).toBe(401);
  });

  it('matures entries respecting limits', async () => {
    const user = {
      commissionLog: [
        { type: 'commission', status: 'pending', availableAt: new Date(Date.now() - 1000), currency: 'brl', amountCents: 100 },
        { type: 'commission', status: 'pending', availableAt: new Date(Date.now() - 1000), currency: 'brl', amountCents: 200 },
      ],
      affiliateBalances: new Map<string, number>(),
      save: jest.fn(),
    };
    const chain = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([user]),
    };
    (User.find as jest.Mock).mockReturnValue(chain);

    const res = await POST(
      mockRequest({ limit: 10, maxItemsPerUser: 1 }, { 'x-internal-secret': 's3cr3t' })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.maturedEntries).toBe(1);
    expect(body.maturedUsers).toBe(1);
    expect(user.commissionLog[0].status).toBe('available');
    expect(user.commissionLog[1].status).toBe('pending');
    expect(user.affiliateBalances.get('brl')).toBe(100);
    expect(user.save).toHaveBeenCalled();
  });

  it('supports dry run without persisting', async () => {
    const user = {
      commissionLog: [
        { type: 'commission', status: 'pending', availableAt: new Date(Date.now() - 1000), currency: 'brl', amountCents: 100 },
      ],
      affiliateBalances: new Map<string, number>(),
      save: jest.fn(),
    };
    const chain = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([user]),
    };
    (User.find as jest.Mock).mockReturnValue(chain);

    const res = await POST(
      mockRequest({ dryRun: true }, { 'x-internal-secret': 's3cr3t' })
    );
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(body.maturedEntries).toBe(1);
    expect(body.maturedUsers).toBe(0);
    expect(user.save).not.toHaveBeenCalled();
    expect(user.commissionLog[0].status).toBe('pending');
    expect(user.affiliateBalances.get('brl')).toBeUndefined();
  });
});
