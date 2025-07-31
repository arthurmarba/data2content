import { GET } from './route';
import AgencyModel from '@/app/models/Agency';
import UserModel from '@/app/models/User';
import { MONTHLY_PRICE } from '@/config/pricing.config';

jest.mock('@/app/models/Agency', () => ({
  countDocuments: jest.fn(),
}));

jest.mock('@/app/models/User', () => ({
  countDocuments: jest.fn(),
}));

const mockAgencyCount = (AgencyModel as any).countDocuments as jest.Mock;
const mockUserCount = (UserModel as any).countDocuments as jest.Mock;

describe('GET /api/admin/monitoring/summary', () => {
  it('returns aggregated metrics', async () => {
    const agencyPrice = Number(process.env.AGENCY_MONTHLY_PRICE || '99');

    mockAgencyCount.mockResolvedValueOnce(2);
    mockUserCount
      .mockResolvedValueOnce(100) // users
      .mockResolvedValueOnce(20) // guests
      .mockResolvedValueOnce(50); // active creators

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      activeAgencies: 2,
      creators: { users: 100, guests: 20 },
      mrr: {
        agencies: 2 * agencyPrice,
        creators: 50 * MONTHLY_PRICE,
        total: 2 * agencyPrice + 50 * MONTHLY_PRICE,
      },
    });
  });
});
