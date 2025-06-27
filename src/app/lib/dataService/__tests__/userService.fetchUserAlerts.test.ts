import { Types } from 'mongoose';
import { fetchUserAlerts } from '../userService';
import User from '@/app/models/User';
import { connectToDatabase } from '../connection';

jest.mock('@/app/models/User', () => ({
  findById: jest.fn(),
}));

jest.mock('../connection');

const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = User.findById as jest.Mock;

describe('fetchUserAlerts - dataService', () => {
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

    mockFindById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ _id: validUserId, alertHistory: alerts }),
    });

    const { alerts: result } = await fetchUserAlerts(validUserId);

    expect(mockConnect).toHaveBeenCalled();
    expect(result.map(a => a.type)).toEqual(['A', 'C', 'B']);
  });

  test('respects limit option', async () => {
    const alerts = [
      { type: 'A', date: new Date('2024-03-01'), messageForAI: '', finalUserMessage: '', details: {} },
      { type: 'B', date: new Date('2024-02-01'), messageForAI: '', finalUserMessage: '', details: {} },
      { type: 'C', date: new Date('2024-01-01'), messageForAI: '', finalUserMessage: '', details: {} },
    ];

    mockFindById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ _id: validUserId, alertHistory: alerts }),
    });

    const { alerts: result } = await fetchUserAlerts(validUserId, { limit: 2 });

    expect(result).toHaveLength(2);
    expect(result.map(a => a.type)).toEqual(['A', 'B']);
  });

  test('filters by alert types', async () => {
    const alerts = [
      { type: 'A', date: new Date('2024-03-01'), messageForAI: '', finalUserMessage: '', details: {} },
      { type: 'B', date: new Date('2024-02-01'), messageForAI: '', finalUserMessage: '', details: {} },
      { type: 'A', date: new Date('2024-01-01'), messageForAI: '', finalUserMessage: '', details: {} },
    ];

    mockFindById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ _id: validUserId, alertHistory: alerts }),
    });

    const { alerts: result } = await fetchUserAlerts(validUserId, { types: ['A'] });

    expect(result).toHaveLength(2);
    expect(result.every(a => a.type === 'A')).toBe(true);
  });
});
