import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreatorsScatterPlot from './CreatorsScatterPlot';

// Mock Recharts components
const ReactLib = require('react');

jest.mock('recharts', () => {
  const Original = jest.requireActual('recharts');
  return {
    ...Original,
    ResponsiveContainer: (props: any) => ReactLib.createElement('div', { ...props, 'data-testid': 'responsive-container' }),
    ScatterChart: (props: any) => ReactLib.createElement('div', { ...props, 'data-testid': 'scatter-chart' }),
    Scatter: (props: any) => ReactLib.createElement('div', { ...props, 'data-testid': 'scatter' }),
    XAxis: (props: any) => ReactLib.createElement('div', { ...props, 'data-testid': 'xaxis' }),
    YAxis: (props: any) => ReactLib.createElement('div', { ...props, 'data-testid': 'yaxis' }),
    CartesianGrid: (props: any) => ReactLib.createElement('div', { ...props, 'data-testid': 'grid' }),
    Tooltip: (props: any) => ReactLib.createElement('div', { ...props, 'data-testid': 'tooltip' }),
    Legend: (props: any) => ReactLib.createElement('div', { ...props, 'data-testid': 'legend' }),
  };
});

// Mock CreatorSelector to immediately select a creator
jest.mock('./CreatorSelector', () => ({
  __esModule: true,
  default: (props: any) => {
    if (!props.isOpen) return null;
    return (
      <div data-testid="selector-mock">
        <button onClick={() => props.onSelect({ id: '1', name: 'Teste' })}>Select</button>
      </div>
    );
  },
}));

global.fetch = jest.fn();

describe('CreatorsScatterPlot Component', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        plotData: [{ id: '1', label: 'A', x: 1, y: 1 }],
        xAxisMetricLabel: 'X',
        yAxisMetricLabel: 'Y',
      }),
    });
  });

  test('renders and triggers fetch on generate', async () => {
    render(<CreatorsScatterPlot />);
    fireEvent.click(screen.getByText('Adicionar Criadores'));
    fireEvent.click(screen.getByText('Select'));
    fireEvent.click(screen.getByText('Gerar Gráfico'));

    await waitFor(() =>
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    );
    expect(screen.getByTestId('scatter-chart')).toBeInTheDocument();
  });
});
