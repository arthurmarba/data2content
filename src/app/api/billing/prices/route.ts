import { NextResponse } from "next/server";
import { fallbackBillingPrices, resolveBillingPrices } from "@/app/lib/billing/serverBillingPrices";

// Ensure this route is never statically generated during build
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json({
      prices: await resolveBillingPrices(),
    });
  } catch (err: any) {
    console.error("[billing/prices] error:", err);
    return NextResponse.json({
      prices: fallbackBillingPrices(),
      fallback: true,
    });
  }
}
