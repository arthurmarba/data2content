import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoDrillDownModal from '../VideoDrillDownModal';

const buildFetchResponse = (response: any, ok = true) => ({
  ok,
  status: ok ? 200 : response.status || 500,
  json: async () => response,
});

const videosPage1 = {
  videos: [
    {
      _id: 'v1',
      caption: 'Video 1',
      description: 'Video 1',
      postDate: '2024-01-01T00:00:00Z',
      stats: { views: 100 },
      average_video_watch_time_seconds: 30,
      retention_rate: 0.5,
    },
  ],
  pagination: { totalVideos: 20, totalPosts: 20, page: 1, limit: 10 },
};

const videosPage2 = {
  videos: [
    {
      _id: 'v2',
      caption: 'Video 2',
      description: 'Video 2',
      postDate: '2024-01-02T00:00:00Z',
      stats: { views: 200 },
      average_video_watch_time_seconds: 40,
      retention_rate: 0.6,
    },
  ],
  pagination: { totalVideos: 20, totalPosts: 20, page: 2, limit: 10 },
};

describe('VideoDrillDownModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue(buildFetchResponse(videosPage1));
  });

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    userId: 'u1',
    timePeriod: 'last_30_days',
    drillDownMetric: 'views',
  } as const;

  test('shows loading state and renders videos after fetch', async () => {
    render(<VideoDrillDownModal {...defaultProps} />);

    expect(screen.getByText('Carregando vídeos...')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByText('Carregando vídeos...')).not.toBeInTheDocument());

    expect(screen.getByText('Video 1')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('sortBy=views'));
  });

  test('handles sorting when header is clicked', async () => {
    render(<VideoDrillDownModal {...defaultProps} />);
    await screen.findByText('Video 1');

    (fetch as jest.Mock).mockResolvedValueOnce(buildFetchResponse(videosPage1));
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'stats.views-desc' } });

    await waitFor(() => {
      expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('sortBy=stats.views'));
      expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('sortOrder=desc'));
    });
  });

  test('handles pagination with next and previous buttons', async () => {
    render(<VideoDrillDownModal {...defaultProps} />);
    await screen.findByText('Video 1');

    (fetch as jest.Mock).mockResolvedValueOnce(buildFetchResponse(videosPage2));
    fireEvent.click(screen.getByText('Próxima'));

    await screen.findByText('Video 2');
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('page=2'));
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    expect(screen.getByText('Total: 20 resultados')).toBeInTheDocument();

    (fetch as jest.Mock).mockResolvedValueOnce(buildFetchResponse(videosPage1));
    fireEvent.click(screen.getByText('Anterior'));

    expect(await screen.findByText('Video 1')).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('page=1'));
  });

  test('opens PostDetailModal when a row is clicked', async () => {
    const onDetailClick = jest.fn();
    render(<VideoDrillDownModal {...defaultProps} onDetailClick={onDetailClick} />);
    await screen.findByText(/Video 1/);
    fireEvent.click(screen.getByRole('button', { name: /Analisar/ }));

    expect(onDetailClick).toHaveBeenCalledWith('v1');
  });

  test('displays error state when fetch fails', async () => {
    (fetch as jest.Mock).mockResolvedValue(buildFetchResponse({ error: 'Internal error' }, false));
    render(<VideoDrillDownModal {...defaultProps} />);

    expect(await screen.findByText('Erro: Internal error')).toBeInTheDocument();
    expect(screen.queryByText('Carregando vídeos...')).not.toBeInTheDocument();
  });
});
