import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";

export const runtime = "nodejs";

// ⚠️ IMPORTANTE: No Stripe Dashboard, aponte o webhook para /api/stripe/webhook
// Eventos mínimos: invoice.payment_succeeded, invoice.payment_failed,
// customer.subscription.updated, customer.subscription.deleted

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event;
  try {
    const payload = await req.text(); // precisa do raw body
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("[stripe/webhook] signature error:", err?.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await connectToDatabase();

    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason !== 'subscription_create' || !invoice.total || invoice.total <= 0) {
          break;
        }
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

        // Comissão somente na 1ª cobrança da assinatura
        if (user.affiliateUsed) {
          const affUser = await User.findOne({ affiliateCode: user.affiliateUsed });
          if (affUser) {
            const alreadyPaidForThisReferral = (affUser.commissionLog || []).some(
              (e) => String(e.referredUserId) === String(user._id) && e.status === 'paid'
            );
            if (alreadyPaidForThisReferral) {
              user.affiliateUsed = null;
              await user.save();
              break;
            }
            if (!affUser.commissionPaidInvoiceIds?.includes(String(invoice.id))) {
              const percent = Number(process.env.AFFILIATE_COMMISSION_PERCENT || 10) / 100;
              const amountCents = Math.round((invoice.total ?? 0) * percent);
              let status: 'paid' | 'failed' | 'fallback' = 'paid';
              let transferId: string | null = null;

              if (affUser.paymentInfo?.stripeAccountId && affUser.affiliatePayoutMode === 'connect') {
                try {
                  const transfer = await stripe.transfers.create({
                    amount: amountCents,
                    currency: (invoice as any).currency || 'usd',
                    destination: affUser.paymentInfo.stripeAccountId,
                    description: `Comissão de ${user.email || user._id}`,
                    metadata: {
                      invoiceId: String(invoice.id),
                      referredUserId: String(user._id),
                      affiliateUserId: String(affUser._id),
                      affiliateCode: affUser.affiliateCode || ''
                    },
                  }, { idempotencyKey: `commission_${invoice.id}_${affUser._id}` });
                  transferId = transfer.id;
                } catch (err) {
                  console.error('[stripe/webhook] transfer error:', { err, currency: (invoice as any).currency, amountCents });
                  status = 'failed';
                  affUser.affiliateBalance = (affUser.affiliateBalance || 0) + amountCents / 100;
                }
              } else {
                status = 'fallback';
                affUser.affiliateBalance = (affUser.affiliateBalance || 0) + amountCents / 100;
              }

              affUser.commissionLog = affUser.commissionLog || [];
              affUser.commissionLog.push({
                date: new Date(),
                amount: amountCents / 100,
                description: `Comissão (1ª cobrança) de ${user.email || user._id}`,
                sourcePaymentId: String(invoice.id),
                referredUserId: user._id,
                status,
                transferId,
              });
              affUser.commissionPaidInvoiceIds = affUser.commissionPaidInvoiceIds || [];
              affUser.commissionPaidInvoiceIds.push(String(invoice.id));
              affUser.affiliateInvites = (affUser.affiliateInvites || 0) + 1;
              if (affUser.affiliateInvites % 5 === 0) {
                affUser.affiliateRank = (affUser.affiliateRank || 1) + 1;
              }
              await affUser.save();
            }
            user.affiliateUsed = null; // limpa para não pagar em renovações
          }
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

      default:
        // opcional: log leve para monitorar
        // console.debug("[stripe/webhook] ignorado:", event.type);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[stripe/webhook] handler error:", err);
    // Sempre 2xx para evitar replays agressivos; logamos o erro para reprocessar manualmente se preciso
    return NextResponse.json({ received: true, error: "logged" }, { status: 200 });
  }
}

// Tipos Stripe (evita import global pesado)
// Se o projeto já tiver os tipos, pode remover este bloco e usar diretamente Stripe.* acima.
declare namespace Stripe {
  export interface Invoice {
    id: string;
    total: number | null;
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

