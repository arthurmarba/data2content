import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
if (!STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY não está definido!");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  // Corrigido para a versão de API esperada pela sua biblioteca Stripe
  apiVersion: "2022-11-15",
});

export default stripe;
