// src/app/api/billing/subscription/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cacheHeader = { "Cache-Control": "no-store, max-age=0" } as const;

// utilito: garante número (seguro p/ campos do Stripe que podem vir como string)
function toNumberOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : null;
}

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

function pickLatest(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  if (!subs.length) return null;
  return subs.sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0] ?? null;
}

function pickBestSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  const pickByStatus = (statuses: string[]) =>
    pickLatest(subs.filter((s) => statuses.includes(String(s.status))));
  return (
    pickByStatus(["active", "trialing"]) ||
    pickByStatus(["past_due", "unpaid"]) ||
    pickByStatus(["incomplete"]) ||
    pickByStatus(["incomplete_expired"]) ||
    pickByStatus(["canceled"]) ||
    null
  );
}

function getPlanInterval(sub: Stripe.Subscription): "month" | "year" | null {
  const raw =
    sub.items?.data?.[0]?.price?.recurring?.interval ??
    (sub.items?.data?.[0] as any)?.plan?.interval;
  return raw === "month" || raw === "year" ? raw : null;
}

function planTypeFromInterval(interval: "month" | "year" | null): "monthly" | "annual" | null {
  if (interval === "month") return "monthly";
  if (interval === "year") return "annual";
  return null;
}

function datesEqual(a: unknown, b: Date | null): boolean {
  const aTime =
    a instanceof Date
      ? a.getTime()
      : typeof a === "string" || typeof a === "number"
      ? new Date(a).getTime()
      : null;
  const bTime = b ? b.getTime() : null;
  if (aTime == null || Number.isNaN(aTime)) return bTime == null;
  return aTime === bTime;
}

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
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
        if (!customerId && typeof sub.customer === "string") {
          customerId = sub.customer;
        }
      } catch {
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
      } catch {
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
      } catch {
        listedSuccessfully = false;
      }
    }

    if (!sub) {
      if (listedSuccessfully) {
        user.stripeSubscriptionId = null;
        user.planStatus = "inactive" as any;
        user.stripePriceId = null;
        user.planInterval = null as any;
        user.planExpiresAt = null;
        user.cancelAtPeriodEnd = false;
        (user as any).currentPeriodEnd = null;
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

    // ---------- Datas de ciclo ----------
    // cancel_at, se definido (em segundos)
    const cancelAtSec = toNumberOrNull((sub as any).cancel_at);

    // current_period_end (preferir do root; se não, min por item como fallback)
    const subCpeSec = toNumberOrNull((sub as any).current_period_end);
    const itemsCpeSecs =
      sub.items?.data
        ?.map((it: any) => toNumberOrNull(it?.current_period_end))
        ?.filter((n: number | null): n is number => typeof n === "number") ?? [];
    const minItemEndSec = itemsCpeSecs.length ? Math.min(...itemsCpeSecs) : null;

    const endSec = cancelAtSec ?? subCpeSec ?? minItemEndSec;
    const periodEndIso = endSec ? new Date(endSec * 1000).toISOString() : null;

    let cancelAtPeriodEnd = Boolean((sub as any).cancel_at_period_end);
    const planInterval = getPlanInterval(sub);
    const planType = planTypeFromInterval(planInterval);

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

    // ---------- Trial ----------
    const trialEndSec = toNumberOrNull((sub as any).trial_end);
    const trialEndIso = trialEndSec ? new Date(trialEndSec * 1000).toISOString() : null;

    // ---------- Status efetivo ----------
    const rawStatus = sub.status as string;
    const inTrialNow = typeof trialEndSec === "number" && trialEndSec * 1000 > Date.now();
    let statusForDb = rawStatus === "incomplete" ? "pending" : rawStatus;

    // (1) Força 'trialing' se há trial em andamento, mesmo se Stripe trouxer 'active'
    let effectiveStatus: "active" | "trialing" | "non_renewing" | "pending" | typeof rawStatus =
      inTrialNow ? "trialing" : rawStatus;

    const nonRenewingEnded =
      cancelAtPeriodEnd &&
      typeof endSec === "number" &&
      endSec * 1000 <= Date.now() &&
      (rawStatus === "active" || rawStatus === "trialing");

    if (nonRenewingEnded) {
      effectiveStatus = "canceled";
      statusForDb = "canceled";
      cancelAtPeriodEnd = false;
    }

    // (2) Se houve agendamento de cancelamento e a sub está ativa/trial → 'non_renewing'
    if (cancelAtPeriodEnd && (effectiveStatus === "active" || effectiveStatus === "trialing")) {
      effectiveStatus = "non_renewing";
    }

    if (effectiveStatus === "incomplete") {
      effectiveStatus = "pending";
    }

    const isTrialing = effectiveStatus === "trialing";

    // ---------- Sync DB com Stripe (sem cancelar pendências) ----------
    const planExpiresAt =
      statusForDb === "pending"
        ? null
        : isTrialing && trialEndSec
        ? new Date(trialEndSec * 1000)
        : endSec
        ? new Date(endSec * 1000)
        : null;
    const priceId = firstItem?.price?.id ?? null;
    let shouldSave = false;

    if ((user as any).stripeCustomerId !== customerId && customerId) {
      (user as any).stripeCustomerId = customerId;
      shouldSave = true;
    }
    if ((user as any).stripeSubscriptionId !== sub.id) {
      (user as any).stripeSubscriptionId = sub.id;
      shouldSave = true;
    }
    if ((user as any).stripePriceId !== priceId) {
      (user as any).stripePriceId = priceId;
      shouldSave = true;
    }
    if ((user as any).planStatus !== statusForDb) {
      (user as any).planStatus = statusForDb as any;
      shouldSave = true;
    }
    if (planInterval && (user as any).planInterval !== planInterval) {
      (user as any).planInterval = planInterval;
      shouldSave = true;
    }
    if (planType && (user as any).planType !== planType) {
      (user as any).planType = planType;
      shouldSave = true;
    }
    if ((user as any).cancelAtPeriodEnd !== cancelAtPeriodEnd) {
      (user as any).cancelAtPeriodEnd = cancelAtPeriodEnd;
      shouldSave = true;
    }
    if (!datesEqual((user as any).planExpiresAt, planExpiresAt)) {
      (user as any).planExpiresAt = planExpiresAt;
      shouldSave = true;
    }
    if (!datesEqual((user as any).currentPeriodEnd, planExpiresAt)) {
      (user as any).currentPeriodEnd = planExpiresAt;
      shouldSave = true;
    }

    if (shouldSave) {
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
