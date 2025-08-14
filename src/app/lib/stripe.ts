import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY não está definido!");
}

// Opcional: fixe a versão via env (ex.: STRIPE_API_VERSION=2025-07-30.basil).
// Se não definir, o SDK usa a Latest API automaticamente.
const API_VERSION = process.env.STRIPE_API_VERSION;

const config: Stripe.StripeConfig = {};
if (API_VERSION) {
  // Cast proposital para ficar imune a mudanças futuras no union de versões.
  (config as any).apiVersion = API_VERSION as any;
}

export const stripe = new Stripe(STRIPE_SECRET_KEY!, config);
export default stripe;
