import useSWR from 'swr';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'canceled';

export interface SubscriptionInfo {
  planName: string;
  currency: string;
  nextInvoiceAmountCents?: number;
  nextInvoiceDate?: string;
  currentPeriodEnd?: string;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  paymentMethodLast4?: string | null;
  defaultPaymentMethodBrand?: string | null;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function useSubscription() {
  const { data, error, mutate } = useSWR<SubscriptionInfo>(
    '/api/billing/subscription',
    fetcher
  );
  return {
    subscription: data,
    loading: !data && !error,
    error,
    refresh: mutate,
  };
}
