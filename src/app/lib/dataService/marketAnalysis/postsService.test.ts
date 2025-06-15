import { Types } from 'mongoose';
import { fetchPostDetails, IPostDetailsData } from './postsService'; // Assuming interfaces are exported or defined here
import MetricModel from '@/app/models/Metric';
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot';
import { connectToDatabase } from '../connection';
import { logger } from '@/app/lib/logger';
import { DatabaseError } from '@/app/lib/errors';

// Mock dependencies
jest.mock('@/app/models/Metric');
jest.mock('@/app/models/DailyMetricSnapshot');
jest.mock('../connection');
jest.mock('@/app/lib/logger');

describe('postsService', () => {
  describe('fetchPostDetails', () => {
    const mockPostId = new Types.ObjectId().toString();
    const mockMetricData = {
      _id: new Types.ObjectId(mockPostId),
      postLink: 'https://example.com/post/1',
      description: 'Test post description',
      postDate: new Date('2023-01-15T10:00:00Z'),
      type: 'IMAGE',
      format: 'Tutorial',
      proposal: 'Educativo',
      context: 'Tecnologia',
      stats: {
        views: 1000,
        likes: 100,
        comments: 10,
        shares: 5,
        reach: 800,
        engagement_rate_on_reach: 0.125,
        total_interactions: 115,
      },
      // other IMetric fields...
    };

    const mockSnapshotsData: IDailyMetricSnapshot[] = [
      { _id: new Types.ObjectId(), metric: new Types.ObjectId(mockPostId), date: new Date('2023-01-15T00:00:00Z'), dayNumber: 1, dailyViews: 500, dailyLikes: 50, dailyComments: 5, dailyShares: 2, cumulativeViews: 500, cumulativeLikes: 50 } as IDailyMetricSnapshot,
      { _id: new Types.ObjectId(), metric: new Types.ObjectId(mockPostId), date: new Date('2023-01-16T00:00:00Z'), dayNumber: 2, dailyViews: 500, dailyLikes: 50, dailyComments: 5, dailyShares: 3, cumulativeViews: 1000, cumulativeLikes: 100 } as IDailyMetricSnapshot,
    ];

    beforeEach(() => {
      jest.clearAllMocks();
      (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
      (MetricModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockMetricData),
      } as any);
      (DailyMetricSnapshotModel.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockSnapshotsData),
      } as any);
    });

    test('should fetch post details and its daily snapshots successfully', async () => {
      const result = await fetchPostDetails({ postId: mockPostId });

      expect(connectToDatabase).toHaveBeenCalledTimes(1);
      expect(MetricModel.findById).toHaveBeenCalledWith(new Types.ObjectId(mockPostId));
      expect(DailyMetricSnapshotModel.find).toHaveBeenCalledWith({ metric: new Types.ObjectId(mockPostId) });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Fetching details for post ID: ${mockPostId}`));

      expect(result).not.toBeNull();
      expect(result?._id.toString()).toEqual(mockPostId);
      expect(result?.description).toEqual(mockMetricData.description);
      expect(result?.stats?.views).toEqual(mockMetricData.stats.views);
      expect(result?.dailySnapshots).toEqual(mockSnapshotsData);
      expect(result?.dailySnapshots.length).toBe(2);
    });

    test('should return null if postId is invalid', async () => {
      const invalidPostId = 'invalid-id';
      const result = await fetchPostDetails({ postId: invalidPostId });
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`Invalid postId format: ${invalidPostId}`));
      expect(result).toBeNull();
      expect(MetricModel.findById).not.toHaveBeenCalled();
    });

    test('should return null if post is not found', async () => {
      (MetricModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      } as any);

      const result = await fetchPostDetails({ postId: mockPostId });

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`Post not found with ID: ${mockPostId}`));
      expect(result).toBeNull();
    });

    test('should throw DatabaseError if MetricModel.findById fails', async () => {
      const error = new Error('MetricModel.findById failed');
      (MetricModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockRejectedValue(error),
      } as any);

      await expect(fetchPostDetails({ postId: mockPostId })).rejects.toThrow(DatabaseError);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Error fetching post details for ID ${mockPostId}`), error);
    });

    test('should throw DatabaseError if DailyMetricSnapshotModel.find fails', async () => {
      const error = new Error('DailyMetricSnapshotModel.find failed');
      (DailyMetricSnapshotModel.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(error),
      } as any);

      await expect(fetchPostDetails({ postId: mockPostId })).rejects.toThrow(DatabaseError);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Error fetching post details for ID ${mockPostId}`), error);
    });
  });
});
