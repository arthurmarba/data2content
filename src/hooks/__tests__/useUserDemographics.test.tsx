import { renderHook, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import useUserDemographics from '../useUserDemographics';

describe('useUserDemographics', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  it('fetches data when userId is provided', async () => {
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ follower_demographics: { gender: { f: 5 }, city: {}, age: {}, country: {} } })
    });

    const { result } = renderHook(() => useUserDemographics('123'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.follower_demographics.gender.f).toBe(5);
  });

  it('returns default state when userId is null', async () => {
    const { result } = renderHook(() => useUserDemographics(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
  });
});
