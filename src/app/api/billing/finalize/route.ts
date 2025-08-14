import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth"; // <— TIPAGEM adicionada
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import { normCur } from "@/utils/normCur";
import { logger } from "@/app/lib/logger";
import {
  ensureInvoiceIdempotent,
  ensureSubscriptionFirstTime,
} from "@/app/services/affiliate/idempotency";
import { calcCommissionCents } from "@/app/services/affiliate/calcCommissionCents";
import { AFFILIATE_HOLD_DAYS } from "@/config/affiliates";

function addDays(d: Date, days: number) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt;
}

export const runtime = "nodejs";

// Tipagem local para garantir que "user.id" exista no TS
type AppSession = Session & { user?: { id?: string | null } };

export async function POST(req: NextRequest) {
  try {
    const { subscriptionId } = await req.json();
    if (!subscriptionId)
      return NextResponse.json(
        { error: "subscriptionId is required" },
        { status: 400 }
      );

    // Cast explícito evita "Property 'user' does not exist on type '{}'"
    const session = (await getServerSession(
      authOptions as any
    )) as AppSession | null;

    if (!session?.user?.id)
      return NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 }
      );

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user)
      return NextResponse.json({ error: "user not found" }, { status: 404 });

    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: [
        "latest_invoice.payment_intent",
        "latest_invoice.discount.coupon",
      ],
    });
    const invoice: any = sub.latest_invoice;
    const paid: boolean =
      Boolean(invoice?.paid) || invoice?.payment_intent?.status === "succeeded";
    const reason = invoice?.billing_reason ?? "";
    const isFirstCycle =
      reason === "subscription_create" || reason === "subscription_cycle";

    // 1) Ativar plano imediatamente
    if (paid && (sub.status === "active" || sub.status === "trialing")) {
      (user as any).planStatus = "active";
      (user as any).stripeSubscriptionId = sub.id;
      (user as any).stripeCustomerId =
        (typeof sub.customer === "string"
          ? sub.customer
          : (sub.customer as any)?.id) || (user as any).stripeCustomerId;
    }

    // 2) Comissão do afiliado (1ª fatura, sem cupom manual)
    const couponId: string | null = invoice?.discount?.coupon?.id || null;
    const AFF_BRL = process.env.STRIPE_COUPON_AFFILIATE10_ONCE_BRL;
    const AFF_USD = process.env.STRIPE_COUPON_AFFILIATE10_ONCE_USD;
    const isAffiliateCoupon =
      couponId && (couponId === AFF_BRL || couponId === AFF_USD);
    const manualCouponUsed = Boolean(couponId && !isAffiliateCoupon);

    if (
      paid &&
      isFirstCycle &&
      !manualCouponUsed &&
      !(user as any).hasAffiliateCommissionPaid &&
      (user as any).affiliateUsed
    ) {
      const affUser = await User.findOne({
        affiliateCode: (user as any).affiliateUsed,
      });
      if (affUser && String(affUser._id) !== String(user._id)) {
        const invoiceId = String(invoice.id);
        const invoiceCheck = await ensureInvoiceIdempotent(
          invoiceId,
          affUser._id
        );
        if (!invoiceCheck.ok) {
          logger.info("[affiliate:idempotency] skip duplicate invoice", {
            invoiceId,
            affiliateUserId: String(affUser._id),
          });
        } else {
          const subId =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : invoice.subscription?.id;
          let proceed = true;
          if (subId) {
            const subCheck = await ensureSubscriptionFirstTime(
              subId,
              affUser._id
            );
            if (!subCheck.ok) {
              logger.info(
                "[affiliate:business] skip subscription already commissioned",
                {
                  subscriptionId: subId,
                  affiliateUserId: String(affUser._id),
                }
              );
              proceed = false;
            }
          }
          if (proceed) {
            const amountCents = calcCommissionCents(invoice as any);
            const cur = normCur(invoice.currency);
            const availableAt = addDays(new Date(), AFFILIATE_HOLD_DAYS);

            ((affUser as any).commissionLog ??= []).push({
              type: 'commission',
              status: 'pending',
              invoiceId,
              subscriptionId: subId,
              affiliateUserId: affUser._id,
              buyerUserId: user._id,
              currency: cur,
              amountCents,
              availableAt,
            } as any);

            logger.info('[affiliate:commission] created pending', {
              invoiceId,
              subscriptionId: subId,
              affiliateUserId: String(affUser._id),
              buyerUserId: String(user._id),
              currency: cur,
              amountCents,
              availableAt,
            });
            ((affUser as any).commissionPaidInvoiceIds ??= []).push(invoiceId);
            (affUser as any).affiliateInvites =
              ((affUser as any).affiliateInvites || 0) + 1;
            if (((affUser as any).affiliateInvites as number) % 5 === 0)
              (affUser as any).affiliateRank =
                ((affUser as any).affiliateRank || 1) + 1;
            await (affUser as any).save();

            (user as any).hasAffiliateCommissionPaid = true;
          }
        }
      }
      // limpar marcação de uso do afiliado após a 1ª cobrança
      (user as any).affiliateUsed = null;
    }

    await user.save();
    return NextResponse.json({
      ok: true,
      planStatus: (user as any).planStatus,
      subStatus: sub.status,
      invoicePaid: paid,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "finalize_failed" },
      { status: 500 }
    );
  }
}
