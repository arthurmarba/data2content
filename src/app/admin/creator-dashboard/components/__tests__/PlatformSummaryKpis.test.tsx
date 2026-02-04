import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlatformSummaryKpis from '../kpis/PlatformSummaryKpis';
import useSWR from 'swr';

jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseSWR = useSWR as jest.Mock;

describe('PlatformSummaryKpis', () => {
  const startDate = '2024-01-01';
  const endDate = '2024-02-01';

  beforeEach(() => {
    jest.resetAllMocks();
    mockUseSWR.mockReset();
  });

  test('shows loading state and renders metric values after fetch', async () => {
    mockUseSWR.mockReturnValueOnce({
      data: undefined,
      error: undefined,
      isLoading: true,
    });

    const { unmount } = render(<PlatformSummaryKpis startDate={startDate} endDate={endDate} />);

    // Expect loading text in all KPI cards
    expect(screen.getAllByText('Carregando...').length).toBeGreaterThan(0);

    unmount();

    mockUseSWR.mockReturnValueOnce({
      data: {
        current: {
          totalCreators: 10,
          pendingCreators: 2,
          activeCreatorsInPeriod: 8,
          averageEngagementRateInPeriod: 0.05,
          averageReachInPeriod: 1000,
        },
        previous: {
          totalCreators: 9,
          pendingCreators: 3,
          activeCreatorsInPeriod: 7,
          averageEngagementRateInPeriod: 0.04,
          averageReachInPeriod: 800,
        },
      },
      error: undefined,
      isLoading: false,
    });

    render(<PlatformSummaryKpis startDate={startDate} endDate={endDate} />);

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();

    expect(screen.getAllByText(/11\.1% vs período anterior/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-33\.3% vs período anterior/).length).toBeGreaterThan(0);
  });

  test('shows error message when fetch fails', async () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('Falha na API'),
      isLoading: false,
    });

    render(<PlatformSummaryKpis startDate={startDate} endDate={endDate} />);

    expect(screen.getAllByText(/Erro: Falha na API/).length).toBe(5);
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
  });
});
