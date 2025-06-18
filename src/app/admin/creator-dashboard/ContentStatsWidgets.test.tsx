import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContentStatsWidgets from './ContentStatsWidgets';
import { IDashboardOverallStats } from '@/app/lib/dataService/marketAnalysisService'; // Adjust path

// Mock global fetch
global.fetch = jest.fn();

jest.mock('recharts', () => {
  const OriginalRecharts = jest.requireActual('recharts');
  return {
    ...OriginalRecharts,
    ResponsiveContainer: (props) => React.createElement('div', { ...props, className: "recharts-responsive-container", style: { width: '100%', height: '100%' } }),
    BarChart: (props) => React.createElement('div', { ...props, "data-testid": "bar-chart" }),
    PieChart: (props) => React.createElement('div', { ...props, "data-testid": "pie-chart" }),
    Bar: (props) => React.createElement('div', { ...props, "data-testid": "bar-element" }, "Bar"),
    Pie: (props) => React.createElement('div', { ...props, "data-testid": "pie-element" }, "Pie"),
    XAxis: (props) => React.createElement('div', { ...props, "data-testid": "xaxis-element" }, "XAxis"),
    YAxis: (props) => React.createElement('div', { ...props, "data-testid": "yaxis-element" }, "YAxis"),
    Tooltip: (props) => React.createElement('div', { ...props, "data-testid": "tooltip-element" }, "Tooltip"),
    Legend: (props) => React.createElement('div', { ...props, "data-testid": "legend-element" }, "Legend"),
    CartesianGrid: (props) => React.createElement('div', { ...props, "data-testid": "grid-element" }, "Grid"),
    Cell: (props) => React.createElement('div', { ...props, "data-testid": "cell-element" }, "Cell"),
  };
});

const mockStats: IDashboardOverallStats = {
  totalPlatformPosts: 12345,
  averagePlatformEngagementRate: 0.067,
  totalContentCreators: 567,
  breakdownByFormat: [{ format: 'Video', count: 8000, avgEngagement: 0.07 }],
  breakdownByProposal: [{ proposal: 'Tutorial', count: 4000, avgEngagement: 0.06 }],
  breakdownByContext: [{ context: 'Tech', count: 6000, avgEngagement: 0.065 }],
};

describe('ContentStatsWidgets Component', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });
  });

  test('renders KPIs and chart placeholders on successful data fetch', async () => {
    render(<ContentStatsWidgets />);

    // Check KPIs
    expect(await screen.findByText('Total de Posts na Plataforma')).toBeInTheDocument();
    expect(screen.getByText('12.345')).toBeInTheDocument(); // Formatted number

    expect(screen.getByText('Média de Engajamento')).toBeInTheDocument();
    expect(screen.getByText('6,7%')).toBeInTheDocument(); // Formatted percentage

    expect(screen.getByText('Total de Criadores de Conteúdo')).toBeInTheDocument();
    expect(screen.getByText('567')).toBeInTheDocument();

    // Check for chart section titles (implies charts would be there)
    expect(screen.getByText('Posts por Formato')).toBeInTheDocument();
    expect(screen.getByText('Posts por Proposta')).toBeInTheDocument();
    expect(screen.getByText('Posts por Contexto')).toBeInTheDocument();

    // Check if mock chart components are rendered
    expect(screen.getAllByTestId('bar-chart').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  test('displays loading state initially', () => {
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {})); // Keep it loading
    render(<ContentStatsWidgets />);
    expect(screen.getByText('Carregando estatísticas...')).toBeInTheDocument();
  });

  test('displays error state and retry button if fetch fails', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error Stats'));
    render(<ContentStatsWidgets />);
    expect(await screen.findByText(/Erro ao carregar dados: API Error Stats/)).toBeInTheDocument();
    expect(screen.getByText('Tentar Novamente')).toBeInTheDocument();
  });

  test('retry button calls fetchData again', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Initial API Error'));
    render(<ContentStatsWidgets />);

    const retryButton = await screen.findByText('Tentar Novamente');
    expect(fetch).toHaveBeenCalledTimes(1); // Initial call

    // Setup next fetch call to succeed
    (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
    });

    fireEvent.click(retryButton);
    expect(fetch).toHaveBeenCalledTimes(2); // Called again after click
    expect(await screen.findByText('12.345')).toBeInTheDocument(); // Data is now loaded
  });

  test('displays "no stats available" message when data is null or empty', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => null, // Simulate API returning null
    });
    render(<ContentStatsWidgets />);
    expect(await screen.findByText('Nenhuma estatística de conteúdo disponível.')).toBeInTheDocument();
  });

  test('displays "data not available" for individual charts if their specific data is empty', async () => {
    const partialMockStats: IDashboardOverallStats = {
        ...mockStats,
        breakdownByFormat: [], // Empty data for this chart
    };
    (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => partialMockStats,
    });
    render(<ContentStatsWidgets />);
    await screen.findByText('Posts por Formato'); // Wait for component to render
    // The text "Dados não disponíveis." is inside the component for each chart.
    // We expect it for the format chart.
    const formatChartSection = screen.getByText('Posts por Formato').closest('div');
    expect(formatChartSection).toHaveTextContent('Dados não disponíveis.');

    // Other charts should still render if they have data
    expect(screen.getByText('Posts por Proposta').closest('div')).not.toHaveTextContent('Dados não disponíveis.');
  });


  test('fetches with dateRangeFilter prop', async () => {
    (fetch as jest.Mock).mockClear(); // Clear initial successful mock
    (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
    });

    const dateRange = { startDate: '2023-01-01', endDate: '2023-01-31' };
    render(<ContentStatsWidgets dateRangeFilter={dateRange} />);

    await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
            `/api/admin/dashboard/content-stats?startDate=${new Date(dateRange.startDate).toISOString()}&endDate=${new Date(dateRange.endDate).toISOString()}`
        );
    });
  });

  test('refetches when dateRangeFilter prop changes', async () => {
    const initialDateRange = { startDate: '2023-01-01', endDate: '2023-01-31' };
    const { rerender } = render(<ContentStatsWidgets dateRangeFilter={initialDateRange} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1)); // Initial fetch

    const newDateRange = { startDate: '2023-02-01', endDate: '2023-02-28' };
    (fetch as jest.Mock).mockResolvedValueOnce({ // Mock for the refetch
        ok: true,
        json: async () => ({...mockStats, totalPlatformPosts: 500 }), // Different data
    });

    rerender(<ContentStatsWidgets dateRangeFilter={newDateRange} />);

    await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2); // Should fetch again
        expect(fetch).toHaveBeenLastCalledWith(
             `/api/admin/dashboard/content-stats?startDate=${new Date(newDateRange.startDate).toISOString()}&endDate=${new Date(newDateRange.endDate).toISOString()}`
        );
    });
    expect(await screen.findByText('500')).toBeInTheDocument(); // Check if new data is rendered
  });

});
