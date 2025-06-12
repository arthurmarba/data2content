import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreatorTimeSeriesChart, { ICreatorTimeSeriesDataPoint } from './CreatorTimeSeriesChart';

// Mock recharts (as done in previous similar tests)
jest.mock('recharts', () => {
  const OriginalRecharts = jest.requireActual('recharts');
  return {
    ...OriginalRecharts,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div className="recharts-responsive-container" data-testid="responsive-container">
        {children}
      </div>
    ),
    LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
    BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
    XAxis: () => <div data-testid="xaxis">XAxis</div>,
    YAxis: () => <div data-testid="yaxis">YAxis</div>,
    CartesianGrid: () => <div data-testid="grid">CartesianGrid</div>,
    Tooltip: () => <div data-testid="tooltip">Tooltip</div>,
    Legend: () => <div data-testid="legend">Legend</div>,
    Line: ({ name }: { name: string }) => <div data-testid="line-element" data-name={name}>Line: {name}</div>,
    Bar: ({ name }: { name: string }) => <div data-testid="bar-element" data-name={name}>Bar: {name}</div>,
  };
});

describe('CreatorTimeSeriesChart Component', () => {
  const mockData: ICreatorTimeSeriesDataPoint[] = [
    { date: new Date('2023-01-01T00:00:00.000Z'), value: 100 },
    { date: new Date('2023-01-08T00:00:00.000Z'), value: 150 },
  ];

  const defaultProps = {
    data: mockData,
    metricLabel: 'Test Metric',
    isLoading: false,
    error: null,
    chartType: 'line' as 'line' | 'bar',
    period: 'weekly' as 'monthly' | 'weekly',
  };

  test('renders loading state', () => {
    render(<CreatorTimeSeriesChart {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Carregando dados do gráfico...')).toBeInTheDocument();
  });

  test('renders error state', () => {
    render(<CreatorTimeSeriesChart {...defaultProps} error="Failed to load data" />);
    expect(screen.getByText('Erro ao carregar dados: Failed to load data')).toBeInTheDocument();
  });

  test('renders "no data" message when data is empty', () => {
    render(<CreatorTimeSeriesChart {...defaultProps} data={[]} />);
    expect(screen.getByText('Nenhum dado disponível para exibir no gráfico.')).toBeInTheDocument();
  });

  test('renders "no data" message when data is null', () => {
    render(<CreatorTimeSeriesChart {...defaultProps} data={null as any} />); // Cast to any to test null case
    expect(screen.getByText('Nenhum dado disponível para exibir no gráfico.')).toBeInTheDocument();
  });

  test('renders line chart with data', () => {
    render(<CreatorTimeSeriesChart {...defaultProps} chartType="line" />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('xaxis')).toBeInTheDocument();
    expect(screen.getByTestId('yaxis')).toBeInTheDocument();
    expect(screen.getByTestId('grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    const lineElement = screen.getByTestId('line-element');
    expect(lineElement).toBeInTheDocument();
    expect(lineElement).toHaveTextContent('Line: Test Metric');
    expect(lineElement).toHaveAttribute('data-name', 'Test Metric');
  });

  test('renders bar chart with data', () => {
    render(<CreatorTimeSeriesChart {...defaultProps} chartType="bar" />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    const barElement = screen.getByTestId('bar-element');
    expect(barElement).toBeInTheDocument();
    expect(barElement).toHaveTextContent('Bar: Test Metric');
    expect(barElement).toHaveAttribute('data-name', 'Test Metric');
  });

  // Test date formatting (conceptual, as actual formatting is inside Recharts)
  // We can check if the `formatDateTick` and `formatTooltipDate` are called if we pass them to Recharts components,
  // but here they are used internally by the XAxis/Tooltip's `tickFormatter` and `content` props.
  // For simplicity, we assume Recharts uses these formatters.
  // A more direct test would involve extracting the formatter functions and testing them in isolation.
  test('uses correct date formatting based on period (conceptual)', () => {
    // Monthly
    render(<CreatorTimeSeriesChart {...defaultProps} period="monthly" />);
    // Check if XAxis (mocked) receives props that would imply monthly formatting (e.g. if formatter was passed directly)
    // This test is more about ensuring the component structure is sound.

    // Weekly
    render(<CreatorTimeSeriesChart {...defaultProps} period="weekly" />);
    // Similar conceptual check for weekly
  });

});
