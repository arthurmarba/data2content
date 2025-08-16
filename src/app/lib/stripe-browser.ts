// src/app/lib/stripe-browser.ts
"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

// Em produção: exige a key. Em dev: apenas alerta para permitir montar a UI.
if (!pk && process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ausente");
}
if (!pk && process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.warn("[stripe-browser] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ausente (dev).");
}

// Mantém a mesma versão do server para evitar inconsistências
const DEFAULT_API_VERSION = "2023-10-16";

// Cacheia a promise globalmente para sobreviver a HMR (evita recarregar o script stripe.js)
const globalForStripeJs = globalThis as unknown as { __stripePromise?: Promise<Stripe | null> };

export const stripePromise: Promise<Stripe | null> =
  pk
    ? (globalForStripeJs.__stripePromise ??
       (globalForStripeJs.__stripePromise = loadStripe(pk, { apiVersion: DEFAULT_API_VERSION })))
    : Promise.resolve(null);
