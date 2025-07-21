import { populateSystemPrompt } from '../aiOrchestrator';
import { getSystemPrompt } from '../promptSystemFC';
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
    getMetricsHistory: jest.fn(),
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
    execs.getMetricsHistory.mockResolvedValue({
      history: {
        propagationIndex: { labels: [], datasets: [{ data: [10, 20] }] },
        followerConversionRate: { labels: [], datasets: [{ data: [3, 5] }] },
        retentionRate: { labels: [], datasets: [{ data: [60, 80] }] },
      }
    });
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
    expect(prompt).toContain('15.0');
    expect(prompt).toContain('4.0');
    expect(prompt).toContain('70.0');
    expect(prompt).toContain('tech');
    expect(prompt).not.toContain('{{AVG_REACH_LAST30}}');
    expect(prompt).not.toContain('{{TOP_CATEGORY_RANKINGS}}');
    expect(prompt).not.toContain('{{TOP_DAY_PCO_COMBOS}}');
    expect(prompt).not.toContain('{{PERFORMANCE_INSIGHT_SUMMARY}}');
    expect(prompt).not.toContain('{{DEALS_COUNT_LAST30}}');
    expect(prompt).not.toContain('{{FOLLOWER_GROWTH_RATE_LAST30}}');
    expect(prompt).not.toContain('{{AVG_PROPAGATION_LAST30}}');
    expect(prompt).not.toContain('{{AVG_FOLLOWER_CONV_RATE_LAST30}}');
    expect(prompt).not.toContain('{{AVG_RETENTION_RATE_LAST30}}');
  });

  it('uses fallback phrase when metrics retrieval fails', async () => {
    execs.getAggregatedReport.mockRejectedValue(new Error('fail'));
    execs.getUserTrend.mockRejectedValue(new Error('fail'));
    execs.getFpcTrendHistory.mockRejectedValue(new Error('fail'));
    execs.getDayPCOStats.mockRejectedValue(new Error('fail'));
    execs.getCategoryRanking.mockRejectedValue(new Error('fail'));
    execs.getLatestAudienceDemographics.mockRejectedValue(new Error('fail'));
    execs.getMetricsHistory.mockRejectedValue(new Error('fail'));
    mockPerf.mockRejectedValue(new Error('fail'));
    mockDayPerf.mockRejectedValue(new Error('fail'));
    mockTimePerf.mockRejectedValue(new Error('fail'));

    const placeholders = [
      '{{AVG_REACH_LAST30}}',
      '{{AVG_SHARES_LAST30}}',
      '{{TREND_SUMMARY_LAST30}}',
      '{{AVG_ENG_RATE_LAST30}}',
      '{{FOLLOWER_GROWTH_LAST30}}',
      '{{EMERGING_FPC_COMBOS}}',
      '{{HOT_TIMES_LAST_ANALYSIS}}',
      '{{TOP_DAY_PCO_COMBOS}}',
      '{{TOP_FPC_TRENDS}}',
      '{{TOP_CATEGORY_RANKINGS}}',
      '{{AUDIENCE_TOP_SEGMENT}}',
      '{{TOP_PERFORMING_FORMAT}}',
      '{{LOW_PERFORMING_FORMAT}}',
      '{{BEST_DAY}}',
      '{{PERFORMANCE_INSIGHT_SUMMARY}}',
      '{{FOLLOWER_GROWTH_RATE_LAST30}}',
      '{{AVG_PROPAGATION_LAST30}}',
      '{{AVG_FOLLOWER_CONV_RATE_LAST30}}',
      '{{AVG_RETENTION_RATE_LAST30}}',
      '{{AVG_ENG_POST_LAST30}}',
      '{{AVG_REACH_POST_LAST30}}',
      '{{DEALS_COUNT_LAST30}}',
      '{{DEALS_REVENUE_LAST30}}',
      '{{DEAL_AVG_VALUE_LAST30}}',
      '{{DEALS_BRAND_SEGMENTS}}',
      '{{DEALS_FREQUENCY}}',
      '{{USER_TONE_PREF}}',
      '{{USER_PREFERRED_FORMATS}}',
      '{{USER_DISLIKED_TOPICS}}',
      '{{USER_LONG_TERM_GOALS}}',
      '{{USER_KEY_FACTS}}',
      '{{USER_EXPERTISE_LEVEL}}',
      '{{USER_BIO}}',
      '{{USER_PROFILE_TONE}}',
    ];

    const expected = placeholders.reduce(
      (p, ph) => p.replace(ph, 'Dados insuficientes'),
      getSystemPrompt('Ana')
    );

    const prompt = await populateSystemPrompt(user, 'Ana');
    expect(prompt).toBe(expected);
  });
});
