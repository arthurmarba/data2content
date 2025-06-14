// src/app/api/admin/redemptions/[redemptionId]/status/route.test.ts
import { PATCH } from './route';
import { updateRedemptionStatus } from '@/lib/services/adminCreatorService'; // Ajuste se o nome do serviço mudou
import { NextRequest } from 'next/server';
import { AdminRedemptionUpdateStatusPayload } from '@/types/admin/redemptions';

jest.mock('@/lib/services/adminCreatorService', () => ({
  updateRedemptionStatus: jest.fn(),
}));

// Mock de getAdminSession (similar ao GET)

async function createMockRedemptionPatchRequest(body: any): Promise<NextRequest> {
  const url = `http://localhost/api/admin/redemptions/someRedemptionId/status`;
  return new NextRequest(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('API Route: PATCH /api/admin/redemptions/[redemptionId]/status', () => {
  const mockUpdateRedemptionStatus = updateRedemptionStatus as jest.Mock;
  const mockRedemptionId = 'testRedemptionId123';

  beforeEach(() => {
    jest.clearAllMocks();
    // (require('./route') as any).getAdminSession.mockResolvedValue({ user: { name: 'Admin User', role: 'admin' } });
  });

  it('should return 200 and updated redemption on successful status update', async () => {
    const mockRequestBody: AdminRedemptionUpdateStatusPayload = { status: 'approved' };
    const mockUpdatedRedemption = { _id: mockRedemptionId, status: 'approved', amount: 100 };
    mockUpdateRedemptionStatus.mockResolvedValueOnce(mockUpdatedRedemption);

    const req = await createMockRedemptionPatchRequest(mockRequestBody);
    const response = await PATCH(req, { params: { redemptionId: mockRedemptionId } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockUpdatedRedemption);
    expect(updateRedemptionStatus).toHaveBeenCalledWith(mockRedemptionId, mockRequestBody);
  });

  it('should return 400 for invalid request body (e.g., invalid status)', async () => {
    const mockRequestBody = { status: 'non_existent_status' };
    const req = await createMockRedemptionPatchRequest(mockRequestBody);
    const response = await PATCH(req, { params: { redemptionId: mockRedemptionId } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Corpo da requisição inválido');
    expect(body.error).toContain("status: Invalid enum value. Expected 'pending' | 'approved' | 'rejected' | 'processing' | 'paid' | 'failed' | 'cancelled'");
  });

  it('should return 404 if redemption not found by service', async () => {
    mockUpdateRedemptionStatus.mockRejectedValueOnce(new Error('Redemption not found.'));
    const req = await createMockRedemptionPatchRequest({ status: 'approved' });
    const response = await PATCH(req, { params: { redemptionId: 'nonExistentId' } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Redemption not found.');
  });

  it('should return 500 if service throws an unexpected error', async () => {
    mockUpdateRedemptionStatus.mockRejectedValueOnce(new Error('Some other internal DB failure'));
    const req = await createMockRedemptionPatchRequest({ status: 'approved' });
    const response = await PATCH(req, { params: { redemptionId: mockRedemptionId } });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Some other internal DB failure');
  });
});
