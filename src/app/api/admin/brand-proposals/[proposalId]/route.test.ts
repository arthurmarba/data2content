/** @jest-environment node */
import { NextRequest } from 'next/server';

import { GET } from './route';
import { getAdminSession } from '@/lib/getAdminSession';
import { fetchBrandProposalById } from '@/lib/services/adminCreatorService';

jest.mock('@/lib/getAdminSession', () => ({
  getAdminSession: jest.fn().mockResolvedValue({ user: { role: 'admin', name: 'Admin' } }),
}));

jest.mock('@/lib/services/adminCreatorService', () => ({
  fetchBrandProposalById: jest.fn(),
}));

const mockGetAdminSession = getAdminSession as jest.Mock;
const mockFetchBrandProposalById = fetchBrandProposalById as jest.Mock;

function createRequest(id: string) {
  return new NextRequest(`http://localhost/api/admin/brand-proposals/${id}`);
}

describe('GET /api/admin/brand-proposals/[proposalId]', () => {
  const validId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when session is not admin', async () => {
    mockGetAdminSession.mockResolvedValueOnce({ user: { role: 'user' } });

    const res = await GET(createRequest(validId), { params: { proposalId: validId } });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid id', async () => {
    const res = await GET(createRequest('invalid-id'), { params: { proposalId: 'invalid-id' } });
    expect(res.status).toBe(400);
    expect(mockFetchBrandProposalById).not.toHaveBeenCalled();
  });

  it('returns 404 when proposal does not exist', async () => {
    mockFetchBrandProposalById.mockResolvedValueOnce(null);

    const res = await GET(createRequest(validId), { params: { proposalId: validId } });
    expect(res.status).toBe(404);
  });

  it('returns 200 with full proposal detail', async () => {
    mockFetchBrandProposalById.mockResolvedValueOnce({
      id: validId,
      status: 'novo',
      brandName: 'Marca X',
      contactName: 'Joana Souza',
      contactEmail: 'contato@marca.com',
      contactWhatsapp: '+5511999999999',
      campaignTitle: 'Campanha X',
      campaignDescription: 'Briefing completo',
      deliverables: ['1 reel', '3 stories'],
      referenceLinks: ['https://example.com/reference'],
      budget: 4000,
      currency: 'BRL',
      mediaKitSlug: 'creator-x',
      originIp: '1.1.1.1',
      userAgent: 'Mozilla/5.0',
      lastResponseAt: null,
      lastResponseMessage: null,
      utmSource: 'instagram',
      utmMedium: 'bio',
      utmCampaign: 'summer',
      utmTerm: null,
      utmContent: null,
      utmReferrer: 'https://instagram.com',
      utmFirstTouchAt: null,
      utmLastTouchAt: null,
      createdAt: '2026-02-12T10:00:00.000Z',
      updatedAt: '2026-02-12T10:10:00.000Z',
      creator: {
        id: 'u1',
        name: 'Creator X',
        email: 'creator@x.com',
        username: 'creatorx',
        mediaKitSlug: 'creator-x',
      },
    });

    const res = await GET(createRequest(validId), { params: { proposalId: validId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(validId);
    expect(body.campaignDescription).toBe('Briefing completo');
    expect(body.contactName).toBe('Joana Souza');
    expect(body.contactEmail).toBe('contato@marca.com');
  });
});
