export function buildCheckoutUrl(clientSecret: string, subscriptionId?: string | null) {
  const params = new URLSearchParams({ cs: clientSecret });
  if (subscriptionId) params.set("sid", subscriptionId);
  return `/dashboard/billing/checkout?${params.toString()}`;
}
