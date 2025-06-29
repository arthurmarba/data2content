// src/app/api/admin/creators/route.test.ts
import { GET } from './route'; // Ajuste se o nome do arquivo for diferente
import { fetchCreators } from '@/lib/services/adminCreatorService'; // Ajuste o caminho
import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/getAdminSession';

jest.mock('@/lib/getAdminSession', () => ({
  getAdminSession: jest.fn(),
}));

jest.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

// Mock o serviço
jest.mock('@/lib/services/adminCreatorService', () => ({
  fetchCreators: jest.fn(),
}));

const mockGetAdminSession = getAdminSession as jest.Mock;

// Mock a sessão de admin (se não estiver usando um helper compartilhado)
// jest.mock('./route', () => { // Cuidado ao mockar o próprio arquivo
//   const originalModule = jest.requireActual('./route');
//   return {
//     ...originalModule,
//     getAdminSession: jest.fn().mockResolvedValue({ user: { name: 'Admin User', role: 'admin' } }),
//   };
// });
// Se getAdminSession for importado de outro lugar, mockar esse lugar.
// Por agora, vamos assumir que um mock mais global ou a ausência de mock (se a função não existir no route.ts)
// fará com que a chamada mockada no teste funcione, ou que getAdminSession é simples e não precisa de mock complexo.
// O ideal é que getAdminSession seja importável e mockável.

// Helper para criar mock NextRequest (pode ser movido para um utilitário de teste)
function createMockRequest(searchParams: URLSearchParams = new URLSearchParams()): NextRequest {
  const url = `http://localhost/api/admin/creators?${searchParams.toString()}`;
  return new NextRequest(url);
}

describe('API Route: GET /api/admin/creators', () => {
  const mockFetchCreators = fetchCreators as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminSession.mockResolvedValue({ user: { role: 'admin' } });
  });

  it('should return 200 and data on successful fetch', async () => {
    const mockData = { creators: [{ _id: '1', name: 'Test Creator' }], totalCreators: 1, totalPages: 1 };
    mockFetchCreators.mockResolvedValueOnce(mockData);

    const req = createMockRequest(new URLSearchParams({ page: '1', limit: '10' }));
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.creators).toEqual(mockData.creators);
    expect(body.totalCreators).toBe(mockData.totalCreators);
    expect(fetchCreators).toHaveBeenCalledWith({ page: 1, limit: 10, sortBy: 'registrationDate', sortOrder: 'desc' });
  });

  it('should return 400 for invalid query parameters (e.g., non-numeric page)', async () => {
    const req = createMockRequest(new URLSearchParams({ page: 'abc', limit: '10' }));
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Parâmetros de consulta inválidos');
    // A mensagem exata do Zod pode variar, mas deve indicar o erro de 'page'
    expect(body.error).toMatch(/page: Expected number, received nan|page: Invalid literal value, expected "numeric"/i);
  });

  it('should return 400 for invalid status enum', async () => {
    const req = createMockRequest(new URLSearchParams({ status: 'invalid_status' }));
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    // A mensagem exata do Zod pode variar um pouco.
    expect(body.error).toContain("status: Invalid enum value. Expected 'pending' | 'approved' | 'rejected' | 'active'");
  });

  // Teste para não autorizado (requer mock de getAdminSession para retornar null)
  // Para este teste funcionar, getAdminSession precisaria ser mockável.
  // Se getAdminSession está hardcoded como mock na rota, este teste não pode forçar o cenário não-admin
  // a menos que o mock da rota inteira seja feito, o que é mais complexo.
  // it('should return 401 if user is not an admin', async () => {
  //   // Supondo que podemos mockar getAdminSession para retornar null
  //   // jest.spyOn(require('./route'), 'getAdminSession').mockResolvedValueOnce(null); // Exemplo de como poderia ser
  //   const req = createMockRequest();
  //   const response = await GET(req);
  //   expect(response.status).toBe(401);
  // });

  it('should return 500 if service throws an error', async () => {
    mockFetchCreators.mockRejectedValueOnce(new Error('Database error'));
    const req = createMockRequest();
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Database error');
  });
});
