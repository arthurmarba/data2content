import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TimePerformanceHeatmap from '../TimePerformanceHeatmap';
import { useGlobalTimePeriod } from '../filters/GlobalTimePeriodContext';

jest.mock('../filters/GlobalTimePeriodContext', () => ({
  useGlobalTimePeriod: jest.fn(),
}));

jest.mock('../TimeSlotTopPostsModal', () => () => null);

const mockUseGlobalTimePeriod = useGlobalTimePeriod as jest.Mock;

describe('TimePerformanceHeatmap', () => {
  beforeEach(() => {
    mockUseGlobalTimePeriod.mockReturnValue({ timePeriod: 'last_30_days' });
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ buckets: [], bestSlots: [], worstSlots: [] }),
    });
  });

  it('fetches data for given user', async () => {
    render(<TimePerformanceHeatmap userId="u1" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/api/v1/users/u1/performance/time-distribution');
  });

  it('uses platform endpoint when no userId is provided', async () => {
    render(<TimePerformanceHeatmap />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/api/v1/platform/performance/time-distribution');
  });

  it('refetches when userId changes', async () => {
    const { rerender } = render(<TimePerformanceHeatmap userId="u1" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/api/v1/users/u1/performance/time-distribution');

    rerender(<TimePerformanceHeatmap userId="u2" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('/api/v1/users/u2/performance/time-distribution');
  });
});
