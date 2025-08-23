import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import BillingPanel from '@/app/dashboard/billing/BillingPanel';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/app/components/ui/ToastA11yProvider', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('date-fns', () => ({
  format: (date: Date) => {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  },
}));

jest.mock('date-fns/format', () => ({
  __esModule: true,
  default: (date: Date) => {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  },
}));

describe('BillingPanel', () => {
  const mockFetch = (data: any) => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => data,
    });
  };

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows trial end date and cancel option while trialing', async () => {
    const expires = '2030-01-15T00:00:00.000Z';
    mockFetch({
      planStatus: 'trialing',
      planInterval: 'month',
      planExpiresAt: expires,
      cancelAt: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      lastPaymentError: null,
    });

    render(<BillingPanel />);

    const info = await screen.findByText(/Período de teste.*termina em 15\/01\/2030/);
    expect(info).toBeInTheDocument();

    expect(await screen.findByRole('button', { name: 'Cancelar pagamento' })).toBeInTheDocument();
  });

  it('shows non renewing status and reactivate option', async () => {
    const expires = '2030-02-20T00:00:00.000Z';
    mockFetch({
      planStatus: 'non_renewing',
      planInterval: 'month',
      planExpiresAt: expires,
      cancelAt: expires,
      stripeSubscriptionId: 'sub_123',
      stripePriceId: 'price_123',
      lastPaymentError: null,
    });

    render(<BillingPanel />);

    const info = await screen.findByText(/Cancelado ao fim do período.*acesso até 20\/02\/2030/);
    expect(info).toBeInTheDocument();

    expect(await screen.findByRole('button', { name: 'Reativar' })).toBeInTheDocument();
  });
});
