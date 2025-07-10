import { renderHook, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import usePlatformDemographics from '../usePlatformDemographics';

describe('usePlatformDemographics', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  it('fetches data and caches it', async () => {
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ follower_demographics: { country: { BR: 1 }, city: {}, age: {}, gender: {} } })
    });

    const { result } = renderHook(() => usePlatformDemographics());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.follower_demographics.country.BR).toBe(1);
    const cached = JSON.parse(localStorage.getItem('platform_demographics_cache') || '{}');
    expect(cached.data.follower_demographics.country.BR).toBe(1);
  });

  it('uses cached data', async () => {
    const data = { follower_demographics: { country: { US: 2 }, city: {}, age: {}, gender: {} } };
    localStorage.setItem('platform_demographics_cache', JSON.stringify({ timestamp: Date.now(), data }));
    const fetchMock = jest.fn();
    (global.fetch as jest.Mock) = fetchMock;

    const { result } = renderHook(() => usePlatformDemographics());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.data?.follower_demographics.country.US).toBe(2);
  });
});
