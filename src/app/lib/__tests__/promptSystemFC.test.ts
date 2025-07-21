import { getSystemPrompt } from '../promptSystemFC';
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

describe('getSystemPrompt', () => {
  it('includes metrics placeholders in Resumo Atual section', () => {
    const prompt = getSystemPrompt('Ana');
    expect(prompt).toContain('Resumo Atual');
    expect(prompt).toContain('{{AVG_REACH_LAST30}}');
    expect(prompt).toContain('{{AVG_SHARES_LAST30}}');
    expect(prompt).toContain('{{TREND_SUMMARY_LAST30}}');
    expect(prompt).toContain('{{AVG_ENG_RATE_LAST30}}');
    expect(prompt).toContain('{{FOLLOWER_GROWTH_LAST30}}');
    expect(prompt).toContain('{{FOLLOWER_GROWTH_RATE_LAST30}}');
    expect(prompt).toContain('{{AVG_ENG_POST_LAST30}}');
    expect(prompt).toContain('{{AVG_REACH_POST_LAST30}}');
    expect(prompt).toContain('{{AVG_PROPAGATION_LAST30}}');
    expect(prompt).toContain('{{AVG_FOLLOWER_CONV_RATE_LAST30}}');
    expect(prompt).toContain('{{AVG_RETENTION_RATE_LAST30}}');
    expect(prompt).toContain('{{EMERGING_FPC_COMBOS}}');
    expect(prompt).toContain('{{HOT_TIMES_LAST_ANALYSIS}}');
    expect(prompt).toContain('{{TOP_DAY_PCO_COMBOS}}');
    expect(prompt).toContain('{{TOP_FPC_TRENDS}}');
    expect(prompt).toContain('{{TOP_CATEGORY_RANKINGS}}');
    expect(prompt).toContain('{{AUDIENCE_TOP_SEGMENT}}');
    expect(prompt).toContain('{{DEALS_COUNT_LAST30}}');
    expect(prompt).toContain('{{DEALS_REVENUE_LAST30}}');
    expect(prompt).toContain('{{DEAL_AVG_VALUE_LAST30}}');
    expect(prompt).toContain('{{DEALS_BRAND_SEGMENTS}}');
    expect(prompt).toContain('{{DEALS_FREQUENCY}}');
    expect(prompt).toContain('{{USER_TONE_PREF}}');
    expect(prompt).toContain('{{USER_PREFERRED_FORMATS}}');
    expect(prompt).toContain('{{USER_DISLIKED_TOPICS}}');
    expect(prompt).toContain('{{USER_LONG_TERM_GOALS}}');
    expect(prompt).toContain('{{USER_KEY_FACTS}}');
  });
});

describe('populateSystemPrompt user preference placeholders', () => {
  const user = {
    _id: new Types.ObjectId(),
    name: 'Tester',
    userPreferences: {
      preferredAiTone: 'direto',
      preferredFormats: ['reel', 'story'],
      dislikedTopics: ['politica', 'religiao'],
    },
    userLongTermGoals: [
      { goal: 'ser influenciador digital' },
      { goal: 'vender curso' },
    ],
    userKeyFacts: [
      { fact: 'ama gatos' },
    ],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    execs.getAggregatedReport.mockResolvedValue({ reportData: {}, adDealInsights: {} });
    execs.getUserTrend.mockResolvedValue({});
    execs.getFpcTrendHistory.mockResolvedValue({});
    execs.getDayPCOStats.mockResolvedValue({});
    execs.getCategoryRanking.mockResolvedValue({});
    execs.getLatestAudienceDemographics.mockResolvedValue({});
    execs.getMetricsHistory.mockResolvedValue({ history: {} });
    mockPerf.mockResolvedValue({});
    mockDayPerf.mockResolvedValue({});
    mockTimePerf.mockResolvedValue({});
  });

  it('replaces placeholders with user preferences', async () => {
    const prompt = await populateSystemPrompt(user, 'Ana');
    expect(prompt).toContain('direto');
    expect(prompt).toContain('reel, story');
    expect(prompt).toContain('politica, religiao');
    expect(prompt).toContain('ser influenciador digital, vender curso');
    expect(prompt).toContain('ama gatos');
    expect(prompt).toContain('Dados insuficientes');
    expect(prompt).not.toContain('{{USER_TONE_PREF}}');
    expect(prompt).not.toContain('{{USER_PREFERRED_FORMATS}}');
    expect(prompt).not.toContain('{{USER_DISLIKED_TOPICS}}');
    expect(prompt).not.toContain('{{USER_LONG_TERM_GOALS}}');
    expect(prompt).not.toContain('{{USER_KEY_FACTS}}');
  });
});
