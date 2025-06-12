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

      const userMatchStageCall = mockUserModelAggregate.mock.calls.find(call => call[0].some((stage: any) => stage.$match && stage.$match.name));
      const matchStage = userMatchStageCall[0].find((stage: any) => stage.$match && stage.$match.name);
      expect(matchStage.name.$regex).toBe('Creator A');
    });

    it('should apply single planStatus filter', async () => {
        mockUserModelAggregate.mockResolvedValueOnce([{ totalCreators: 1 }]).mockResolvedValueOnce([mockCreators[0]]);
        const paramsWithPlanStatus: IFetchDashboardCreatorsListParams = { ...defaultParams, filters: { planStatus: ['Pro'] } };
        await fetchDashboardCreatorsList(paramsWithPlanStatus);

        const userMatchStageCall = mockUserModelAggregate.mock.calls.find(call => call[0].some((stage: any) => stage.$match && stage.$match.planStatus));
        const matchStage = userMatchStageCall[0].find((stage: any) => stage.$match && stage.$match.planStatus);
        expect(matchStage.planStatus.$in).toEqual(['Pro']);
    });

    it('should apply multiple planStatus filters', async () => {
      mockUserModelAggregate.mockResolvedValueOnce([{ totalCreators: 1 }]).mockResolvedValueOnce([mockCreators[0]]);
      const statuses = ['Pro', 'Premium'];
      const params: IFetchDashboardCreatorsListParams = { ...defaultParams, filters: { planStatus: statuses } };
      await fetchDashboardCreatorsList(params);

      const userMatchStageCall = mockUserModelAggregate.mock.calls.find(call => call[0].some((stage: any) => stage.$match && stage.$match.planStatus));
      const matchStage = userMatchStageCall[0].find((stage: any) => stage.$match && stage.$match.planStatus);
      expect(matchStage.planStatus.$in).toEqual(statuses);
    });

    it('should apply multiple expertiseLevel filters', async () => {
      mockUserModelAggregate.mockResolvedValueOnce([{ totalCreators: 1 }]).mockResolvedValueOnce([mockCreators[0]]);
      const levels = ['Intermediário', 'Avançado'];
      const params: IFetchDashboardCreatorsListParams = { ...defaultParams, filters: { expertiseLevel: levels } };
      await fetchDashboardCreatorsList(params);

      const userMatchStageCall = mockUserModelAggregate.mock.calls.find(call => call[0].some((stage: any) => stage.$match && stage.$match.inferredExpertiseLevel));
      const matchStage = userMatchStageCall[0].find((stage: any) => stage.$match && stage.$match.inferredExpertiseLevel);
      expect(matchStage.inferredExpertiseLevel.$in).toEqual(levels);
    });

    it('should not add filter if planStatus is an empty array', async () => {
      mockUserModelAggregate.mockResolvedValueOnce([{ totalCreators: 0 }]).mockResolvedValueOnce([]);
      const params: IFetchDashboardCreatorsListParams = { ...defaultParams, filters: { planStatus: [] } };
      await fetchDashboardCreatorsList(params);

      const userMatchStageCall = mockUserModelAggregate.mock.calls.find(call => call[0].some((stage: any) => stage.$match));
      const matchStage = userMatchStageCall[0].find((stage: any) => stage.$match);
      expect(matchStage.$match.planStatus).toBeUndefined();
    });

    it('should not add filter if expertiseLevel is undefined', async () => {
      mockUserModelAggregate.mockResolvedValueOnce([{ totalCreators: 0 }]).mockResolvedValueOnce([]);
      const params: IFetchDashboardCreatorsListParams = { ...defaultParams, filters: { expertiseLevel: undefined } };
      await fetchDashboardCreatorsList(params);

      const userMatchStageCall = mockUserModelAggregate.mock.calls.find(call => call[0].some((stage: any) => stage.$match));
      const matchStage = userMatchStageCall[0].find((stage: any) => stage.$match);
      expect(matchStage.$match.inferredExpertiseLevel).toBeUndefined();
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

  // ============================================================================
  // Tests for fetchCreatorTimeSeriesData
  // ============================================================================
  describe('fetchCreatorTimeSeriesData', () => {
    const baseArgs = {
      creatorId: new Types.ObjectId().toString(),
      dateRange: {
        startDate: new Date('2023-01-01T00:00:00.000Z'),
        endDate: new Date('2023-03-31T23:59:59.999Z')
      },
    };

    const mockTimeSeriesData = [
      { date: new Date('2023-01-01T00:00:00.000Z'), value: 10 },
      { date: new Date('2023-02-01T00:00:00.000Z'), value: 15 },
    ];

    it('should fetch monthly post_count successfully', async () => {
      mockMetricModelAggregate.mockResolvedValue(mockTimeSeriesData);
      const args = { ...baseArgs, metric: 'post_count', period: 'monthly' } as const;
      const result = await fetchCreatorTimeSeriesData(args);

      expect(connectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockMetricModelAggregate).toHaveBeenCalledTimes(1);
      const pipeline = mockMetricModelAggregate.mock.calls[0][0];

      // Check $match stage
      expect(pipeline[0].$match.user).toEqual(new Types.ObjectId(baseArgs.creatorId));
      expect(pipeline[0].$match.postDate.$gte).toEqual(baseArgs.dateRange.startDate);
      expect(pipeline[0].$match.postDate.$lte).toEqual(baseArgs.dateRange.endDate);

      // Check $group stage for monthly post_count
      expect(pipeline[1].$group._id).toEqual({ year: { $year: '$postDate' }, month: { $month: '$postDate' } });
      expect(pipeline[1].$group.rawValue).toEqual({ $sum: 1 });

      // Check $project stage for date construction
      expect(pipeline[3].$project.date.$dateFromParts.day).toBe(1); // Monthly sets day to 1

      expect(result).toEqual(mockTimeSeriesData);
    });

    it('should fetch weekly avg_engagement_rate successfully', async () => {
      mockMetricModelAggregate.mockResolvedValue(mockTimeSeriesData); // Re-use mock data for structure
      const args = { ...baseArgs, metric: 'avg_engagement_rate', period: 'weekly' } as const;
      await fetchCreatorTimeSeriesData(args);

      const pipeline = mockMetricModelAggregate.mock.calls[0][0];

      // Check $match for metric field existence
      expect(pipeline[0].$match['stats.engagement_rate_on_reach']).toEqual({ $exists: true, $ne: null });

      // Check $group stage for weekly avg_engagement_rate
      expect(pipeline[1].$group._id).toEqual({ year: { $isoWeekYear: '$postDate' }, week: { $isoWeek: '$postDate' } });
      expect(pipeline[1].$group.rawValue).toEqual({ $avg: '$stats.engagement_rate_on_reach' });

      // Check $project stage for date construction and rounding
      expect(pipeline[3].$project.date.$dateFromParts.isoDayOfWeek).toBe(1); // Weekly sets day to Monday
      expect(pipeline[3].$project.value).toEqual({ $round: ['$rawValue', 4] });


      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('[fetchCreatorTimeSeriesData] Aggregation pipeline:'), expect.any(String));
    });

    it('should fetch monthly total_interactions successfully', async () => {
      mockMetricModelAggregate.mockResolvedValue(mockTimeSeriesData);
      const args = { ...baseArgs, metric: 'total_interactions', period: 'monthly' } as const;
      await fetchCreatorTimeSeriesData(args);
      const pipeline = mockMetricModelAggregate.mock.calls[0][0];
      expect(pipeline[1].$group.rawValue).toEqual({ $sum: '$stats.total_interactions' });
      expect(pipeline[0].$match['stats.total_interactions']).toEqual({ $exists: true, $ne: null }); // ensure this is checked
    });


    it('should return empty array if aggregation yields no results', async () => {
      mockMetricModelAggregate.mockResolvedValue([]);
      const args = { ...baseArgs, metric: 'post_count', period: 'monthly' } as const;
      const result = await fetchCreatorTimeSeriesData(args);
      expect(result).toEqual([]);
    });

    it('should throw an error for invalid creatorId', async () => {
      const args = { ...baseArgs, creatorId: 'invalid-id', metric: 'post_count', period: 'monthly' } as const;
      await expect(fetchCreatorTimeSeriesData(args)).rejects.toThrow('Invalid creatorId format.');
      expect(connectToDatabase).toHaveBeenCalledTimes(1); // Should be called before validation
    });

    it('should throw an error for unsupported metric', async () => {
      const args = { ...baseArgs, metric: 'unsupported_metric_type', period: 'monthly' } as any; // Cast to any to bypass TS type check for test
      await expect(fetchCreatorTimeSeriesData(args)).rejects.toThrow('Unsupported metric: unsupported_metric_type');
    });

    it('should throw DatabaseError if aggregation fails', async () => {
      mockMetricModelAggregate.mockRejectedValue(new Error('TimeSeries Aggregation failed'));
      const args = { ...baseArgs, metric: 'post_count', period: 'monthly' } as const;
      await expect(fetchCreatorTimeSeriesData(args)).rejects.toThrow('Failed to fetch time series data: TimeSeries Aggregation failed');
    });
  });

  // ============================================================================
  // Tests for fetchMultipleCreatorProfiles
  // ============================================================================
  describe('fetchMultipleCreatorProfiles', () => {
    const objectId1 = new Types.ObjectId();
    const objectId2 = new Types.ObjectId();
    const objectId3 = new Types.ObjectId();

    const mockUsers = [
      { _id: objectId1, name: 'User One', profile_picture_url: 'url1.jpg' },
      { _id: objectId2, name: 'User Two', profile_picture_url: 'url2.jpg' },
      { _id: objectId3, name: 'User Three', profile_picture_url: 'url3.jpg' },
    ];

    const mockMetricsData = {
      mainStatsPerUser: [
        { _id: objectId1, postCount: 10, avgLikes: 100, avgShares: 10, avgEngagementRate: 0.1 },
        { _id: objectId2, postCount: 20, avgLikes: 200, avgShares: 20, avgEngagementRate: 0.2 },
        // User Three has no metrics in this mock
      ],
      topContextPerUser: [
        { _id: objectId1, topContext: 'Tech' },
        { _id: objectId2, topContext: 'Finance' },
      ],
    };

    beforeEach(() => {
      (UserModel.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]), // Default to no users found
      });
      mockMetricModelAggregate.mockResolvedValue([mockMetricsData]); // Default mock for aggregation
    });

    it('should fetch multiple creator profiles successfully', async () => {
      (UserModel.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockUsers[0], mockUsers[1]]),
      });
      mockMetricModelAggregate.mockResolvedValue([{ // Ensure the facet structure is returned
          mainStatsPerUser: [mockMetricsData.mainStatsPerUser[0], mockMetricsData.mainStatsPerUser[1]],
          topContextPerUser: [mockMetricsData.topContextPerUser[0], mockMetricsData.topContextPerUser[1]],
      }]);

      const args = { creatorIds: [objectId1.toString(), objectId2.toString()] };
      const profiles = await fetchMultipleCreatorProfiles(args);

      expect(connectToDatabase).toHaveBeenCalledTimes(1);
      expect(UserModel.find).toHaveBeenCalledWith({ _id: { $in: [objectId1, objectId2] } });
      expect(mockMetricModelAggregate).toHaveBeenCalledTimes(1);
      expect(profiles).toHaveLength(2);

      expect(profiles[0]).toMatchObject({
        creatorId: objectId1.toString(),
        creatorName: 'User One',
        profilePictureUrl: 'url1.jpg',
        postCount: 10,
        avgEngagementRate: 0.1,
        topPerformingContext: 'Tech',
      });
      expect(profiles[1]).toMatchObject({
        creatorId: objectId2.toString(),
        creatorName: 'User Two',
        postCount: 20,
        avgEngagementRate: 0.2,
        topPerformingContext: 'Finance',
      });
    });

    it('should filter out invalid creatorIds and process valid ones', async () => {
      (UserModel.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockUsers[0]]), // Only User One is valid and found
      });
       mockMetricModelAggregate.mockResolvedValue([{
          mainStatsPerUser: [mockMetricsData.mainStatsPerUser[0]],
          topContextPerUser: [mockMetricsData.topContextPerUser[0]],
      }]);

      const args = { creatorIds: [objectId1.toString(), 'invalid-id1', 'invalid-id2'] };
      const profiles = await fetchMultipleCreatorProfiles(args);

      expect(UserModel.find).toHaveBeenCalledWith({ _id: { $in: [objectId1] } });
      expect(profiles).toHaveLength(1);
      expect(profiles[0].creatorId).toBe(objectId1.toString());
    });

    it('should handle users with no metrics gracefully (default/zeroed stats)', async () => {
      // User Three has user data but no corresponding entry in mockMetricsData.mainStatsPerUser or topContextPerUser
      (UserModel.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockUsers[2]]),
      });
      mockMetricModelAggregate.mockResolvedValue([{ // Simulate empty results for this user from metrics
          mainStatsPerUser: [],
          topContextPerUser: [],
      }]);

      const args = { creatorIds: [objectId3.toString()] };
      const profiles = await fetchMultipleCreatorProfiles(args);

      expect(profiles).toHaveLength(1);
      expect(profiles[0]).toMatchObject({
        creatorId: objectId3.toString(),
        creatorName: 'User Three',
        postCount: 0, // Defaulted
        avgLikes: 0,  // Defaulted
        avgShares: 0, // Defaulted
        avgEngagementRate: 0, // Defaulted
        topPerformingContext: 'Geral', // Defaulted
      });
    });

    it('should return an empty array if creatorIds array is empty', async () => {
      const profiles = await fetchMultipleCreatorProfiles({ creatorIds: [] });
      expect(profiles).toEqual([]);
      expect(UserModel.find).not.toHaveBeenCalled();
    });

    it('should return an empty array if no valid ObjectIds are provided', async () => {
      const profiles = await fetchMultipleCreatorProfiles({ creatorIds: ['invalid1', 'invalid2'] });
      expect(profiles).toEqual([]);
      expect(UserModel.find).not.toHaveBeenCalled(); // Or called with empty $in array, then returns empty
    });

    it('should return an empty array if UserModel.find returns no users', async () => {
      (UserModel.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      const args = { creatorIds: [objectId1.toString()] };
      const profiles = await fetchMultipleCreatorProfiles(args);
      expect(profiles).toEqual([]);
      // MetricModel.aggregate might not be called if no users are found, or it might be called with an empty $in array.
      // Depending on implementation, we might expect it not to be called or to handle empty $in.
      // The current implementation calls it with validCreatorObjectIds, so if that's empty, it won't run the facet.
    });

    it('should correctly structure the $facet aggregation', async () => {
      (UserModel.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockUsers[0]]),
      });
      await fetchMultipleCreatorProfiles({ creatorIds: [objectId1.toString()] });

      expect(mockMetricModelAggregate).toHaveBeenCalledTimes(1);
      const pipeline = mockMetricModelAggregate.mock.calls[0][0];

      expect(pipeline[0].$match.user).toEqual({ $in: [objectId1] });
      expect(pipeline[1].$facet).toBeDefined();
      expect(pipeline[1].$facet.mainStatsPerUser).toBeDefined();
      expect(pipeline[1].$facet.topContextPerUser).toBeDefined();

      // Check mainStatsPerUser facet part
      const mainStatsFacet = pipeline[1].$facet.mainStatsPerUser;
      expect(mainStatsFacet[0].$group._id).toBe('$user');
      expect(mainStatsFacet[0].$group.postCount).toEqual({ $sum: 1 });
      expect(mainStatsFacet[0].$group.avgLikes).toEqual({ $avg: '$stats.likes' });
      expect(mainStatsFacet[1].$project.avgLikes).toEqual({ $ifNull: ['$avgLikes', 0] });

      // Check topContextPerUser facet part
      const topContextFacet = pipeline[1].$facet.topContextPerUser;
      expect(topContextFacet[0].$match.context).toEqual({ $ne: null, $ne: "" });
      expect(topContextFacet[1].$group._id).toEqual({ user: '$user', context: '$context' });
      expect(topContextFacet[2].$sort).toEqual({ '_id.user': 1, count: -1 });
      expect(topContextFacet[3].$group._id).toBe('$_id.user');
      expect(topContextFacet[3].$group.topContext).toEqual({ $first: '$_id.context' });
    });


    it('should throw DatabaseError if UserModel.find fails', async () => {
      (UserModel.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('User find failed')),
      });
      const args = { creatorIds: [objectId1.toString()] };
      await expect(fetchMultipleCreatorProfiles(args)).rejects.toThrow('Failed to fetch multiple creator profiles: User find failed');
    });

    it('should throw DatabaseError if MetricModel.aggregate fails', async () => {
      (UserModel.find as jest.Mock).mockReturnValue({ // Assume users are found
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockUsers[0]]),
      });
      mockMetricModelAggregate.mockRejectedValue(new Error('Metrics aggregation failed'));
      const args = { creatorIds: [objectId1.toString()] };
      await expect(fetchMultipleCreatorProfiles(args)).rejects.toThrow('Failed to fetch multiple creator profiles: Metrics aggregation failed');
    });
  });

  // ============================================================================
  // Tests for fetchSegmentPerformanceData
  // ============================================================================
  describe('fetchSegmentPerformanceData', () => {
    const defaultDateRange = {
      startDate: new Date('2023-01-01T00:00:00.000Z'),
      endDate: new Date('2023-01-31T23:59:59.999Z'),
    };

    const mockFullResult: ISegmentPerformanceResult = {
      postCount: 10,
      avgEngagementRate: 0.05,
      avgLikes: 20,
      avgShares: 5,
      avgComments: 2,
    };

    const mockEmptyResultFromGroup: any[] = [{ // What aggregate returns if $group runs but finds nothing to avg/sum (postCount would be 0)
        postCount: 0, // $sum:1 over empty set is 0, but $group itself might not produce a doc if $match is empty
        avgEngagementRate: null, // $avg over empty set is null
        avgLikes: null,
        avgShares: null,
        avgComments: null,
    }];


    it('should fetch performance data with all criteria successfully', async () => {
      mockMetricModelAggregate.mockResolvedValue([mockFullResult]); // Assume $project handles nulls if needed
      const args = {
        criteria: { format: 'Video', proposal: 'Tutorial', context: 'Tech' },
        dateRange: defaultDateRange,
      };
      const result = await fetchSegmentPerformanceData(args);

      expect(connectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockMetricModelAggregate).toHaveBeenCalledTimes(1);
      const pipeline = mockMetricModelAggregate.mock.calls[0][0];

      // Check $match stage
      const matchStage = pipeline[0].$match;
      expect(matchStage.postDate.$gte).toEqual(defaultDateRange.startDate);
      expect(matchStage.postDate.$lte).toEqual(defaultDateRange.endDate);
      expect(matchStage.format).toBe('Video');
      expect(matchStage.proposal).toBe('Tutorial');
      expect(matchStage.context).toBe('Tech');
      expect(matchStage['stats.engagement_rate_on_reach']).toEqual({ $exists: true, $ne: null });
      // ... similar checks for other stats fields ...

      // Check $group stage
      const groupStage = pipeline[1].$group;
      expect(groupStage._id).toBeNull();
      expect(groupStage.postCount).toEqual({ $sum: 1 });
      expect(groupStage.avgEngagementRate).toEqual({ $avg: '$stats.engagement_rate_on_reach' });
      // ... similar checks for other avg fields ...

      // Check $project stage for defaulting nulls
      const projectStage = pipeline[2].$project;
      expect(projectStage.avgEngagementRate).toEqual({ $ifNull: ["$avgEngagementRate", 0] });
      expect(projectStage.postCount).toEqual({ $ifNull: ["$postCount", 0] });


      expect(result).toEqual(mockFullResult);
    });

    it('should fetch performance data with partial criteria (only format)', async () => {
      mockMetricModelAggregate.mockResolvedValue([mockFullResult]);
      const args = {
        criteria: { format: 'Reel' },
        dateRange: defaultDateRange,
      };
      await fetchSegmentPerformanceData(args);
      const pipeline = mockMetricModelAggregate.mock.calls[0][0];
      const matchStage = pipeline[0].$match;
      expect(matchStage.format).toBe('Reel');
      expect(matchStage.proposal).toBeUndefined();
      expect(matchStage.context).toBeUndefined();
    });

    it('should return zeroed results if aggregation yields no documents', async () => {
      mockMetricModelAggregate.mockResolvedValue([]); // No documents found
      const args = {
        criteria: { context: 'NonExistent' },
        dateRange: defaultDateRange,
      };
      const result = await fetchSegmentPerformanceData(args);
      expect(result).toEqual({
        postCount: 0,
        avgEngagementRate: 0,
        avgLikes: 0,
        avgShares: 0,
        avgComments: 0,
      });
    });

    it('should correctly default null averages to 0 if $group runs but averages are null (via $project)', async () => {
      // This scenario happens if the $match stage finds documents, but all of them have 'null' for the specific stats fields.
      // The $group stage would then produce nulls for $avg. The subsequent $project stage handles this.
      const resultsFromAggWithNulls = [{
        _id: null, // from $group
        postCount: 5, // Some posts existed
        avgEngagementRate: null, // but all had null engagement
        avgLikes: null,
        avgShares: null,
        avgComments: null
      }];
       // After $project stage with $ifNull, these nulls become 0s
      const expectedProjectedResult = {
        postCount: 5,
        avgEngagementRate: 0,
        avgLikes: 0,
        avgShares: 0,
        avgComments: 0
      };

      mockMetricModelAggregate.mockResolvedValue([expectedProjectedResult]); // Mocking the final result after $project

      const args = {
        criteria: { context: 'SpecificContext' },
        dateRange: defaultDateRange,
      };
      const result = await fetchSegmentPerformanceData(args);

      // Verify pipeline was called
      expect(mockMetricModelAggregate).toHaveBeenCalled();
      const pipeline = mockMetricModelAggregate.mock.calls[0][0];
      expect(pipeline[2].$project.avgEngagementRate).toEqual({ $ifNull: ["$avgEngagementRate", 0] });

      // Verify the final result after JS fallback (if any) or direct from agg
      expect(result).toEqual(expectedProjectedResult);
    });


    it('should throw DatabaseError if MetricModel.aggregate fails', async () => {
      mockMetricModelAggregate.mockRejectedValue(new Error('Segment Aggregation failed'));
      const args = {
        criteria: { format: 'Video' },
        dateRange: defaultDateRange,
      };
      await expect(fetchSegmentPerformanceData(args)).rejects.toThrow('Failed to fetch segment performance data: Segment Aggregation failed');
    });
  });

  // ============================================================================
  // Tests for fetchTopMoversData (Content Focus)
  // ============================================================================
  describe('fetchTopMoversData - entityType: content', () => {
    const metricId1 = new Types.ObjectId();
    const metricId2 = new Types.ObjectId();
    const metricId3 = new Types.ObjectId();

    const previousPeriod = { startDate: new Date('2023-01-01T00:00:00Z'), endDate: new Date('2023-01-31T23:59:59Z') };
    const currentPeriod = { startDate: new Date('2023-02-01T00:00:00Z'), endDate: new Date('2023-02-28T23:59:59Z') };

    const baseArgs: IFetchTopMoversArgs = {
      entityType: 'content',
      metric: 'cumulative_likes',
      previousPeriod,
      currentPeriod,
      topN: 5,
    };

    const mockSnapshots = [
      // Metric 1: Increase
      { metric: metricId1, date: previousPeriod.endDate, cumulative_likes: 100 },
      { metric: metricId1, date: currentPeriod.endDate, cumulative_likes: 150 },
      // Metric 2: Decrease
      { metric: metricId2, date: previousPeriod.endDate, cumulative_likes: 200 },
      { metric: metricId2, date: currentPeriod.endDate, cumulative_likes: 50 },
      // Metric 3: No change (should be filtered out by $match $ne previous current)
      { metric: metricId3, date: previousPeriod.endDate, cumulative_likes: 75 },
      { metric: metricId3, date: currentPeriod.endDate, cumulative_likes: 75 },
    ];

    const mockMetricDetails = [
        { _id: metricId1, description: 'Post about Cats', text_content: 'Cats are great' },
        { _id: metricId2, description: 'Post about Dogs', text_content: 'Dogs are fun' },
        { _id: metricId3, description: 'Post about Birds', text_content: 'Birds can fly' },
    ];

    beforeEach(() => {
      // Default mock for DailyMetricSnapshotModel.aggregate
      (DailyMetricSnapshotModel.aggregate as jest.Mock).mockImplementation(async (pipeline: any[]) => {
        // Simplified mock: Assumes the pipeline correctly filters and groups,
        // then this mock just provides data for the $lookup stage if it's the last one of interest
        // For a more accurate mock, one would need to simulate each stage.

        // Find the $lookup stage for metrics
        const lookupStageIndex = pipeline.findIndex(stage => stage.$lookup && stage.$lookup.from === 'metrics');
        if (lookupStageIndex !== -1 && lookupStageIndex === pipeline.length - 2) { // Assuming $unwind is next
            // This is after sorting and limiting. We need to return the topN results with metricInfo
            // Based on the provided mockSnapshots and a sortBy criteria
            // This simplified mock will return all mockMetricDetails for any _id for now
             return pipeline.filter(stage => stage.$match && stage.$match._id) // if there is a match by _id
                .map(stage => {
                    const id = stage.$match._id;
                    const metricDetail = mockMetricDetails.find(m => m._id.equals(id));
                    // This is a very simplified mock of the final lookup data
                    return {
                        _id: id,
                        metricInfo: metricDetail,
                        // previousValue, currentValue, etc., would have been calculated by earlier pipeline stages
                        // and should be preserved or added here based on what the test needs.
                        // For this mock, we'll assume the values are attached.
                        // This is a placeholder for the actual aggregation result structure.
                        previousValue: mockSnapshots.find(s => s.metric.equals(id) && s.date.getTime() === previousPeriod.endDate.getTime())?.cumulative_likes || 0,
                        currentValue: mockSnapshots.find(s => s.metric.equals(id) && s.date.getTime() === currentPeriod.endDate.getTime())?.cumulative_likes || 0,
                        absoluteChange: (mockSnapshots.find(s => s.metric.equals(id) && s.date.getTime() === currentPeriod.endDate.getTime())?.cumulative_likes || 0) - (mockSnapshots.find(s => s.metric.equals(id) && s.date.getTime() === previousPeriod.endDate.getTime())?.cumulative_likes || 0),
                        percentageChange: 0.5 // dummy
                    };
                });
        }

        // Default for earlier stages: return processed snapshots
        // This simulates the data as it would be *before* the final $lookup
        return [
          { _id: metricId1, previousValue: 100, currentValue: 150, absoluteChange: 50, percentageChange: 0.5 },
          { _id: metricId2, previousValue: 200, currentValue: 50, absoluteChange: -150, percentageChange: -0.75 },
          // Metric3 (no change) would have been filtered out by the $match stage for value difference
        ];
      });

      (MetricModel.find as jest.Mock).mockReturnValue({ // For contentFilters
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockMetricDetails.map(m => ({_id: m._id}))), // Return all by default
      });
    });

    it('should fetch top movers for content successfully with absoluteChange_increase', async () => {
      const result = await fetchTopMoversData({ ...baseArgs, sortBy: 'absoluteChange_increase' });

      expect(connectToDatabase).toHaveBeenCalledTimes(1);
      expect(DailyMetricSnapshotModel.aggregate).toHaveBeenCalled();
      const pipeline = (DailyMetricSnapshotModel.aggregate as jest.Mock).mock.calls[0][0];

      // Check initial $match
      const initialMatch = pipeline.find((p: any) => p.$match && p.$match.date);
      expect(initialMatch.$match.date.$in).toEqual([previousPeriod.endDate, currentPeriod.endDate]);
      expect(initialMatch.$match.cumulative_likes.$exists).toBe(true);

      // Check sorting stage
      const sortStage = pipeline.find((p: any) => p.$sort && p.$sort.absoluteChange);
      expect(sortStage.$sort.absoluteChange).toBe(-1); // -1 for increase (descending)

      // Check $limit stage
      const limitStage = pipeline.find((p: any) => p.$limit);
      expect(limitStage.$limit).toBe(baseArgs.topN);

      expect(result).toHaveLength(2); // metricId3 filtered out due to no change
      expect(result[0].entityId).toBe(metricId1.toString()); // 50 increase
      expect(result[0].entityName).toBe(mockMetricDetails.find(m=>m._id.equals(metricId1))?.description || 'Conteúdo Desconhecido');
      expect(result[0].absoluteChange).toBe(50);
      expect(result[1].entityId).toBe(metricId2.toString()); // -150 decrease
      expect(result[1].absoluteChange).toBe(-150);
    });

    it('should fetch top movers with absoluteChange_decrease sort', async () => {
      await fetchTopMoversData({ ...baseArgs, sortBy: 'absoluteChange_decrease' });
      const pipeline = (DailyMetricSnapshotModel.aggregate as jest.Mock).mock.calls[0][0];
      const sortStage = pipeline.find((p: any) => p.$sort && p.$sort.absoluteChange);
      expect(sortStage.$sort.absoluteChange).toBe(1); // 1 for decrease (ascending)
    });

    it('should calculate percentageChange correctly (handling previousValue=0)', async () => {
       // Override mock for this specific test case
      (DailyMetricSnapshotModel.aggregate as jest.Mock).mockImplementationOnce(async () => [
        { _id: metricId1, previousValue: 0, currentValue: 100, absoluteChange: 100, percentageChange: null, metricInfo: mockMetricDetails[0] }, // Previous 0
        { _id: metricId2, previousValue: 50, currentValue: 100, absoluteChange: 50, percentageChange: 1, metricInfo: mockMetricDetails[1] }, // 100% increase
      ]);

      const result = await fetchTopMoversData({ ...baseArgs, sortBy: 'percentageChange_increase' });
      expect(result[0].entityId).toBe(metricId2.toString()); // 100% increase
      expect(result[0].percentageChange).toBe(1);
      expect(result[1].entityId).toBe(metricId1.toString()); // null percentage change (prev was 0)
      expect(result[1].percentageChange).toBeNull();
    });

    it('should apply contentFilters (e.g., format)', async () => {
      const specificFormat = 'Video';
      (MetricModel.find as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: metricId1 }]), // Only metricId1 matches 'Video'
      });

      await fetchTopMoversData({ ...baseArgs, contentFilters: { format: specificFormat } });

      expect(MetricModel.find).toHaveBeenCalledWith({ format: specificFormat });
      const pipeline = (DailyMetricSnapshotModel.aggregate as jest.Mock).mock.calls[0][0];
      const initialMatch = pipeline.find((p: any) => p.$match && p.$match.metric);
      expect(initialMatch.$match.metric.$in).toEqual([metricId1]);
    });

    it('should return empty array if contentFilters yield no posts', async () => {
      (MetricModel.find as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]), // No posts match filter
      });
      const result = await fetchTopMoversData({ ...baseArgs, contentFilters: { format: 'RareFormat' } });
      expect(result).toEqual([]);
      expect(DailyMetricSnapshotModel.aggregate).not.toHaveBeenCalled(); // Aggregation shouldn't run
    });

    it('should handle no snapshots for a period (results in 0 for that period)', async () => {
      // metricId1 has current but no previous, metricId2 has previous but no current
      (DailyMetricSnapshotModel.aggregate as jest.Mock).mockImplementationOnce(async () => [
        { _id: metricId1, previousValue: 0, currentValue: 150, absoluteChange: 150, percentageChange: null, metricInfo: mockMetricDetails[0] },
        { _id: metricId2, previousValue: 200, currentValue: 0, absoluteChange: -200, percentageChange: -1, metricInfo: mockMetricDetails[1] },
      ]);

      const result = await fetchTopMoversData({ ...baseArgs, sortBy: 'absoluteChange_increase' });
      expect(result).toHaveLength(2);
      expect(result[0].entityId).toBe(metricId1.toString());
      expect(result[0].previousValue).toBe(0);
      expect(result[0].currentValue).toBe(150);
      expect(result[1].entityId).toBe(metricId2.toString());
      expect(result[1].previousValue).toBe(200);
      expect(result[1].currentValue).toBe(0);
    });

    it('should return empty array for entityType creator (as it is not implemented)', async () => {
      const result = await fetchTopMoversData({ ...baseArgs, entityType: 'creator' });
      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Creator top movers not fully implemented yet."));
    });

    it('should throw DatabaseError if DailyMetricSnapshotModel.aggregate fails', async () => {
      (DailyMetricSnapshotModel.aggregate as jest.Mock).mockRejectedValue(new Error('Snapshot Aggregation failed'));
      await expect(fetchTopMoversData(baseArgs)).rejects.toThrow('Failed to fetch top movers data: Snapshot Aggregation failed');
    });
  });
});
