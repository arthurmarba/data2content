import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoDrillDownModal from '../VideoDrillDownModal';

// Mock PostDetailModal
const MockPostDetailModal = jest.fn(({ isOpen, postId, onClose }) => {
  if (!isOpen) return null;
  return (
    <div data-testid="mock-post-detail-modal">
      <span>Post {postId}</span>
      <button onClick={onClose}>Close</button>
    </div>
  );
});

jest.mock('../PostDetailModal', () => ({
  __esModule: true,
  default: MockPostDetailModal,
}));

// Helper to mock fetch responses
const mockFetch = (response: any, ok = true) => {
  (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : response.status || 500,
    json: async () => response,
  });
};

const videosPage1 = {
  videos: [
    {
      _id: 'v1',
      caption: 'Video 1',
      postDate: '2024-01-01T00:00:00Z',
      stats: { views: 100 },
      average_video_watch_time_seconds: 30,
      retention_rate: 0.5,
    },
  ],
  pagination: { totalVideos: 2, page: 1, limit: 1 },
};

const videosPage2 = {
  videos: [
    {
      _id: 'v2',
      caption: 'Video 2',
      postDate: '2024-01-02T00:00:00Z',
      stats: { views: 200 },
      average_video_watch_time_seconds: 40,
      retention_rate: 0.6,
    },
  ],
  pagination: { totalVideos: 2, page: 2, limit: 1 },
};

describe('VideoDrillDownModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch(videosPage1);
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

    mockFetch(videosPage1); // mock for next fetch
    fireEvent.click(screen.getByText('Views'));

    await waitFor(() => {
      expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('sortOrder=asc'));
    });
  });

  test('handles pagination with next and previous buttons', async () => {
    render(<VideoDrillDownModal {...defaultProps} />);
    await screen.findByText('Video 1');

    mockFetch(videosPage2);
    fireEvent.click(screen.getByText('Próxima'));

    expect(await screen.findByText('Video 2')).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('page=2'));
    expect(screen.getByText('Página 2 de 2 (2 vídeos)')).toBeInTheDocument();

    mockFetch(videosPage1);
    fireEvent.click(screen.getByText('Anterior'));

    expect(await screen.findByText('Video 1')).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('page=1'));
  });

  test('opens PostDetailModal when a row is clicked', async () => {
    render(<VideoDrillDownModal {...defaultProps} />);
    const row = await screen.findByText('Video 1');
    fireEvent.click(row.closest('tr')!);

    expect(MockPostDetailModal).toHaveBeenCalledWith(
      expect.objectContaining({ isOpen: true, postId: 'v1' }),
      {}
    );
    expect(screen.getByTestId('mock-post-detail-modal')).toBeInTheDocument();
  });

  test('displays error state when fetch fails', async () => {
    mockFetch({ error: 'Internal error' }, false);
    render(<VideoDrillDownModal {...defaultProps} />);

    expect(await screen.findByText('Erro: Internal error')).toBeInTheDocument();
    expect(screen.queryByText('Carregando vídeos...')).not.toBeInTheDocument();
  });
});
