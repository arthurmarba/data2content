import { populateSystemPrompt } from '../aiOrchestrator';
import { functionExecutors } from '../aiFunctions';
import { Types } from 'mongoose';
import aggregateUserPerformanceHighlights from '@/utils/aggregateUserPerformanceHighlights';
import aggregateUserDayPerformance from '@/utils/aggregateUserDayPerformance';
import { aggregateUserTimePerformance } from '@/utils/aggregateUserTimePerformance';

jest.mock('../aiFunctions', () => ({
  functionExecutors: {
    getAggregatedReport: jest.fn(),
    getUserTrend: jest.fn(),
    getFpcTrendHistory: jest.fn(),
    getDayPCOStats: jest.fn(),
    getCategoryRanking: jest.fn(),
    getLatestAudienceDemographics: jest.fn(),
  }
}));
jest.mock('@/utils/aggregateUserPerformanceHighlights');
jest.mock('@/utils/aggregateUserDayPerformance');
jest.mock('@/utils/aggregateUserTimePerformance');

const execs = functionExecutors as jest.Mocked<typeof functionExecutors>;
const mockPerf = aggregateUserPerformanceHighlights as jest.Mock;
const mockDayPerf = aggregateUserDayPerformance as jest.Mock;
const mockTimePerf = aggregateUserTimePerformance as jest.Mock;

describe('populateSystemPrompt', () => {
  const user = { _id: new Types.ObjectId(), name: 'Tester' } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    execs.getAggregatedReport.mockResolvedValue({
      reportData: {
        overallStats: { avgReach: 100, avgShares: 5, avgEngagementRate: 0.1 },
        historicalComparisons: {
          followerChangeShortTerm: 2,
          followerGrowthRateShortTerm: 0.2,
          avgEngagementPerPostShortTerm: 4,
          avgReachPerPostShortTerm: 40,
        },
        detailedContentStats: [
          { _id: { format: 'reel', proposal: 'dica', context: 'tech' }, shareDiffPercentage: 10 }
        ]
      },
      adDealInsights: {
        totalDeals: 3,
        totalRevenueBRL: 5000,
        averageDealValueBRL: 1666.7,
        commonBrandSegments: ['tech', 'food'],
        dealsFrequency: 1.5,
      }
    });
    execs.getUserTrend.mockResolvedValue({ insightSummary: 'alta' });
    execs.getFpcTrendHistory.mockResolvedValue({ chartData: [{ avgInteractions: 1 }, { avgInteractions: 3 }] });
    execs.getDayPCOStats.mockResolvedValue({ dayPCOStats: { '1': { dica: { tech: { avgTotalInteractions: 10 } } } } });
    execs.getCategoryRanking.mockResolvedValue({ ranking: [{ category: 'reel' }, { category: 'carrossel' }] });
    execs.getLatestAudienceDemographics.mockResolvedValue({ demographics: { follower_demographics: { country: { Brasil: 80 }, age: { '18-24': 50 } } } });
    mockPerf.mockResolvedValue({
      topFormat: { name: 'VIDEO', average: 10, count: 2 },
      lowFormat: { name: 'IMAGE', average: 2, count: 1 },
      topContext: null,
      topProposal: null,
      topTone: null,
      topReference: null,
    });
    mockDayPerf.mockResolvedValue({ buckets: [], bestDays: [{ dayOfWeek: 5, average: 12, count: 4 }], worstDays: [] });
    mockTimePerf.mockResolvedValue({ buckets: [], bestSlots: [{ dayOfWeek: 5, hour: 14, average: 20, count: 2 }], worstSlots: [] });
  });

  it('fills placeholders with values', async () => {
    const prompt = await populateSystemPrompt(user, 'Ana');
    expect(prompt).toContain('100');
    expect(prompt).toContain('reel');
    expect(prompt).toContain('Brasil');
    expect(prompt).toContain('VIDEO');
    expect(prompt).toContain('14h');
    expect(prompt).toContain('1.5');
    expect(prompt).toContain('5000');
    expect(prompt).toContain('tech');
    expect(prompt).not.toContain('{{AVG_REACH_LAST30}}');
    expect(prompt).not.toContain('{{TOP_CATEGORY_RANKINGS}}');
    expect(prompt).not.toContain('{{TOP_DAY_PCO_COMBOS}}');
    expect(prompt).not.toContain('{{PERFORMANCE_INSIGHT_SUMMARY}}');
    expect(prompt).not.toContain('{{DEALS_COUNT_LAST30}}');
    expect(prompt).not.toContain('{{FOLLOWER_GROWTH_RATE_LAST30}}');
  });
});
