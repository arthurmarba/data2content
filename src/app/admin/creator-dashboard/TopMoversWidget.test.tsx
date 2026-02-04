import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { cache } from 'swr/_internal';
import '@testing-library/jest-dom';
import TopMoversWidget from './TopMoversWidget';
import { GlobalTimePeriodProvider } from './components/filters/GlobalTimePeriodContext';
import { ITopMoverResult } from '@/app/lib/dataService/marketAnalysisService';

global.fetch = jest.fn();

const mockData: ITopMoverResult[] = [
  { entityId: '1', entityName: 'Post A', metricName: 'cumulativeLikes', previousValue: 10, currentValue: 20, absoluteChange: 10, percentageChange: 1 },
];

const renderWidget = () =>
  render(
    <GlobalTimePeriodProvider>
      <TopMoversWidget />
    </GlobalTimePeriodProvider>
  );

describe('TopMoversWidget', () => {
  beforeEach(() => {
    cache.clear();
    (fetch as jest.Mock).mockClear();
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => mockData });
  });

  test('fetches data on mount', async () => {
    renderWidget();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  test('changes trigger automatic fetch', async () => {
    renderWidget();
    const metricSelect = screen.getByLabelText('Métrica');
    const initialCalls = (fetch as jest.Mock).mock.calls.length;
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockData });
    fireEvent.change(metricSelect, { target: { value: 'cumulativeShares' } });
    await waitFor(() => expect((fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initialCalls));
  });
});
