// src/app/api/stripe/connect-webhook/route.ts
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/app/lib/stripe';
import { handleStripeConnectEvent } from '@/server/stripe/handle-stripe-connect-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!sig || !secret) {
    console.error('Connect webhook missing signature or secret env');
    return NextResponse.json({ received: true, error: 'missing-signature' }, { status: 400 });
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err: any) {
    console.error('Connect webhook signature error:', err?.message);
    return NextResponse.json({ received: true, error: 'invalid-signature' }, { status: 400 });
  }

  try {
    await handleStripeConnectEvent(event);
  } catch (err: any) {
    console.error('Connect webhook processing error:', event.type, err?.message);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

