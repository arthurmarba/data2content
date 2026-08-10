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
  /** false para acessos Pro internos/manuais sem assinatura recorrente na Stripe. */
  billingManagedByStripe?: boolean;
};

export function subscriptionFallbackFromPlanStatus(payload: any): SubResp | null {
  if (!payload?.ok) return null;
  const normalizedStatus = String(payload?.extras?.normalizedStatus ?? payload?.status ?? "").toLowerCase();
  const hasPremiumAccess = Boolean(payload?.extras?.hasPremiumAccess);
  if (!hasPremiumAccess) return null;

  const status =
    normalizedStatus === "non_renewing"
      ? "non_renewing"
      : normalizedStatus === "active" || normalizedStatus === "trialing"
        ? normalizedStatus
        : "active";

  return {
    planName: "Pro",
    currency: "BRL",
    nextInvoiceAmountCents: 0,
    nextInvoiceDate: payload?.planExpiresAt ?? null,
    currentPeriodEnd: payload?.planExpiresAt ?? null,
    status,
    cancelAtPeriodEnd: Boolean(payload?.cancelAtPeriodEnd),
    paymentMethodLast4: null,
    defaultPaymentMethodBrand: null,
    trialEnd: payload?.trial?.expiresAt ?? null,
    billingManagedByStripe: false,
  };
}

async function fetchPlanStatusFallback(): Promise<SubResp | null> {
  const response = await fetch("/api/plan/status", { cache: "no-store", credentials: "include" });
  if (!response.ok) return null;
  return subscriptionFallbackFromPlanStatus(await response.json().catch(() => null));
}

const fetcher = async (u: string): Promise<SubResp | null> => {
  const response = await fetch(u, { cache: "no-store", credentials: "include" });
  if (response.status === 204 || response.status === 404) {
    return fetchPlanStatusFallback();
  }
  if (!response.ok) throw new Error("fail");
  return { ...(await response.json()), billingManagedByStripe: true } as SubResp;
};

export function useSubscription() {
  const { data, error, isLoading, mutate } = useSWR<SubResp | null>(
    '/api/billing/subscription',
    fetcher,
    { revalidateOnFocus: false }
  );
  return { subscription: data, error, isLoading, refresh: () => mutate() };
}
