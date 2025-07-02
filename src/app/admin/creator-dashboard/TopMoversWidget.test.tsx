import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopMoversWidget from './TopMoversWidget';
import { GlobalTimePeriodProvider } from './components/filters/GlobalTimePeriodContext';
import { ITopMoverResult } from '@/app/lib/dataService/marketAnalysisService';

// Mock icons
jest.mock('@heroicons/react/24/outline', () => ({
  ArrowUpIcon: (props: any) => <div data-testid="arrow-up-icon" {...props} />, 
  ArrowDownIcon: (props: any) => <div data-testid="arrow-down-icon" {...props} />,
  ChartBarIcon: (props: any) => <div data-testid="chartbar-icon" {...props} />,
  ArrowsUpDownIcon: (props: any) => <div data-testid="arrows-icon" {...props} />,
}));

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
    (fetch as jest.Mock).mockClear();
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => mockData });
  });

  test('fetches data on mount', async () => {
    renderWidget();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('changes trigger automatic fetch', async () => {
    renderWidget();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const metricSelect = screen.getByLabelText('Métrica');
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockData });
    fireEvent.change(metricSelect, { target: { value: 'cumulativeShares' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});
