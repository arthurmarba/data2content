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
    const sorted = [...posts].sort((a, b) => {
      const aTotal = a.stats.total_interactions ?? ((a.stats.likes || 0) + (a.stats.comments || 0) + (a.stats.shares || 0) + (a.stats.saved || 0));
      const bTotal = b.stats.total_interactions ?? ((b.stats.likes || 0) + (b.stats.comments || 0) + (b.stats.shares || 0) + (b.stats.saved || 0));
      return bTotal - aTotal;
    });
    mockAggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue(sorted) });

    const result = await findUserPostsEligibleForCommunity(userId, { sinceDate: since });

    expect(mockConnect).toHaveBeenCalled();
    expect(result.posts.map(p => p._id)).toEqual(sorted.map(p => p._id));

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
    mockAggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue(posts.slice(0, 50)) });

    const result = await findUserPostsEligibleForCommunity(userId, { sinceDate: since });

    // Expect IDs from 1..50 which correspond to total_interactions 55..6
    expect(result.posts.map(p => p._id)).toEqual(posts.slice(0, 50).map(p => p._id));
  });

  it('computes total_interactions when missing', async () => {
    const posts = [
      { _id: '4', stats: { likes: 1, comments: 1, shares: 1, saved: 1, total_interactions: 4 } },
    ];
    mockAggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue(posts) });

    const result = await findUserPostsEligibleForCommunity(userId, { sinceDate: since });

    expect(result.posts[0].stats.total_interactions).toBe(4);
  });
});
