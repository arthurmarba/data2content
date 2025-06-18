import { Types } from 'mongoose';
import { getPlatformMinMaxValues } from './platformMetricsHelpers';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import AccountInsightModel from '@/app/models/AccountInsight';

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

const mockConnect = connectToDatabase as jest.Mock;
const mockUserFind = UserModel.find as jest.Mock;
const mockAccountFindOne = AccountInsightModel.findOne as jest.Mock;

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
});
