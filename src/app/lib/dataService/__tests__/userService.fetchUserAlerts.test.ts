import { Types } from 'mongoose';
import { fetchUserAlerts } from '../userService';
import User from '@/app/models/User';
import { connectToDatabase } from '../connection';

jest.mock('@/app/models/User', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../connection');

const mockConnect = connectToDatabase as jest.Mock;
const mockAggregate = User.aggregate as jest.Mock;

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

    mockAggregate.mockResolvedValue([{ alerts, totalCount: [{ count: alerts.length }] }]);

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

    mockAggregate.mockResolvedValue([{ alerts, totalCount: [{ count: alerts.length }] }]);

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

    mockAggregate.mockResolvedValue([{ alerts, totalCount: [{ count: alerts.length }] }]);

    const { alerts: result } = await fetchUserAlerts(validUserId, { types: ['A'] });

    expect(result).toHaveLength(2);
    expect(result.every(a => a.type === 'A')).toBe(true);
  });

  test('deduplicates no_event_found_today_with_insight when option enabled', async () => {
    const alerts = [
      { type: 'no_event_found_today_with_insight', date: new Date('2024-04-01T10:00:00Z'), messageForAI: '', finalUserMessage: '', details: {} },
      { type: 'no_event_found_today_with_insight', date: new Date('2024-04-01T09:00:00Z'), messageForAI: '', finalUserMessage: '', details: {} },
      { type: 'A', date: new Date('2024-04-01T08:00:00Z'), messageForAI: '', finalUserMessage: '', details: {} },
    ];

    const deduped = [
      alerts[0],
      alerts[2],
    ];

    mockAggregate.mockResolvedValue([{ alerts: deduped, totalCount: [{ count: deduped.length }] }]);

    const { alerts: result } = await fetchUserAlerts(validUserId, { dedupeNoEventAlerts: true });

    expect(mockConnect).toHaveBeenCalled();
    const pipeline = mockAggregate.mock.calls[0][0];
    const hasGroupStage = pipeline.some((stage: any) => stage.$group && stage.$group._id === '$dedupeKey');
    expect(hasGroupStage).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('no_event_found_today_with_insight');
    expect(result[1].type).toBe('A');
  });
});
