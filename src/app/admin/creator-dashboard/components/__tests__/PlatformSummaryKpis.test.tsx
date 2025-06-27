import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlatformSummaryKpis from '../kpis/PlatformSummaryKpis';

// Helper to mock fetch
const mockFetch = (response: any, ok = true) => {
  (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : response.status || 500,
    json: async () => response,
  });
};

describe('PlatformSummaryKpis', () => {
  const startDate = '2024-01-01';
  const endDate = '2024-02-01';

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('shows loading state and renders metric values after fetch', async () => {
    mockFetch({
      totalCreators: 10,
      pendingCreators: 2,
      activeCreatorsInPeriod: 8,
      averageEngagementRateInPeriod: 0.05,
      averageReachInPeriod: 1000,
    });

    render(<PlatformSummaryKpis startDate={startDate} endDate={endDate} />);

    // Expect loading text in all KPI cards
    expect(screen.getAllByText('Carregando...').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  test('shows error message when fetch fails', async () => {
    mockFetch({ error: 'Internal' }, false);

    render(<PlatformSummaryKpis startDate={startDate} endDate={endDate} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Erro HTTP/).length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
    expect(screen.getAllByText('Erro: Erro HTTP: 500 - Internal').length).toBe(5);
  });
});
