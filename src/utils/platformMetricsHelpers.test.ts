import { Types } from 'mongoose';
import { getPlatformMinMaxValues } from './platformMetricsHelpers';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import AccountInsightModel from '@/app/models/AccountInsight';
import calculateAverageEngagementPerPost from './calculateAverageEngagementPerPost';
import calculateFollowerGrowthRate from './calculateFollowerGrowthRate';
import calculateWeeklyPostingFrequency from './calculateWeeklyPostingFrequency';
import calculateAverageVideoMetrics from './calculateAverageVideoMetrics';

jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/app/models/User', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

jest.mock('@/app/models/AccountInsight', () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));

jest.mock('./calculateAverageEngagementPerPost');
jest.mock('./calculateFollowerGrowthRate');
jest.mock('./calculateWeeklyPostingFrequency');
jest.mock('./calculateAverageVideoMetrics');

const mockConnect = connectToDatabase as jest.Mock;
const mockUserFind = UserModel.find as jest.Mock;
const mockAccountFindOne = AccountInsightModel.findOne as jest.Mock;
const mockAvgEng = calculateAverageEngagementPerPost as jest.Mock;
const mockGrowth = calculateFollowerGrowthRate as jest.Mock;
const mockWeekly = calculateWeeklyPostingFrequency as jest.Mock;
const mockVideo = calculateAverageVideoMetrics as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
});

describe('getPlatformMinMaxValues', () => {
  it('calculates min and max follower counts', async () => {
    const id1 = new Types.ObjectId();
    const id2 = new Types.ObjectId();

    mockUserFind.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: id1 }, { _id: id2 }]),
    });

    const leanFn = jest.fn()
      .mockResolvedValueOnce({ followersCount: 100 })
      .mockResolvedValueOnce({ followersCount: 300 });
    mockAccountFindOne.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: leanFn,
    });

    const res = await getPlatformMinMaxValues(['totalFollowers']);
    expect(res.totalFollowers.min).toBe(100);
    expect(res.totalFollowers.max).toBe(300);
    expect(connectToDatabase).toHaveBeenCalled();
    expect(UserModel.find).toHaveBeenCalled();
    expect(AccountInsightModel.findOne).toHaveBeenCalledTimes(2);
  });

  it('returns fallback for unknown metric', async () => {
    mockUserFind.mockReturnValue({ select: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) });
    const res = await getPlatformMinMaxValues(['nonexistentMetric']);
    expect(res.nonexistentMetric).toEqual({ min: 0, max: 100 });
  });

  it('uses calculation helpers for complex metrics', async () => {
    const id1 = new Types.ObjectId();
    const id2 = new Types.ObjectId();

    mockUserFind.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: id1 }, { _id: id2 }]),
    });

    mockAvgEng.mockResolvedValueOnce({ averageEngagementPerPost: 10 })
      .mockResolvedValueOnce({ averageEngagementPerPost: 20 });
    mockGrowth.mockResolvedValueOnce({ percentageGrowth: -0.1 })
      .mockResolvedValueOnce({ percentageGrowth: 0.5 });
    mockWeekly.mockResolvedValueOnce({ currentWeeklyFrequency: 2 })
      .mockResolvedValueOnce({ currentWeeklyFrequency: 5 });
    mockVideo.mockResolvedValueOnce({ averageRetentionRate: 30 })
      .mockResolvedValueOnce({ averageRetentionRate: 60 });

    const res = await getPlatformMinMaxValues([
      'avgEngagementPerPost30d',
      'followerGrowthRatePercent30d',
      'avgWeeklyPostingFrequency30d',
      'avgVideoRetentionRate90d',
    ]);

    expect(mockAvgEng).toHaveBeenCalledTimes(2);
    expect(res.avgEngagementPerPost30d).toEqual({ min: 10, max: 20 });

    expect(mockGrowth).toHaveBeenCalledTimes(2);
    expect(res.followerGrowthRatePercent30d).toEqual({ min: -0.1, max: 0.5 });

    expect(mockWeekly).toHaveBeenCalledTimes(2);
    expect(res.avgWeeklyPostingFrequency30d).toEqual({ min: 2, max: 5 });

    expect(mockVideo).toHaveBeenCalledTimes(2);
    expect(res.avgVideoRetentionRate90d).toEqual({ min: 30, max: 60 });
  });
});
