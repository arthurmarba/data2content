// src/app/api/admin/affiliates/[affiliateId]/status/route.test.ts
import { PATCH } from './route';
import { updateAffiliateStatus } from '@/lib/services/adminCreatorService'; // Ajuste se o nome do serviço mudou
import { NextRequest } from 'next/server';
import { AdminAffiliateUpdateStatusPayload } from '@/types/admin/affiliates';

jest.mock('@/lib/services/adminCreatorService', () => ({
  updateAffiliateStatus: jest.fn(),
}));

// Mock de getAdminSession (similar ao GET)

async function createMockAffiliatePatchRequest(body: any): Promise<NextRequest> {
  const url = `http://localhost/api/admin/affiliates/someUserId/status`;
  return new NextRequest(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('API Route: PATCH /api/admin/affiliates/[affiliateId]/status', () => {
  const mockUpdateAffiliateStatus = updateAffiliateStatus as jest.Mock;
  const mockUserId = 'testAffiliateUserId123'; // affiliateId na rota é o userId

  beforeEach(() => {
    jest.clearAllMocks();
    // (require('./route') as any).getAdminSession.mockResolvedValue({ user: { name: 'Admin User', role: 'admin' } });
  });

  it('should return 200 and updated affiliate on successful status update', async () => {
    const mockRequestBody: AdminAffiliateUpdateStatusPayload = { status: 'active' };
    const mockUpdatedAffiliate = { userId: mockUserId, name: 'Updated Affiliate', affiliateStatus: 'active' };
    mockUpdateAffiliateStatus.mockResolvedValueOnce(mockUpdatedAffiliate);

    const req = await createMockAffiliatePatchRequest(mockRequestBody);
    const response = await PATCH(req, { params: { affiliateId: mockUserId } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockUpdatedAffiliate);
    expect(updateAffiliateStatus).toHaveBeenCalledWith(mockUserId, mockRequestBody);
  });

  it('should return 400 for invalid request body (e.g., invalid status)', async () => {
    const mockRequestBody = { status: 'invalid_affiliate_status' };
    const req = await createMockAffiliatePatchRequest(mockRequestBody);
    const response = await PATCH(req, { params: { affiliateId: mockUserId } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Corpo da requisição inválido');
    expect(body.error).toContain("status: Invalid enum value. Expected 'pending_approval' | 'active' | 'inactive' | 'suspended'");
  });

  it('should return 404 if affiliate (user) not found by service', async () => {
    mockUpdateAffiliateStatus.mockRejectedValueOnce(new Error('User (affiliate) not found.'));
    const req = await createMockAffiliatePatchRequest({ status: 'active' });
    const response = await PATCH(req, { params: { affiliateId: 'nonExistentUserId' } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('User (affiliate) not found.');
  });

  // Teste para não autorizado (requer mock mais robusto de getAdminSession)
  // it('should return 401 if user is not an admin', async () => { ... });

  it('should return 500 if service throws an unexpected error', async () => {
    mockUpdateAffiliateStatus.mockRejectedValueOnce(new Error('Some other DB failure'));
    const req = await createMockAffiliatePatchRequest({ status: 'active' });
    const response = await PATCH(req, { params: { affiliateId: mockUserId } });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Some other DB failure');
  });
});
