import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlatformSummaryKpis from '../kpis/PlatformSummaryKpis';

// Helper to mock sequential fetch calls
const mockFetchSequence = (responses: { data: any; ok?: boolean; status?: number }[]) => {
  (global.fetch as jest.Mock) = jest.fn();
  responses.forEach(res => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: res.ok !== false,
      status: res.ok !== false ? 200 : res.status || 500,
      json: async () => res.data,
    });
  });
};

describe('PlatformSummaryKpis', () => {
  const startDate = '2024-01-01';
  const endDate = '2024-02-01';

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('shows loading state and renders metric values after fetch', async () => {
    mockFetchSequence([
      { data: {
          totalCreators: 10,
          pendingCreators: 2,
          activeCreatorsInPeriod: 8,
          averageEngagementRateInPeriod: 0.05,
          averageReachInPeriod: 1000,
        }
      },
      { data: {
          totalCreators: 9,
          pendingCreators: 3,
          activeCreatorsInPeriod: 7,
          averageEngagementRateInPeriod: 0.04,
          averageReachInPeriod: 800,
        }
      }
    ]);

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

    expect(screen.getAllByText('+11.1% vs período anterior').length).toBeGreaterThan(0);
    expect(screen.getAllByText('-33.3% vs período anterior').length).toBeGreaterThan(0);
  });

  test('shows error message when fetch fails', async () => {
    mockFetchSequence([
      { data: { error: 'Internal' }, ok: false, status: 500 },
      { data: { error: 'Internal' }, ok: false, status: 500 }
    ]);

    render(<PlatformSummaryKpis startDate={startDate} endDate={endDate} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Erro HTTP/).length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
    expect(screen.getAllByText('Erro: Erro HTTP: 500 - Internal').length).toBe(5);
  });
});
