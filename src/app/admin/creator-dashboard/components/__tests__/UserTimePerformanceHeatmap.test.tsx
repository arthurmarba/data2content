import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserTimePerformanceHeatmap from '../UserTimePerformanceHeatmap';
import { useGlobalTimePeriod } from '../filters/GlobalTimePeriodContext';

jest.mock('../filters/GlobalTimePeriodContext', () => ({
  useGlobalTimePeriod: jest.fn(),
}));

jest.mock('../TimeSlotTopPostsModal', () => () => null);

const mockUseGlobalTimePeriod = useGlobalTimePeriod as jest.Mock;

describe('UserTimePerformanceHeatmap', () => {
  beforeEach(() => {
    mockUseGlobalTimePeriod.mockReturnValue({ timePeriod: 'last_30_days' });
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ buckets: [], bestSlots: [], worstSlots: [] }),
    });
  });

  it('fetches data for given user', async () => {
    render(<UserTimePerformanceHeatmap userId="u1" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/api/v1/users/u1/performance/time-distribution');
  });

  it('refetches when userId changes', async () => {
    const { rerender } = render(<UserTimePerformanceHeatmap userId="u1" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/api/v1/users/u1/performance/time-distribution');

    rerender(<UserTimePerformanceHeatmap userId="u2" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('/api/v1/users/u2/performance/time-distribution');
  });
});
