import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";

// Ensure this route is never statically generated during build
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";

function entries<T extends string>(o: Record<T, string | undefined>) {
  return Object.entries(o) as [T, string | undefined][];
}

export async function GET() {
  try {
    const priceIds: Record<`${Plan}_${Currency}`, string | undefined> = {
      monthly_BRL: process.env.STRIPE_PRICE_MONTHLY_BRL,
      annual_BRL: process.env.STRIPE_PRICE_ANNUAL_BRL,
      monthly_USD: process.env.STRIPE_PRICE_MONTHLY_USD,
      annual_USD: process.env.STRIPE_PRICE_ANNUAL_USD,
    };

    const results = await Promise.all(
      entries(priceIds).map(async ([key, id]) => {
        if (!id) return null;
        const p = await stripe.prices.retrieve(id);
        const [plan, cur] = key.split("_") as [Plan, Currency];
        return {
          plan,
          currency: cur,
          unitAmount: p.unit_amount ?? null,
          recurring: p.recurring?.interval ?? null,
          priceId: p.id,
          displayCurrency: (p.currency || cur).toUpperCase(),
        };
      })
    );

    return NextResponse.json({
      prices: results.filter(Boolean),
    });
  } catch (err: any) {
    console.error("[billing/prices] error:", err);
    return NextResponse.json({ error: "Erro ao obter preços." }, { status: 500 });
  }
}
