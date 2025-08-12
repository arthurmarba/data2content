import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import { normCur } from "@/utils/normCur";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { subscriptionId } = await req.json();
    if (!subscriptionId)
      return NextResponse.json(
        { error: "subscriptionId is required" },
        { status: 400 }
      );

    const session = await getServerSession(authOptions as any);
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
      !user.hasAffiliateCommissionPaid &&
      user.affiliateUsed
    ) {
      const affUser = await User.findOne({
        affiliateCode: user.affiliateUsed,
      });
      if (affUser && String(affUser._id) !== String(user._id)) {
        if (!affUser.affiliateBalances)
          affUser.affiliateBalances = new Map<string, number>();
        const percent =
          Number(process.env.AFFILIATE_COMMISSION_PERCENT || 10) / 100;
        const subtotalCents =
          invoice?.amount_subtotal ?? invoice?.amount_paid ?? 0;
        const amountCents = Math.round(subtotalCents * percent);
        const cur = normCur(invoice.currency);
        let status: "paid" | "fallback" | "failed" = "paid";
        let transactionId: string | null = null;
        try {
          if (affUser.paymentInfo?.stripeAccountId) {
            const account = await stripe.accounts.retrieve(
              affUser.paymentInfo.stripeAccountId
            );
            const payoutsEnabled = Boolean((account as any).payouts_enabled);
            const destCurrency = normCur((account as any).default_currency);
            if (!payoutsEnabled || destCurrency !== cur) {
              status = "fallback";
            } else {
              const transfer = await stripe.transfers.create(
                {
                  amount: amountCents,
                  currency: destCurrency,
                  destination: affUser.paymentInfo.stripeAccountId,
                  description: `Comissão de ${user.email || user._id}`,
                  metadata: {
                    invoiceId: String(invoice.id),
                    referredUserId: String(user._id),
                    affiliateUserId: String(affUser._id),
                    affiliateCode: affUser.affiliateCode || "",
                  },
                },
                {
                  idempotencyKey: `commission_${invoice.id}_${affUser._id}`,
                }
              );
              transactionId = transfer.id;
            }
          } else {
            status = "fallback";
          }
        } catch (e) {
          status = "failed";
        }

        if (status !== "paid") {
          const prev = affUser.affiliateBalances.get(cur) ?? 0;
          affUser.affiliateBalances.set(cur, prev + amountCents);
          affUser.markModified("affiliateBalances");
        }
        (affUser.commissionLog ??= []).push({
          date: new Date(),
          description: `Comissão (1ª cobrança) de ${user.email || user._id}`,
          sourcePaymentId: String(invoice.id),
          referredUserId: user._id,
          status,
          transactionId,
          currency: cur,
          amountCents,
        });
        (affUser.commissionPaidInvoiceIds ??= []).push(String(invoice.id));
        affUser.affiliateInvites = (affUser.affiliateInvites || 0) + 1;
        if (affUser.affiliateInvites % 5 === 0)
          affUser.affiliateRank = (affUser.affiliateRank || 1) + 1;
        await affUser.save();

        user.hasAffiliateCommissionPaid = true as any;
      }
      // limpar marcação de uso do afiliado após a 1ª cobrança
      user.affiliateUsed = null;
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

