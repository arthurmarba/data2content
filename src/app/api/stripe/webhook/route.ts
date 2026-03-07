// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import type Stripe from "stripe";
import { handleStripeEvent } from "@/server/stripe/handle-stripe-event";
import { logger } from "@/app/lib/logger";
import { getErrorMessage, isTransientMongoError } from "@/app/lib/mongoTransient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    logger.error("stripe_webhook_missing_signature_or_secret");
    return NextResponse.json({ received: true, error: "missing-signature" }, { status: 400 });
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err: any) {
    logger.error("stripe_webhook_signature_error", {
      error: err?.message || String(err),
    });
    return NextResponse.json({ received: true, error: "invalid-signature" }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err: any) {
    if (isTransientMongoError(err)) {
      logger.warn("stripe_webhook_processing_transient_error", {
        eventId: event.id,
        eventType: event.type,
        error: getErrorMessage(err),
      });
      return NextResponse.json(
        { received: false, error: "processing-temporarily-unavailable" },
        { status: 503 }
      );
    }
    logger.error("stripe_webhook_processing_error", {
      eventId: event.id,
      eventType: event.type,
      error: err?.message || String(err),
    });
    return NextResponse.json(
      { received: false, error: "processing-error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
