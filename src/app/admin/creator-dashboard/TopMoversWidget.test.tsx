import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopMoversWidget from './TopMoversWidget';
import { ITopMoverResult } from '@/app/lib/dataService/marketAnalysisService';

// Mock global fetch
global.fetch = jest.fn();

// Mock Heroicons
const React = require('react'); // Import React for creating elements if needed in mocks

jest.mock('@heroicons/react/24/outline', () => ({
  ArrowUpIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'arrow-up-icon' }),
  ArrowDownIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'arrow-down-icon' }),
  ExclamationTriangleIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'exclamation-icon' }),
  ChartBarIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'chartbar-icon' }),
}));

const mockTopMoversData: ITopMoverResult[] = [
  { entityId: 'post1', entityName: 'Amazing Post Alpha', metricName: 'cumulative_likes', previousValue: 100, currentValue: 150, absoluteChange: 50, percentageChange: 0.5 },
  { entityId: 'post2', entityName: 'Brilliant Post Beta', metricName: 'cumulative_likes', previousValue: 200, currentValue: 50, absoluteChange: -150, percentageChange: -0.75 },
];

describe('TopMoversWidget Component', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    (fetch as jest.Mock).mockResolvedValue({ // Default successful fetch
      ok: true,
      json: async () => mockTopMoversData,
    });
  });

  test('renders initial structure and default parameter values', () => {
    render(<TopMoversWidget />);
    expect(screen.getByText(/Top Movers \(Conteúdo\)/)).toBeInTheDocument(); // Title checks default entity

    // Check default values of some select elements
    expect(screen.getByLabelText('Entidade')).toHaveValue('content');
    expect(screen.getByLabelText('Métrica')).toHaveValue('cumulative_views');
    expect(screen.getByLabelText('Ordenar Por')).toHaveValue('absoluteChange_decrease');
    expect(screen.getByLabelText('Top N')).toHaveValue(10);

    expect(screen.getByText('Analisar Top Movers')).toBeInTheDocument();
  });

  test('updates internal state on parameter change', () => {
    render(<TopMoversWidget />);
    const metricSelect = screen.getByLabelText('Métrica') as HTMLSelectElement;
    fireEvent.change(metricSelect, { target: { value: 'cumulative_shares' } });
    expect(metricSelect.value).toBe('cumulative_shares');

    const topNInput = screen.getByLabelText('Top N') as HTMLInputElement;
    fireEvent.change(topNInput, { target: { value: '5' } });
    expect(topNInput.value).toBe('5');
  });

  test('"Analisar" button is disabled if entityType is "creator"', () => {
    render(<TopMoversWidget />);
    const entitySelect = screen.getByLabelText('Entidade');
    fireEvent.change(entitySelect, { target: { value: 'creator' } }); // Switch to creator

    const analyzeButton = screen.getByText('Analisar Top Movers');
    expect(analyzeButton).toBeDisabled();
    // Also check if error message about creator not implemented is shown upon trying to analyze (covered in fetch test)
  });

  test('date validation: shows error if previous period ends after current period starts', () => {
    render(<TopMoversWidget />);
    const prevEndDateInput = screen.getByLabelText('Fim', { selector: '#tm-prevEnd' });
    const currStartDateInput = screen.getByLabelText('Início', { selector: '#tm-currStart' });

    fireEvent.change(prevEndDateInput, { target: { value: '2023-02-15' } });
    fireEvent.change(currStartDateInput, { target: { value: '2023-02-01' } });

    // Fill other dates to make them valid initially
    fireEvent.change(screen.getByLabelText('Início', { selector: '#tm-prevStart' }), { target: { value: '2023-01-01' } });
    fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-currEnd' }), { target: { value: '2023-02-28' } });

    const analyzeButton = screen.getByText('Analisar Top Movers');
    fireEvent.click(analyzeButton); // Attempt to analyze

    expect(screen.getByText('O período anterior deve terminar antes do início do período atual.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('date validation: shows error if any date field is empty', () => {
    render(<TopMoversWidget />);
    // Leave one date field empty, e.g. previousPeriod.startDate
    fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-prevEnd' }), { target: { value: '2023-01-31' } });
    fireEvent.change(screen.getByLabelText('Início', { selector: '#tm-currStart' }), { target: { value: '2023-02-01' } });
    fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-currEnd' }), { target: { value: '2023-02-28' } });

    const analyzeButton = screen.getByText('Analisar Top Movers');
    fireEvent.click(analyzeButton);
    expect(screen.getByText('Todos os campos de data são obrigatórios.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });


  test('calls fetch on "Analisar" click with correct payload for content', async () => {
    render(<TopMoversWidget />);

    // Set valid dates
    fireEvent.change(screen.getByLabelText('Início', { selector: '#tm-prevStart' }), { target: { value: '2023-01-01' } });
    fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-prevEnd' }), { target: { value: '2023-01-15' } });
    fireEvent.change(screen.getByLabelText('Início', { selector: '#tm-currStart' }), { target: { value: '2023-01-16' } });
    fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-currEnd' }), { target: { value: '2023-01-31' } });

    // Select metric and other params
    fireEvent.change(screen.getByLabelText('Métrica'), { target: { value: 'cumulative_shares' } });
    fireEvent.change(screen.getByLabelText('Formato (Conteúdo)'), { target: { value: 'Reel' } });

    fireEvent.click(screen.getByText('Analisar Top Movers'));

    expect(screen.getByText('Analisando...')).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/api/admin/dashboard/top-movers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'content',
        metric: 'cumulative_shares',
        previousPeriod: { startDate: new Date('2023-01-01T00:00:00.000Z'), endDate: new Date('2023-01-15T00:00:00.000Z') }, // Dates will be full Date objects
        currentPeriod: { startDate: new Date('2023-01-16T00:00:00.000Z'), endDate: new Date('2023-01-31T00:00:00.000Z') },
        topN: 10, // Default
        sortBy: 'absoluteChange_decrease', // Default
        contentFilters: { format: 'Reel' }, // Context would be undefined
      }),
    });
  });

  describe('Results Display', () => {
    const setupAndFetch = async () => {
        render(<TopMoversWidget />);
        fireEvent.change(screen.getByLabelText('Início', { selector: '#tm-prevStart' }), { target: { value: '2023-01-01' } });
        fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-prevEnd' }), { target: { value: '2023-01-15' } });
        fireEvent.change(screen.getByLabelText('Início', { selector: '#tm-currStart' }), { target: { value: '2023-01-16' } });
        fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-currEnd' }), { target: { value: '2023-01-31' } });
        fireEvent.click(screen.getByText('Analisar Top Movers'));
        await screen.findByText('Analisando...'); // Wait for loading state
        await waitFor(() => expect(screen.queryByText('Analisando...')).not.toBeInTheDocument()); // Wait for fetch to complete
    };

    test('displays loading state during fetch', async () => {
      (fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {})); // Infinite load
      render(<TopMoversWidget />);
      fireEvent.change(screen.getByLabelText('Início', { selector: '#tm-prevStart' }), { target: { value: '2023-01-01' } });
      fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-prevEnd' }), { target: { value: '2023-01-15' } });
      fireEvent.change(screen.getByLabelText('Início', { selector: '#tm-currStart' }), { target: { value: '2023-01-16' } });
      fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-currEnd' }), { target: { value: '2023-01-31' } });
      fireEvent.click(screen.getByText('Analisar Top Movers'));
      expect(await screen.findByText('Buscando Top Movers...')).toBeInTheDocument();
    });

    test('displays error message on fetch failure', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('API TopMovers failed'));
      await setupAndFetch();
      expect(await screen.findByText('Erro ao buscar dados: API TopMovers failed')).toBeInTheDocument();
    });

    test('displays "no movers found" message for empty results', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [] });
      await setupAndFetch();
      expect(await screen.findByText('Nenhum "mover" encontrado para os critérios e períodos selecionados.')).toBeInTheDocument();
    });

    test('renders results table with data, icons, and colors', async () => {
      await setupAndFetch();
      expect(screen.getByText('Amazing Post Alpha')).toBeInTheDocument();
      expect(screen.getByText('Brilliant Post Beta')).toBeInTheDocument();

      // Check values for Alice (increase)
      const aliceRow = screen.getByText('Amazing Post Alpha').closest('tr');
      expect(aliceRow).toHaveTextContent('100'); // Prev
      expect(aliceRow).toHaveTextContent('150'); // Curr
      expect(aliceRow).toHaveTextContent('50');  // Abs Change
      expect(aliceRow).toHaveTextContent('50,0%'); // Pct Change
      expect(aliceRow?.querySelector('[data-testid="arrow-up"]')).toBeInTheDocument();
      expect(aliceRow?.querySelector('[data-testid="arrow-down"]')).not.toBeInTheDocument();
      const absChangeCellAlice = Array.from(aliceRow!.querySelectorAll('td')).find(td => td.textContent?.includes('50') && !td.textContent.includes('%'));
      expect(absChangeCellAlice).toHaveClass('text-green-600');


      // Check values for Bob (decrease)
      const bobRow = screen.getByText('Brilliant Post Beta').closest('tr');
      expect(bobRow).toHaveTextContent('200'); // Prev
      expect(bobRow).toHaveTextContent('50');  // Curr
      expect(bobRow).toHaveTextContent('-150'); // Abs Change
      expect(bobRow).toHaveTextContent('-75,0%'); // Pct Change
      expect(bobRow?.querySelector('[data-testid="arrow-down"]')).toBeInTheDocument();
      expect(bobRow?.querySelector('[data-testid="arrow-up"]')).not.toBeInTheDocument();
      const absChangeCellBob = Array.from(bobRow!.querySelectorAll('td')).find(td => td.textContent?.includes('-150'));
      expect(absChangeCellBob).toHaveClass('text-red-600');
    });

    test('shows initial prompt before any analysis', () => {
        render(<TopMoversWidget />);
        expect(screen.getByText('Configure os parâmetros e clique em "Analisar Top Movers".')).toBeInTheDocument();
    });
  });
});
