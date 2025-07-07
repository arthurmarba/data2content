import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserMonthlyEngagementStackedChart from '../UserMonthlyEngagementStackedChart';
import { useGlobalTimePeriod } from '../filters/GlobalTimePeriodContext';

jest.mock('../filters/GlobalTimePeriodContext', () => ({
  useGlobalTimePeriod: jest.fn(),
}));

const mockUseGlobalTimePeriod = useGlobalTimePeriod as jest.Mock;

describe('UserMonthlyEngagementStackedChart', () => {
  beforeEach(() => {
    mockUseGlobalTimePeriod.mockReturnValue({ timePeriod: 'last_6_months' });
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ chartData: [], insightSummary: '' }),
    });
  });

  it('calls user endpoint', async () => {
    render(<UserMonthlyEngagementStackedChart userId="u1" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/api/v1/users/u1/charts/monthly-engagement-stacked');
  });
});
