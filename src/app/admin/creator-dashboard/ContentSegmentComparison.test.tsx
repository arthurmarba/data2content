import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContentSegmentComparison from './ContentSegmentComparison';
import { SegmentComparisonResultItem } from '@/app/api/admin/dashboard/content-segments/compare/route';

// Mock global fetch
global.fetch = jest.fn();

// Mock Heroicons
jest.mock('@heroicons/react/24/outline', () => ({
  PlusIcon: () => <div data-testid="plus-icon" />,
  TrashIcon: () => <div data-testid="trash-icon" />,
  ExclamationTriangleIcon: () => <div data-testid="exclamation-icon" />,
}));

// Mock next/image (if used for anything else, not directly by this component from props)
jest.mock('next/image', () => ({
    __esModule: true,
    default: jest.fn(() => null), // Simple mock if not testing image rendering itself
}));


const mockDateRange = { startDate: '2023-01-01T00:00:00.000Z', endDate: '2023-01-31T23:59:59.999Z' };

const mockApiResponse: SegmentComparisonResultItem[] = [
  {
    name: 'Segment 1: Reels de Tech',
    criteria: { format: 'Reel', context: 'Tech' },
    performance: { postCount: 50, avgEngagementRate: 0.05, avgLikes: 100, avgShares: 10, avgComments: 5 }
  },
  {
    name: 'Segment 2: Posts de Finanças',
    criteria: { format: 'Post Estático', context: 'Finanças' },
    performance: { postCount: 70, avgEngagementRate: 0.07, avgLikes: 120, avgShares: 15, avgComments: 8 } // Higher engagement
  },
];


describe('ContentSegmentComparison Component', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    // Default successful fetch
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });
  });

  test('renders initial structure with one segment form', () => {
    render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);
    expect(screen.getByText('Comparador de Performance de Segmentos de Conteúdo')).toBeInTheDocument();
    expect(screen.getByText('Segmento 1')).toBeInTheDocument();
    expect(screen.queryByText('Segmento 2')).not.toBeInTheDocument();
    expect(screen.getByText('Adicionar Segmento')).toBeInTheDocument();
    expect(screen.getByText('Comparar Segmentos')).toBeInTheDocument();
  });

  test('adds and removes segment forms', () => {
    render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);
    const addButton = screen.getByText('Adicionar Segmento');

    fireEvent.click(addButton);
    expect(screen.getByText('Segmento 2')).toBeInTheDocument();

    const removeButtons = screen.getAllByTitle('Remover Segmento');
    expect(removeButtons.length).toBe(2); // One for each segment now
    fireEvent.click(removeButtons[1]); // Remove the second segment
    expect(screen.queryByText('Segmento 2')).not.toBeInTheDocument();

    // Test MIN_SEGMENTS limit for removal
    const firstRemoveButton = screen.getByTitle('Remover Segmento'); // Should be only one now
    expect(firstRemoveButton).toBeDisabled(); // Assuming MIN_SEGMENTS is 1
  });

  test('disables Add Segment button when MAX_SEGMENTS reached', () => {
    render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);
    const addButton = screen.getByText('Adicionar Segmento');
    // Click to add up to MAX_SEGMENTS (default is 1, MAX is 5)
    for (let i = 0; i < 4; i++) { // Add 4 more to reach 5
      if (!addButton.hasAttribute('disabled')) fireEvent.click(addButton);
    }
    expect(screen.getByText('Segmento 5')).toBeInTheDocument();
    expect(addButton).toBeDisabled();
  });

  test('updates segment criteria on input/select change', () => {
    render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);
    const segment1NameInput = screen.getByLabelText('Nome do Segmento (Opcional)') as HTMLInputElement;
    const segment1FormatSelect = screen.getAllByLabelText('Formato')[0] as HTMLSelectElement; // First format select

    fireEvent.change(segment1NameInput, { target: { value: 'My Custom Segment' } });
    // This state change is internal. We'll verify it through the fetch call later.

    fireEvent.change(segment1FormatSelect, { target: { value: 'Reel' } });
    expect(segment1FormatSelect.value).toBe('Reel');
  });

  test('"Comparar Segmentos" button disabled states', () => {
    // 1. Incomplete dateRangeFilter
    render(<ContentSegmentComparison dateRangeFilter={{ startDate: mockDateRange.startDate }} />); // No endDate
    const compareButton = screen.getByText('Comparar Segmentos');
    expect(compareButton).toBeDisabled();
    expect(screen.getByText(/Por favor, selecione um período de datas nos filtros globais/)).toBeInTheDocument();

    // 2. Segment criteria not defined (initial state with one empty segment)
    render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);
    // Re-fetch compareButton as it's a new render
    const compareButtonWithEmptyCriteria = screen.getByText('Comparar Segmentos');
    expect(compareButtonWithEmptyCriteria).toBeDisabled();
    expect(screen.getByText(/Defina ao menos um critério para este segmento/)).toBeInTheDocument();
  });

  test('calls fetch on "Comparar Segmentos" click with correct payload', async () => {
    render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);

    // Define criteria for the first segment
    const formatSelect = screen.getAllByLabelText('Formato')[0];
    fireEvent.change(formatSelect, { target: { value: 'Reel' } });
    const nameInput = screen.getByLabelText('Nome do Segmento (Opcional)');
    fireEvent.change(nameInput, {target: { value: 'Reels Test'}});

    const compareButton = screen.getByText('Comparar Segmentos');
    expect(compareButton).not.toBeDisabled(); // Should be enabled now

    fireEvent.click(compareButton);

    expect(screen.getByText('Comparando...')).toBeInTheDocument(); // Loading state on button
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/api/admin/dashboard/content-segments/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRange: mockDateRange,
        segments: [
          { name: 'Reels Test', criteria: { format: 'Reel', proposal: undefined, context: undefined } }
        ],
      }),
    });
  });

  describe('Results Display', () => {
    test('shows loading state during fetch', async () => {
        (fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {})); // Infinite load
        render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);
        fireEvent.change(screen.getAllByLabelText('Formato')[0], { target: { value: 'Video' } });
        fireEvent.click(screen.getByText('Comparar Segmentos'));
        expect(await screen.findByText('Carregando resultados da comparação...')).toBeInTheDocument();
    });

    test('shows error message on fetch failure', async () => {
        (fetch as jest.Mock).mockRejectedValueOnce(new Error('API comparison failed'));
        render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);
        fireEvent.change(screen.getAllByLabelText('Formato')[0], { target: { value: 'Video' } });
        fireEvent.click(screen.getByText('Comparar Segmentos'));
        expect(await screen.findByText('Erro ao comparar segmentos: API comparison failed')).toBeInTheDocument();
    });

    test('renders comparison table with data and highlights best values', async () => {
      render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);
      // Set criteria for first segment to match mockApiResponse[0]
      fireEvent.change(screen.getAllByLabelText('Formato')[0], { target: { value: 'Reel' } });
      fireEvent.change(screen.getAllByLabelText('Contexto')[0], { target: { value: 'Tech' } });
      fireEvent.change(screen.getByLabelText('Nome do Segmento (Opcional)'), {target: { value: 'Segment 1: Reels de Tech'}});


      // Add and define second segment to match mockApiResponse[1]
      fireEvent.click(screen.getByText('Adicionar Segmento'));
      fireEvent.change(screen.getAllByLabelText('Formato')[1], { target: { value: 'Post Estático' } });
      fireEvent.change(screen.getAllByLabelText('Contexto')[1], { target: { value: 'Finanças' } });
      fireEvent.change(screen.getAllByLabelText('Nome do Segmento (Opcional)')[1], {target: { value: 'Segment 2: Posts de Finanças'}});


      fireEvent.click(screen.getByText('Comparar Segmentos'));

      await waitFor(() => expect(screen.getByText('Segment 1: Reels de Tech')).toBeInTheDocument());
      expect(screen.getByText('Segment 2: Posts de Finanças')).toBeInTheDocument();

      // Check for a metric label and some values
      expect(screen.getByText('Nº de Posts')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument(); // Segment 1 postCount
      expect(screen.getByText('70')).toBeInTheDocument(); // Segment 2 postCount (highlighted)

      expect(screen.getByText('Taxa de Engaj. Média')).toBeInTheDocument();
      expect(screen.getByText('5,0%')).toBeInTheDocument(); // Segment 1 engagement
      expect(screen.getByText('7,0%')).toBeInTheDocument(); // Segment 2 engagement (highlighted)

      // Check highlighting (Segment 2 has better engagement rate in mock)
      const segment2EngagementCell = screen.getByText('7,0%').closest('td');
      expect(segment2EngagementCell).toHaveClass('font-bold text-green-600 dark:text-green-400');

      const segment1EngagementCell = screen.getByText('5,0%').closest('td');
      expect(segment1EngagementCell).not.toHaveClass('font-bold text-green-600 dark:text-green-400');

      // Check segment criteria display below header name
      expect(screen.getByText('(Formato: Reel / Contexto: Tech)')).toBeInTheDocument();
    });
  });

  test('clears results if dateRangeFilter becomes incomplete', async () => {
    const { rerender } = render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);
    // Set criteria & fetch initial results
    fireEvent.change(screen.getAllByLabelText('Formato')[0], { target: { value: 'Video' } });
    fireEvent.click(screen.getByText('Comparar Segmentos'));
    await waitFor(() => expect(screen.getByText('Segment 1: Video')).toBeInTheDocument()); // Wait for results table header

    // Now, simulate dateRangeFilter becoming incomplete
    rerender(<ContentSegmentComparison dateRangeFilter={{ startDate: mockDateRange.startDate, endDate: undefined }} />);
    // Results table should be cleared, initial prompt might show
    expect(screen.queryByText('Segment 1: Video')).not.toBeInTheDocument();
    // Check for a message indicating to define segments or that date is incomplete
    expect(screen.getByText(/Por favor, selecione um período de datas nos filtros globais/)).toBeInTheDocument();
  });

});
