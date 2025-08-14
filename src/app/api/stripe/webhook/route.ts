import { stripe } from "@/app/lib/stripe";
import type Stripe from "stripe";
import { handleStripeEvent } from "@/server/stripe/handle-stripe-event";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig!, secret);
  } catch (err: any) {
    console.error("Webhook signature error:", err?.message);
    return new Response(
      JSON.stringify({ received: true, error: "invalid-signature" }),
      { status: 200 }
    );
  }

  try {
    await handleStripeEvent(event);
  } catch (err: any) {
    console.error("Webhook processing error:", event.type, err?.message);
  }
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
