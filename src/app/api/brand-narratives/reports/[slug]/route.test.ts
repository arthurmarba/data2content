/** @jest-environment node */

import { GET } from './route';
import { getPublicBrandNarrativeReportBySlug } from '@/app/lib/brands/brandNarrativeReportBuilder';

jest.mock('@/app/lib/brands/brandNarrativeReportBuilder', () => ({
  getPublicBrandNarrativeReportBySlug: jest.fn(),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('GET /api/brand-narratives/reports/[slug]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna 404 quando não há relatório ativo, incluindo relatórios archived', async () => {
    (getPublicBrandNarrativeReportBySlug as jest.Mock).mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/brand-narratives/reports/br-archived'), {
      params: { slug: 'br-archived' },
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ ok: false, error: 'Relatório não encontrado.' });
    expect(getPublicBrandNarrativeReportBySlug).toHaveBeenCalledWith('br-archived');
  });

  it('não expõe userId quando retorna relatório público', async () => {
    (getPublicBrandNarrativeReportBySlug as jest.Mock).mockResolvedValue({
      publicSlug: 'br-public',
      brand: { brandName: 'Nike' },
      creator: { name: 'Creator' },
      evidencePosts: [],
      metricsSummary: { postsAnalyzed: 0, evidenceCount: 0 },
      reportContent: { disclaimer: 'disclaimer' },
    });

    const response = await GET(new Request('http://localhost/api/brand-narratives/reports/br-public'), {
      params: { slug: 'br-public' },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.report.userId).toBeUndefined();
    expect(payload.report.publicSlug).toBe('br-public');
  });

  it('aceita params assíncronos ao buscar relatório público', async () => {
    (getPublicBrandNarrativeReportBySlug as jest.Mock).mockResolvedValue({
      publicSlug: 'br-async',
      status: 'active',
      brand: { brandName: 'Natura' },
      creator: { name: 'Creator' },
      evidencePosts: [],
      metricsSummary: { postsAnalyzed: 0, evidenceCount: 0 },
      reportContent: { disclaimer: 'disclaimer' },
    });

    const response = await GET(new Request('http://localhost/api/brand-narratives/reports/br-async'), {
      params: Promise.resolve({ slug: 'br-async' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.report.publicSlug).toBe('br-async');
    expect(getPublicBrandNarrativeReportBySlug).toHaveBeenCalledWith('br-async');
  });
});
