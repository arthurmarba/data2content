import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreatorDetailModal from './CreatorDetailModal';

// Mock global fetch
global.fetch = jest.fn();


// Mock CreatorTimeSeriesChart
jest.mock('./CreatorTimeSeriesChart', () => jest.fn(({ isLoading, error, data, metricLabel }) => (
    <div data-testid="mock-chart">
      {isLoading && <p>Chart Loading...</p>}
      {error && <p>Chart Error: {error}</p>}
      {data && data.length > 0 && <p>{`Chart Data for: ${metricLabel} (${data.length} points)`}</p>}
      {data && data.length === 0 && <p>{`No Chart Data for: ${metricLabel}`}</p>}
    </div>
)));

// Mock XMarkIcon from Heroicons
jest.mock('@heroicons/react/24/solid', () => ({
  XMarkIcon: jest.fn(() => <div data-testid="x-mark-icon" />),
}));


const mockCreatorTimeSeriesChart = require('./CreatorTimeSeriesChart').default;

const validCreatorId = '60f7ea9f9b9b9b001f8e4d1c'; // Example valid ObjectId string
const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  creatorId: validCreatorId,
  creatorName: 'Test Creator X',
  dateRangeFilter: { startDate: '2023-01-01T00:00:00.000Z', endDate: '2023-01-31T23:59:59.999Z' },
};

describe('CreatorDetailModal Component', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    mockCreatorTimeSeriesChart.mockClear(); // Clear mock calls
    defaultProps.onClose.mockClear();

    // Default successful fetch for initial load
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ date: new Date().toISOString(), value: 10 }],
    });
  });

  test('renders nothing if isOpen is false', () => {
    render(<CreatorDetailModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(`Detalhes de: ${defaultProps.creatorName}`)).not.toBeInTheDocument();
  });

  test('renders modal with creator name when open', () => {
    render(<CreatorDetailModal {...defaultProps} />);
    expect(screen.getByText(`Detalhes de: ${defaultProps.creatorName}`)).toBeInTheDocument();
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', () => {
    render(<CreatorDetailModal {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Fechar modal'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('fetches time series data on mount if open and creatorId is provided', async () => {
    render(<CreatorDetailModal {...defaultProps} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      `/api/admin/dashboard/creators/${validCreatorId}/time-series?metric=post_count&period=monthly&startDate=${defaultProps.dateRangeFilter.startDate}&endDate=${defaultProps.dateRangeFilter.endDate}`
    );
    await waitFor(() => expect(screen.getByText('Chart Data for: Contagem de Posts (1 points)')).toBeInTheDocument());
  });

  test('does not fetch if creatorId is null', () => {
    render(<CreatorDetailModal {...defaultProps} creatorId={null} />);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('does not fetch if dateRangeFilter is incomplete', () => {
    render(<CreatorDetailModal {...defaultProps} dateRangeFilter={{ startDate: '2023-01-01' }} />); // No endDate
    expect(fetch).not.toHaveBeenCalled();
  });


  test('refetches data when selectedMetric changes', async () => {
    render(<CreatorDetailModal {...defaultProps} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1)); // Initial fetch

    const metricSelect = screen.getByLabelText('Métrica:');
    fireEvent.change(metricSelect, { target: { value: 'avg_engagement_rate' } });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('metric=avg_engagement_rate')
    );
    await waitFor(() => expect(screen.getByText('Chart Data for: Engajamento Médio (1 points)')).toBeInTheDocument());
  });

  test('refetches data when selectedPeriod changes', async () => {
    render(<CreatorDetailModal {...defaultProps} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    const periodSelect = screen.getByLabelText('Período:');
    fireEvent.change(periodSelect, { target: { value: 'weekly' } });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('period=weekly')
    );
  });

  test('refetches data when dateRangeFilter prop changes', async () => {
    const { rerender } = render(<CreatorDetailModal {...defaultProps} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    const newDateRange = { startDate: '2023-02-01T00:00:00.000Z', endDate: '2023-02-28T23:59:59.999Z' };
    (fetch as jest.Mock).mockResolvedValueOnce({ // Mock for the refetch
        ok: true,
        json: async () => [{ date: new Date().toISOString(), value: 20 }],
    });

    rerender(<CreatorDetailModal {...defaultProps} dateRangeFilter={newDateRange} />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(`startDate=${newDateRange.startDate}&endDate=${newDateRange.endDate}`)
    );
     await waitFor(() => expect(screen.getByText('Chart Data for: Contagem de Posts (1 points)')).toBeInTheDocument());
  });


  test('passes correct props to CreatorTimeSeriesChart (loading, error, data)', async () => {
    render(<CreatorDetailModal {...defaultProps} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    // Check initial props (isLoading is false after fetch)
    expect(mockCreatorTimeSeriesChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isLoading: false,
        error: null,
        data: [{ date: expect.any(String), value: 10 }], // Data from mock fetch
        metricLabel: 'Contagem de Posts',
        period: 'monthly',
        chartType: 'bar' // Default for post_count
      }),
      {}
    );

    // Test error state
    (fetch as jest.Mock).mockRejectedValueOnce(new Error("Fetch failed spectacularly"));
    fireEvent.change(screen.getByLabelText('Métrica:'), { target: { value: 'avg_likes' } }); // Trigger refetch that will fail

    await waitFor(() => {
      expect(mockCreatorTimeSeriesChart).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isLoading: false,
          error: "Fetch failed spectacularly",
          data: [],
          metricLabel: 'Média de Likes',
        }),
        {}
      );
    });
  });

  test('clears data and error when modal is closed or creatorId/dateRange changes to invalid', async () => {
    const { rerender } = render(<CreatorDetailModal {...defaultProps} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Chart Data for: Contagem de Posts (1 points)')).toBeInTheDocument();

    // Close modal
    rerender(<CreatorDetailModal {...defaultProps} isOpen={false} />);
    // Chart is not rendered, but internal state should be cleared.
    // We can check if fetch is NOT called again with invalid state
    (fetch as jest.Mock).mockClear();
    rerender(<CreatorDetailModal {...defaultProps} isOpen={true} creatorId={null} />);
    expect(fetch).not.toHaveBeenCalled();
    // Check if chart shows no data or initial state
     await waitFor(() => expect(screen.getByTestId('mock-chart')).toBeInTheDocument()); // Chart is there
     expect(screen.queryByText(/Chart Data for/)).not.toBeInTheDocument(); // But no data text
  });

});
