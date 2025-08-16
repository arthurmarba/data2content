import type Stripe from "stripe";
import { User } from "@/server/db/models/User";
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

// Extrai subscriptionId do Invoice (compat com basil: pode ser string ou objeto)
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub: unknown = (invoice as any)?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : (sub as any)?.id ?? null;
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

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = (invoice.customer as any)?.id ?? (invoice.customer as string);
      if (!customerId) return;

      const user = await findUserByCustomerId(customerId);
      if (!user) return;

      const proceed = await markEventIfNew(user, event.id);
      if (!proceed) return;

      const subId = getSubscriptionIdFromInvoice(invoice);
      const period = invoice.lines?.data?.[0]?.period;
      (user as any).planStatus = "active";
      (user as any).stripeSubscriptionId = subId ?? (user as any).stripeSubscriptionId ?? null;
      (user as any).planInterval = getIntervalFromInvoice(invoice) ?? (user as any).planInterval ?? null;
      (user as any).planExpiresAt = period?.end ? new Date(period.end * 1000) : (user as any).planExpiresAt ?? null;

      if ((invoice.amount_paid ?? 0) > 0) {
        const code = (user as any).affiliateUsed || invoice.metadata?.affiliateCode;
        if (code) {
          const owner = await User.findOne({ affiliateCode: code });
          
          if (owner && String(owner._id) !== String(user._id)) {
            
            const okInvoice = await ensureInvoiceIdempotent(invoice.id!, String(owner._id));
            const okSub = subId ? await ensureSubscriptionFirstTime(subId, String(owner._id)) : true;

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

      (user as any).lastPaymentError = undefined;
      await user.save();
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = (invoice.customer as any)?.id ?? (invoice.customer as string);
      if (!customerId) return;
      const user = await findUserByCustomerId(customerId);
      if (!user) return;

      const proceed = await markEventIfNew(user, event.id);
      if (!proceed) return;

      const pmErr = invoice?.last_finalization_error?.message || "Pagamento não autorizado.";
      (user as any).lastPaymentError = {
        at: new Date(),
        id: invoice.id!,
        status: "failed",
        statusDetail: pmErr,
      };
      await user.save();
      return;
    }

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
        entry.reversedAt = new Date();
        entry.reversalReason = "invoice.voided";
        await owner.save();
      }
      return;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const invId = getInvoiceIdFromCharge(charge);
      if (!invId) return;
      await processAffiliateRefund(invId, undefined, charge);
      return;
    }

    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = (sub.customer as any)?.id ?? (sub.customer as string);
      if (!customerId) return;
      const user = await findUserByCustomerId(customerId);
      if (!user) return;

      const proceed = await markEventIfNew(user, event.id);
      if (!proceed) return;

      const item = sub.items?.data?.[0];
      const interval = item?.price?.recurring?.interval;
      (user as any).planInterval =
        interval === "month" || interval === "year" ? interval : (user as any).planInterval ?? null;
      (user as any).stripeSubscriptionId = sub.id;
      (user as any).stripePriceId = item?.price?.id ?? (user as any).stripePriceId ?? null;
      
      // --- INÍCIO DA CORREÇÃO ---
      // Se a assinatura foi agendada para cancelar no fim do período, nosso status
      // interno deve ser 'canceled'. Caso contrário, espelhamos o status do Stripe.
      (user as any).planStatus = sub.cancel_at_period_end ? "canceled" : (sub.status as any);
      // --- FIM DA CORREÇÃO ---

      const currentPeriodEnd = (sub as any)?.current_period_end as number | undefined;
      if (typeof currentPeriodEnd === "number") {
        (user as any).planExpiresAt = new Date(currentPeriodEnd * 1000);
      }

      await user.save();
      return;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = (sub.customer as any)?.id ?? (sub.customer as string);
      if (!customerId) return;
      const user = await findUserByCustomerId(customerId);
      if (!user) return;

      const proceed = await markEventIfNew(user, event.id);
      if (!proceed) return;
      
      if ((user as any).stripeSubscriptionId === sub.id) {
        (user as any).planStatus = "inactive";
        (user as any).planExpiresAt = null;
        await user.save();
      }
      return;
    }

    default:
      return;
  }
}