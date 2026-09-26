// src/app/api/billing/subscription/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import Stripe from "stripe";
import {
  applyStaleStripeBillingPatch,
  isStripeResourceMissingError,
  persistStaleStripeBillingPatch,
} from "@/utils/stripeHelpers";
import {
  applyBillingStateToUser,
  billingStateFromSubscription,
  pickBestSubscription,
} from "@/app/lib/billing/stripeSubscriptionSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cacheHeader = { "Cache-Control": "no-store, max-age=0" } as const;

const subscriptionExpand: string[] = [
  "items.data.price",
  "default_payment_method",
  "latest_invoice.payment_intent",
  "latest_invoice.payment_intent.payment_method",
];

const subscriptionListExpand: string[] = [
  "data.items.data.price",
  "data.default_payment_method",
  "data.latest_invoice.payment_intent",
  "data.latest_invoice.payment_intent.payment_method",
];

export async function GET(_req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401, headers: cacheHeader }
      );
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404, headers: cacheHeader }
      );
    }

    let customerId = (user as any).stripeCustomerId ?? null;
    let sub: Stripe.Subscription | null = null;
    let listedSuccessfully = false;

    if (user.stripeSubscriptionId) {
      try {
        sub = (await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: subscriptionExpand,
        })) as Stripe.Subscription;
        if (typeof sub.customer === "string") {
          customerId = sub.customer;
        }
      } catch (error) {
        if (isStripeResourceMissingError(error, "subscription")) {
          user.stripeSubscriptionId = null;
        }
        sub = null;
      }
    }

    if (
      sub &&
      customerId &&
      (sub.status === "canceled" ||
        sub.status === "incomplete" ||
        sub.status === "incomplete_expired")
    ) {
      try {
        const listed = await stripe.subscriptions.list({
          customer: customerId as string,
          status: "all",
          limit: 10,
          expand: subscriptionListExpand,
        } as any);
        listedSuccessfully = true;
        const pick = pickBestSubscription(listed.data ?? []);
        if (pick && pick.id !== sub.id) {
          sub = (await stripe.subscriptions.retrieve(pick.id, {
            expand: subscriptionExpand,
          })) as Stripe.Subscription;
        }
      } catch (error) {
        if (isStripeResourceMissingError(error, "customer")) {
          await persistStaleStripeBillingPatch(user as any);
          return new NextResponse(null, { status: 204, headers: cacheHeader });
        }
        // fallback: mantém a assinatura original
      }
    }

    if (!sub && customerId) {
      try {
        const listed = await stripe.subscriptions.list({
          customer: customerId as string,
          status: "all",
          limit: 10,
          expand: subscriptionListExpand,
        } as any);
        listedSuccessfully = true;
        sub = pickBestSubscription(listed.data ?? []);
      } catch (error) {
        if (isStripeResourceMissingError(error, "customer")) {
          await persistStaleStripeBillingPatch(user as any);
          return new NextResponse(null, { status: 204, headers: cacheHeader });
        }
        listedSuccessfully = false;
      }
    }

    if (!sub) {
      if (listedSuccessfully) {
        applyStaleStripeBillingPatch(user as any, { clearCustomerId: false });
        await user.save();
      }
      return new NextResponse(null, { status: 204, headers: cacheHeader });
    }

    // ---------- Price / moeda ----------
    const firstItem = sub.items?.data?.[0];
    const price = (firstItem?.price as Stripe.Price | undefined) ?? undefined;

    // fallback p/ APIs antigas que ainda expunham plan no root (tipagem via any para não quebrar)
    const legacyPlan = (sub as any).plan as { amount?: number; currency?: string; nickname?: string } | undefined;

    const unitAmountCents =
      typeof price?.unit_amount === "number"
        ? price.unit_amount
        : typeof legacyPlan?.amount === "number"
        ? legacyPlan.amount
        : 0;

    const currency = (price?.currency ?? legacyPlan?.currency ?? (sub as any).currency ?? "brl")
      .toString()
      .toUpperCase();

    // ---------- Status, ciclo e plano (mesma regra da conferência do Stripe) ----------
    const state = billingStateFromSubscription(sub);
    const { cancelAtPeriodEnd, effectiveStatus, isTrialing } = state;
    const periodEndIso = state.endSec ? new Date(state.endSec * 1000).toISOString() : null;
    const trialEndIso = state.trialEndSec ? new Date(state.trialEndSec * 1000).toISOString() : null;

    // ---------- Payment method ----------
    const pmExplicit =
      typeof sub.default_payment_method === "object"
        ? (sub.default_payment_method as Stripe.PaymentMethod)
        : null;

    const pi =
      (typeof (sub as any)?.latest_invoice === "object" &&
        ((sub as any).latest_invoice.payment_intent as Stripe.PaymentIntent | undefined)) ||
      undefined;

    const pmFromPI =
      pi && typeof pi === "object" && typeof pi.payment_method === "object"
        ? (pi.payment_method as Stripe.PaymentMethod)
        : null;

    const pm = pmExplicit ?? pmFromPI ?? null;

    // ---------- Sync DB com Stripe (sem cancelar pendências) ----------
    if (applyBillingStateToUser(user as any, customerId, sub, state)) {
      await user.save();
    }

    // ---------- Próxima cobrança / fim do ciclo ----------
    const nextDateIso = isTrialing && trialEndIso ? trialEndIso : periodEndIso;
    const nextAmountCents = isTrialing ? 0 : unitAmountCents || 0;

    const body = {
      planName: price?.nickname || legacyPlan?.nickname || "Plano",
      currency,
      nextInvoiceAmountCents: nextAmountCents,
      nextInvoiceDate: nextDateIso, // trial → fim do trial; senão → fim do período
      currentPeriodEnd: nextDateIso, // compat com UI
      status: effectiveStatus,
      cancelAtPeriodEnd,
      paymentMethodLast4: pm?.card?.last4 ?? null,
      defaultPaymentMethodBrand: (pm?.card?.brand as string | undefined) || null,
      trialEnd: trialEndIso,
    };

    return NextResponse.json(body, { headers: cacheHeader });
  } catch (err: unknown) {
    if (err instanceof (Stripe as any).errors?.StripeError) {
      const stripeErr = err as Stripe.errors.StripeError;
      return NextResponse.json(
        { error: stripeErr.message },
        { status: stripeErr.statusCode || 500, headers: cacheHeader }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível carregar a assinatura." },
      { status: 500, headers: cacheHeader }
    );
  }
}
