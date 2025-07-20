import { Types } from 'mongoose';
import { buildInspirationFilters } from '../process-response/dailyTipHandler';
import * as dataService from '@/app/lib/dataService';
import { IUser } from '@/app/models/User';

type PostObject = {
  format?: string;
  proposal?: string;
  context?: string;
  postDate?: Date;
};

jest.mock('@/app/lib/dataService', () => ({
  getRecentPostObjectsWithAggregatedMetrics: jest.fn()
}));

const mockGetPosts = dataService.getRecentPostObjectsWithAggregatedMetrics as jest.Mock;

describe('buildInspirationFilters', () => {
  const user: IUser = {
    _id: new Types.ObjectId(),
    email: 'test@example.com',
    role: 'user',
    userPreferences: {
      preferredFormats: ['Reel'],
      preferredAiTone: 'inspirational',
      dislikedTopics: ['Tecnologia']
    }
  } as IUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses user preferences when posts are missing', async () => {
    mockGetPosts.mockResolvedValue([]);
    const result = await buildInspirationFilters(user, undefined, true);
    expect(result.format).toBe('Reel');
    expect(result.tone).toBe('inspirational');
    expect(result.context).toBe('Tecnologia');
  });

  it('prefers last post values over preferences', async () => {
    const posts: PostObject[] = [
      { format: 'Foto', proposal: 'Dicas', context: 'Moda', postDate: new Date() }
    ];
    mockGetPosts.mockResolvedValue(posts);
    const result = await buildInspirationFilters(user, undefined, true);
    expect(result.format).toBe('Foto');
    expect(result.proposal).toBe('Dicas');
    expect(result.context).toBe('Moda');
  });
});
