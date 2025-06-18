import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopMoversWidget from './TopMoversWidget';
import { ITopMoverResult } from '@/app/lib/dataService/marketAnalysisService';

// Mock global fetch
global.fetch = jest.fn();

jest.mock('@heroicons/react/24/outline', () => ({
  ArrowUpIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'arrow-up-icon' }),
  ArrowDownIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'arrow-down-icon' }),
  ExclamationTriangleIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'exclamation-icon' }),
  ChartBarIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'chartbar-icon' }),
}));

const mockTopMoversData: ITopMoverResult[] = [
  { entityId: 'post1', entityName: 'Amazing Post Alpha', metricName: 'cumulativeLikes', previousValue: 100, currentValue: 150, absoluteChange: 50, percentageChange: 0.5 },
  { entityId: 'post2', entityName: 'Brilliant Post Beta', metricName: 'cumulativeLikes', previousValue: 200, currentValue: 50, absoluteChange: -150, percentageChange: -0.75 },
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
    expect(screen.getByLabelText('Métrica')).toHaveValue('cumulativeViews');
    expect(screen.getByLabelText('Ordenar Por')).toHaveValue('absoluteChange_decrease');
    expect(screen.getByLabelText('Top N')).toHaveValue(10);

    expect(screen.getByText('Analisar Top Movers')).toBeInTheDocument();
  });

  test('updates internal state on parameter change', () => {
    render(<TopMoversWidget />);
    const metricSelect = screen.getByLabelText('Métrica') as HTMLSelectElement;
    fireEvent.change(metricSelect, { target: { value: 'cumulativeShares' } });
    expect(metricSelect.value).toBe('cumulativeShares');

    const topNInput = screen.getByLabelText('Top N') as HTMLInputElement;
    fireEvent.change(topNInput, { target: { value: '5' } });
    expect(topNInput.value).toBe('5');
  });

  test('"Analisar" button text changes and is enabled when "creator" entityType is selected and dates are valid', () => {
    render(<TopMoversWidget />);
    const entitySelect = screen.getByLabelText('Entidade');
    fireEvent.change(entitySelect, { target: { value: 'creator' } });

    // Set valid dates to enable the button
    fireEvent.change(screen.getByLabelText('Início', { selector: '#tm-prevStart' }), { target: { value: '2023-01-01' } });
    fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-prevEnd' }), { target: { value: '2023-01-15' } });
    fireEvent.change(screen.getByLabelText('Início', { selector: '#tm-currStart' }), { target: { value: '2023-01-16' } });
    fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-currEnd' }), { target: { value: '2023-01-31' } });

    const analyzeButton = screen.getByText('Analisar Top Criadores'); // Text should change
    expect(analyzeButton).not.toBeDisabled();
  });

  test('contentFilters UI is hidden when entityType is "creator"', () => {
    render(<TopMoversWidget />);
    const entitySelect = screen.getByLabelText('Entidade');

    // Initially, content filters should be visible
    expect(screen.getByLabelText('Formato (Conteúdo)')).toBeVisible();
    expect(screen.getByLabelText('Contexto (Conteúdo)')).toBeVisible();

    fireEvent.change(entitySelect, { target: { value: 'creator' } }); // Switch to creator

    expect(screen.queryByLabelText('Formato (Conteúdo)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Contexto (Conteúdo)')).not.toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText('Métrica'), { target: { value: 'cumulativeShares' } });
    fireEvent.change(screen.getByLabelText('Formato (Conteúdo)'), { target: { value: 'Reel' } });

    fireEvent.click(screen.getByText('Analisar Top Movers'));

    expect(screen.getByText('Analisando...')).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/api/admin/dashboard/top-movers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'content',
        metric: 'cumulativeShares',
        previousPeriod: { startDate: new Date('2023-01-01T00:00:00.000Z'), endDate: new Date('2023-01-15T00:00:00.000Z') },
        currentPeriod: { startDate: new Date('2023-01-16T00:00:00.000Z'), endDate: new Date('2023-01-31T00:00:00.000Z') },
        topN: 10,
        sortBy: 'absoluteChange_decrease',
        contentFilters: { format: 'Reel' },
      }),
    });
  });

  test('calls fetch with entityType "creator" and undefined contentFilters/creatorFilters (as no UI for them)', async () => {
    render(<TopMoversWidget />);
    fireEvent.change(screen.getByLabelText('Entidade'), { target: { value: 'creator' } });
    fireEvent.change(screen.getByLabelText('Início', { selector: '#tm-prevStart' }), { target: { value: '2023-01-01' } });
    fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-prevEnd' }), { target: { value: '2023-01-15' } });
    fireEvent.change(screen.getByLabelText('Início', { selector: '#tm-currStart' }), { target: { value: '2023-01-16' } });
    fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-currEnd' }), { target: { value: '2023-01-31' } });

    fireEvent.click(screen.getByText('Analisar Top Criadores'));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/api/admin/dashboard/top-movers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expect.objectContaining({
        entityType: 'creator',
        contentFilters: undefined, // Explicitly check it's not sent or is undefined
        creatorFilters: undefined, // Explicitly check it's not sent or is undefined
      })),
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
      expect(aliceRow).toHaveTextContent('100');
      expect(aliceRow).toHaveTextContent('150');
      expect(aliceRow).toHaveTextContent('50');
      expect(aliceRow).toHaveTextContent('50,0%');
      expect(aliceRow?.querySelector('[data-testid="arrow-up-icon"]')).toBeInTheDocument();
      expect(aliceRow?.querySelector('[data-testid="arrow-down-icon"]')).not.toBeInTheDocument();
      const absChangeCellAlice = Array.from(aliceRow!.querySelectorAll('td')).find(td => td.textContent?.includes('50') && !td.textContent.includes('%'));
      expect(absChangeCellAlice).toHaveClass('text-green-600');


      // Check values for Bob (decrease)
      const bobRow = screen.getByText('Brilliant Post Beta').closest('tr');
      expect(bobRow).toHaveTextContent('200');
      expect(bobRow).toHaveTextContent('50');
      expect(bobRow).toHaveTextContent('-150');
      expect(bobRow).toHaveTextContent('-75,0%');
      expect(bobRow?.querySelector('[data-testid="arrow-down-icon"]')).toBeInTheDocument();
      expect(bobRow?.querySelector('[data-testid="arrow-up-icon"]')).not.toBeInTheDocument();
      const absChangeCellBob = Array.from(bobRow!.querySelectorAll('td')).find(td => td.textContent?.includes('-150'));
      expect(absChangeCellBob).toHaveClass('text-red-600');
    });

    test('renders creator results with profile picture placeholder', async () => {
        const creatorMockData: ITopMoverResult[] = [
            { entityId: 'creator1', entityName: 'Creator Gamma', metricName: 'cumulativeViews', previousValue: 1000, currentValue: 2000, absoluteChange: 1000, percentageChange: 1, profilePictureUrl: undefined },
            { entityId: 'creator2', entityName: 'Creator Delta', metricName: 'cumulativeViews', previousValue: 500, currentValue: 1500, absoluteChange: 1000, percentageChange: 2, profilePictureUrl: 'delta.jpg' },
        ];
        (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => creatorMockData });

        render(<TopMoversWidget />);
        fireEvent.change(screen.getByLabelText('Entidade'), { target: { value: 'creator' } });
        fireEvent.change(screen.getByLabelText('Início', { selector: '#tm-prevStart' }), { target: { value: '2023-01-01' } });
        fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-prevEnd' }), { target: { value: '2023-01-15' } });
        fireEvent.change(screen.getByLabelText('Início', { selector: '#tm-currStart' }), { target: { value: '2023-01-16' } });
        fireEvent.change(screen.getByLabelText('Fim', { selector: '#tm-currEnd' }), { target: { value: '2023-01-31' } });
        fireEvent.click(screen.getByText('Analisar Top Criadores'));

        await waitFor(() => expect(screen.getByText('Creator Gamma')).toBeInTheDocument());
        const gammaRow = screen.getByText('Creator Gamma').closest('tr');
        expect(gammaRow?.querySelector('.bg-gray-200')).toHaveTextContent('C'); // Placeholder initial

        expect(screen.getByText('Creator Delta')).toBeInTheDocument();
        const deltaRow = screen.getByText('Creator Delta').closest('tr');
        expect(deltaRow?.querySelector('img[alt="Creator Delta"]')).toBeInTheDocument();
    });

    test('shows initial prompt before any analysis', () => {
        render(<TopMoversWidget />);
        expect(screen.getByText('Configure os parâmetros e clique em "Analisar Top Movers".')).toBeInTheDocument();
    });
  });
});
