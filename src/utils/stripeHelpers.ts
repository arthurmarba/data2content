import Stripe from "stripe";

export async function cancelBlockingIncompleteSubs(stripe: Stripe, customerId: string) {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
  for (const s of subs.data) {
    if (s.status === "incomplete") {
      await stripe.subscriptions.cancel(s.id);
      console.info(`[stripe] Canceled blocking incomplete sub ${s.id} for ${customerId}`);
    }
  }
}
