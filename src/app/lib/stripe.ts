import Stripe from "stripe";
import { assertBillingEnv } from "@/app/lib/boot-sanity";

assertBillingEnv();

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  throw new Error("STRIPE_SECRET_KEY ausente nas variáveis de ambiente.");
}

const apiVersion =
  (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion | undefined) ??
  "2022-11-15";

if (
  process.env.NODE_ENV === "production" &&
  process.env.STRIPE_API_VERSION &&
  process.env.STRIPE_API_VERSION !== "2022-11-15"
) {
  throw new Error(
    `STRIPE_API_VERSION divergente (${process.env.STRIPE_API_VERSION}). Use 2022-11-15.`
  );
}

let _stripe: Stripe | null = null;

/**
 * Retorna sempre a MESMA instância do cliente Stripe.
 * Evita múltiplas conexões/configs divergentes.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(secret, { apiVersion });
  }
  return _stripe;
}

// atalho conveniente
export const stripe = getStripe();

