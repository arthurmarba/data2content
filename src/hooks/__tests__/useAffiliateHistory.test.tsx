import { renderHook, act, waitFor } from '@testing-library/react';
import { useAffiliateHistory, HistoryResponse } from '../useAffiliateHistory';

describe('useAffiliateHistory', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn().mockImplementation((url: string) => {
      const u = new URL(url, 'http://localhost');
      const cursor = u.searchParams.get('cursor');
      const page: HistoryResponse = {
        items: [{ id: cursor || 'first', currency: 'BRL', amountCents: 100, status: 'pending', createdAt: new Date().toISOString() }],
        nextCursor: cursor ? null : 'next',
      };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(page) });
    });
  });

  test('builds query with filters', async () => {
    const { result } = renderHook(() =>
      useAffiliateHistory({ statuses: ['pending'], currencies: ['BRL'], limit: 1 })
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect((global as any).fetch).toHaveBeenCalledWith('/api/affiliate/history?statuses=pending&currencies=BRL&limit=1');
  });

  test('loads more pages', async () => {
    const { result } = renderHook(() => useAffiliateHistory());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => {
      await result.current.loadMore();
    });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
  });
});
