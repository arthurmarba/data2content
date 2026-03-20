import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { GET } from './route';
import { getAdminSession } from '@/lib/getAdminSession';
import { getAverageEngagementByGroupings } from '@/utils/getAverageEngagementByGrouping';

jest.mock('@/lib/getAdminSession', () => ({
  getAdminSession: jest.fn(),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
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

jest.mock('@/charts/getReachInteractionTrendChartData', () => ({
  getUserReachInteractionTrendChartData: jest.fn().mockResolvedValue({ chartData: [] }),
}));

jest.mock('@/charts/getEngagementDistributionByFormatChartData', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({ chartData: [] }),
}));

jest.mock('@/utils/aggregateUserTimePerformance', () => ({
  aggregateUserTimePerformance: jest.fn().mockResolvedValue({ buckets: [] }),
}));

jest.mock('@/utils/getAverageEngagementByGrouping', () => ({
  __esModule: true,
  default: jest.fn(),
  getAverageEngagementByGroupings: jest.fn(),
}));

const mockGetAdminSession = getAdminSession as jest.Mock;
const mockGetAverageEngagementByGroupings = getAverageEngagementByGroupings as jest.Mock;

const makeRequest = (userId: string, search = '') =>
  new NextRequest(`http://localhost/api/admin/dashboard/users/${userId}/planning/batch${search}`);

describe('GET /api/admin/dashboard/users/[userId]/planning/batch', () => {
  const userId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminSession.mockResolvedValue({ user: { name: 'Admin User' } });
    mockGetAverageEngagementByGroupings.mockResolvedValue({
      context: [{ name: 'Moda/Estilo', value: 120, postsCount: 2 }],
      proposal: [{ name: 'Review', value: 115, postsCount: 2 }],
      tone: [{ name: 'Inspirador/Motivacional', value: 90, postsCount: 1 }],
      references: [{ name: 'Cidade', value: 80, postsCount: 1 }],
      contentIntent: [{ name: 'Converter', value: 140, postsCount: 3 }],
      narrativeForm: [{ name: 'Review', value: 132, postsCount: 2 }],
      contentSignals: [{ name: 'CTA de Comentario', value: 125, postsCount: 3 }],
      stance: [{ name: 'Depoimento', value: 118, postsCount: 2 }],
      proofStyle: [{ name: 'Antes e Depois', value: 111, postsCount: 2 }],
      commercialMode: [{ name: 'Oferta/Desconto', value: 109, postsCount: 2 }],
    });
  });

  it('returns editorial and strategic planning charts in one payload', async () => {
    const res = await GET(
      makeRequest(
        userId,
        '?timePeriod=last_90_days&granularity=weekly&engagementMetricField=stats.total_interactions'
      ),
      { params: { userId } }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.contextData.chartData).toEqual([{ name: 'Moda/Estilo', value: 120, postsCount: 2 }]);
    expect(body.proposalData.chartData).toEqual([{ name: 'Review', value: 115, postsCount: 2 }]);
    expect(body.contentIntentData.chartData).toEqual([{ name: 'Converter', value: 140, postsCount: 3 }]);
    expect(body.narrativeFormData.chartData).toEqual([{ name: 'Review', value: 132, postsCount: 2 }]);
    expect(body.contentSignalsData.chartData).toEqual([{ name: 'CTA de Comentario', value: 125, postsCount: 3 }]);
    expect(body.stanceData.chartData).toEqual([{ name: 'Depoimento', value: 118, postsCount: 2 }]);
    expect(body.proofStyleData.chartData).toEqual([{ name: 'Antes e Depois', value: 111, postsCount: 2 }]);
    expect(body.commercialModeData.chartData).toEqual([{ name: 'Oferta/Desconto', value: 109, postsCount: 2 }]);

    expect(mockGetAverageEngagementByGroupings).toHaveBeenCalledWith(
      userId,
      'last_90_days',
      'stats.total_interactions',
      [
        'context',
        'proposal',
        'tone',
        'references',
        'contentIntent',
        'narrativeForm',
        'contentSignals',
        'stance',
        'proofStyle',
        'commercialMode',
      ]
    );
  });
});
