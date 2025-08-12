// src/app/lib/stripe.ts
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
if (!STRIPE_SECRET_KEY) {
  // Log leve pra facilitar debug em dev
  console.warn("STRIPE_SECRET_KEY não está definido!");
}

// Importante: sua tipagem atual do SDK aceita "2022-11-15".
// Se quiser usar "2024-06-20", atualize o pacote `stripe` no package.json.
export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

export default stripe;
