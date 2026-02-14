/** @jest-environment node */
import { NextRequest } from 'next/server';

import { GET } from './route';
import { getAdminSession } from '@/lib/getAdminSession';
import { fetchBrandProposals } from '@/lib/services/adminCreatorService';

jest.mock('@/lib/getAdminSession', () => ({
  getAdminSession: jest.fn().mockResolvedValue({ user: { role: 'admin', name: 'Admin' } }),
}));

jest.mock('@/lib/services/adminCreatorService', () => ({
  fetchBrandProposals: jest.fn(),
}));

const mockGetAdminSession = getAdminSession as jest.Mock;
const mockFetchBrandProposals = fetchBrandProposals as jest.Mock;

function createRequest(query = '') {
  const suffix = query ? `?${query}` : '';
  return new NextRequest(`http://localhost/api/admin/brand-proposals${suffix}`);
}

describe('GET /api/admin/brand-proposals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when session is not admin', async () => {
    mockGetAdminSession.mockResolvedValueOnce({ user: { role: 'user' } });

    const res = await GET(createRequest());
    expect(res.status).toBe(401);
  });

  it('returns paginated data with default shape', async () => {
    mockFetchBrandProposals.mockResolvedValueOnce({
      proposals: [
        {
          id: 'p1',
          status: 'novo',
          brandName: 'Marca X',
          contactName: 'Joana Souza',
          contactEmail: 'contato@marca.com',
          contactWhatsapp: null,
          campaignTitle: 'Campanha A',
          budget: 1500,
          currency: 'BRL',
          mediaKitSlug: 'creator-x',
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
          creator: {
            id: 'u1',
            name: 'Creator X',
            email: 'creator@x.com',
            username: 'creatorx',
            mediaKitSlug: 'creator-x',
          },
        },
      ],
      totalProposals: 1,
      totalPages: 1,
    });

    const res = await GET(createRequest('page=1&limit=10'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.totalItems).toBe(1);
    expect(body.totalPages).toBe(1);
    expect(body.currentPage).toBe(1);
    expect(body.perPage).toBe(10);
  });

  it('passes status filter to service', async () => {
    mockFetchBrandProposals.mockResolvedValueOnce({
      proposals: [],
      totalProposals: 0,
      totalPages: 0,
    });

    const res = await GET(createRequest('status=aceito'));
    expect(res.status).toBe(200);
    expect(mockFetchBrandProposals).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'aceito' })
    );
  });

  it('passes search filter to service', async () => {
    mockFetchBrandProposals.mockResolvedValueOnce({
      proposals: [],
      totalProposals: 0,
      totalPages: 0,
    });

    const res = await GET(createRequest('search=Marca%20X'));
    expect(res.status).toBe(200);
    expect(mockFetchBrandProposals).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Marca X' })
    );
  });

  it('returns 400 for invalid query params', async () => {
    const res = await GET(createRequest('page=0'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Parâmetros de consulta inválidos');
  });
});
