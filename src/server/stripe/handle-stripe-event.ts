// src/server/stripe/handle-stripe-event.ts
import type Stripe from "stripe";
import { User } from "@/server/db/models/User";
import { stripe } from "@/app/lib/stripe";
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

function normalizeFromSubscription(sub: Stripe.Subscription): Normalized {
  const cancelAtPeriodEnd = !!(sub as any).cancel_at_period_end;
  const baseStatus = ((sub as any).status ?? "inactive") as Normalized["planStatus"];
  const planStatus: Normalized["planStatus"] = baseStatus;

  const item = sub.items?.data?.[0];
  const planInterval = coerceInterval(item?.price?.recurring?.interval as any);

  // Em Basil, o fim do período pode vir por item: current_period_end
  const itemEnds: number[] =
    sub.items?.data
      ?.map((it: any) => it?.current_period_end)
      ?.filter((n: any) => typeof n === "number") ?? [];

  let planExpiresAt: Date | null = null;
  if (typeof (sub as any).cancel_at === "number") {
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

function applyNormalizedUserBilling(
  user: any,
  sub: Stripe.Subscription,
  eventId?: string,
  opts?: { overrideStatus?: Normalized["planStatus"] }
): void {
  const n = normalizeFromSubscription(sub);
  user.stripeSubscriptionId = sub.id;
  user.stripePriceId = n.stripePriceId;
  user.planStatus = opts?.overrideStatus ?? n.planStatus;
  user.planInterval = n.planInterval;
  user.planExpiresAt = n.planExpiresAt;
  user.currentPeriodEnd = n.planExpiresAt;
  user.cancelAtPeriodEnd = n.cancelAtPeriodEnd;
  if (n.currency) user.currency = n.currency;
  if (eventId) user.lastProcessedEventId = eventId;
}

/* ---------------------- Heurística anti-past_due/incomplete ---------------------- */

// Em Basil, o tipo de Invoice não expõe `payment_intent` no d.ts; acessamos via `any`.
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

  // Aceita qualquer billing_reason; focamos em PI pendente & recente
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
  switch (event.type) {
    /* -------------------- Cobrança confirmada (pró-rata) -------------------- */
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = (invoice.customer as any)?.id ?? (invoice.customer as string);
      if (!customerId) return;

      const user = await findUserByCustomerId(customerId);
      if (!user) return;

      const proceed = await markEventIfNew(user, event.id);
      if (!proceed) return;

      // 1) Atualiza billing a partir da assinatura (fonte de verdade)
      const subId = getSubscriptionIdFromInvoice(invoice);
      if (subId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subId, {
            expand: ["items.data.price"],
          });
          applyNormalizedUserBilling(user, sub, event.id);
        } catch {
          // Fallback: usa dados do invoice (menos precisos)
          const period = invoice.lines?.data?.[0]?.period;
          user.planStatus = "active";
          user.stripeSubscriptionId = subId ?? user.stripeSubscriptionId ?? null;
          user.planInterval =
            coerceInterval(getIntervalFromInvoice(invoice)) ?? user.planInterval;
          user.planExpiresAt = period?.end
            ? new Date(period.end * 1000)
            : user.planExpiresAt ?? null;
          user.cancelAtPeriodEnd = false;
          user.currency = (invoice.currency ?? "brl").toUpperCase();
          user.lastProcessedEventId = event.id;
        }
      } else {
        // Sem subId (raro): mantém compat a partir do invoice
        const period = invoice.lines?.data?.[0]?.period;
        user.planStatus = "active";
        user.planInterval =
          coerceInterval(getIntervalFromInvoice(invoice)) ?? user.planInterval;
        user.planExpiresAt = period?.end
          ? new Date(period.end * 1000)
          : user.planExpiresAt ?? null;
        user.cancelAtPeriodEnd = false;
        user.currency = (invoice.currency ?? "brl").toUpperCase();
        user.lastProcessedEventId = event.id;
      }

      // 2) Lógica de afiliados (mantida)
      if ((invoice.amount_paid ?? 0) > 0) {
        const code = (user as any).affiliateUsed || invoice.metadata?.affiliateCode;
        if (code) {
          const owner = await User.findOne({ affiliateCode: code });
          if (owner && String(owner._id) !== String(user._id)) {
            const okInvoice = await ensureInvoiceIdempotent(
              invoice.id!,
              String(owner._id)
            );
            const okSub = subId
              ? await ensureSubscriptionFirstTime(subId, String(owner._id))
              : true;

            if (okInvoice && okSub) {
              const amountCents = calcCommissionCents(invoice);
              if (amountCents > 0) {
                (user as any).affiliateFirstCommissionAt = new Date();
                (owner as any).commissionLog.push({
                  type: "commission",
                  status: "pending",
                  invoiceId: invoice.id!,
                  subscriptionId: subId ?? null,
                  affiliateUserId: owner._id,
                  buyerUserId: user._id,
                  currency: String(invoice.currency || "brl").toLowerCase(),
                  amountCents,
                  availableAt: addDays(new Date(), HOLD_DAYS),
                  createdAt: new Date(),
                });
                await owner.save();
              }
            }
          }
        }
      }

      // 3) Limpa erro de pagamento anterior (se houver) e salva UMA vez
      (user as any).lastPaymentError = undefined;
      await user.save();
      return;
    }

    /* -------------------------- Pagamento falhou -------------------------- */
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = (invoice.customer as any)?.id ?? (invoice.customer as string);
      if (!customerId) return;
      const user = await findUserByCustomerId(customerId);
      if (!user) return;

      const proceed = await markEventIfNew(user, event.id);
      if (!proceed) return;

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
      // Observação: não alteramos planStatus aqui. O status “past_due/incomplete”, se aplicável,
      // será decidido por customer.subscription.updated.
      await user.save();
      return;
    }

    /* ---------------------------- Fatura anulada ---------------------------- */
    case "invoice.voided": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = (invoice.customer as any)?.id ?? (invoice.customer as string);
      if (!customerId) return;
      const buyer = await findUserByCustomerId(customerId);
      if (!buyer) return;

      if (!(buyer as any).affiliateUsed) return;
      const owner = await User.findOne({ affiliateCode: (buyer as any).affiliateUsed });
      if (!owner) return;

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
        await owner.save();
      }
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

      const proceed = await markEventIfNew(user, event.id);
      if (!proceed) return;

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

      if (subId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subId, {
            expand: ["items.data.price"],
          });
          applyNormalizedUserBilling(user, sub, event.id);
          (user as any).lastPaymentError = undefined;
          await user.save();
        } catch {
          /* ignore */
        }
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

      const proceed = await markEventIfNew(user, event.id);
      if (!proceed) return;

      (user as any).lastPaymentError = {
        at: new Date(),
        paymentId: pi.id,
        status: "failed",
        statusDetail:
          (pi.last_payment_error as any)?.message ||
          "Falha ao processar o pagamento.",
      };
      await user.save();
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

      const proceed = await markEventIfNew(user, event.id);
      if (!proceed) return;

      // Rebusca com expansões necessárias para decidir heurística
      const sub = await stripe.subscriptions.retrieve(subEventObj.id, {
        expand: ["items.data.price", "latest_invoice.payment_intent"],
      });

      const normalized = normalizeFromSubscription(sub);
      const prev = (user as any).planStatus as Normalized["planStatus"] | undefined;

      let overrideStatus: Normalized["planStatus"] | undefined = undefined;

      // (A) Se o cancelamento está agendado, mostramos como "non_renewing"
      // quando a assinatura ainda está ativa ou em trial.
      const cancelAtPE = (sub as any).cancel_at_period_end === true;
      if (
        cancelAtPE &&
        (normalized.planStatus === "active" || normalized.planStatus === "trialing")
      ) {
        overrideStatus = "non_renewing";
      }

      // (B) Heurística anti-downgrade: se Stripe reporta past_due/incomplete,
      // mas a fatura da troca é recente e o PI está pendente, preserve status "bom".
      if (
        (normalized.planStatus === "past_due" || normalized.planStatus === "incomplete") &&
        isLikelyPlanChangePaymentPending(sub.latest_invoice as any, prev)
      ) {
        if (cancelAtPE) {
          // Se já está para encerrar no fim do ciclo, prioriza "non_renewing"
          overrideStatus = "non_renewing";
        } else {
          if (prev === "trialing") overrideStatus = "trialing";
          else if (prev === "non_renewing") overrideStatus = "non_renewing";
          else if (prev === "active") overrideStatus = "active";
          else overrideStatus = "active";
        }
      }

      applyNormalizedUserBilling(user, sub, event.id, { overrideStatus });
      await user.save();
      return;
    }

    /* --------------------------- Assinatura deletada --------------------------- */
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = (sub.customer as any)?.id ?? (sub.customer as string);
      if (!customerId) return;
      const user = await findUserByCustomerId(customerId);
      if (!user) return;

      const proceed = await markEventIfNew(user, event.id);
      if (!proceed) return;

      // Marca como cancelada; zera flags que confundem o UI
      (user as any).planStatus = "canceled";
      (user as any).cancelAtPeriodEnd = false;
      (user as any).stripeSubscriptionId = sub.id;
      (user as any).stripePriceId = null;
      (user as any).planInterval = undefined; // <<< não usar null aqui
      (user as any).planExpiresAt =
        typeof (sub as any)?.ended_at === "number"
          ? new Date((sub as any).ended_at * 1000)
          : new Date();
      (user as any).currentPeriodEnd = (user as any).planExpiresAt;
      (user as any).lastProcessedEventId = event.id;

      await user.save();
      return;
    }

    default:
      return;
  }
}
