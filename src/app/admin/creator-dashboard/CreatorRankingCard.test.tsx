import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreatorRankingCard from './CreatorRankingCard';
import { ICreatorMetricRankItem } from '@/app/lib/dataService/marketAnalysisService';
// Assuming SkeletonBlock is a simple component that doesn't need complex mocking itself
// If it's complex, it might need a jest.mock a level up.
// For now, let's assume it renders something identifiable or just works.

const mockRankingData: ICreatorMetricRankItem[] = [
  { creatorId: '1', creatorName: 'Alice Wonderland', metricValue: 95.5, profilePictureUrl: 'https://example.com/alice.jpg' },
  { creatorId: '2', creatorName: 'Bob The Builder', metricValue: 88, profilePictureUrl: 'https://example.com/bob.jpg' },
  { creatorId: '3', creatorName: 'Charlie Brown', metricValue: 72.123, profilePictureUrl: null }, // Test null profile picture
];

const mockEmptyData: ICreatorMetricRankItem[] = [];

global.fetch = jest.fn();

const mockDateRange = { startDate: '2023-01-01', endDate: '2023-01-31' };

describe('CreatorRankingCard', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('renders loading state initially', async () => {
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {})); // Simulate pending fetch

    render(
      <CreatorRankingCard
        title="Top Creators"
        apiEndpoint="/api/test-ranking"
        dateRangeFilter={mockDateRange}
        limit={3}
      />
    );

    expect(screen.getByText('Top Creators')).toBeInTheDocument();
    // Check for presence of multiple skeleton items (assuming SkeletonBlock renders identifiable role or text)
    // For simplicity, we'll check if the container for skeletons is there.
    // A more robust test would check for specific skeleton item counts.
    // Using 'listitem' role implicitly added by <li> in renderSkeleton
    await waitFor(() => {
        const listItems = screen.getAllByRole('listitem');
        // Check if class 'animate-pulse' is present on any parent
        expect(listItems[0].closest('ul')).toHaveClass('animate-pulse');
    });
  });

  it('renders successfully with data', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockRankingData,
    });

    render(
      <CreatorRankingCard
        title="Engaging Users"
        apiEndpoint="/api/engaging"
        dateRangeFilter={mockDateRange}
        metricLabel="%"
        limit={3}
      />
    );

    await waitFor(() => expect(screen.getByText('Alice Wonderland')).toBeInTheDocument());
    expect(screen.getByText('Engaging Users')).toBeInTheDocument();
    expect(screen.getByText('Bob The Builder')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();

    // Check formatted metric values and labels
    expect(screen.getByText('95,50 %')).toBeInTheDocument(); // Alice
    expect(screen.getByText('88 %')).toBeInTheDocument();    // Bob (integer)
    expect(screen.getByText('72,12 %')).toBeInTheDocument(); // Charlie (decimal)

    // Check images (or fallback)
    const images = screen.getAllByRole('img');
    expect(images[0]).toHaveAttribute('src', expect.stringContaining('alice.jpg'));
    expect(images[1]).toHaveAttribute('src', expect.stringContaining('bob.jpg'));
    // Charlie has no image, should render fallback initial
    expect(screen.getByText('C')).toBeInTheDocument(); // Fallback for Charlie Brown
  });

  it('renders error state and retries', async () => {
    const errorMessage = 'Network Error';
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: errorMessage }),
      })
      .mockResolvedValueOnce({ // For retry
        ok: true,
        json: async () => mockRankingData,
      });

    render(
      <CreatorRankingCard
        title="Error Test"
        apiEndpoint="/api/error"
        dateRangeFilter={mockDateRange}
      />
    );

    await waitFor(() => expect(screen.getByText(`Erro: ${errorMessage}`)).toBeInTheDocument());
    const retryButton = screen.getByText('Tentar Novamente');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(fetch).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByText('Alice Wonderland')).toBeInTheDocument());
  });

  it('renders empty data state', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockEmptyData,
    });

    render(
      <CreatorRankingCard
        title="Empty Test"
        apiEndpoint="/api/empty"
        dateRangeFilter={mockDateRange}
      />
    );

    await waitFor(() => expect(screen.getByText('Nenhum dado disponível para o período selecionado.')).toBeInTheDocument());
  });

  it('does not fetch if dateRangeFilter is incomplete', () => {
    render(
      <CreatorRankingCard
        title="No Date Range"
        apiEndpoint="/api/nodate"
        dateRangeFilter={{ startDate: '2023-01-01' }} // Missing endDate
      />
    );
    expect(fetch).not.toHaveBeenCalled();
    // Current behavior is to render "No data" state, as rankingData remains null
    expect(
      screen.getAllByText('Nenhum dado disponível para o período selecionado.')
    ).toHaveLength(1);

    cleanup();

    render(
        <CreatorRankingCard
          title="No Date Range At All"
          apiEndpoint="/api/nodate2"
          // dateRangeFilter is undefined
        />
      );
      expect(fetch).not.toHaveBeenCalled();
      expect(
        screen.getAllByText('Nenhum dado disponível para o período selecionado.')
      ).toHaveLength(1);
  });

   it('displays correct metric formatting for very small numbers', async () => {
    const smallValueData: ICreatorMetricRankItem[] = [
      { creatorId: '1', creatorName: 'Tiny Tim', metricValue: 0.0075, profilePictureUrl: null },
    ];
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => smallValueData,
    });

    render(
      <CreatorRankingCard
        title="Small Value Test"
        apiEndpoint="/api/smallvalue"
        dateRangeFilter={mockDateRange}
        metricLabel="rate"
      />
    );
    await waitFor(() => expect(screen.getByText('Tiny Tim')).toBeInTheDocument());
    // 0.0075 should be formatted like 0,0075 or similar depending on toPrecision/toFixed logic
    // The current logic: value.toFixed(Math.max(2, -Math.floor(Math.log10(Math.abs(value))) + 1)).replace('.', ',')
    // For 0.0075: -Math.floor(Math.log10(0.0075)) + 1 = -(-3) + 1 = 4. So, toFixed(4) => "0.0075" -> "0,0075"
    expect(screen.getByText('0,0075 rate')).toBeInTheDocument();
  });

});
