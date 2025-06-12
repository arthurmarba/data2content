// Mock Mongoose Models AT THE VERY TOP
import { Types } from 'mongoose'; // Import Types for use in mock return values if needed

// UserModel Mock
const mockUserAggregate = jest.fn();
const mockUserFindLean = jest.fn();
const mockUserFindSelect = jest.fn().mockReturnThis();
const mockUserFind = jest.fn(() => ({ select: mockUserFindSelect, lean: mockUserFindLean }));
const mockUserFindOneLean = jest.fn();
const mockUserFindOne = jest.fn(() => ({ lean: mockUserFindOneLean }));
jest.mock('@/app/models/User', () => ({
  __esModule: true,
  default: {
    aggregate: mockUserAggregate,
    find: mockUserFind,
    findOne: mockUserFindOne,
  },
}));

// MetricModel Mock
const mockMetricAggregate = jest.fn();
const mockMetricFindLean = jest.fn();
const mockMetricFindSelect = jest.fn().mockReturnThis();
const mockMetricFind = jest.fn(() => ({ select: mockMetricFindSelect, lean: mockMetricFindLean }));
const mockMetricFindOneLean = jest.fn();
const mockMetricFindOne = jest.fn(() => ({ lean: mockMetricFindOneLean }));
const mockMetricDistinct = jest.fn();
jest.mock('@/app/models/Metric', () => ({
  __esModule: true,
  default: {
    aggregate: mockMetricAggregate,
    find: mockMetricFind,
    findOne: mockMetricFindOne,
    distinct: mockMetricDistinct,
  },
}));

// DailyMetricSnapshotModel Mock
const mockDailyMetricSnapshotAggregate = jest.fn();
jest.mock('@/app/models/DailyMetricSnapshot', () => ({
  __esModule: true,
  default: {
    aggregate: mockDailyMetricSnapshotAggregate,
  },
}));

// NOW import other modules
import {
  IFetchDashboardCreatorsListParams,
  IDashboardCreator,
  IDashboardOverallStats,
  FindGlobalPostsArgs,
  IGlobalPostsPaginatedResult,
  IFetchCreatorTimeSeriesArgs,
  ICreatorTimeSeriesDataPoint,
  IFetchMultipleCreatorProfilesArgs,
  ICreatorProfile,
  ISegmentPerformanceResult,
  IFetchSegmentPerformanceArgs,
  IFetchTopMoversArgs,
  ITopMoverResult,
  // Service functions will be called via namespace
} from './marketAnalysisService';
import * as marketAnalysisService from './marketAnalysisService'; // Import all as a namespace

import { connectToDatabase } from './connection';
import { logger } from '@/app/lib/logger';
// Model imports for type usage (casting) are fine, runtime usage uses the mocks
import MetricModel from '@/app/models/Metric';
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot';
import UserModel from '@/app/models/User';


// Mock logger
jest.mock('@/app/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mock database connection
jest.mock('./connection', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
}));


describe('MarketAnalysisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (connectToDatabase as jest.Mock).mockResolvedValue(undefined);

    mockUserAggregate.mockReset().mockResolvedValue([]);
    mockUserFindLean.mockReset().mockResolvedValue([]);
    (UserModel.find as jest.Mock).mockClear().mockReturnValue({ // Ensure chaining is reset
      select: mockUserFindSelect.mockClear().mockReturnThis(),
      lean: mockUserFindLean,
    });
    mockUserFindOneLean.mockReset().mockResolvedValue(null);
    (UserModel.findOne as jest.Mock).mockClear().mockReturnValue({ // Ensure chaining is reset
      lean: mockUserFindOneLean,
    });


    mockMetricAggregate.mockReset().mockResolvedValue([]);
    mockMetricDistinct.mockReset().mockResolvedValue([]);
    mockMetricFindLean.mockReset().mockResolvedValue([]);
    (MetricModel.find as jest.Mock).mockClear().mockReturnValue({ // Ensure chaining is reset
      select: mockMetricFindSelect.mockClear().mockReturnThis(),
      lean: mockMetricFindLean,
    });
    mockMetricFindOneLean.mockReset().mockResolvedValue(null);
     (MetricModel.findOne as jest.Mock).mockClear().mockReturnValue({ // Ensure chaining is reset
      lean: mockMetricFindOneLean,
    });

    mockDailyMetricSnapshotAggregate.mockReset().mockResolvedValue([]);
  });

  // ============================================================================
  // Tests for fetchDashboardCreatorsList
  // ============================================================================
  describe('fetchDashboardCreatorsList', () => {
    const defaultParams: IFetchDashboardCreatorsListParams = {
      page: 1, limit: 10, sortBy: 'totalPosts', sortOrder: 'desc', filters: {},
    };
    const mockCreators: IDashboardCreator[] = [
      { _id: new Types.ObjectId() as any, name: 'Creator A', totalPosts: 100, avgEngagementRate: 0.05, planStatus: 'Pro', lastActivityDate: new Date(), profilePictureUrl: 'url.jpg', inferredExpertiseLevel: 'Avançado' },
      { _id: new Types.ObjectId() as any, name: 'Creator B', totalPosts: 150, avgEngagementRate: 0.03, planStatus: 'Free', lastActivityDate: new Date(), profilePictureUrl: 'url.jpg', inferredExpertiseLevel: 'Iniciante' },
    ];

    it('should fetch creators with default parameters successfully', async () => {
      mockUserAggregate
        .mockImplementationOnce(async (pipeline: any[]) => {
            if (pipeline.some(stage => stage.$count === 'totalCreators')) return Promise.resolve([{ totalCreators: mockCreators.length }]);
            return Promise.resolve([]);
        })
        .mockImplementationOnce(async (pipeline: any[]) => {
            return Promise.resolve(mockCreators);
        });

      const result = await marketAnalysisService.fetchDashboardCreatorsList(defaultParams);
      expect(connectToDatabase).toHaveBeenCalledTimes(1);
      expect(UserModel.aggregate).toHaveBeenCalledTimes(2);
      expect(result.creators).toEqual(mockCreators);
      expect(result.totalCreators).toBe(mockCreators.length);
    });

    it('should apply nameSearch filter', async () => {
      mockUserAggregate.mockResolvedValueOnce([{ totalCreators: 1 }]).mockResolvedValueOnce([mockCreators[0]]);
      const params: IFetchDashboardCreatorsListParams = { ...defaultParams, filters: { nameSearch: 'Creator A' } };
      await marketAnalysisService.fetchDashboardCreatorsList(params);
      const dataPipeline = mockUserAggregate.mock.calls[1][0];
      const userMatchStage = dataPipeline.find((stage: any) => stage.$match && stage.$match.name);
      expect(userMatchStage).toBeDefined();
      expect(userMatchStage!.$match.name.$regex).toBe('Creator A');
    });

     it('should throw DatabaseError if aggregation fails', async () => {
      mockUserAggregate.mockRejectedValue(new Error('Aggregation failed'));
      await expect(marketAnalysisService.fetchDashboardCreatorsList(defaultParams)).rejects.toThrow('Falha ao buscar lista de criadores: Aggregation failed');
    });
  });

  // ============================================================================
  // Tests for fetchDashboardOverallContentStats
  // ============================================================================
  describe('fetchDashboardOverallContentStats', () => {
    const mockStatsData: IDashboardOverallStats = { // Adjusted to match new interface
      totalPlatformPosts: 1000, averagePlatformEngagementRate: 0.045, totalContentCreators: 50,
      breakdownByFormat: [{ format: 'video', count: 600 }],
      breakdownByProposal: [{ proposal: 'tutorial', count: 300 }],
      breakdownByContext: [{ context: 'education', count: 400 }],
    };
    it('should fetch overall content stats successfully', async () => {
      (MetricModel.aggregate as jest.Mock).mockResolvedValueOnce([{
        totalPlatformPosts: [{ count: mockStatsData.totalPlatformPosts }],
        averagePlatformEngagementRate: [{ avgEngagement: mockStatsData.averagePlatformEngagementRate }],
        totalContentCreators: [{ count: mockStatsData.totalContentCreators }],
        breakdownByFormat: mockStatsData.breakdownByFormat,
        breakdownByProposal: mockStatsData.breakdownByProposal,
        breakdownByContext: mockStatsData.breakdownByContext,
      }]);
      const result = await marketAnalysisService.fetchDashboardOverallContentStats({});
      expect(result).toEqual(mockStatsData);
    });
    it('should throw DatabaseError if aggregation fails', async () => {
      (MetricModel.aggregate as jest.Mock).mockRejectedValue(new Error('Stats Aggregation failed'));
      await expect(marketAnalysisService.fetchDashboardOverallContentStats({})).rejects.toThrow('Falha ao buscar estatísticas gerais de conteúdo: Stats Aggregation failed');
    });
  });

  // ============================================================================
  // Tests for findGlobalPostsByCriteria
  // ============================================================================
  describe('findGlobalPostsByCriteria', () => {
    const defaultArgs: FindGlobalPostsArgs = { page: 1, limit: 5 };
    const mockPosts: Partial<IGlobalPostResult>[] = [
      { _id: new Types.ObjectId() as any, description: 'Post A', stats: { total_interactions: 100 } },
    ];
     it('should fetch posts with default args successfully', async () => {
      (MetricModel.aggregate as jest.Mock)
        .mockResolvedValueOnce([{ totalPosts: mockPosts.length }])
        .mockResolvedValueOnce(mockPosts as any);
      const result = await marketAnalysisService.findGlobalPostsByCriteria(defaultArgs);
      expect(result.posts).toEqual(mockPosts);
    });
     it('should throw DatabaseError if aggregation fails', async () => {
      (MetricModel.aggregate as jest.Mock).mockRejectedValue(new Error('Global Post Aggregation failed'));
      await expect(marketAnalysisService.findGlobalPostsByCriteria(defaultArgs)).rejects.toThrow('Falha ao buscar posts globais: Global Post Aggregation failed');
    });
  });

  // ============================================================================
  // Tests for fetchCreatorTimeSeriesData
  // ============================================================================
  describe('fetchCreatorTimeSeriesData', () => {
    const baseArgs: IFetchCreatorTimeSeriesArgs = {
      creatorId: new Types.ObjectId().toString(),
      metric: 'post_count', period: 'monthly',
      dateRange: { startDate: new Date('2023-01-01Z'), endDate: new Date('2023-03-31Z') },
    };
     const mockTimeSeriesData: ICreatorTimeSeriesDataPoint[] = [{ date: new Date('2023-01-01Z'), value: 10 }];
    it('should fetch monthly post_count successfully', async () => {
      (MetricModel.aggregate as jest.Mock).mockResolvedValue(mockTimeSeriesData);
      const result = await marketAnalysisService.fetchCreatorTimeSeriesData(baseArgs);
      expect(result).toEqual(mockTimeSeriesData);
    });
     it('should throw DatabaseError if aggregation fails', async () => {
      (MetricModel.aggregate as jest.Mock).mockRejectedValue(new Error('TimeSeries Aggregation failed'));
      await expect(marketAnalysisService.fetchCreatorTimeSeriesData(baseArgs)).rejects.toThrow('Failed to fetch time series data: TimeSeries Aggregation failed');
    });
     it('should log the aggregation pipeline for debug', async () => {
      (MetricModel.aggregate as jest.Mock).mockResolvedValue(mockTimeSeriesData);
      await marketAnalysisService.fetchCreatorTimeSeriesData({...baseArgs, metric: 'avg_engagement_rate', period: 'weekly'});
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('[fetchCreatorTimeSeriesData] Aggregation pipeline:'));
    });
  });

  // ============================================================================
  // Tests for fetchMultipleCreatorProfiles
  // ============================================================================
  describe('fetchMultipleCreatorProfiles', () => {
     const objectId1 = new Types.ObjectId();
     const mockUsers = [{ _id: objectId1, name: 'User One', profile_picture_url: 'url1.jpg' }];
     const mockMetricsFacetResult = [{
        mainStatsPerUser: [{ _id: objectId1, postCount: 10, avgLikes: 100, avgShares: 10, avgEngagementRate: 0.1 }],
        topContextPerUser: [{ _id: objectId1, topContext: 'Tech' }],
    }];
    it('should fetch multiple creator profiles successfully', async () => {
      (UserModel.find().select().lean as jest.Mock).mockResolvedValue([mockUsers[0]]);
      (MetricModel.aggregate as jest.Mock).mockResolvedValue(mockMetricsFacetResult);
      const args = { creatorIds: [objectId1.toString()] };
      const profiles = await marketAnalysisService.fetchMultipleCreatorProfiles(args);
      expect(profiles).toHaveLength(1);
      expect(profiles[0].creatorName).toBe('User One');
    });
     it('should throw DatabaseError if UserModel.find fails', async () => {
      (UserModel.find().select().lean as jest.Mock).mockRejectedValue(new Error('User find failed'));
      const args = { creatorIds: [objectId1.toString()] };
      await expect(marketAnalysisService.fetchMultipleCreatorProfiles(args)).rejects.toThrow('Failed to fetch multiple creator profiles: User find failed');
    });
  });

  // ============================================================================
  // Tests for fetchSegmentPerformanceData
  // ============================================================================
  describe('fetchSegmentPerformanceData', () => {
    const defaultDateRange = { startDate: new Date('2023-01-01Z'), endDate: new Date('2023-01-31Z')};
    const mockFullResult: ISegmentPerformanceResult = {
      postCount: 10, avgEngagementRate: 0.05, avgLikes: 20, avgShares: 5, avgComments: 2,
    };
    it('should fetch performance data with all criteria successfully', async () => {
      (MetricModel.aggregate as jest.Mock).mockResolvedValue([mockFullResult]);
      const args = { criteria: { format: 'Video' }, dateRange: defaultDateRange };
      const result = await marketAnalysisService.fetchSegmentPerformanceData(args);
      expect(result).toEqual(mockFullResult);
    });
    it('should throw DatabaseError if MetricModel.aggregate fails', async () => {
      (MetricModel.aggregate as jest.Mock).mockRejectedValue(new Error('Segment Aggregation failed'));
      const args = { criteria: { format: 'Video' }, dateRange: defaultDateRange };
      await expect(marketAnalysisService.fetchSegmentPerformanceData(args)).rejects.toThrow('Failed to fetch segment performance data: Segment Aggregation failed');
    });
  });

  // ============================================================================
  // Tests for fetchTopMoversData (Content Focus)
  // ============================================================================
  describe('fetchTopMoversData - entityType: content', () => {
    const metricId1 = new Types.ObjectId();
    const previousPeriod = { startDate: new Date('2023-01-01Z'), endDate: new Date('2023-01-31Z') };
    const currentPeriod = { startDate: new Date('2023-02-01Z'), endDate: new Date('2023-02-28Z') };
    const baseArgs: IFetchTopMoversArgs = {
      entityType: 'content', metric: 'cumulative_likes', previousPeriod, currentPeriod, topN: 5,
    };
    const mockMetricDetails = [{ _id: metricId1, description: 'Post about Cats' }];

    it('should fetch top movers for content successfully', async () => {
      (DailyMetricSnapshotModel.aggregate as jest.Mock).mockResolvedValue([
        { _id: metricId1, previousValue: 100, currentValue: 150, absoluteChange: 50, percentageChange: 0.5, metricInfo: mockMetricDetails[0] },
      ]);
      (MetricModel.find().select().lean as jest.Mock).mockResolvedValue([{_id: metricId1}]);

      const result = await marketAnalysisService.fetchTopMoversData({ ...baseArgs, sortBy: 'absoluteChange_increase' });
      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe(metricId1.toString());
    });
    it('should throw DatabaseError if DailyMetricSnapshotModel.aggregate fails', async () => {
      (DailyMetricSnapshotModel.aggregate as jest.Mock).mockRejectedValue(new Error('Snapshot Aggregation failed'));
      await expect(marketAnalysisService.fetchTopMoversData(baseArgs)).rejects.toThrow('Failed to fetch top movers data: Snapshot Aggregation failed');
    });
  });
});
