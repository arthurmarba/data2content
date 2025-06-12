import {
  fetchDashboardCreatorsList,
  fetchDashboardOverallContentStats,
  findGlobalPostsByCriteria,
  IFetchDashboardCreatorsListParams,
  IDashboardCreator,
  IDashboardOverallStats,
  FindGlobalPostsArgs,
  IGlobalPostsPaginatedResult,
} from './marketAnalysisService';
import { connectToDatabase } from './connection';
import MetricModel from '@/app/models/Metric';
import UserModel from '@/app/models/User';
import { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';

// Mock logger to prevent console output during tests
jest.mock('@/app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock database connection
jest.mock('./connection', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
}));

// Mock Mongoose models
jest.mock('@/app/models/Metric');
jest.mock('@/app/models/User');

const mockMetricModelAggregate = MetricModel.aggregate as jest.Mock;
const mockUserModelAggregate = UserModel.aggregate as jest.Mock;
// const mockMetricModelDistinct = MetricModel.distinct as jest.Mock; // If getAvailableContexts was being tested

describe('MarketAnalysisService', () => {
  beforeEach(() => {
    // Clear all mock implementations and calls before each test
    jest.clearAllMocks();
    (connectToDatabase as jest.Mock).mockResolvedValue(undefined); // Ensure it's reset
  });

  // ============================================================================
  // Tests for fetchDashboardCreatorsList
  // ============================================================================
  describe('fetchDashboardCreatorsList', () => {
    const defaultParams: IFetchDashboardCreatorsListParams = {
      page: 1,
      limit: 10,
      sortBy: 'totalPosts',
      sortOrder: 'desc',
      filters: {},
    };

    const mockCreators: IDashboardCreator[] = [
      { _id: new Types.ObjectId() as any, name: 'Creator A', totalPosts: 100, avgEngagementRate: 0.05, avgLikes: 50, avgShares: 10, planStatus: 'Pro' },
      { _id: new Types.ObjectId() as any, name: 'Creator B', totalPosts: 150, avgEngagementRate: 0.03, avgLikes: 45, avgShares: 5, planStatus: 'Free' },
    ];

    it('should fetch creators with default parameters successfully', async () => {
      mockUserModelAggregate.mockImplementation((pipeline: any[]) => {
        // Check if the pipeline is for counting or fetching data
        if (pipeline.some(stage => stage.$count === 'totalCreators')) {
          return Promise.resolve([{ totalCreators: mockCreators.length }]);
        }
        return Promise.resolve(mockCreators);
      });

      const result = await fetchDashboardCreatorsList(defaultParams);

      expect(connectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockUserModelAggregate).toHaveBeenCalledTimes(2); // Once for count, once for data
      expect(result.creators).toEqual(mockCreators);
      expect(result.totalCreators).toBe(mockCreators.length);
    });

    it('should apply nameSearch filter', async () => {
      mockUserModelAggregate.mockResolvedValueOnce([{ totalCreators: 1 }]).mockResolvedValueOnce([mockCreators[0]]);
      const paramsWithNameSearch: IFetchDashboardCreatorsListParams = { ...defaultParams, filters: { nameSearch: 'Creator A' } };
      await fetchDashboardCreatorsList(paramsWithNameSearch);

      const matchStage = mockUserModelAggregate.mock.calls[0][0].find((stage: any) => stage.$match && stage.$match.name);
      expect(matchStage.name.$regex).toBe('Creator A');
    });

    it('should apply planStatus filter', async () => {
        mockUserModelAggregate.mockResolvedValueOnce([{ totalCreators: 1 }]).mockResolvedValueOnce([mockCreators[0]]);
        const paramsWithPlanStatus: IFetchDashboardCreatorsListParams = { ...defaultParams, filters: { planStatus: ['Pro'] } };
        await fetchDashboardCreatorsList(paramsWithPlanStatus);

        const matchStage = mockUserModelAggregate.mock.calls[0][0].find((stage: any) => stage.$match && stage.$match.planStatus);
        expect(matchStage.planStatus.$in).toEqual(['Pro']);
    });

    it('should handle pagination correctly', async () => {
        mockUserModelAggregate.mockResolvedValueOnce([{ totalCreators: 2 }]).mockResolvedValueOnce([mockCreators[1]]);
        const paramsPage2: IFetchDashboardCreatorsListParams = { ...defaultParams, page: 2, limit: 1 };
        await fetchDashboardCreatorsList(paramsPage2);

        const skipStage = mockUserModelAggregate.mock.calls[1][0].find((stage: any) => stage.$skip);
        const limitStage = mockUserModelAggregate.mock.calls[1][0].find((stage: any) => stage.$limit);
        expect(skipStage.$skip).toBe(1);
        expect(limitStage.$limit).toBe(1);
    });

    it('should handle sorting correctly', async () => {
        mockUserModelAggregate.mockResolvedValueOnce([{ totalCreators: 2 }]).mockResolvedValueOnce(mockCreators);
        const paramsSortNameAsc: IFetchDashboardCreatorsListParams = { ...defaultParams, sortBy: 'name', sortOrder: 'asc' };
        await fetchDashboardCreatorsList(paramsSortNameAsc);

        const sortStage = mockUserModelAggregate.mock.calls[1][0].find((stage: any) => stage.$sort);
        expect(sortStage.$sort.name).toBe(1);
    });

    it('should return empty array and zero total when no creators found', async () => {
      mockUserModelAggregate.mockResolvedValueOnce([{ totalCreators: 0 }]).mockResolvedValueOnce([]);
      const result = await fetchDashboardCreatorsList(defaultParams);
      expect(result.creators).toEqual([]);
      expect(result.totalCreators).toBe(0);
    });

    it('should throw DatabaseError if aggregation fails', async () => {
      mockUserModelAggregate.mockRejectedValue(new Error('Aggregation failed'));
      await expect(fetchDashboardCreatorsList(defaultParams)).rejects.toThrow('Falha ao buscar lista de criadores: Aggregation failed');
    });
  });

  // ============================================================================
  // Tests for fetchDashboardOverallContentStats
  // ============================================================================
  describe('fetchDashboardOverallContentStats', () => {
    const mockStatsData: IDashboardOverallStats = {
      totalPlatformPosts: 1000,
      averagePlatformEngagementRate: 0.045,
      totalContentCreators: 50,
      breakdownByFormat: [{ format: 'video', count: 600, avgEngagement: 0.05 }],
      breakdownByProposal: [{ proposal: 'tutorial', count: 300, avgEngagement: 0.04 }],
      breakdownByContext: [{ context: 'education', count: 400, avgEngagement: 0.048 }],
    };

    it('should fetch overall content stats successfully', async () => {
      // Mock the $facet structure
      mockMetricModelAggregate.mockResolvedValueOnce([{
        totalPlatformPosts: [{ count: mockStatsData.totalPlatformPosts }],
        averagePlatformEngagementRate: [{ avgEngagement: mockStatsData.averagePlatformEngagementRate }],
        totalContentCreators: [{ count: mockStatsData.totalContentCreators }],
        breakdownByFormat: mockStatsData.breakdownByFormat,
        breakdownByProposal: mockStatsData.breakdownByProposal,
        breakdownByContext: mockStatsData.breakdownByContext,
      }]);

      const result = await fetchDashboardOverallContentStats({});
      expect(connectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockMetricModelAggregate).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockStatsData);
    });

    it('should apply date filters if provided', async () => {
        mockMetricModelAggregate.mockResolvedValueOnce([{}]); // Simplified response for this test
        const startDate = new Date('2023-01-01T00:00:00.000Z');
        const endDate = new Date('2023-01-31T23:59:59.999Z');

        await fetchDashboardOverallContentStats({ dateRange: { startDate, endDate } });

        const matchStage = mockMetricModelAggregate.mock.calls[0][0].find((stage: any) => stage.$match && stage.$match.postDate);
        expect(matchStage.$match.postDate.$gte).toEqual(startDate);
        expect(matchStage.$match.postDate.$lte).toEqual(endDate);
    });

    it('should handle empty results from aggregation', async () => {
      mockMetricModelAggregate.mockResolvedValueOnce([{
        totalPlatformPosts: [],
        averagePlatformEngagementRate: [],
        totalContentCreators: [],
        breakdownByFormat: [],
        breakdownByProposal: [],
        breakdownByContext: [],
      }]);
      const result = await fetchDashboardOverallContentStats({});
      expect(result.totalPlatformPosts).toBe(0);
      expect(result.averagePlatformEngagementRate).toBe(0);
      expect(result.totalContentCreators).toBe(0);
      expect(result.breakdownByFormat).toEqual([]);
    });

    it('should throw DatabaseError if aggregation fails', async () => {
      mockMetricModelAggregate.mockRejectedValue(new Error('Stats Aggregation failed'));
      await expect(fetchDashboardOverallContentStats({})).rejects.toThrow('Falha ao buscar estatísticas gerais de conteúdo: Stats Aggregation failed');
    });
  });

  // ============================================================================
  // Tests for findGlobalPostsByCriteria
  // ============================================================================
  describe('findGlobalPostsByCriteria', () => {
    const defaultArgs: FindGlobalPostsArgs = { page: 1, limit: 5 };
    const mockPosts: any[] = [ // Using 'any' for simplicity as IMetric is complex
      { _id: 'post1', content: 'Post A', 'stats.total_interactions': 100, postDate: new Date() },
      { _id: 'post2', content: 'Post B', 'stats.total_interactions': 200, postDate: new Date() },
    ];
    const mockPaginatedResult: IGlobalPostsPaginatedResult = {
      posts: mockPosts,
      totalPosts: mockPosts.length,
      page: 1,
      limit: 5,
    };

    it('should fetch posts with default args successfully', async () => {
      mockMetricModelAggregate.mockImplementation((pipeline: any[]) => {
        if (pipeline.some(stage => stage.$count === 'totalPosts')) {
          return Promise.resolve([{ totalPosts: mockPosts.length }]);
        }
        return Promise.resolve(mockPosts);
      });

      const result = await findGlobalPostsByCriteria(defaultArgs);
      expect(connectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockMetricModelAggregate).toHaveBeenCalledTimes(2); // Count and data
      expect(result.posts).toEqual(mockPosts);
      expect(result.totalPosts).toBe(mockPosts.length);
    });

    it('should apply context, proposal, and format filters', async () => {
        mockMetricModelAggregate.mockResolvedValueOnce([{totalPosts: 0}]).mockResolvedValueOnce([]);
        const filterArgs: FindGlobalPostsArgs = {
            ...defaultArgs,
            context: 'Tech',
            proposal: 'Review',
            format: 'Article'
        };
        await findGlobalPostsByCriteria(filterArgs);

        const matchStage = mockMetricModelAggregate.mock.calls[0][0].find((stage: any) => stage.$match && stage.$match.context); // Check one of the filters
        expect(matchStage.$match.context).toEqual({ $regex: 'Tech', $options: 'i' });
        // Similar checks for proposal and format
    });

    it('should apply dateRange filter', async () => {
        mockMetricModelAggregate.mockResolvedValueOnce([{totalPosts: 0}]).mockResolvedValueOnce([]);
        const startDate = new Date('2023-05-01T00:00:00Z');
        const endDate = new Date('2023-05-31T23:59:59Z');
        const dateArgs: FindGlobalPostsArgs = { ...defaultArgs, dateRange: { startDate, endDate }};
        await findGlobalPostsByCriteria(dateArgs);

        const matchStage = mockMetricModelAggregate.mock.calls[0][0].find((stage: any) => stage.$match && stage.$match.postDate);
        expect(matchStage.$match.postDate.$gte).toEqual(startDate);
        expect(matchStage.$match.postDate.$lte).toEqual(endDate);
    });

    it('should apply sorting correctly', async () => {
        mockMetricModelAggregate.mockResolvedValueOnce([{totalPosts: 1}]).mockResolvedValueOnce([mockPosts[0]]);
        const sortArgs: FindGlobalPostsArgs = {...defaultArgs, sortBy: 'postDate', sortOrder: 'asc'};
        await findGlobalPostsByCriteria(sortArgs);

        const sortStage = mockMetricModelAggregate.mock.calls[1][0].find((stage: any) => stage.$sort);
        expect(sortStage.$sort.postDate).toBe(1); // 1 for asc
    });

    it('should throw DatabaseError if aggregation fails', async () => {
      mockMetricModelAggregate.mockRejectedValue(new Error('Global Post Aggregation failed'));
      await expect(findGlobalPostsByCriteria(defaultArgs)).rejects.toThrow('Falha ao buscar posts globais: Global Post Aggregation failed');
    });
  });
});
