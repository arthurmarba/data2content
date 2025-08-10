import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
if (!STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set');
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

export default stripe;
