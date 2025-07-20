import { populateSystemPrompt } from '../aiOrchestrator';
import { functionExecutors } from '../aiFunctions';
import { Types } from 'mongoose';

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

const execs = functionExecutors as jest.Mocked<typeof functionExecutors>;

describe('populateSystemPrompt', () => {
  const user = { _id: new Types.ObjectId(), name: 'Tester' } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    execs.getAggregatedReport.mockResolvedValue({
      reportData: {
        overallStats: { avgReach: 100, avgShares: 5, avgEngagementRate: 0.1 },
        historicalComparisons: { followerChangeShortTerm: 2 },
        detailedContentStats: [
          { _id: { format: 'reel', proposal: 'dica', context: 'tech' }, shareDiffPercentage: 10 }
        ]
      }
    });
    execs.getUserTrend.mockResolvedValue({ insightSummary: 'alta' });
    execs.getFpcTrendHistory.mockResolvedValue({ chartData: [{ avgInteractions: 1 }, { avgInteractions: 3 }] });
    execs.getDayPCOStats.mockResolvedValue({ dayPCOStats: { '1': { dica: { tech: { avgTotalInteractions: 10 } } } } });
    execs.getCategoryRanking.mockResolvedValue({ ranking: [{ category: 'reel' }, { category: 'carrossel' }] });
    execs.getLatestAudienceDemographics.mockResolvedValue({ demographics: { follower_demographics: { country: { Brasil: 80 }, age: { '18-24': 50 } } } });
  });

  it('fills placeholders with values', async () => {
    const prompt = await populateSystemPrompt(user, 'Ana');
    expect(prompt).toContain('100');
    expect(prompt).toContain('reel');
    expect(prompt).toContain('Brasil');
    expect(prompt).not.toContain('{{AVG_REACH_LAST30}}');
    expect(prompt).not.toContain('{{TOP_CATEGORY_RANKINGS}}');
  });
});
