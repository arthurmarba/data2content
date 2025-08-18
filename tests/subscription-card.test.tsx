import React from 'react';
import { render, screen } from '@testing-library/react';
import SubscriptionCard from '@/components/billing/SubscriptionCard';

const mockUseSubscription = jest.fn();
jest.mock('@/hooks/billing/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ update: jest.fn() }),
}));

jest.mock('@/components/billing/CancelSubscriptionModal', () => () => <div />);
jest.mock('@/components/billing/ReactivateBanner', () => () => <div />);

describe('SubscriptionCard', () => {
  const baseSubscription = {
    planName: 'Pro',
    cancelAtPeriodEnd: false,
    nextInvoiceDate: new Date().toISOString(),
    nextInvoiceAmountCents: 5000,
    currency: 'BRL',
    paymentMethodLast4: '1234',
    defaultPaymentMethodBrand: 'Visa',
    status: 'active',
    currentPeriodEnd: new Date().toISOString(),
  };

  it('does not show next charge when subscription is set to cancel', () => {
    mockUseSubscription.mockReturnValue({
      subscription: { ...baseSubscription, cancelAtPeriodEnd: true },
      error: null,
      isLoading: false,
      refresh: jest.fn(),
    });
    render(<SubscriptionCard />);
    expect(screen.queryByText(/Próxima cobrança/)).not.toBeInTheDocument();
  });

  it('shows next charge when subscription is active', () => {
    mockUseSubscription.mockReturnValue({
      subscription: { ...baseSubscription, cancelAtPeriodEnd: false },
      error: null,
      isLoading: false,
      refresh: jest.fn(),
    });
    render(<SubscriptionCard />);
    expect(screen.getByText(/Próxima cobrança/)).toBeInTheDocument();
  });
});
