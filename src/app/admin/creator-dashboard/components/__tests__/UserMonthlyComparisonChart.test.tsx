import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserMonthlyComparisonChart from '../UserMonthlyComparisonChart';

jest.mock('../filters/GlobalTimePeriodContext', () => ({
  useGlobalTimePeriod: jest.fn(() => ({ timePeriod: 'last_3_months' })),
}));

describe('UserMonthlyComparisonChart', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ chartData: [], metricCompared: 'totalPosts' }),
    });
  });

  it('calls user endpoint', async () => {
    render(<UserMonthlyComparisonChart userId="u1" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/users/u1/charts/monthly-comparison');
    expect(url).toContain('timePeriod=last_3_months');
  });
});
