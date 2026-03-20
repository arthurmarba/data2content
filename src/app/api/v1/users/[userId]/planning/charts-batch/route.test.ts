import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { GET } from './route';
import { dashboardCache } from '@/app/lib/cache/dashboardCache';
import { withMongoTransientRetry } from '@/app/lib/mongoTransient';
import { buildPlanningRecommendations } from '@/utils/buildPlanningRecommendations';

jest.mock('@/app/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/app/lib/cache/dashboardCache', () => ({
  DEFAULT_DASHBOARD_TTL_MS: 60_000,
  dashboardCache: {
    wrap: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
  },
}));

jest.mock('@/app/lib/mongoTransient', () => ({
  getErrorMessage: jest.fn((error) => String(error?.message || error || '')),
  isTransientMongoError: jest.fn(() => false),
  withMongoTransientRetry: jest.fn(),
}));

jest.mock('@/utils/buildPlanningRecommendations', () => ({
  ALLOWED_PLANNING_OBJECTIVES: ['reach', 'engagement', 'leads'],
  buildPlanningRecommendations: jest.fn(),
}));

const mockDashboardCache = dashboardCache as unknown as {
  wrap: jest.Mock;
  set: jest.Mock;
  get: jest.Mock;
};
const mockWithMongoTransientRetry = withMongoTransientRetry as jest.Mock;
const mockBuildPlanningRecommendations = buildPlanningRecommendations as jest.Mock;

const makeRequest = (userId: string, search = '') =>
  new NextRequest(`http://localhost/api/v1/users/${userId}/planning/charts-batch${search}`);

describe('GET /api/v1/users/[userId]/planning/charts-batch', () => {
  const userId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDashboardCache.wrap.mockResolvedValue({
      value: {
        payload: {
          trendData: { chartData: [] },
          timeData: { buckets: [] },
          durationData: { buckets: [], totalVideoPosts: 0, totalPostsWithDuration: 0, totalPostsWithoutDuration: 0 },
          timingBenchmark: null,
          similarCreators: null,
          formatData: { chartData: [] },
          proposalData: { chartData: [{ name: 'Review', value: 120, postsCount: 2 }], metricUsed: 'stats.total_interactions', groupBy: 'proposal' },
          toneData: { chartData: [{ name: 'Inspirador/Motivacional', value: 110, postsCount: 2 }], metricUsed: 'stats.total_interactions', groupBy: 'tone' },
          referenceData: { chartData: [{ name: 'Cidade', value: 100, postsCount: 2 }], metricUsed: 'stats.total_interactions', groupBy: 'references' },
          contextData: { chartData: [{ name: 'Moda/Estilo', value: 130, postsCount: 3 }], metricUsed: 'stats.total_interactions', groupBy: 'context' },
          contentIntentData: { chartData: [{ name: 'Converter', value: 140, postsCount: 3 }], metricUsed: 'stats.total_interactions', groupBy: 'contentIntent' },
          narrativeFormData: { chartData: [{ name: 'Review', value: 132, postsCount: 2 }], metricUsed: 'stats.total_interactions', groupBy: 'narrativeForm' },
          contentSignalsData: { chartData: [{ name: 'CTA de Comentário', value: 126, postsCount: 3 }], metricUsed: 'stats.total_interactions', groupBy: 'contentSignals' },
          stanceData: { chartData: [{ name: 'Depoimento', value: 118, postsCount: 2 }], metricUsed: 'stats.total_interactions', groupBy: 'stance' },
          proofStyleData: { chartData: [{ name: 'Demonstração', value: 112, postsCount: 2 }], metricUsed: 'stats.total_interactions', groupBy: 'proofStyle' },
          commercialModeData: { chartData: [{ name: 'Oferta/Desconto', value: 108, postsCount: 2 }], metricUsed: 'stats.total_interactions', groupBy: 'commercialMode' },
          postsData: {
            posts: [],
            pagination: {
              currentPage: 1,
              totalPages: 1,
              totalPosts: 0,
            },
          },
          strategicDeltas: {},
          metricMeta: {
            field: 'stats.total_interactions',
            label: 'Interações por post',
            shortLabel: 'Engajamento',
            tooltipLabel: 'Interações por post',
            unitLabel: 'Engajamento',
            isProxy: false,
            description: null,
          },
        },
        __perf: {},
      },
      hit: false,
    });
    mockWithMongoTransientRetry.mockResolvedValue([]);
    mockBuildPlanningRecommendations.mockReturnValue({ actions: [] });
  });

  it('returns editorial and strategic planning data in the creator payload', async () => {
    const res = await GET(
      makeRequest(
        userId,
        '?timePeriod=last_90_days&granularity=weekly&objectiveMode=engagement&engagementMetricField=stats.total_interactions'
      ),
      { params: { userId } }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.contextData.chartData).toEqual([{ name: 'Moda/Estilo', value: 130, postsCount: 3 }]);
    expect(body.contentIntentData.chartData).toEqual([{ name: 'Converter', value: 140, postsCount: 3 }]);
    expect(body.narrativeFormData.chartData).toEqual([{ name: 'Review', value: 132, postsCount: 2 }]);
    expect(body.contentSignalsData.chartData).toEqual([{ name: 'CTA de Comentário', value: 126, postsCount: 3 }]);
    expect(body.stanceData.chartData).toEqual([{ name: 'Depoimento', value: 118, postsCount: 2 }]);
    expect(body.proofStyleData.chartData).toEqual([{ name: 'Demonstração', value: 112, postsCount: 2 }]);
    expect(body.commercialModeData.chartData).toEqual([{ name: 'Oferta/Desconto', value: 108, postsCount: 2 }]);
    expect(body.topActions).toEqual([]);
    expect(mockDashboardCache.set).toHaveBeenCalled();
    expect(mockBuildPlanningRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalData: expect.objectContaining({ groupBy: 'proposal' }),
        toneData: expect.objectContaining({ groupBy: 'tone' }),
        contextData: expect.objectContaining({ groupBy: 'context' }),
      })
    );
  });
});
