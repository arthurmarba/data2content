import { fetchDashboardCreatorsList } from './dashboardService';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '../connection';
import { logger } from '@/app/lib/logger';
import { IDashboardCreator, IFetchDashboardCreatorsListParams } from './types'; // Assuming types are correctly pathed
import { Types } from 'mongoose';
import { DatabaseError } from '@/app/lib/errors';

// Mock dependencies
jest.mock('@/app/models/User');
jest.mock('../connection');
jest.mock('@/app/lib/logger');

describe('dashboardService', () => {
  describe('fetchDashboardCreatorsList', () => {
    const mockUserId1 = new Types.ObjectId();
    const mockUserId2 = new Types.ObjectId();

    const mockRawCreators = [
      {
        _id: mockUserId1,
        name: 'Creator One',
        planStatus: 'Pro',
        inferredExpertiseLevel: 'Avançado',
        profilePictureUrl: 'http://example.com/pic1.jpg',
        followers_count: 15000,
        alertHistory: [
          { type: 'PeakShares', date: new Date('2023-10-01T10:00:00Z'), finalUserMessage: 'High shares!' },
          { type: 'DropWatchTime', date: new Date('2023-10-03T10:00:00Z'), finalUserMessage: 'Watch time dropped.' },
          { type: 'ForgottenFormat', date: new Date('2023-09-20T10:00:00Z'), finalUserMessage: 'Try new formats.' },
          { type: 'LowActivity', date: new Date('2023-10-02T10:00:00Z'), finalUserMessage: 'Activity is low.' },
        ],
        // fields that would be added by $lookup and $addFields in the real aggregation:
        totalPosts: 50,
        lastActivityDate: new Date('2023-10-03T10:00:00Z'),
        avgEngagementRate: 0.05
      },
      {
        _id: mockUserId2,
        name: 'Creator Two',
        planStatus: 'Free',
        inferredExpertiseLevel: 'Iniciante',
        profilePictureUrl: 'http://example.com/pic2.jpg',
        followers_count: 2000,
        alertHistory: [
          { type: 'PeakShares', date: new Date('2023-10-05T10:00:00Z'), message: 'Another share peak.' },
        ],
        totalPosts: 10,
        lastActivityDate: new Date('2023-10-05T10:00:00Z'),
        avgEngagementRate: 0.02
      },
      { // Creator with no alert history
        _id: new Types.ObjectId(),
        name: 'Creator Three',
        followers_count: 500,
        alertHistory: [],
        totalPosts: 5,
        lastActivityDate: new Date('2023-09-01T10:00:00Z'),
        avgEngagementRate: 0.01
      }
    ];

    beforeEach(() => {
      jest.clearAllMocks();
      (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
      // Mock the two aggregate calls: one for count, one for data
      (UserModel.aggregate as jest.Mock)
        .mockResolvedValueOnce([{ totalCreators: mockRawCreators.length }]) // For countPipeline
        .mockResolvedValueOnce(mockRawCreators); // For data pipeline
    });

    const defaultParams: IFetchDashboardCreatorsListParams = {
      page: 1,
      limit: 10,
      sortBy: 'totalPosts',
      sortOrder: 'desc',
      filters: {},
    };

    test('should return creators with followers_count and processed recentAlertsSummary', async () => {
      const { creators, totalCreators } = await fetchDashboardCreatorsList(defaultParams);

      expect(connectToDatabase).toHaveBeenCalledTimes(1);
      expect(UserModel.aggregate).toHaveBeenCalledTimes(2); // Once for count, once for data
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Iniciando busca de criadores para dashboard'));

      expect(totalCreators).toBe(mockRawCreators.length);
      expect(creators.length).toBe(mockRawCreators.length);

      // Check Creator One
      const creatorOne = creators.find(c => c.name === 'Creator One');
      expect(creatorOne).toBeDefined();
      expect(creatorOne?.followers_count).toBe(15000);
      expect(creatorOne?.recentAlertsSummary).toBeDefined();
      expect(creatorOne?.recentAlertsSummary?.count).toBe(4);
      expect(creatorOne?.recentAlertsSummary?.alerts.length).toBe(3); // Max 3 alerts
      // Alerts should be sorted by date descending
      expect(creatorOne?.recentAlertsSummary?.alerts[0]!.type).toBe('DropWatchTime'); // Most recent (Oct 3)
      expect(creatorOne?.recentAlertsSummary?.alerts[0]!.message).toBe('Watch time dropped.');
      expect(creatorOne?.recentAlertsSummary?.alerts[1]!.type).toBe('LowActivity');     // Next recent (Oct 2)
      expect(creatorOne?.recentAlertsSummary?.alerts[2]!.type).toBe('PeakShares');      // Next recent (Oct 1)

      // Check Creator Two
      const creatorTwo = creators.find(c => c.name === 'Creator Two');
      expect(creatorTwo).toBeDefined();
      expect(creatorTwo?.followers_count).toBe(2000);
      expect(creatorTwo?.recentAlertsSummary).toBeDefined();
      expect(creatorTwo?.recentAlertsSummary?.count).toBe(1);
      expect(creatorTwo?.recentAlertsSummary?.alerts.length).toBe(1);
      expect(creatorTwo?.recentAlertsSummary?.alerts[0]!.type).toBe('PeakShares');
      expect(creatorTwo?.recentAlertsSummary?.alerts[0]!.message).toBe('Another share peak.');


      // Check Creator Three (no alerts)
      const creatorThree = creators.find(c => c.name === 'Creator Three');
      expect(creatorThree).toBeDefined();
      expect(creatorThree?.followers_count).toBe(500);
      expect(creatorThree?.recentAlertsSummary).toBeDefined();
      expect(creatorThree?.recentAlertsSummary?.count).toBe(0);
      expect(creatorThree?.recentAlertsSummary?.alerts.length).toBe(0);

    });

    test('should handle missing alertHistory or undefined message field gracefully', async () => {
      (UserModel.aggregate as jest.Mock).mockReset();
      const modifiedMockCreators = [
        {
          ...mockRawCreators[0],
          alertHistory: [
            { type: 'TestType', date: new Date('2023-10-01T10:00:00Z') }, // No finalUserMessage or message
          ],
        },
        {
          ...mockRawCreators[1],
          alertHistory: null, // Null alertHistory
        }
      ];
      (UserModel.aggregate as jest.Mock)
        .mockResolvedValueOnce([{ totalCreators: modifiedMockCreators.length }])
        .mockResolvedValueOnce(modifiedMockCreators);

      const { creators } = await fetchDashboardCreatorsList(defaultParams);

      expect(creators[0].recentAlertsSummary?.alerts[0].message).toBeUndefined();
      expect(creators[1].recentAlertsSummary?.count).toBe(0);
      expect(creators[1].recentAlertsSummary?.alerts.length).toBe(0);
    });

    test('should throw DatabaseError if UserModel.aggregate fails for count', async () => {
      (UserModel.aggregate as jest.Mock).mockReset();
      (UserModel.aggregate as jest.Mock).mockRejectedValueOnce(new Error('Aggregate count failed'));
      await expect(fetchDashboardCreatorsList(defaultParams)).rejects.toThrow(DatabaseError);
    });

    test('should throw DatabaseError if UserModel.aggregate fails for data', async () => {
      (UserModel.aggregate as jest.Mock).mockReset();
      (UserModel.aggregate as jest.Mock)
        .mockResolvedValueOnce([{ totalCreators: 1 }]) // Count succeeds
        .mockRejectedValueOnce(new Error('Aggregate data failed')); // Data fails
      await expect(fetchDashboardCreatorsList(defaultParams)).rejects.toThrow(DatabaseError);
    });

  });
});
