// src/app/api/admin/affiliates/route.test.ts
import { GET } from './route';
import { fetchAffiliates } from '@/lib/services/adminCreatorService'; // Ajuste se o nome do serviço mudou
import { NextRequest } from 'next/server';
import { AdminAffiliateListParams } from '@/types/admin/affiliates';

jest.mock('@/lib/services/adminCreatorService', () => ({
  fetchAffiliates: jest.fn(),
}));

// Mock de getAdminSession (assumindo que está definido na rota ou é importável e mockável)
// Se for uma função local simples na rota, este mock pode não ter efeito direto sem
// mockar o módulo da rota em si, o que pode ser complexo.
// Para os testes abaixo, vamos assumir que a validação de sessão passa ou que
// a função mock getAdminSession da rota é usada.

function createMockAffiliateRequest(searchParams: URLSearchParams = new URLSearchParams()): NextRequest {
  const url = `http://localhost/api/admin/affiliates?${searchParams.toString()}`;
  return new NextRequest(url);
}

describe('API Route: GET /api/admin/affiliates', () => {
  const mockFetchAffiliates = fetchAffiliates as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // (require('./route') as any).getAdminSession.mockResolvedValue({ user: { name: 'Admin User', role: 'admin' } });
  });

  it('should return 200 and affiliate data on successful fetch', async () => {
    const mockData = { affiliates: [{ userId: '1', name: 'Test Affiliate' }], totalAffiliates: 1, totalPages: 1 };
    mockFetchAffiliates.mockResolvedValueOnce(mockData);

    const req = createMockAffiliateRequest(new URLSearchParams({ page: '1', limit: '5' }));
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.affiliates).toEqual(mockData.affiliates);
    expect(body.totalAffiliates).toBe(mockData.totalAffiliates);
    expect(fetchAffiliates).toHaveBeenCalledWith({ page: 1, limit: 5, sortBy: 'registrationDate', sortOrder: 'desc' });
  });

  it('should return 400 for invalid status enum parameter', async () => {
    const req = createMockAffiliateRequest(new URLSearchParams({ status: 'not_a_real_status' }));
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Parâmetros de consulta inválidos');
    expect(body.error).toContain("status: Invalid enum value. Expected 'pending_approval' | 'active' | 'inactive' | 'suspended'");
  });

  // Teste para não autorizado (requer mock mais robusto de getAdminSession)
  // it('should return 401 if user is not an admin', async () => { ... });

  it('should return 500 if service throws an error', async () => {
    mockFetchAffiliates.mockRejectedValueOnce(new Error('Affiliate service DB error'));
    const req = createMockAffiliateRequest();
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Affiliate service DB error');
  });
});
