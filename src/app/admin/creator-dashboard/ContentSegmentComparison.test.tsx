import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContentSegmentComparison, { ISegmentDefinition, ISegmentPerformanceResult } from './ContentSegmentComparison';

// Definindo o tipo SegmentComparisonResultItem localmente para o teste
interface SegmentComparisonResultItem {
  name: string;
  criteria: ISegmentDefinition;
  performance: ISegmentPerformanceResult;
}

// Mock global fetch
global.fetch = jest.fn();

// --- CORREÇÃO PRINCIPAL ---
// Mock completo para todos os ícones usados no componente
jest.mock('@heroicons/react/24/outline', () => ({
  __esModule: true,
  ArrowsRightLeftIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'arrows-icon' }),
  TableCellsIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'table-cells-icon' }),
  PlusIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'plus-icon' }),
  TrashIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'trash-icon' }),
  ExclamationTriangleIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'exclamation-icon' }),
}));

// Mock next/image
jest.mock('next/image', () => ({
    __esModule: true,
    default: jest.fn(() => null),
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
    expect(removeButtons.length).toBe(2);
    fireEvent.click(removeButtons[1]);
    expect(screen.queryByText('Segmento 2')).not.toBeInTheDocument();

    const firstRemoveButton = screen.getByTitle('Remover Segmento');
    expect(firstRemoveButton).toBeDisabled();
  });

  test('disables Add Segment button when MAX_SEGMENTS reached', () => {
    render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);
    const addButton = screen.getByText('Adicionar Segmento');
    for (let i = 0; i < 4; i++) {
      if (!addButton.hasAttribute('disabled')) fireEvent.click(addButton);
    }
    expect(screen.getByText('Segmento 5')).toBeInTheDocument();
    expect(addButton).toBeDisabled();
  });

  test('updates segment criteria on input/select change', () => {
    render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);
    const segment1NameInput = screen.getByLabelText('Nome do Segmento (Opcional)') as HTMLInputElement;
    const segment1FormatSelect = screen.getAllByLabelText('Formato')[0] as HTMLSelectElement;

    fireEvent.change(segment1NameInput, { target: { value: 'My Custom Segment' } });
    fireEvent.change(segment1FormatSelect, { target: { value: 'Reel' } });
    expect(segment1FormatSelect.value).toBe('Reel');
  });

  test('"Comparar Segmentos" button disabled states', () => {
    // 1. Incomplete dateRangeFilter
    const { rerender } = render(<ContentSegmentComparison dateRangeFilter={{ startDate: mockDateRange.startDate }} />);
    const compareButton = screen.getByText('Comparar Segmentos');
    expect(compareButton).toBeDisabled();
    expect(screen.getByText(/Por favor, selecione um período de datas nos filtros globais/)).toBeInTheDocument();

    // 2. Segment criteria not defined
    rerender(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);
    const compareButtonWithEmptyCriteria = screen.getByText('Comparar Segmentos');
    expect(compareButtonWithEmptyCriteria).toBeDisabled();
    expect(screen.getByText(/Por favor, defina ao menos um critério para cada segmento/)).toBeInTheDocument();
  });

  test('calls fetch on "Comparar Segmentos" click with correct payload', async () => {
    render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);

    const formatSelect = screen.getAllByLabelText('Formato')[0];
    fireEvent.change(formatSelect, { target: { value: 'Reel' } });
    const nameInput = screen.getByLabelText('Nome do Segmento (Opcional)');
    fireEvent.change(nameInput, {target: { value: 'Reels Test'}});

    const compareButton = screen.getByText('Comparar Segmentos');
    expect(compareButton).not.toBeDisabled();

    fireEvent.click(compareButton);

    // CORREÇÃO: Verifica o texto de carregamento correto no botão
    expect(screen.getByText('A comparar...')).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/api/admin/dashboard/content-segments/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRange: mockDateRange,
        segments: [
          { name: 'Reels Test', criteria: { format: 'Reel' } }
        ],
      }),
    });
  });

  describe('Results Display', () => {
    test('shows loading state during fetch', async () => {
        (fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
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
        expect(await screen.findByText('Erro ao comparar segmentos')).toBeInTheDocument();
        expect(await screen.findByText('API comparison failed')).toBeInTheDocument();
    });

    test('renders comparison table with data and highlights best values', async () => {
      render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);
      
      fireEvent.change(screen.getAllByLabelText('Formato')[0], { target: { value: 'Reel' } });
      fireEvent.change(screen.getAllByLabelText('Contexto')[0], { target: { value: 'Tech' } });

      fireEvent.click(screen.getByText('Adicionar Segmento'));
      fireEvent.change(screen.getAllByLabelText('Formato')[1], { target: { value: 'Post Estático' } });
      fireEvent.change(screen.getAllByLabelText('Contexto')[1], { target: { value: 'Finanças' } });

      fireEvent.click(screen.getByText('Comparar Segmentos'));

      await waitFor(() => expect(screen.getByText('Segment 1: Reels de Tech')).toBeInTheDocument());
      expect(screen.getByText('Segment 2: Posts de Finanças')).toBeInTheDocument();

      expect(screen.getByText('Nº de Posts')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('70')).toBeInTheDocument();

      expect(screen.getByText('Taxa de Engaj. Média')).toBeInTheDocument();
      expect(screen.getByText('5,0%')).toBeInTheDocument();
      expect(screen.getByText('7,0%')).toBeInTheDocument();

      const segment2EngagementCell = screen.getByText('7,0%').closest('td');
      expect(segment2EngagementCell).toHaveClass('font-bold text-green-600 dark:text-green-400');

      const segment1EngagementCell = screen.getByText('5,0%').closest('td');
      expect(segment1EngagementCell).not.toHaveClass('font-bold text-green-600 dark:text-green-400');
      
      expect(screen.getByText('(Reel / Tech)')).toBeInTheDocument();
    });
  });

  test('clears results if dateRangeFilter becomes incomplete', async () => {
    const { rerender } = render(<ContentSegmentComparison dateRangeFilter={mockDateRange} />);
    
    fireEvent.change(screen.getAllByLabelText('Formato')[0], { target: { value: 'Video' } });
    fireEvent.click(screen.getByText('Comparar Segmentos'));
    await waitFor(() => expect(screen.getByText('(Video)')).toBeInTheDocument());

    rerender(<ContentSegmentComparison dateRangeFilter={{ startDate: mockDateRange.startDate, endDate: undefined }} />);
    
    expect(screen.queryByText('(Video)')).not.toBeInTheDocument();
    expect(screen.getByText(/Por favor, selecione um período de datas nos filtros globais/)).toBeInTheDocument();
  });

});
