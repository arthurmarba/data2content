import "server-only";

import { stripe } from "@/app/lib/stripe";
import { ANNUAL_MONTHLY_PRICE, MONTHLY_PRICE } from "@/config/pricing.config";

import {
  BillingCurrency,
  BillingPlan,
  BillingPriceResponseItem,
  BillingPricesShape,
  pricesShapeFromItems,
} from "./pricesShape";

function entries<T extends string>(o: Record<T, string | undefined>) {
  return Object.entries(o) as [T, string | undefined][];
}

function normalizeRecurringInterval(
  interval: string | null | undefined,
): BillingPriceResponseItem["recurring"] {
  return interval === "month" || interval === "year" ? interval : null;
}

function fallbackPriceFor(plan: BillingPlan, currency: BillingCurrency): BillingPriceResponseItem {
  const fallbackUsdMonthly = Number(process.env.MONTHLY_PLAN_PRICE_USD ?? 19.4);
  const fallbackUsdAnnual = Number(process.env.ANNUAL_PLAN_YEAR_PRICE_USD ?? 179);

  if (currency === "BRL") {
    if (plan === "monthly") {
      return {
        plan,
        currency,
        unitAmount: Math.round(MONTHLY_PRICE * 100),
        recurring: "month",
        priceId: null,
        displayCurrency: currency,
      };
    }

    return {
      plan,
      currency,
      unitAmount: Math.round(ANNUAL_MONTHLY_PRICE * 12 * 100),
      recurring: "year",
      priceId: null,
      displayCurrency: currency,
    };
  }

  if (plan === "monthly") {
    return {
      plan,
      currency,
      unitAmount: Math.round(fallbackUsdMonthly * 100),
      recurring: "month",
      priceId: null,
      displayCurrency: currency,
    };
  }

  return {
    plan,
    currency,
    unitAmount: Math.round(fallbackUsdAnnual * 100),
    recurring: "year",
    priceId: null,
    displayCurrency: currency,
  };
}

export function fallbackBillingPrices(): BillingPriceResponseItem[] {
  return [
    fallbackPriceFor("monthly", "BRL"),
    fallbackPriceFor("annual", "BRL"),
    fallbackPriceFor("monthly", "USD"),
    fallbackPriceFor("annual", "USD"),
  ];
}

export async function resolveBillingPrices(): Promise<BillingPriceResponseItem[]> {
  const priceIds: Record<`${BillingPlan}_${BillingCurrency}`, string | undefined> = {
    monthly_BRL: process.env.STRIPE_PRICE_MONTHLY_BRL,
    annual_BRL: process.env.STRIPE_PRICE_ANNUAL_BRL,
    monthly_USD: process.env.STRIPE_PRICE_MONTHLY_USD,
    annual_USD: process.env.STRIPE_PRICE_ANNUAL_USD,
  };
  const priceEntries = entries(priceIds);

  const results = await Promise.allSettled(
    priceEntries.map(async ([key, id]) => {
      const [plan, currency] = key.split("_") as [BillingPlan, BillingCurrency];
      if (!id) return fallbackPriceFor(plan, currency);
      const price = await stripe.prices.retrieve(id);
      return {
        plan,
        currency,
        unitAmount: price.unit_amount ?? null,
        recurring: normalizeRecurringInterval(price.recurring?.interval),
        priceId: price.id,
        displayCurrency: (price.currency || currency).toUpperCase() as BillingCurrency,
      } satisfies BillingPriceResponseItem;
    }),
  );

  return priceEntries.map(([key], index) => {
    const [plan, currency] = key.split("_") as [BillingPlan, BillingCurrency];
    const result = results[index];

    if (!result) {
      return fallbackPriceFor(plan, currency);
    }

    if (result.status === "fulfilled") {
      return result.value;
    }

    console.error("[billing/prices] falling back after stripe error:", {
      key,
      error: result.reason,
    });
    return fallbackPriceFor(plan, currency);
  });
}

export async function resolveBillingPricesShape(): Promise<BillingPricesShape> {
  try {
    return pricesShapeFromItems(await resolveBillingPrices());
  } catch (error) {
    console.error("[billing/prices] error:", error);
    return pricesShapeFromItems(fallbackBillingPrices());
  }
}
