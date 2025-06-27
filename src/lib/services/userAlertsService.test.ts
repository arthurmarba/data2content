import { Types } from 'mongoose';
import { fetchUserAlerts } from './userAlertsService';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/dataService/connection';

jest.mock('@/app/models/User', () => ({
  findById: jest.fn(),
}));

jest.mock('@/app/lib/dataService/connection');

const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = UserModel.findById as jest.Mock;

describe('fetchUserAlerts', () => {
  const validUserId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  test('returns alerts sorted by date', async () => {
    const alerts = [
      { type: 'B', date: new Date('2024-01-01'), messageForAI: '', finalUserMessage: '', details: {} },
      { type: 'A', date: new Date('2024-03-01'), messageForAI: '', finalUserMessage: '', details: {} },
      { type: 'C', date: new Date('2024-02-01'), messageForAI: '', finalUserMessage: '', details: {} },
    ];
    mockFindById.mockReturnValue({ lean: () => Promise.resolve({ _id: validUserId, alertHistory: alerts }) });

    const result = await fetchUserAlerts(validUserId);

    expect(mockConnect).toHaveBeenCalled();
    expect(result.map(a => a.type)).toEqual(['A', 'C', 'B']);
  });

  test('applies limit and types filters', async () => {
    const alerts = [
      { type: 'A', date: new Date('2024-03-01'), messageForAI: '', finalUserMessage: '', details: {} },
      { type: 'B', date: new Date('2024-02-01'), messageForAI: '', finalUserMessage: '', details: {} },
      { type: 'A', date: new Date('2024-01-01'), messageForAI: '', finalUserMessage: '', details: {} },
    ];
    mockFindById.mockReturnValue({ lean: () => Promise.resolve({ _id: validUserId, alertHistory: alerts }) });

    const result = await fetchUserAlerts(validUserId, { limit: 1, types: ['A'] });

    expect(result.length).toBe(1);
    expect(result[0].type).toBe('A');
    // Should be the most recent type A
    expect(result[0].date.toISOString()).toBe(alerts[0].date.toISOString());
  });

  test('throws on invalid userId', async () => {
    await expect(fetchUserAlerts('invalid-id')).rejects.toThrow('Invalid userId');
  });
});
