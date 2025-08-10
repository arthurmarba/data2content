import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
if (!STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY não está definido!");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export default stripe;

