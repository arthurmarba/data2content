import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PlanCardPro from '@/components/billing/PlanCardPro';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

describe('PlanCardPro', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows next cycle amount when total is zero', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total: 0, nextCycleAmount: 4990, currency: 'BRL' }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ total: 0, nextCycleAmount: 4990 }),
      });

    render(<PlanCardPro defaultCurrency="BRL" />);

    await waitFor(() => {
      expect(screen.getByText(/R\$\s*49,90/)).toBeInTheDocument();
    });
  });
});
