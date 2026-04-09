export type BillingPlan = "monthly" | "annual";
export type BillingCurrency = "BRL" | "USD";

export type BillingPriceResponseItem = {
  plan: BillingPlan;
  currency: BillingCurrency;
  unitAmount: number | null;
  recurring: "month" | "year" | null;
  priceId: string | null;
  displayCurrency: BillingCurrency;
};

export type BillingPricesShape = {
  monthly: { brl: number; usd: number };
  annual: { brl: number; usd: number };
};

export function emptyBillingPricesShape(): BillingPricesShape {
  return {
    monthly: { brl: 0, usd: 0 },
    annual: { brl: 0, usd: 0 },
  };
}

export function pricesShapeFromItems(
  items: Array<Pick<BillingPriceResponseItem, "plan" | "currency" | "unitAmount"> | null | undefined>,
): BillingPricesShape {
  const byKey = emptyBillingPricesShape();

  for (const item of items) {
    const plan = String(item?.plan || "").toLowerCase();
    const currency = String(item?.currency || "").toUpperCase();
    const value = typeof item?.unitAmount === "number" ? item.unitAmount / 100 : 0;

    if (plan === "monthly" && (currency === "BRL" || currency === "USD")) {
      byKey.monthly[currency.toLowerCase() as "brl" | "usd"] = value;
    }

    if (plan === "annual" && (currency === "BRL" || currency === "USD")) {
      byKey.annual[currency.toLowerCase() as "brl" | "usd"] = value;
    }
  }

  return byKey;
}
