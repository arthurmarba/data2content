import axios from 'axios';
import { fetchFollowerDemographics } from './instagramInsightsService';

jest.mock('axios');
const mockedGet = axios.get as jest.Mock;

describe('fetchFollowerDemographics', () => {
  const igUserId = '123';
  const token = 'token';

  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('aggregates breakdown responses', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [{ name: 'age', values: [] }] } });
    mockedGet.mockResolvedValueOnce({ data: { data: [{ name: 'gender', values: [] }] } });
    mockedGet.mockResolvedValueOnce({ data: { data: [{ name: 'country', values: [] }] } });
    mockedGet.mockResolvedValueOnce({ data: { data: [{ name: 'city', values: [] }] } });
    const res = await fetchFollowerDemographics(igUserId, token);
    expect(Object.keys(res.follower_demographics)).toEqual(['age', 'gender', 'country', 'city']);
    expect(mockedGet).toHaveBeenCalledTimes(4);
  });

  it('handles 429 with retry', async () => {
    mockedGet.mockRejectedValueOnce({ response: { status: 429, data: { error: { message: 'rate limit' } } } });
    mockedGet.mockResolvedValueOnce({ data: { data: [] } });
    mockedGet.mockResolvedValue({ data: { data: [] } });
    const res = await fetchFollowerDemographics(igUserId, token);
    expect(res.follower_demographics.age).toEqual([]);
    expect(mockedGet).toHaveBeenCalled();
  });
});
