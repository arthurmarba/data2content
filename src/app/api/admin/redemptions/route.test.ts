// src/app/api/admin/redemptions/route.test.ts
import { GET } from './route';
import { fetchRedemptions } from '@/lib/services/adminCreatorService'; // Ajuste se o nome do serviço mudou
import { NextRequest } from 'next/server';
import { AdminRedemptionListParams } from '@/types/admin/redemptions';

jest.mock('@/lib/services/adminCreatorService', () => ({
  fetchRedemptions: jest.fn(),
}));

// Mock de getAdminSession (similar aos outros testes de API)

function createMockRedemptionRequest(searchParams: URLSearchParams = new URLSearchParams()): NextRequest {
  const url = `http://localhost/api/admin/redemptions?${searchParams.toString()}`;
  return new NextRequest(url);
}

describe('API Route: GET /api/admin/redemptions', () => {
  const mockFetchRedemptions = fetchRedemptions as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock da sessão de admin, se necessário para getAdminSession na rota
    // (require('./route') as any).getAdminSession.mockResolvedValue({ user: { name: 'Admin User', role: 'admin' } });
  });

  it('should return 200 and redemption data on successful fetch', async () => {
    const mockData = { redemptions: [{ _id: 'r1', userName: 'Test User' }], totalRedemptions: 1, totalPages: 1 };
    mockFetchRedemptions.mockResolvedValueOnce(mockData);

    const req = createMockRedemptionRequest(new URLSearchParams({ page: '1', limit: '5' }));
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.redemptions).toEqual(mockData.redemptions);
    expect(fetchRedemptions).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 5, sortBy: 'requestedAt', sortOrder: 'desc' }));
  });

  it('should return 400 for invalid status enum parameter', async () => {
    const req = createMockRedemptionRequest(new URLSearchParams({ status: 'invalid_redemption_status' }));
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Parâmetros de consulta inválidos');
    // A mensagem exata do Zod pode variar, mas deve indicar erro no campo 'status'
    expect(body.error).toContain("status: Invalid enum value. Expected 'pending' | 'approved' | 'rejected' | 'processing' | 'paid' | 'failed' | 'cancelled'");
  });

  it('should return 400 for invalid dateFrom format', async () => {
    const req = createMockRedemptionRequest(new URLSearchParams({ dateFrom: 'not-a-date' }));
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Parâmetros de consulta inválidos');
    expect(body.error).toContain('dateFrom: Invalid dateFrom format. Expected ISO datetime string.');
  });

  it('should return 500 if service throws an error', async () => {
    mockFetchRedemptions.mockRejectedValueOnce(new Error('Redemption service DB error'));
    const req = createMockRedemptionRequest();
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Redemption service DB error');
  });
});
