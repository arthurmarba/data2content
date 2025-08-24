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
    if (!user?.stripeSubscriptionId) {
      return new NextResponse(null, { status: 204, headers: cacheHeader });
    }

    // Inclui fallbacks úteis: price, default PM e PM do PaymentIntent da última fatura
    const sub = (await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: [
        "items.data.price",
        "default_payment_method",
        "latest_invoice.payment_intent",
        "latest_invoice.payment_intent.payment_method",
      ],
    })) as Stripe.Subscription;

    // Estados de assinatura sem valor para UI → limpar e 204
    if (sub.status === "incomplete" || sub.status === "incomplete_expired") {
      try {
        await stripe.subscriptions.cancel(sub.id);
      } catch {
        /* noop */
      }
      user.stripeSubscriptionId = undefined as any;
      user.planStatus = "inactive" as any;
      user.stripePriceId = null;
      user.planInterval = undefined;
      user.planExpiresAt = null;
      user.cancelAtPeriodEnd = false;
      await user.save();
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

    const cancelAtPeriodEnd = Boolean((sub as any).cancel_at_period_end);

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

    // (1) Força 'trialing' se há trial em andamento, mesmo se Stripe trouxer 'active'
    let effectiveStatus: "active" | "trialing" | "non_renewing" | typeof rawStatus =
      inTrialNow ? "trialing" : rawStatus;

    // (2) Se houve agendamento de cancelamento e a sub está ativa/trial → 'non_renewing'
    if (cancelAtPeriodEnd && (effectiveStatus === "active" || effectiveStatus === "trialing")) {
      effectiveStatus = "non_renewing";
    }

    // ---------- Próxima cobrança / fim do ciclo ----------
    const isTrialing = effectiveStatus === "trialing";
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
