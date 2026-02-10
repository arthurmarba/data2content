import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserAverageEngagementChart from '../UserAverageEngagementChart';
import { useGlobalTimePeriod } from '../filters/GlobalTimePeriodContext';

jest.mock('../filters/GlobalTimePeriodContext', () => ({
  useGlobalTimePeriod: jest.fn(),
}));

const mockUseGlobalTimePeriod = useGlobalTimePeriod as jest.Mock;

describe('UserAverageEngagementChart', () => {
  const userId = 'user-123';

  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
    mockUseGlobalTimePeriod.mockReturnValue({ timePeriod: 'last_30_days' });
  });

  it('calls user endpoint', async () => {
    render(<UserAverageEngagementChart userId="user-1" chartTitle="Average Engagement" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect((global.fetch as jest.Mock).mock.calls[0]![0]).toContain('/api/v1/users/user-1/performance/average-engagement');
  });
});
