import useSWR from 'swr';

export type SubResp = {
  planName: string;
  currency: string;
  nextInvoiceAmountCents: number;
  nextInvoiceDate: string | null;
  currentPeriodEnd: string | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  paymentMethodLast4?: string | null;
  defaultPaymentMethodBrand?: string | null;
  trialEnd?: string | null;
};

const fetcher = (u: string) =>
  fetch(u, { cache: 'no-store' }).then(async r => {
    if (r.status === 204) return null;
    if (!r.ok) throw new Error('fail');
    return r.json();
  });

export function useSubscription() {
  const { data, error, isLoading, mutate } = useSWR<SubResp | null>(
    '/api/billing/subscription',
    fetcher,
    { revalidateOnFocus: false }
  );
  return { subscription: data, error, isLoading, refresh: () => mutate() };
}
