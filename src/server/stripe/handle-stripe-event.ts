import type Stripe from "stripe";
import { User } from "@/server/db/models/User";
import { findUserByCustomerId, markEventIfNew, ensureInvoiceIdempotent, ensureSubscriptionFirstTime, calcCommissionCents, addDays } from "./webhook-helpers";
import { adjustBalance } from "@/server/affiliate/balance";
import { processAffiliateRefund } from "@/server/affiliate/refund";

const HOLD_DAYS = Number(process.env.AFFILIATE_HOLD_DAYS ?? "7");

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = (invoice.customer as any)?.id ?? (invoice.customer as string);
      if (!customerId) return;

      const user = await findUserByCustomerId(customerId);
      if (!user) return; // opcional: cancelar sub órfã

      // idempotência de evento por usuário
      const proceed = await markEventIfNew(user, event.id);
      if (!proceed) return;

      // Ativar plano
      const subId = (invoice.subscription as any)?.id ?? (invoice.subscription as string);
      const period = invoice.lines?.data?.[0]?.period;
      user.planStatus = "active";
      user.stripeSubscriptionId = subId ?? user.stripeSubscriptionId ?? null;
      user.planInterval = invoice.lines?.data?.[0]?.price?.recurring?.interval ?? user.planInterval ?? null;
      user.planExpiresAt = period?.end ? new Date(period.end * 1000) : user.planExpiresAt ?? null;

      // Primeira comissão (somente se amount_paid > 0)
      if ((invoice.amount_paid ?? 0) > 0 && !user.affiliateFirstCommissionAt) {
        user.affiliateFirstCommissionAt = new Date();

        const code = (user as any).affiliateUsed || invoice.metadata?.affiliateCode;
        if (code) {
          const owner = await User.findOne({ affiliateCode: code });
          if (owner && String(owner._id) !== String(user._id)) {
            const okInvoice = await ensureInvoiceIdempotent(invoice.id!, String(owner._id));
            const okSub = subId ? await ensureSubscriptionFirstTime(subId, String(owner._id)) : true;
            if (okInvoice && okSub) {
              const amountCents = calcCommissionCents(invoice);
              if (amountCents > 0) {
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

      // limpar erro anterior
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

      // localizar afiliado pelo código usado
      if (!(buyer as any).affiliateUsed) return;
      const owner = await User.findOne({ affiliateCode: (buyer as any).affiliateUsed });
      if (!owner) return;

      const idx = (owner as any).commissionLog.findIndex((e: any) =>
        e.type === "commission" &&
        e.invoiceId === invoice.id &&
        (e.status === "pending" || e.status === "available")
      );
      if (idx >= 0) {
        const entry = (owner as any).commissionLog[idx];
        if (entry.status === "available") {
          await adjustBalance(owner, entry.currency, -Math.abs(entry.amountCents));
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
      const invId = (charge.invoice as any)?.id ?? (charge.invoice as string);
      if (!invId) return;
      // delega para rotina que calcula parcial/total e ajusta saldo/dívida
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
      (user as any).planInterval = interval === "month" || interval === "year" ? interval : (user as any).planInterval ?? null;
      (user as any).stripeSubscriptionId = sub.id;
      (user as any).stripePriceId = item?.price?.id ?? (user as any).stripePriceId ?? null;
      (user as any).planStatus = sub.cancel_at_period_end ? "canceled" : (sub.status as any);

      const ends: number[] = [];
      for (const i of sub.items?.data ?? []) {
        if (i?.billing_thresholds?.reset_billing_cycle_anchor) continue;
        if (sub.current_period_end) ends.push(sub.current_period_end);
      }
      const minEnd = ends.length ? Math.min(...ends) : sub.current_period_end;
      if (minEnd) (user as any).planExpiresAt = new Date(minEnd * 1000);

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

      // somente se for a sub atual
      if ((user as any).stripeSubscriptionId === sub.id) {
        (user as any).planStatus = "inactive";
        (user as any).planExpiresAt = null;
        await user.save();
      }
      return;
    }

    default:
      return; // ignore outros
  }
}
