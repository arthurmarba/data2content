// src/app/api/admin/redemptions/route.test.ts
import { GET } from './route';
import { fetchRedemptions } from '@/lib/services/adminCreatorService'; // Ajuste se o nome do serviço mudou
import { NextRequest } from 'next/server';
import { AdminRedemptionListParams } from '@/types/admin/redemptions';

jest.mock('@/lib/services/adminCreatorService', () => ({
  fetchRedemptions: jest.fn(),
}));
jest.mock('@/lib/getAdminSession', () => ({
  getAdminSession: jest.fn().mockResolvedValue({ user: { role: 'admin', name: 'Admin' } }),
}));

function createMockRedemptionRequest(searchParams: URLSearchParams = new URLSearchParams()): NextRequest {
  const url = `http://localhost/api/admin/redemptions?${searchParams.toString()}`;
  return new NextRequest(url);
}

describe('API Route: GET /api/admin/redemptions', () => {
  const mockFetchRedemptions = fetchRedemptions as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 and redemption data on successful fetch', async () => {
    const mockData = { redemptions: [{ _id: 'r1', user: { _id: 'u1', name: 'User', email: 'u@e' }, amountCents: 100, currency: 'BRL', status: 'requested', createdAt: '2023-01-01' }], totalRedemptions: 1, totalPages: 1 };
    mockFetchRedemptions.mockResolvedValueOnce(mockData);

    const req = createMockRedemptionRequest(new URLSearchParams({ page: '1', limit: '5' }));
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual(mockData.redemptions);
    expect(fetchRedemptions).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 5 }));
  });

  it('should return 500 if service throws an error', async () => {
    mockFetchRedemptions.mockRejectedValueOnce(new Error('Redemption service DB error'));
    const req = createMockRedemptionRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Redemption service DB error');
  });
});
