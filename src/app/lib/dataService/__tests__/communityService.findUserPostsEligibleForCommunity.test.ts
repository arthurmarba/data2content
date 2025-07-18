import { Types } from 'mongoose';
import { findUserPostsEligibleForCommunity } from '../communityService';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '../connection';

jest.mock('@/app/models/Metric', () => ({
  find: jest.fn(),
}));

jest.mock('../connection');

const mockConnect = connectToDatabase as jest.Mock;
const mockFind = MetricModel.find as jest.Mock;

describe('findUserPostsEligibleForCommunity', () => {
  const userId = new Types.ObjectId().toString();
  const since = new Date('2024-01-01');

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it('sorts posts by total interactions desc', async () => {
    const posts = [
      { _id: '1', stats: { total_interactions: 10 } },
      { _id: '2', stats: { likes: 3, comments: 1, shares: 1, saved: 0 } },
      { _id: '3', stats: { total_interactions: 7 } },
    ];
    const lean = jest.fn().mockResolvedValue(posts);
    const limit = jest.fn().mockReturnValue({ lean });
    mockFind.mockReturnValue({ limit });

    const result = await findUserPostsEligibleForCommunity(userId, { sinceDate: since });

    expect(mockConnect).toHaveBeenCalled();
    expect(result.map(p => p._id)).toEqual(['1', '3', '2']);
  });

  it('computes total_interactions when missing', async () => {
    const posts = [
      { _id: '4', stats: { likes: 1, comments: 1, shares: 1, saved: 1 } },
    ];
    const lean = jest.fn().mockResolvedValue(posts);
    const limit = jest.fn().mockReturnValue({ lean });
    mockFind.mockReturnValue({ limit });

    const result = await findUserPostsEligibleForCommunity(userId, { sinceDate: since });

    expect(result[0].stats.total_interactions).toBe(4);
  });
});
