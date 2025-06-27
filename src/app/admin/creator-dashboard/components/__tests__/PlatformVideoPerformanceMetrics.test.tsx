import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlatformVideoPerformanceMetrics from '../PlatformVideoPerformanceMetrics';
import { useGlobalTimePeriod } from '../filters/GlobalTimePeriodContext';

jest.mock('../filters/GlobalTimePeriodContext', () => ({
  useGlobalTimePeriod: jest.fn(),
}));

const mockUseGlobalTimePeriod = useGlobalTimePeriod as jest.Mock;

beforeEach(() => {
  (global.fetch as any) = jest.fn();
  mockUseGlobalTimePeriod.mockReturnValue({ timePeriod: 'last_30_days' });
});

describe('PlatformVideoPerformanceMetrics', () => {
  it('renders metrics on success', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        averageRetentionRate: 50,
        averageWatchTimeSeconds: 120,
        numberOfVideoPosts: 10,
        insightSummary: 'Resumo',
      }),
    });

    render(<PlatformVideoPerformanceMetrics />);

    await waitFor(() => expect(screen.getByText('50.0%')).toBeInTheDocument());
    expect(screen.getByText('120s')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Resumo')).toBeInTheDocument();
  });

  it('shows no data message', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        averageRetentionRate: null,
        averageWatchTimeSeconds: null,
        numberOfVideoPosts: null,
      }),
    });

    render(<PlatformVideoPerformanceMetrics />);
    await waitFor(() =>
      expect(screen.getByText('Nenhuma métrica de vídeo encontrada para a plataforma.')).toBeInTheDocument()
    );
  });

  it('renders error state', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Bad' }),
    });
    render(<PlatformVideoPerformanceMetrics />);

    await waitFor(() => expect(screen.getByText(/Erro:/)).toBeInTheDocument());
  });
});
