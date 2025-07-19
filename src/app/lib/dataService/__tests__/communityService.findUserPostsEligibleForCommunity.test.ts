import { Types } from 'mongoose';
import { findUserPostsEligibleForCommunity } from '../communityService';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '../connection';

jest.mock('@/app/models/Metric', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../connection');

const mockConnect = connectToDatabase as jest.Mock;
const mockAggregate = MetricModel.aggregate as jest.Mock;

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
    mockAggregate.mockResolvedValue(posts);

    const result = await findUserPostsEligibleForCommunity(userId, { sinceDate: since });

    expect(mockConnect).toHaveBeenCalled();
    expect(result.posts.map(p => p._id)).toEqual(['1', '3', '2']);

    const pipeline = mockAggregate.mock.calls[0][0];
    const sortIndex = pipeline.findIndex((s: any) => Boolean(s.$sort));
    const limitIndex = pipeline.findIndex((s: any) => Boolean(s.$limit));
    expect(sortIndex).toBeGreaterThan(-1);
    expect(limitIndex).toBeGreaterThan(sortIndex);
  });

  it('limits to the top 50 posts after sorting', async () => {
    const posts = Array.from({ length: 55 }).map((_, i) => ({
      _id: `${i + 1}`,
      stats: { total_interactions: 55 - i }
    }));
    mockAggregate.mockResolvedValue(posts.slice(0, 50));

    const result = await findUserPostsEligibleForCommunity(userId, { sinceDate: since });

    // Expect IDs from 1..50 which correspond to total_interactions 55..6
    expect(result.posts.map(p => p._id)).toEqual(posts.slice(0, 50).map(p => p._id));
  });

  it('computes total_interactions when missing', async () => {
    const posts = [
      { _id: '4', stats: { likes: 1, comments: 1, shares: 1, saved: 1 } },
    ];
    mockAggregate.mockResolvedValue(posts);

    const result = await findUserPostsEligibleForCommunity(userId, { sinceDate: since });

    expect(result.posts[0].stats.total_interactions).toBe(4);
  });
});
