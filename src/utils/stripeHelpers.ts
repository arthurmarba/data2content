// src/utils/stripeHelpers.ts
import { stripe } from "@/app/lib/stripe";
import type Stripe from "stripe";
import User, { type IUser } from "@/app/models/User";

type StripeMissingResource = "customer" | "subscription";
type ResetStripeBillingOptions = {
  clearCustomerId?: boolean;
  clearSubscriptionId?: boolean;
};

function getStripeErrorField(error: unknown, field: string): string | null {
  const direct = (error as any)?.[field];
  if (typeof direct === "string" && direct) return direct;
  const raw = (error as any)?.raw?.[field];
  return typeof raw === "string" && raw ? raw : null;
}

export function isStripeResourceMissingError(
  error: unknown,
  resource?: StripeMissingResource
): boolean {
  const code = getStripeErrorField(error, "code");
  const type = getStripeErrorField(error, "type") ?? (error as any)?.rawType ?? null;
  const param = getStripeErrorField(error, "param");
  const message = (getStripeErrorField(error, "message") ?? "").toLowerCase();

  const looksLikeMissingResource =
    code === "resource_missing" ||
    (type === "StripeInvalidRequestError" || type === "invalid_request_error") &&
      /no such (customer|subscription)/.test(message);

  if (!looksLikeMissingResource) return false;
  if (!resource) return true;

  return (
    param === resource ||
    param === `${resource}s` ||
    message.includes(`no such ${resource}`)
  );
}

export function buildStaleStripeBillingPatch(
  options: ResetStripeBillingOptions = {}
): Record<string, any> {
  const { clearCustomerId = true, clearSubscriptionId = true } = options;
  return {
    ...(clearCustomerId ? { stripeCustomerId: null } : {}),
    ...(clearSubscriptionId ? { stripeSubscriptionId: null } : {}),
    stripePriceId: null,
    planStatus: "inactive",
    planInterval: null,
    planExpiresAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    lastPaymentError: null,
  };
}

export function applyStaleStripeBillingPatch(
  target: Record<string, any>,
  options: ResetStripeBillingOptions = {}
) {
  Object.assign(target, buildStaleStripeBillingPatch(options));
  return target;
}

export async function persistStaleStripeBillingPatch(
  user: (IUser & { save: () => Promise<unknown> }) | null | undefined,
  options: ResetStripeBillingOptions = {}
) {
  if (!user) return;
  applyStaleStripeBillingPatch(user as any, options);
  await user.save();
}

/**
 * Cancela tentativas pendentes (Stripe statuses: "incomplete" e "incomplete_expired")
 * para um determinado customer. Não toca em assinaturas ativas.
 *
 * Retorna listas de IDs cancelados e pulados (skipped).
 *
 * Compat Basil:
 * - O expand abaixo continua válido; não dependemos dele para a lógica,
 *   mas é seguro mantê-lo.
 */
export async function cancelBlockingIncompleteSubs(
  customerId: string
): Promise<{ canceled: string[]; skipped: string[] }> {
  const canceled: string[] = [];
  const skipped: string[] = [];
  let startingAfter: string | undefined = undefined;

  do {
    let page: Stripe.ApiList<Stripe.Subscription>;
    try {
      page = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
        expand: ["data.latest_invoice.payment_intent"],
      });
    } catch (error) {
      if (isStripeResourceMissingError(error, "customer")) {
        return { canceled, skipped };
      }
      throw error;
    }

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

    const last = page.data.length ? page.data[page.data.length - 1] : undefined;
    startingAfter = page.has_more && last ? last.id : undefined;
  } while (startingAfter);

  return { canceled, skipped };
}

/**
 * Retorna o `stripeCustomerId` do usuário ou cria um novo cliente no Stripe.
 * A criação usa uma idempotency key baseada no `_id` do usuário para evitar
 * múltiplos clientes em chamadas simultâneas.
 *
 * Compat Basil:
 * - Campos básicos (email/name/metadata) sem mudanças.
 */
export async function getOrCreateStripeCustomerId(
  userOrId: IUser | string
): Promise<string> {
  const user =
    typeof userOrId === "string" ? await User.findById(userOrId) : userOrId;
  if (!user) throw new Error("Usuário não encontrado");
  if (user.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(user.stripeCustomerId);
      if (!("deleted" in existing && existing.deleted)) {
        return existing.id;
      }
    } catch (error) {
      if (!isStripeResourceMissingError(error, "customer")) {
        throw error;
      }
    }

    (user as any).stripeCustomerId = null;
    await user.save();
  }

  const email = (user.email || "").toLowerCase().trim();
  const name = (user.name || "").trim() || undefined;

  const customer = await stripe.customers.create(
    {
      email: email || undefined,
      name,
      metadata: { userId: String(user._id) },
    },
    { idempotencyKey: `user-${String(user._id)}-customer` }
  );

  user.stripeCustomerId = customer.id;
  await user.save();
  return customer.id;
}
