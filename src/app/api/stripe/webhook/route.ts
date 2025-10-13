// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import type Stripe from "stripe";
import { handleStripeEvent } from "@/server/stripe/handle-stripe-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    console.error("Webhook missing signature or secret env");
    return NextResponse.json({ received: true, error: "missing-signature" }, { status: 400 });
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err: any) {
    console.error("Webhook signature error:", err?.message);
    return NextResponse.json({ received: true, error: "invalid-signature" }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err: any) {
    console.error("Webhook processing error:", event.type, err?.message);
    return NextResponse.json(
      { received: false, error: "processing-error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
