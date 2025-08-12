// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import { logger } from "@/app/lib/logger";
import { normCur } from "@/utils/normCur";
import Redemption from "@/app/models/Redemption";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

// ⚠️ IMPORTANTE: No Stripe Dashboard, aponte o webhook para /api/stripe/webhook
// Mínimos (Connect enabled): account.updated, transfer.reversed,
// invoice.payment_succeeded, invoice.payment_failed,
// customer.subscription.updated, customer.subscription.deleted

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event;
  try {
    const payload = await req.text(); // precisa do raw body
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    logger.error("[stripe/webhook] signature error:", err?.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await connectToDatabase();

    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as any;
        const acctId = account.id as string;

        const destCurrency = (account.default_currency || "").toLowerCase() || null;
        let status: "verified" | "pending" | "disabled" = "pending";
        if (account.charges_enabled && account.payouts_enabled) status = "verified";
        if (account.requirements?.disabled_reason) status = "disabled";

        const user = await User.findOne({ "paymentInfo.stripeAccountId": acctId });
        if (user) {
          user.paymentInfo ||= {};
          user.paymentInfo.stripeAccountStatus = status;
          user.paymentInfo.stripeAccountDefaultCurrency = destCurrency || undefined;
          await user.save();
        }
        break;
      }

      case "transfer.reversed": {
        const transfer = event.data.object as any;
        const transactionId = transfer.id as string;
        const redemption = await Redemption.findOne({ transactionId });
        if (redemption) {
          const user = await User.findById(redemption.userId);
          if (user) {
            const cur = redemption.currency.toLowerCase();
            const balances: Map<string, number> = user.affiliateBalances || new Map();
            const prev = balances.get(cur) ?? 0;
            balances.set(cur, prev + redemption.amountCents);
            user.markModified("affiliateBalances");
            await user.save();
          }
          redemption.status = "rejected";
          redemption.notes = `Reversed by Stripe: ${transactionId}`;
          await redemption.save();
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const reason = invoice.billing_reason ?? '';
        // primeira fatura PAGA da vida do cliente:
        // pode ser 'subscription_create' (sem trial) ou 'subscription_cycle' (primeira pós-trial)
        const isFirstCycle = reason === 'subscription_create' || reason === 'subscription_cycle';
        if (!isFirstCycle || !invoice.amount_paid || invoice.amount_paid <= 0) break;
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

        if (!customerId) break;
        const user = await User.findOne({ stripeCustomerId: customerId });
        if (!user) break;
        if (user.lastProcessedEventId === event.id) break;
        user.lastProcessedEventId = event.id;

        // Define plano e expiração a partir da própria invoice
        const line = invoice.lines?.data?.find((l) => l?.price?.recurring);
        const periodEnd = line?.period?.end ? new Date(line.period.end * 1000) : null;
        const interval = line?.price?.recurring?.interval as "month" | "year" | undefined;

        if (interval) {
          user.planInterval = interval;
          user.planType = interval === "year" ? "annual" : "monthly";
        }
        user.planStatus = "active";
        if (periodEnd) user.planExpiresAt = periodEnd;
        if (subId) user.stripeSubscriptionId = subId;

        // Comissão somente na 1ª cobrança da vida do cliente + sem cupom manual
        // Detectar cupom manual vs. cupom interno de afiliado
        const anyInv: any = invoice as any;
        const couponId: string | null = anyInv?.discount?.coupon?.id || null;
        const AFF_BRL = process.env.STRIPE_COUPON_AFFILIATE10_ONCE_BRL;
        const AFF_USD = process.env.STRIPE_COUPON_AFFILIATE10_ONCE_USD;
        const isAffiliateCoupon = couponId && (couponId === AFF_BRL || couponId === AFF_USD);
        const manualCouponUsed = Boolean(couponId && !isAffiliateCoupon);

        if (!user.hasAffiliateCommissionPaid && !manualCouponUsed && user.affiliateUsed) {
          const affUser = await User.findOne({ affiliateCode: user.affiliateUsed });
          if (affUser && String(affUser._id) !== String(user._id)) {
            if (!affUser.affiliateBalances) {
              affUser.affiliateBalances = new Map<string, number>();
            }
            // Evitar repetir comissão para este cliente (mesmo com outro afiliado no futuro)
            if (!affUser.commissionPaidInvoiceIds?.includes(String(invoice.id))) {
              const percent = Number(process.env.AFFILIATE_COMMISSION_PERCENT || 10) / 100;
              const subtotalCents = (anyInv?.amount_subtotal ?? invoice.amount_paid ?? 0);
              const amountCents = Math.round(subtotalCents * percent);
              const cur = normCur((invoice as any).currency);
              let status: 'paid' | 'failed' | 'fallback' = 'paid';
              let transactionId: string | null = null;

              if (affUser.paymentInfo?.stripeAccountId && affUser.affiliatePayoutMode === 'connect') {
                try {
                  const account = await stripe.accounts.retrieve(affUser.paymentInfo.stripeAccountId);
                  const destCurrency = normCur((account as any).default_currency);
                  const payoutsEnabled = Boolean((account as any).payouts_enabled);
                  if (!payoutsEnabled || destCurrency !== cur) {
                    status = 'fallback';
                    const prev = affUser.affiliateBalances?.get(cur) ?? 0;
                    affUser.affiliateBalances?.set(cur, prev + amountCents);
                    affUser.markModified('affiliateBalances');
                  } else {
                    const transfer = await stripe.transfers.create({
                      amount: amountCents,
                      currency: destCurrency,
                      destination: affUser.paymentInfo.stripeAccountId,
                      description: `Comissão de ${user.email || user._id}`,
                      metadata: {
                        invoiceId: String(invoice.id),
                        referredUserId: String(user._id),
                        affiliateUserId: String(affUser._id),
                        affiliateCode: affUser.affiliateCode || ''
                      },
                    }, { idempotencyKey: `commission_${invoice.id}_${affUser._id}` });
                    transactionId = transfer.id;
                  }
                } catch (err) {
                  logger.error('[stripe/webhook] transfer error:', { err, currency: (invoice as any).currency, amountCents });
                  status = 'failed';
                  const prev = affUser.affiliateBalances?.get(cur) ?? 0;
                  affUser.affiliateBalances?.set(cur, prev + amountCents);
                  affUser.markModified('affiliateBalances');
                }
              } else {
                status = 'fallback';
                const prev = affUser.affiliateBalances?.get(cur) ?? 0;
                affUser.affiliateBalances?.set(cur, prev + amountCents);
                affUser.markModified('affiliateBalances');
              }

              affUser.commissionLog = affUser.commissionLog || [];
              affUser.commissionLog.push({
                date: new Date(),
                description: `Comissão (1ª cobrança) de ${user.email || user._id}`,
                sourcePaymentId: String(invoice.id),
                referredUserId: user._id,
                status,
                transactionId,
                currency: cur,
                amountCents,
              });
              affUser.commissionPaidInvoiceIds = affUser.commissionPaidInvoiceIds || [];
              affUser.commissionPaidInvoiceIds.push(String(invoice.id));
              affUser.affiliateInvites = (affUser.affiliateInvites || 0) + 1;
              if (affUser.affiliateInvites % 5 === 0) {
                affUser.affiliateRank = (affUser.affiliateRank || 1) + 1;
              }
              await affUser.save();

              // marcar no usuário indicado que a comissão já foi paga (evita comissões com outros afiliados no futuro)
              user.hasAffiliateCommissionPaid = true as any; // campo adicionado no modelo
            }
          }
        }
        // Sempre limpa affiliateUsed após processar a cobrança inicial
        if (user.affiliateUsed) {
          user.affiliateUsed = null; // padroniza com o schema (string | null)
        }

        user.lastPaymentError = undefined;
        await user.save();
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        const user = await User.findOne({ stripeCustomerId: customerId });
        if (!user) break;
        if (user.lastProcessedEventId === event.id) break;
        user.lastProcessedEventId = event.id;

        user.lastPaymentError = {
          at: new Date(),
          paymentId: String(invoice.id),
          status: "failed",
          statusDetail: String(invoice.last_finalization_error?.message || "unknown"),
        };
        await user.save();
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const item = sub.items.data[0];
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!customerId) break;

        const update: any = {
          planStatus: sub.cancel_at_period_end ? "non_renewing" : sub.status,
          stripeSubscriptionId: sub.id,
          stripePriceId: item?.price?.id,
          planInterval: item?.price?.recurring?.interval,
        };
        if (sub.current_period_end) {
          update.planExpiresAt = new Date(sub.current_period_end * 1000);
        }
        await User.updateOne(
          { stripeCustomerId: customerId },
          { $set: { ...update, lastProcessedEventId: event.id } }
        );
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!customerId) break;
        const user = await User.findOne({ stripeCustomerId: customerId });
        if (!user) break;
        if (user.lastProcessedEventId === event.id) break;
        user.lastProcessedEventId = event.id;

        user.planStatus = "inactive";
        user.planExpiresAt = null;
        await user.save();
        break;
      }

      case "charge.refunded":
      case "charge.dispute.funds_withdrawn":
      case "charge.dispute.closed": {
        // Clawback até 7 dias
        const charge: any = event.data.object as any;
        const invoiceId: string | undefined = typeof charge.invoice === 'string' ? charge.invoice : undefined;
        if (!invoiceId) break;

        // encontrar afiliado que recebeu a comissão desta invoice
        const affUser = await User.findOne({ 'commissionLog.sourcePaymentId': invoiceId });
        if (!affUser) break;
        const entry = (affUser.commissionLog || []).find((e: any) => e.sourcePaymentId === invoiceId && (e.status === 'paid' || e.status === 'fallback' || e.status === 'failed'));
        if (!entry) break;

        const createdAt = new Date(entry.date).getTime();
        const within7d = (Date.now() - createdAt) <= 7*24*60*60*1000;
        if (!within7d) break;

        const cur = String(entry.currency || 'brl').toLowerCase();
        try {
          if (entry.status === 'paid' && entry.transactionId) {
            await stripe.transfers.createReversal(entry.transactionId, { amount: entry.amountCents });
          } else {
            // held/failed -> apenas ajustar ledger
          }
        } catch (e) {
          // se não conseguir reverter, cai para ajuste de ledger negativo
        }

        const prev = affUser.affiliateBalances?.get(cur) ?? 0;
        affUser.affiliateBalances?.set(cur, prev - entry.amountCents);
        affUser.markModified('affiliateBalances');
        affUser.commissionLog.push({
          date: new Date(),
          description: `Clawback comissão invoice ${invoiceId}`,
          sourcePaymentId: invoiceId,
          status: 'accrued', // marca de ajuste no log (usando novo status)
          transactionId: null,
          currency: cur,
          amountCents: -entry.amountCents,
        });
        await affUser.save();
        break;
      }

      default:
        // opcional: log leve para monitorar
        // console.debug("[stripe/webhook] ignorado:", event.type);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    logger.error("[stripe/webhook] handler error:", err);
    return NextResponse.json({ received: true, error: "logged" }, { status: 200 });
  }
}

// Tipos Stripe (evita import global pesado)
declare namespace Stripe {
  export interface Invoice {
    id: string;
    total: number | null;
    amount_paid?: number | null;
    currency?: string;
    subscription: string | { id: string } | null;
    customer: string | { id: string } | null;
    billing_reason?: string;
    last_finalization_error?: { message?: string };
    lines: { data: Array<{ period: { start: number; end: number }, price?: { recurring?: { interval?: "day"|"week"|"month"|"year" } } }> };
  }
  export interface Subscription {
    id: string;
    customer: string | { id: string };
    status: "active" | "trialing" | "past_due" | "unpaid" | "canceled" | "incomplete" | "incomplete_expired" | "paused";
    cancel_at_period_end: boolean | null;
    current_period_end: number;
    items: { data: Array<{ id: string, price: { id: string; recurring?: { interval?: "day"|"week"|"month"|"year" } } }> };
  }
}
