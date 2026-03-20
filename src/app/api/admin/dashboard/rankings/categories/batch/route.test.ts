import { NextRequest } from 'next/server';
import { GET } from './route';
import { fetchTopCategories } from '@/app/lib/dataService/marketAnalysis/rankingsService';

jest.mock('@/app/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/app/lib/dataService/marketAnalysis/rankingsService', () => ({
  fetchTopCategories: jest.fn(),
}));

jest.mock('@/app/lib/cache/dashboardCache', () => ({
  DEFAULT_DASHBOARD_TTL_MS: 60_000,
  dashboardCache: {
    wrap: jest.fn(async (_key: string, fn: () => Promise<unknown>) => ({
      value: await fn(),
      hit: false,
    })),
  },
}));

const mockFetchTopCategories = fetchTopCategories as jest.Mock;

const makeRequest = (search = '') =>
  new NextRequest(`http://localhost/api/admin/dashboard/rankings/categories/batch${search}`);

describe('GET /api/admin/dashboard/rankings/categories/batch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchTopCategories.mockResolvedValue([{ category: 'demo', value: 10 }]);
  });

  it('returns editorial and strategic category rankings in one payload', async () => {
    const res = await GET(
      makeRequest('?startDate=2026-01-01T00:00:00.000Z&endDate=2026-03-01T23:59:59.999Z&limit=3')
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.format.posts).toEqual([{ category: 'demo', value: 10 }]);
    expect(body.contentIntent.posts).toEqual([{ category: 'demo', value: 10 }]);
    expect(body.narrativeForm.avg_total_interactions).toEqual([{ category: 'demo', value: 10 }]);
    expect(body.contentSignals.posts).toEqual([{ category: 'demo', value: 10 }]);
    expect(body.stance.posts).toEqual([{ category: 'demo', value: 10 }]);
    expect(body.proofStyle.avg_total_interactions).toEqual([{ category: 'demo', value: 10 }]);
    expect(body.commercialMode.posts).toEqual([{ category: 'demo', value: 10 }]);

    const requestedCategories = new Set(
      mockFetchTopCategories.mock.calls.map(([params]) => params.category)
    );

    expect(requestedCategories).toEqual(
      new Set([
        'format',
        'proposal',
        'context',
        'tone',
        'references',
        'contentIntent',
        'narrativeForm',
        'contentSignals',
        'stance',
        'proofStyle',
        'commercialMode',
      ])
    );
  });
});
