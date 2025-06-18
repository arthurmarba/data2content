// src/app/api/admin/creators/[creatorId]/status/route.test.ts
import { PATCH, PUT } from './route'; // Ajuste se o nome do arquivo for diferente
import { updateCreatorStatus } from '@/lib/services/adminCreatorService'; // Ajuste o caminho
import { NextRequest } from 'next/server';

jest.mock('@/lib/services/adminCreatorService', () => ({
  updateCreatorStatus: jest.fn(),
}));

// Mock de getAdminSession (similar ao GET)
// Se getAdminSession for simples, pode não precisar mockar se a rota já o tem mockado para dev.
// Para testes robustos, deveria ser mockável. Assumindo que a validação de sessão na rota passa por padrão.

// Helper para criar mock NextRequest com body
async function createMockPatchRequest(body: any): Promise<NextRequest> {
  const url = `http://localhost/api/admin/creators/someId/status`;
  return new NextRequest(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function createMockPutRequest(body?: any): Promise<NextRequest> {
  const url = `http://localhost/api/admin/creators/someId/status`;
  return new NextRequest(url, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('API Route: PATCH /api/admin/creators/[creatorId]/status', () => {
  const mockUpdateCreatorStatus = updateCreatorStatus as jest.Mock;
  const mockCreatorId = 'testCreatorId123';

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock para getAdminSession (se necessário para forçar não-admin)
  });

  it('should return 200 and updated creator on successful status update', async () => {
    const mockRequestBody = { status: 'approved' };
    const mockUpdatedCreator = { _id: mockCreatorId, name: 'Updated Creator', adminStatus: 'approved' };
    mockUpdateCreatorStatus.mockResolvedValueOnce(mockUpdatedCreator);

    const req = await createMockPatchRequest(mockRequestBody);
    const response = await PATCH(req, { params: { creatorId: mockCreatorId } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockUpdatedCreator);
    expect(updateCreatorStatus).toHaveBeenCalledWith(mockCreatorId, mockRequestBody);
  });

  it('should return 400 for invalid request body (e.g., invalid status)', async () => {
    const mockRequestBody = { status: 'invalid_status_value' };
    const req = await createMockPatchRequest(mockRequestBody);
    const response = await PATCH(req, { params: { creatorId: mockCreatorId } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Corpo da requisição inválido');
    // A mensagem exata do Zod pode variar.
    expect(body.error).toContain("status: Invalid enum value. Expected 'pending' | 'approved' | 'rejected' | 'active'");
  });

  it('should return 404 if creator not found by service', async () => {
    mockUpdateCreatorStatus.mockRejectedValueOnce(new Error('Creator not found.'));
    const req = await createMockPatchRequest({ status: 'approved' });
    const response = await PATCH(req, { params: { creatorId: 'nonExistentId' } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Creator not found.');
  });

  it('should return 404 for invalid creatorId format by service', async () => {
    mockUpdateCreatorStatus.mockRejectedValueOnce(new Error('Invalid creatorId format.'));
    const req = await createMockPatchRequest({ status: 'approved' });
    const response = await PATCH(req, { params: { creatorId: 'invalidIdFormat' } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Invalid creatorId format.');
  });

  // Teste para não autorizado (requer mock de getAdminSession para retornar null)
  // it('should return 401 if user is not an admin', async () => {
  //   // Supondo que podemos mockar getAdminSession para retornar null
  //   const req = await createMockPatchRequest({ status: 'approved' });
  //   const response = await PATCH(req, { params: { creatorId: mockCreatorId } });
  //   expect(response.status).toBe(401);
  // });

  it('should return 500 if service throws an unexpected error', async () => {
    mockUpdateCreatorStatus.mockRejectedValueOnce(new Error('Some database failure'));
    const req = await createMockPatchRequest({ status: 'approved' });
    const response = await PATCH(req, { params: { creatorId: mockCreatorId } });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Some database failure');
  });
});

describe('API Route: PUT /api/admin/creators/[creatorId]/status', () => {
  const mockUpdateCreatorStatus = updateCreatorStatus as jest.Mock;
  const mockCreatorId = 'creatorPutId';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should approve creator without body', async () => {
    const mockUpdatedCreator = { _id: mockCreatorId, adminStatus: 'approved' };
    mockUpdateCreatorStatus.mockResolvedValueOnce(mockUpdatedCreator);

    const req = await createMockPutRequest();
    const response = await PUT(req, { params: { creatorId: mockCreatorId } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockUpdatedCreator);
    expect(updateCreatorStatus).toHaveBeenCalledWith(mockCreatorId, { status: 'approved' });
  });

  it('should forward feedback when provided', async () => {
    const mockUpdatedCreator = { _id: mockCreatorId, adminStatus: 'approved' };
    mockUpdateCreatorStatus.mockResolvedValueOnce(mockUpdatedCreator);

    const req = await createMockPutRequest({ feedback: 'ok' });
    const response = await PUT(req, { params: { creatorId: mockCreatorId } });
    await response.json();

    expect(updateCreatorStatus).toHaveBeenCalledWith(mockCreatorId, { status: 'approved', feedback: 'ok' });
  });

  it('should return 404 if creator not found by service', async () => {
    mockUpdateCreatorStatus.mockRejectedValueOnce(new Error('Creator not found.'));
    const req = await createMockPutRequest();
    const response = await PUT(req, { params: { creatorId: 'nonExistentId' } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Creator not found.');
  });

  it('should return 404 for invalid creatorId format by service', async () => {
    mockUpdateCreatorStatus.mockRejectedValueOnce(new Error('Invalid creatorId format.'));
    const req = await createMockPutRequest();
    const response = await PUT(req, { params: { creatorId: 'invalidIdFormat' } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Invalid creatorId format.');
  });

  it('should return 500 if service throws an unexpected error', async () => {
    mockUpdateCreatorStatus.mockRejectedValueOnce(new Error('Some database failure'));
    const req = await createMockPutRequest();
    const response = await PUT(req, { params: { creatorId: mockCreatorId } });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Some database failure');
  });
});
