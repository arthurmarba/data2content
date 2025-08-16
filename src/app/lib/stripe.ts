import Stripe from "stripe";
import { assertBillingEnv } from "@/app/lib/boot-sanity";

assertBillingEnv();

// Garante `string` no tipo (e no runtime)
const secret: string = (() => {
  const v = process.env.STRIPE_SECRET_KEY;
  if (!v) {
    throw new Error("STRIPE_SECRET_KEY ausente nas variáveis de ambiente.");
  }
  return v;
})();

// Versão basil (pin do stripe@18.4.0)
const DEFAULT_API_VERSION: Stripe.LatestApiVersion = "2025-07-30.basil";

// Usa env se fornecida; caso contrário, trava na basil
const apiVersion: Stripe.LatestApiVersion =
  (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion | undefined) ??
  DEFAULT_API_VERSION;

// Em produção, exige a mesma versão para evitar drift
if (process.env.NODE_ENV === "production" && apiVersion !== DEFAULT_API_VERSION) {
  throw new Error(
    `STRIPE_API_VERSION divergente (${apiVersion}). Use ${DEFAULT_API_VERSION}.`
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
