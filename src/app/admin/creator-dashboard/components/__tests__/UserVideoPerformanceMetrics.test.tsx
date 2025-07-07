import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserVideoPerformanceMetrics from '../UserVideoPerformanceMetrics';
import { useGlobalTimePeriod } from '../filters/GlobalTimePeriodContext';

jest.mock('../filters/GlobalTimePeriodContext', () => ({
  useGlobalTimePeriod: jest.fn(),
}));

jest.mock('../VideoDrillDownModal', () => {
  return {
    __esModule: true,
    default: jest.fn(({ isOpen, drillDownMetric }) =>
      isOpen ? <div data-testid="drilldown-modal">{drillDownMetric}</div> : null,
    ),
  };
});

const mockUseGlobalTimePeriod = useGlobalTimePeriod as jest.Mock;
const MockVideoDrillDownModal = require('../VideoDrillDownModal').default as jest.Mock;

describe('UserVideoPerformanceMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGlobalTimePeriod.mockReturnValue({ timePeriod: 'last_30_days' });
    (global.fetch as jest.Mock) = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          averageRetentionRate: 50,
          averageWatchTimeSeconds: 120,
          numberOfVideoPosts: 10,
          averageShares: 5,
          averageSaves: 3,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          videos: [
            {
              _id: 'v1',
              description: 'Video 1',
              thumbnailUrl: null,
              stats: { views: 100, likes: 10, comments: 1 },
              postDate: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });
  });

  it('opens drill down modal with "retention_rate" when Retenção Média is clicked', async () => {
    render(<UserVideoPerformanceMetrics userId="u1" />);
    await waitFor(() => expect(screen.getByText('50.0%')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Retenção Média'));
    expect(MockVideoDrillDownModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ isOpen: true, drillDownMetric: 'retention_rate' }),
      {}
    );
    expect(screen.getByTestId('drilldown-modal')).toHaveTextContent('retention_rate');
  });

  it('opens drill down modal with "average_video_watch_time_seconds" when Tempo Médio de Visualização is clicked', async () => {
    render(<UserVideoPerformanceMetrics userId="u1" />);
    await waitFor(() => expect(screen.getByText('50.0%')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Tempo Médio de Visualização'));
    expect(MockVideoDrillDownModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ isOpen: true, drillDownMetric: 'average_video_watch_time_seconds' }),
      {}
    );
    expect(screen.getByTestId('drilldown-modal')).toHaveTextContent('average_video_watch_time_seconds');
  });

  it('opens drill down modal with "views" when Total de Vídeos Analisados is clicked', async () => {
    render(<UserVideoPerformanceMetrics userId="u1" />);
    await waitFor(() => expect(screen.getByText('50.0%')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Total de Vídeos Analisados'));
    expect(MockVideoDrillDownModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ isOpen: true, drillDownMetric: 'views' }),
      {}
    );
    expect(screen.getByTestId('drilldown-modal')).toHaveTextContent('views');
  });

  it('opens drill down modal with "views" when "Ver Todos os Vídeos" button is clicked', async () => {
    render(<UserVideoPerformanceMetrics userId="u1" />);
    await waitFor(() => expect(screen.getByText('50.0%')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Ver Todos os Vídeos'));
    expect(MockVideoDrillDownModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ isOpen: true, drillDownMetric: 'views' }),
      {}
    );
    expect(screen.getByTestId('drilldown-modal')).toHaveTextContent('views');
  });

  it('renders video list preview automatically', async () => {
    render(<UserVideoPerformanceMetrics userId="u1" />);
    expect(await screen.findByTestId('video-list-preview')).toBeInTheDocument();
    expect(screen.getByText('Video 1')).toBeInTheDocument();
  });
});
