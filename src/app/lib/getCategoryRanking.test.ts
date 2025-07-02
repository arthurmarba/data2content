import { functionExecutors } from './aiFunctions';
import { fetchTopCategories } from './dataService';
import { Types } from 'mongoose';

jest.mock('./logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

jest.mock('./dataService', () => ({
  ...jest.requireActual('./dataService'),
  fetchTopCategories: jest.fn()
}));

describe('getCategoryRanking', () => {
  const user = { _id: new Types.ObjectId(), name: 'Tester' } as any;
  const mockedFetch = fetchTopCategories as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetch.mockResolvedValue([
      { category: 'FORMATO1', value: 10 },
      { category: 'FORMATO2', value: 5 }
    ]);
  });

  it('uses full history when periodDays is 0', async () => {
    const args = { category: 'format', metric: 'shares', periodDays: 0, limit: 5 };
    const result = await functionExecutors.getCategoryRanking(args, user) as any;

    const call = mockedFetch.mock.calls[0][0];
    expect(call.userId).toBe(user._id.toString());
    expect(call.dateRange.startDate.getTime()).toBe(0);
    expect(result.summary).toContain('todo o período disponível');
  });
});
