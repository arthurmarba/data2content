import stripe from "@/app/lib/stripe";

export async function cancelBlockingIncompleteSubs(customerId: string) {
  const canceled: string[] = [];
  const skipped: string[] = [];
  let startingAfter: string | undefined = undefined;

  do {
    const page = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
      expand: ["data.latest_invoice.payment_intent"],
    });

    for (const s of page.data) {
      if (s.status === "incomplete" || s.status === "incomplete_expired") {
        try {
          await stripe.subscriptions.cancel(s.id);
          canceled.push(s.id);
        } catch {
          skipped.push(s.id);
        }
      } else {
        skipped.push(s.id);
      }
    }

    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (startingAfter);

  return { canceled, skipped };
}

