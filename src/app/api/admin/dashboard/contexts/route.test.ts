import { GET } from './route';
import { NextRequest } from 'next/server';
import { getAvailableContexts } from '@/app/lib/dataService/marketAnalysis/cohortsService';
import { logger } from '@/app/lib/logger';
import { DatabaseError } from '@/app/lib/errors';

jest.mock('@/app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/app/lib/dataService/marketAnalysis/cohortsService', () => ({
  getAvailableContexts: jest.fn(),
}));

const mockGetAvailableContexts = getAvailableContexts as jest.Mock;

describe('API Route: /api/admin/dashboard/contexts', () => {
  const createRequest = () => new NextRequest('http://localhost/api/admin/dashboard/contexts');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with contexts list', async () => {
    mockGetAvailableContexts.mockResolvedValue(['Finanças', 'Tecnologia']);
    const res = await GET(createRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ contexts: ['Finanças', 'Tecnologia'] });
  });

  it('returns 500 on DatabaseError', async () => {
    mockGetAvailableContexts.mockRejectedValue(new DatabaseError('db fail'));
    const res = await GET(createRequest());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('Erro de banco de dados: db fail');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetAvailableContexts.mockRejectedValue(new Error('boom'));
    const res = await GET(createRequest());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('Ocorreu um erro interno no servidor.');
  });
});
