// src/utils/stripeHelpers.ts
import { stripe } from "@/app/lib/stripe";
import type Stripe from "stripe";
import User, { type IUser } from "@/app/models/User";

/**
 * Cancela tentativas pendentes (Stripe statuses: "incomplete" e "incomplete_expired")
 * para um determinado customer. Não toca em assinaturas ativas.
 *
 * Retorna listas de IDs cancelados e pulados (skipped).
 */
export async function cancelBlockingIncompleteSubs(
  customerId: string
): Promise<{ canceled: string[]; skipped: string[] }> {
  const canceled: string[] = [];
  const skipped: string[] = [];
  let startingAfter: string | undefined = undefined;

  do {
    // ✅ Tipagem explícita evita "implicit any" e problemas de auto-referência
    const page: Stripe.ApiList<Stripe.Subscription> =
      await stripe.subscriptions.list({
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

    // Evita usar .at(-1); mantém compatibilidade com targets/lib mais antigos
    const last = page.data.length ? page.data[page.data.length - 1] : undefined;
    startingAfter = page.has_more && last ? last.id : undefined;
  } while (startingAfter);

  return { canceled, skipped };
}

/**
 * Retorna o `stripeCustomerId` do usuário ou cria um novo cliente no Stripe.
 * A criação usa uma idempotency key baseada no `_id` do usuário para evitar
 * múltiplos clientes em chamadas simultâneas.
 */
export async function getOrCreateStripeCustomerId(
  userOrId: IUser | string
): Promise<string> {
  const user =
    typeof userOrId === "string" ? await User.findById(userOrId) : userOrId;
  if (!user) throw new Error("Usuário não encontrado");
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create(
    {
      email: user.email,
      name: user.name || undefined,
      metadata: { userId: String(user._id) },
    },
    { idempotencyKey: `user-${String(user._id)}-customer` }
  );

  user.stripeCustomerId = customer.id;
  await user.save();
  return customer.id;
}
