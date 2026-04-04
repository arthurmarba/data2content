import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { ANNUAL_MONTHLY_PRICE, MONTHLY_PRICE } from "@/config/pricing.config";

// Ensure this route is never statically generated during build
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";

type PriceResponseItem = {
  plan: Plan;
  currency: Currency;
  unitAmount: number | null;
  recurring: "month" | "year" | null;
  priceId: string | null;
  displayCurrency: Currency;
};

function entries<T extends string>(o: Record<T, string | undefined>) {
  return Object.entries(o) as [T, string | undefined][];
}

function normalizeRecurringInterval(
  interval: string | null | undefined
): PriceResponseItem["recurring"] {
  return interval === "month" || interval === "year" ? interval : null;
}

function fallbackPriceFor(plan: Plan, currency: Currency): PriceResponseItem {
  const fallbackUsdMonthly = Number(process.env.MONTHLY_PLAN_PRICE_USD ?? 9.9);
  const fallbackUsdAnnual = Number(process.env.ANNUAL_PLAN_YEAR_PRICE_USD ?? 99);

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

export async function GET() {
  try {
    const priceIds: Record<`${Plan}_${Currency}`, string | undefined> = {
      monthly_BRL: process.env.STRIPE_PRICE_MONTHLY_BRL,
      annual_BRL: process.env.STRIPE_PRICE_ANNUAL_BRL,
      monthly_USD: process.env.STRIPE_PRICE_MONTHLY_USD,
      annual_USD: process.env.STRIPE_PRICE_ANNUAL_USD,
    };
    const priceEntries = entries(priceIds);

    const results = await Promise.allSettled(
      priceEntries.map(async ([key, id]) => {
        const [plan, cur] = key.split("_") as [Plan, Currency];
        if (!id) return fallbackPriceFor(plan, cur);
        const p = await stripe.prices.retrieve(id);
        return {
          plan,
          currency: cur,
          unitAmount: p.unit_amount ?? null,
          recurring: normalizeRecurringInterval(p.recurring?.interval),
          priceId: p.id,
          displayCurrency: (p.currency || cur).toUpperCase() as Currency,
        } satisfies PriceResponseItem;
      })
    );

    const resolvedPrices: PriceResponseItem[] = [];

    for (const [index, [key]] of priceEntries.entries()) {
      const [plan, cur] = key.split("_") as [Plan, Currency];
      const result = results[index];

      if (!result) {
        resolvedPrices.push(fallbackPriceFor(plan, cur));
        continue;
      }

      if (result.status === "fulfilled") {
        resolvedPrices.push(result.value);
        continue;
      }

      console.error("[billing/prices] falling back after stripe error:", {
        key,
        error: result.reason,
      });
      resolvedPrices.push(fallbackPriceFor(plan, cur));
    }

    return NextResponse.json({
      prices: resolvedPrices,
    });
  } catch (err: any) {
    console.error("[billing/prices] error:", err);
    return NextResponse.json({
      prices: [
        fallbackPriceFor("monthly", "BRL"),
        fallbackPriceFor("annual", "BRL"),
        fallbackPriceFor("monthly", "USD"),
        fallbackPriceFor("annual", "USD"),
      ],
      fallback: true,
    });
  }
}
