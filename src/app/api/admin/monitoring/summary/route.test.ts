import { GET } from './route';
import AgencyModel from '@/app/models/Agency';
import UserModel from '@/app/models/User';
import {
  MONTHLY_PRICE,
  ANNUAL_MONTHLY_PRICE,
  AGENCY_GUEST_MONTHLY_PRICE,
  AGENCY_GUEST_ANNUAL_MONTHLY_PRICE,
  AGENCY_MONTHLY_PRICE,
} from '@/config/pricing.config';

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
    mockAgencyCount.mockResolvedValueOnce(2);
    mockUserCount
      .mockResolvedValueOnce(100) // users
      .mockResolvedValueOnce(20) // guests
      .mockResolvedValueOnce(30) // active user monthly
      .mockResolvedValueOnce(5) // active user annual
      .mockResolvedValueOnce(10) // active guest monthly
      .mockResolvedValueOnce(3); // active guest annual

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      activeAgencies: 2,
      creators: { users: 100, guests: 20 },
      mrr: {
        agencies: 2 * AGENCY_MONTHLY_PRICE,
        creators:
          30 * MONTHLY_PRICE +
          5 * ANNUAL_MONTHLY_PRICE +
          10 * AGENCY_GUEST_MONTHLY_PRICE +
          3 * AGENCY_GUEST_ANNUAL_MONTHLY_PRICE,
        total:
          2 * AGENCY_MONTHLY_PRICE +
          30 * MONTHLY_PRICE +
          5 * ANNUAL_MONTHLY_PRICE +
          10 * AGENCY_GUEST_MONTHLY_PRICE +
          3 * AGENCY_GUEST_ANNUAL_MONTHLY_PRICE,
      },
    });
  });
});
