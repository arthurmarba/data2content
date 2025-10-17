// src/server/stripe/handle-stripe-event.ts
import type Stripe from "stripe";
import { connectToDatabase } from "@/app/lib/mongoose";
import { User } from "@/server/db/models/User";
import { stripe } from "@/app/lib/stripe";
import { logger } from "@/app/lib/logger";
import {
  findUserByCustomerId,
  markEventIfNew,
  ensureInvoiceIdempotent,
  ensureSubscriptionFirstTime,
  calcCommissionCents,
  addDays,
} from "./webhook-helpers";
import { adjustBalance } from "@/server/affiliate/balance";
import { processAffiliateRefund } from "@/server/affiliate/refund";

const HOLD_DAYS = Number(process.env.AFFILIATE_HOLD_DAYS ?? "7");
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 200;

type RetryOptions = {
  attempts?: number;
  delayMs?: number;
  context?: Record<string, unknown>;
};

async function withRetries<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const attempts = options?.attempts ?? DEFAULT_RETRY_ATTEMPTS;
  const delayMs = options?.delayMs ?? DEFAULT_RETRY_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;

      if (options?.context) {
        logger.warn("stripe_retry", {
          ...options.context,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Retryable operation failed without error instance");
}

function eventCreatedMs(event: Stripe.Event | { created?: number }): number | null {
  const created = (event as any)?.created;
  if (typeof created === "number") return created * 1000;
  return null;
}

function eventCreatedDate(event: Stripe.Event | { created?: number }): Date | null {
  const ms = eventCreatedMs(event);
  return ms ? new Date(ms) : null;
}

function buildEventMeta(
  user: any,
  event: Stripe.Event,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return {
    userId: String(user._id),
    eventId: event.id,
    eventType: event.type,
    ...extra,
  };
}

function shouldIgnoreOutOfOrderEvent(user: any, event: Stripe.Event): boolean {
  const last = user.lastStripeEventAt instanceof Date ? user.lastStripeEventAt.getTime() : null;
  const current = eventCreatedMs(event);

  if (last != null && current != null && current < last) {
    logger.info("stripe_event_out_of_order", {
      ...buildEventMeta(user, event, {
        lastStripeEventAt: new Date(last).toISOString(),
        incomingCreatedAt: new Date(current).toISOString(),
      }),
    });
    return true;
  }

  return false;
}

type SubscriptionMismatchOptions = {
  requireMatch?: boolean;
  logLevel?: "warn" | "info";
};

function isSubscriptionMismatch(
  user: any,
  subscriptionId: string | null | undefined,
  event: Stripe.Event,
  options?: SubscriptionMismatchOptions
): boolean {
  const current = user.stripeSubscriptionId;
  const requireMatch = options?.requireMatch ?? false;
  const logLevel = options?.logLevel ?? "warn";

  if (!subscriptionId) {
    if (!requireMatch) return false;
    const meta = buildEventMeta(user, event, {
      eventSubscriptionId: subscriptionId,
      currentSubscriptionId: current ?? null,
    });
    if (logLevel === "warn") logger.warn("stripe_subscription_missing_event_id", meta);
    else logger.info("stripe_subscription_missing_event_id", meta);
    return true;
  }

  if (!current) {
    if (!requireMatch) return false;
    const meta = buildEventMeta(user, event, {
      eventSubscriptionId: subscriptionId,
      currentSubscriptionId: current ?? null,
    });
    if (logLevel === "warn") {
      logger.warn("stripe_subscription_missing_current_id", meta);
    } else {
      logger.info("stripe_subscription_missing_current_id", meta);
    }
    return true;
  }

  if (current === subscriptionId) return false;

  const meta = buildEventMeta(user, event, {
    eventSubscriptionId: subscriptionId,
    currentSubscriptionId: current,
  });

  if (logLevel === "warn") {
    logger.warn("stripe_subscription_mismatch", meta);
  } else {
    logger.info("stripe_subscription_mismatch", meta);
  }

  return true;
}

/* ---------------------- Helpers de extração ---------------------- */

// Extrai subscriptionId do Invoice (compat Basil: string ou objeto)
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub: unknown = (invoice as any)?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : (sub as any)?.id ?? null;
}

// Coage para "month" | "year" | undefined
function coerceInterval(
  v: "month" | "year" | null | undefined
): "month" | "year" | undefined {
  return v === "month" || v === "year" ? v : undefined;
}

// Extrai "month" | "year" do 1º line item (price.recurring.interval ou plan.interval)
function getIntervalFromInvoice(invoice: Stripe.Invoice): "month" | "year" | null {
  const li: any = invoice?.lines?.data?.[0];
  const raw: string | undefined =
    li?.price?.recurring?.interval || li?.plan?.interval || undefined;
  return raw === "month" || raw === "year" ? raw : null;
}

// Extrai invoiceId de um Charge (direto ou via payment_intent)
function getInvoiceIdFromCharge(charge: Stripe.Charge): string | null {
  const c: any = charge as any;
  const direct = c?.invoice?.id ?? c?.invoice ?? null;
  if (typeof direct === "string") return direct;
  const pi: any = c?.payment_intent;
  if (!pi) return null;
  const viaPI = pi?.invoice?.id ?? pi?.invoice ?? null;
  return typeof viaPI === "string" ? viaPI : null;
}

/* --------------------- Normalização de assinatura --------------------- */

type Normalized = {
  planStatus:
    | "active"
    | "trialing"
    | "past_due"
    | "incomplete"
    | "incomplete_expired"
    | "unpaid"
    | "canceled"
    | "inactive"
    | "non_renewing";
  planInterval: "month" | "year" | undefined;
  planExpiresAt: Date | null;
  cancelAtPeriodEnd: boolean;
  stripePriceId: string | null;
  currency: string | null;
};

/** Compat Basil: força status "trialing" se trial_end > agora e ancora expiração no trial_end */
function normalizeFromSubscription(sub: Stripe.Subscription): Normalized {
  const cancelAtPeriodEnd = !!(sub as any).cancel_at_period_end;
  const baseStatus = ((sub as any).status ?? "inactive") as Normalized["planStatus"];

  const trialEndSec =
    typeof (sub as any).trial_end === "number" ? (sub as any).trial_end : null;
  const nowSec = Math.floor(Date.now() / 1000);
  const isTrialingNow = trialEndSec != null && trialEndSec > nowSec;

  const planStatus: Normalized["planStatus"] = isTrialingNow ? "trialing" : baseStatus;

  const item = sub.items?.data?.[0];
  const planInterval = coerceInterval(item?.price?.recurring?.interval as any);

  // Em Basil, o fim do período pode vir por item: current_period_end
  const itemEnds: number[] =
    sub.items?.data
      ?.map((it: any) => it?.current_period_end)
      ?.filter((n: any) => typeof n === "number") ?? [];

  let planExpiresAt: Date | null = null;
  if (isTrialingNow && trialEndSec) {
    // Durante o trial mostramos a data de término do trial
    planExpiresAt = new Date(trialEndSec * 1000);
  } else if (typeof (sub as any).cancel_at === "number") {
    planExpiresAt = new Date((sub as any).cancel_at * 1000);
  } else if (itemEnds.length > 0) {
    planExpiresAt = new Date(Math.min(...itemEnds) * 1000);
  } else if (typeof (sub as any).current_period_end === "number") {
    // Fallback: algumas contas ainda recebem no topo
    planExpiresAt = new Date((sub as any).current_period_end * 1000);
  }

  const stripePriceId = item?.price?.id ?? null;
  const currency =
    (item?.price?.currency ? String(item.price.currency).toUpperCase() : null) ?? null;

  return { planStatus, planInterval, planExpiresAt, cancelAtPeriodEnd, stripePriceId, currency };
}

/** Mapeia o status normalizado (Stripe-like) para o status aceito pelo schema do User */
type DbPlanStatus =
  | "pending"
  | "active"
  | "canceled"
  | "inactive"
  | "trial"
  | "expired"
  | "non_renewing"
  | undefined;

function toDbPlanStatus(s: Normalized["planStatus"] | undefined): DbPlanStatus {
  if (!s) return undefined;
  if (s === "trialing") return "trial";
  return s as DbPlanStatus;
}

function applyNormalizedUserBilling(
  user: any,
  sub: Stripe.Subscription,
  eventId?: string,
  opts?: { overrideStatus?: Normalized["planStatus"] }
): void {
  const n = normalizeFromSubscription(sub);
  user.stripeSubscriptionId = sub.id;
  user.stripePriceId = n.stripePriceId;

  const desired = opts?.overrideStatus ?? n.planStatus;
  user.planStatus = toDbPlanStatus(desired);

  user.planInterval = n.planInterval;
  user.planExpiresAt = n.planExpiresAt;
  user.currentPeriodEnd = n.planExpiresAt;
  user.cancelAtPeriodEnd = n.cancelAtPeriodEnd;
  if (n.currency) user.currency = n.currency;
  if (eventId) user.lastProcessedEventId = eventId; // correção
}

/* ---------------------- Heurística anti-past_due/incomplete ---------------------- */

function getInvoicePaymentIntentStatus(
  inv: Stripe.Invoice | null | undefined
): Stripe.PaymentIntent.Status | undefined {
  if (!inv) return undefined;
  const piAny = (inv as any)?.payment_intent;
  if (!piAny || typeof piAny === "string") return undefined;
  return (piAny as any)?.status as Stripe.PaymentIntent.Status | undefined;
}

function isLikelyPlanChangePaymentPending(
  inv: Stripe.Invoice | null | undefined,
  prevUserStatus: Normalized["planStatus"] | undefined
) {
  if (!inv) return false;

  const createdRecent =
    typeof inv.created === "number"
      ? Date.now() - inv.created * 1000 < 30 * 60 * 1000
      : false;

  const piStatus = getInvoicePaymentIntentStatus(inv);
  const pendingPI =
    piStatus === "requires_action" ||
    piStatus === "requires_payment_method" ||
    piStatus === "requires_confirmation" ||
    piStatus === "processing";

  const wasGoodBefore =
    prevUserStatus === "active" ||
    prevUserStatus === "trialing" ||
    prevUserStatus === "non_renewing";

  return Boolean(createdRecent && pendingPI && wasGoodBefore);
}

/* ----------------------------- Handler ----------------------------- */

export async function handleStripeEvent(event: Stripe.Event) {
  await connectToDatabase();

  switch (event.type) {
    /* ----------------- Checkout concluído (modo subscription) ----------------- */
    case "checkout.session.completed": {
      const cs = event.data.object as Stripe.Checkout.Session;
      if (cs.mode !== "subscription") return;

      const customerId =
        typeof cs.customer === "string" ? cs.customer : (cs.customer as any)?.id;
      const subscriptionId =
        typeof cs.subscription === "string"
          ? cs.subscription
          : (cs.subscription as any)?.id;

      const clientRef = cs.client_reference_id || null;
      const email =
        cs.customer_details?.email ||
        (typeof (cs as any).customer_email === "string"
          ? ((cs as any).customer_email as string)
          : undefined);

      // Preferência: customerId → userId (client_reference_id) → email
      let user =
        (customerId ? await findUserByCustomerId(customerId) : null) ||
        (clientRef ? await User.findById(clientRef) : null) ||
        (email ? await User.findOne({ email: String(email).toLowerCase() }) : null);

      if (!user) return;

      const isNewEvent = await markEventIfNew(user, event.id, { commit: false });
      if (!isNewEvent) return;

      if (shouldIgnoreOutOfOrderEvent(user, event)) return;

      if (customerId && !(user as any).stripeCustomerId) {
        (user as any).stripeCustomerId = customerId;
      }

      const eventDate = eventCreatedDate(event) ?? new Date();

      if (subscriptionId) {
        try {
          const sub = await withRetries(
            () =>
              stripe.subscriptions.retrieve(subscriptionId, {
                expand: ["items.data.price"],
              }),
            {
              context: buildEventMeta(user, event, {
                action: "retrieve_subscription",
                subscriptionId,
              }),
            }
          );

          // Força trial somente se trial_end > agora
          const trialEndSec =
            typeof (sub as any).trial_end === "number" ? (sub as any).trial_end : null;
          const isTrialingNow = trialEndSec != null && trialEndSec * 1000 > Date.now();

          // Persistimos como "trial" (schema do User), não "trialing"
          applyNormalizedUserBilling(user, sub, event.id, {
            overrideStatus: isTrialingNow ? "trialing" : undefined,
          });
          (user as any).lastSubscriptionEventId = event.id;

          // Evita múltiplos trials simultâneos para o mesmo cliente
          if (customerId) {
            try {
              const siblings = await withRetries(
                () =>
                  stripe.subscriptions.list({
                    customer: customerId,
                    status: "all",
                    limit: 20,
                  }),
                {
                  context: buildEventMeta(user, event, {
                    action: "list_customer_subscriptions",
                    customerId,
                  }),
                }
              );
              const duplicates = siblings.data.filter(
                (other) =>
                  other.id !== sub.id &&
                  (other.status === "trialing" || other.status === "incomplete")
              );
              await Promise.allSettled(
                duplicates.map((other) =>
                  withRetries(
                    () => stripe.subscriptions.cancel(other.id),
                    {
                      context: buildEventMeta(user, event, {
                        action: "cancel_duplicate_subscription",
                        subscriptionId: other.id,
                      }),
                    }
                  )
                )
              );
            } catch {
              /* noop */
            }
          }
        } catch (error) {
          logger.warn("stripe_checkout_subscription_fetch_failed", {
            ...buildEventMeta(user, event, { subscriptionId }),
            error: error instanceof Error ? error.message : String(error),
          });
          (user as any).lastProcessedEventId = event.id;
        }
      } else {
        (user as any).lastProcessedEventId = event.id;
      }

      (user as any).lastStripeEventAt = eventDate;

      await markEventIfNew(user, event.id);

      await withRetries(
        () => user.save(),
        { context: buildEventMeta(user, event, { action: "user.save" }) }
      );
      return;
    }

    /* -------------------- Cobrança confirmada (pró-rata / trial $0) -------------------- */
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = (invoice.customer as any)?.id ?? (invoice.customer as string);
      if (!customerId) return;

      const user = await findUserByCustomerId(customerId);
      if (!user) return;

      const isNewEvent = await markEventIfNew(user, event.id, { commit: false });
      if (!isNewEvent) return;

      if (shouldIgnoreOutOfOrderEvent(user, event)) return;

      // 1) Atualiza billing pela assinatura
      const subId = getSubscriptionIdFromInvoice(invoice);
      if (subId && isSubscriptionMismatch(user, subId, event)) return;

      const eventDate = eventCreatedDate(event) ?? new Date();

      if (subId) {
        try {
          const sub = await withRetries(
            () =>
              stripe.subscriptions.retrieve(subId, {
                expand: ["items.data.price"],
              }),
            {
              context: buildEventMeta(user, event, {
                action: "retrieve_subscription",
                subscriptionId: subId,
              }),
            }
          );
          applyNormalizedUserBilling(user, sub, event.id);
          (user as any).lastSubscriptionEventId = event.id;
        } catch {
          // Fallback: se for fatura de $0 (subscription_create com trial),
          // NÃO devemos marcar como "active".
          const period = invoice.lines?.data?.[0]?.period;
          const amountPaid = typeof invoice.amount_paid === "number" ? invoice.amount_paid : 0;

          (user as any).planStatus = toDbPlanStatus(amountPaid === 0 ? "trialing" : "active");
          (user as any).stripeSubscriptionId = subId ?? (user as any).stripeSubscriptionId ?? null;
          (user as any).planInterval =
            coerceInterval(getIntervalFromInvoice(invoice)) ?? (user as any).planInterval;
          (user as any).planExpiresAt = period?.end
            ? new Date(period.end * 1000)
            : (user as any).planExpiresAt ?? null;
          (user as any).cancelAtPeriodEnd = false;
          (user as any).currency = (invoice.currency ?? "brl").toUpperCase();
          (user as any).lastProcessedEventId = event.id;
          (user as any).lastSubscriptionEventId = event.id;
        }
      } else {
        const period = invoice.lines?.data?.[0]?.period;
        const amountPaid = typeof invoice.amount_paid === "number" ? invoice.amount_paid : 0;

        (user as any).planStatus = toDbPlanStatus(amountPaid === 0 ? "trialing" : "active");
        (user as any).planInterval =
          coerceInterval(getIntervalFromInvoice(invoice)) ?? (user as any).planInterval;
        (user as any).planExpiresAt = period?.end
          ? new Date(period.end * 1000)
          : (user as any).planExpiresAt ?? null;
        (user as any).cancelAtPeriodEnd = false;
        (user as any).currency = (invoice.currency ?? "brl").toUpperCase();
        (user as any).lastProcessedEventId = event.id;
      }

      // 2) Afiliados — só comissiona se amount_paid > 0
      if ((invoice.amount_paid ?? 0) > 0) {
        const code = (user as any).affiliateUsed || invoice.metadata?.affiliateCode;
        if (code) {
          const owner = await User.findOne({ affiliateCode: code });
          if (owner && String(owner._id) !== String(user._id)) {
            const okInvoice = await ensureInvoiceIdempotent(
              invoice.id!,
              String(owner._id)
            );
            const subId2 = getSubscriptionIdFromInvoice(invoice);
            const okSub = subId2
              ? await ensureSubscriptionFirstTime(subId2, String(owner._id))
              : true;

            if (okInvoice && okSub) {
              const amountCents = calcCommissionCents(invoice);
              if (amountCents > 0) {
                (user as any).affiliateFirstCommissionAt = new Date();
                (owner as any).commissionLog.push({
                  type: "commission",
                  status: "pending",
                  invoiceId: invoice.id!,
                  subscriptionId: subId2 ?? null,
                  affiliateUserId: owner._id,
                  buyerUserId: user._id,
                  currency: String(invoice.currency || "brl").toLowerCase(),
                  amountCents,
                  availableAt: addDays(new Date(), HOLD_DAYS),
                  createdAt: new Date(),
                });
                await withRetries(
                  () => owner.save(),
                  {
                    context: {
                      ownerId: String(owner._id),
                      action: "owner.save",
                      eventId: event.id,
                      eventType: event.type,
                    },
                  }
                );
              }
            }
          }
        }
      }

      // 3) Limpa erro anterior e salva
      (user as any).lastPaymentError = undefined;
      (user as any).lastStripeEventAt = eventDate;

      await markEventIfNew(user, event.id);

      await withRetries(
        () => user.save(),
        { context: buildEventMeta(user, event, { action: "user.save" }) }
      );
      return;
    }

    /* -------------------------- Pagamento falhou -------------------------- */
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = (invoice.customer as any)?.id ?? (invoice.customer as string);
      if (!customerId) return;
      const user = await findUserByCustomerId(customerId);
      if (!user) return;

      const isNewEvent = await markEventIfNew(user, event.id, { commit: false });
      if (!isNewEvent) return;

      if (shouldIgnoreOutOfOrderEvent(user, event)) return;

      const subId = getSubscriptionIdFromInvoice(invoice);
      if (subId && isSubscriptionMismatch(user, subId, event)) return;

      const pmErr =
        invoice?.last_finalization_error?.message ||
        (invoice as any)?.last_payment_error?.message ||
        "Pagamento não autorizado.";

      (user as any).lastPaymentError = {
        at: new Date(),
        paymentId: invoice.id!,
        status: "failed",
        statusDetail: pmErr,
      };

      const invoiceStatus = typeof invoice.status === "string" ? invoice.status : undefined;
      let desiredStatus: Normalized["planStatus"] | undefined = "past_due";
      if (invoiceStatus === "uncollectible") desiredStatus = "unpaid";

      if (desiredStatus) {
        (user as any).planStatus = toDbPlanStatus(desiredStatus);
      }

      if (subId) {
        (user as any).lastSubscriptionEventId = event.id;
      }

      const eventDate = eventCreatedDate(event) ?? new Date();
      (user as any).lastStripeEventAt = eventDate;

      await markEventIfNew(user, event.id);

      await withRetries(
        () => user.save(),
        { context: buildEventMeta(user, event, { action: "user.save" }) }
      );
      return;
    }

    /* ---------------------------- Fatura anulada ---------------------------- */
    case "invoice.voided": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = (invoice.customer as any)?.id ?? (invoice.customer as string);
      if (!customerId) return;
      const buyer = await findUserByCustomerId(customerId);
      if (!buyer) return;

      const isNewEvent = await markEventIfNew(buyer, event.id, { commit: false });
      if (!isNewEvent) return;

      if (shouldIgnoreOutOfOrderEvent(buyer, event)) return;

      const eventDate = eventCreatedDate(event) ?? new Date();

      if (!(buyer as any).affiliateUsed) {
        (buyer as any).lastStripeEventAt = eventDate;
        await markEventIfNew(buyer, event.id);
        await withRetries(
          () => buyer.save(),
          { context: buildEventMeta(buyer, event, { action: "buyer.save" }) }
        );
        return;
      }
      const owner = await User.findOne({ affiliateCode: (buyer as any).affiliateUsed });
      if (!owner) {
        (buyer as any).lastStripeEventAt = eventDate;
        await markEventIfNew(buyer, event.id);
        await withRetries(
          () => buyer.save(),
          { context: buildEventMeta(buyer, event, { action: "buyer.save" }) }
        );
        return;
      }

      const idx = (owner as any).commissionLog.findIndex(
        (e: any) =>
          e.type === "commission" &&
          e.invoiceId === invoice.id &&
          (e.status === "pending" || e.status === "available")
      );
      if (idx >= 0) {
        const entry = (owner as any).commissionLog[idx];
        if (entry.status === "available") {
          await adjustBalance(owner as any, entry.currency, -Math.abs(entry.amountCents));
        }
        entry.status = "reversed";
        (entry as any).reversedAt = new Date();
        (entry as any).reversalReason = "invoice.voided";
        await withRetries(
          () => owner.save(),
          {
            context: {
              ownerId: String(owner._id),
              action: "owner.save",
              eventId: event.id,
              eventType: event.type,
            },
          }
        );
      }
      (buyer as any).lastStripeEventAt = eventDate;

      await markEventIfNew(buyer, event.id);

      await withRetries(
        () => buyer.save(),
        { context: buildEventMeta(buyer, event, { action: "buyer.save" }) }
      );
      return;
    }

    /* ------------------------------ Reembolso ------------------------------ */
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const invId = getInvoiceIdFromCharge(charge);
      if (!invId) return;
      await processAffiliateRefund(invId, undefined, charge);
      return;
    }

    /* --------------------------- Payment Intent OK --------------------------- */
    case "payment_intent.succeeded": {
      // Em alguns fluxos Basil, o PI é confirmado antes do "invoice.payment_succeeded"
      const pi = event.data.object as Stripe.PaymentIntent;
      const customerId = (pi.customer as any)?.id ?? (pi.customer as string);
      if (!customerId) return;
      const user = await findUserByCustomerId(customerId);
      if (!user) return;

      const isNewEvent = await markEventIfNew(user, event.id, { commit: false });
      if (!isNewEvent) return;

      if (shouldIgnoreOutOfOrderEvent(user, event)) return;

      // Tentar chegar na assinatura via invoice do PI
      let subId: string | null = null;
      if ((pi as any).invoice) {
        const invId = typeof (pi as any).invoice === "string" ? (pi as any).invoice : (pi as any).invoice?.id;
        if (invId) {
          try {
            const inv = await stripe.invoices.retrieve(invId as string, { expand: ["subscription"] });
            subId = getSubscriptionIdFromInvoice(inv);
          } catch {
            /* ignore */
          }
        }
      }

      if (subId && isSubscriptionMismatch(user, subId, event)) return;

      let updated = false;
      const eventDate = eventCreatedDate(event) ?? new Date();

      if (subId) {
        try {
          const sub = await withRetries(
            () =>
              stripe.subscriptions.retrieve(subId, {
                expand: ["items.data.price"],
              }),
            {
              context: buildEventMeta(user, event, {
                action: "retrieve_subscription",
                subscriptionId: subId,
              }),
            }
          );
          applyNormalizedUserBilling(user, sub, event.id);
          (user as any).lastPaymentError = undefined;
          (user as any).lastStripeEventAt = eventDate;
          (user as any).lastSubscriptionEventId = event.id;
          await markEventIfNew(user, event.id);
          await withRetries(
            () => user.save(),
            { context: buildEventMeta(user, event, { action: "user.save" }) }
          );
          updated = true;
        } catch {
          /* ignore */
        }
      }
      if (!updated) {
        (user as any).lastProcessedEventId = event.id;
        (user as any).lastStripeEventAt = eventDate;
        await markEventIfNew(user, event.id);
        await withRetries(
          () => user.save(),
          { context: buildEventMeta(user, event, { action: "user.save" }) }
        );
      }
      return;
    }

    /* ----------------------- Payment Intent falhou ----------------------- */
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const customerId = (pi.customer as any)?.id ?? (pi.customer as string);
      if (!customerId) return;
      const user = await findUserByCustomerId(customerId);
      if (!user) return;

      const isNewEvent = await markEventIfNew(user, event.id, { commit: false });
      if (!isNewEvent) return;

      if (shouldIgnoreOutOfOrderEvent(user, event)) return;

      (user as any).lastPaymentError = {
        at: new Date(),
        paymentId: pi.id,
        status: "failed",
        statusDetail:
          (pi.last_payment_error as any)?.message ||
          "Falha ao processar o pagamento.",
      };
      (user as any).lastProcessedEventId = event.id;
      (user as any).lastStripeEventAt = eventCreatedDate(event) ?? new Date();

      await markEventIfNew(user, event.id);

      await withRetries(
        () => user.save(),
        { context: buildEventMeta(user, event, { action: "user.save" }) }
      );
      return;
    }

    /* -------------- Assinatura criada/atualizada (fonte de verdade) -------------- */
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const subEventObj = event.data.object as Stripe.Subscription;
      const customerId = (subEventObj.customer as any)?.id ?? (subEventObj.customer as string);
      if (!customerId) return;
      const user = await findUserByCustomerId(customerId);
      if (!user) return;

      const isNewEvent = await markEventIfNew(user, event.id, { commit: false });
      if (!isNewEvent) return;

      if (shouldIgnoreOutOfOrderEvent(user, event)) return;

      if (isSubscriptionMismatch(user, subEventObj.id, event)) return;

      // Rebusca com expansões necessárias para decidir heurística
      const sub = await withRetries(
        () =>
          stripe.subscriptions.retrieve(subEventObj.id, {
            expand: ["items.data.price", "latest_invoice.payment_intent"],
          }),
        {
          context: buildEventMeta(user, event, {
            action: "retrieve_subscription",
            subscriptionId: subEventObj.id,
          }),
        }
      );

      const normalized = normalizeFromSubscription(sub);

      // Converte status anterior do DB ("trial") para "trialing" para a heurística
      const prevRaw = (user as any).planStatus as string | undefined;
      const prev = (prevRaw === "trial" ? "trialing" : prevRaw) as
        | Normalized["planStatus"]
        | undefined;

      let overrideStatus: Normalized["planStatus"] | undefined = undefined;

      // (A) Se o cancelamento está agendado, mostramos "non_renewing" enquanto ativa/trial
      const cancelAtPE = (sub as any).cancel_at_period_end === true;
      if (
        cancelAtPE &&
        (normalized.planStatus === "active" || normalized.planStatus === "trialing")
      ) {
        overrideStatus = "non_renewing";
      }

      // (B) Heurística anti-downgrade
      if (
        (normalized.planStatus === "past_due" || normalized.planStatus === "incomplete") &&
        isLikelyPlanChangePaymentPending(sub.latest_invoice as any, prev)
      ) {
        if (cancelAtPE) {
          overrideStatus = "non_renewing";
        } else {
          if (prev === "trialing") overrideStatus = "trialing";
          else if (prev === "non_renewing") overrideStatus = "non_renewing";
          else if (prev === "active") overrideStatus = "active";
          else overrideStatus = "active";
        }
      }

      applyNormalizedUserBilling(user, sub, event.id, { overrideStatus });
      (user as any).lastSubscriptionEventId = event.id;
      (user as any).lastStripeEventAt = eventCreatedDate(event) ?? new Date();

      await markEventIfNew(user, event.id);

      await withRetries(
        () => user.save(),
        { context: buildEventMeta(user, event, { action: "user.save" }) }
      );
      return;
    }

    /* --------------------------- Assinatura deletada --------------------------- */
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = (sub.customer as any)?.id ?? (sub.customer as string);
      if (!customerId) return;
      const user = await findUserByCustomerId(customerId);
      if (!user) return;

      const isNewEvent = await markEventIfNew(user, event.id, { commit: false });
      if (!isNewEvent) return;

      if (isSubscriptionMismatch(user, sub.id, event, { requireMatch: true })) return;

      if (shouldIgnoreOutOfOrderEvent(user, event)) return;

      // Marca como cancelada; zera flags que confundem o UI
      (user as any).planStatus = "canceled";
      (user as any).cancelAtPeriodEnd = false;
      (user as any).stripeSubscriptionId = sub.id;
      (user as any).stripePriceId = null;
      (user as any).planInterval = undefined; // não usar null aqui
      (user as any).planExpiresAt =
        typeof (sub as any)?.ended_at === "number"
          ? new Date((sub as any).ended_at * 1000)
          : new Date();
      (user as any).currentPeriodEnd = (user as any).planExpiresAt;
      (user as any).lastSubscriptionEventId = event.id;
      (user as any).lastStripeEventAt = eventCreatedDate(event) ?? new Date();

      await markEventIfNew(user, event.id);

      await withRetries(
        () => user.save(),
        { context: buildEventMeta(user, event, { action: "user.save" }) }
      );
      return;
    }

    default:
      return;
  }
}
