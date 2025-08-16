// src/app/lib/stripe.ts
import Stripe from "stripe";
import { assertBillingEnv } from "@/app/lib/boot-sanity";

assertBillingEnv();

// --- chave secreta ---
const secret: string = (() => {
  const v = process.env.STRIPE_SECRET_KEY;
  if (!v) throw new Error("STRIPE_SECRET_KEY ausente nas variáveis de ambiente.");
  return v;
})();

// ——— Versão da API pinada ———
const DEFAULT_API_VERSION: Stripe.LatestApiVersion = "2025-07-30.basil";

// Usa env se fornecida; caso contrário, trava na basil
const apiVersion: Stripe.LatestApiVersion =
  (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion | undefined) ??
  DEFAULT_API_VERSION;

// Em produção, evita drift de versão
if (process.env.NODE_ENV === "production" && apiVersion !== DEFAULT_API_VERSION) {
  throw new Error(`STRIPE_API_VERSION divergente (${apiVersion}). Use ${DEFAULT_API_VERSION}.`);
}

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(secret, { apiVersion });
  }
  return _stripe;
}

export const stripe = getStripe();
