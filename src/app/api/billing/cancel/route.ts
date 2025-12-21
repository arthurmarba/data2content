// src/app/api/billing/cancel/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import Stripe from "stripe";
import { stripe } from "@/app/lib/stripe";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cacheHeader = { "Cache-Control": "no-store, max-age=0" } as const;

/** Menor current_period_end entre os itens (compat “basil”) */
function getMinCurrentPeriodEnd(sub: Stripe.Subscription): Date | null {
  const secs = (sub.items?.data ?? [])
    .map((it) => (it as any)?.current_period_end)
    .filter((n: unknown): n is number => typeof n === "number");
  if (!secs.length) return null;
  return new Date(Math.min(...secs) * 1000);
}

/** Intervalo month/year do primeiro item */
function getInterval(sub: Stripe.Subscription): "month" | "year" | undefined {
  const raw = sub.items?.data?.[0]?.price?.recurring?.interval;
  return raw === "month" || raw === "year" ? raw : undefined;
}

/** Resolve a melhor “data de expiração” para exibir */
function resolvePlanExpiresAt(sub: Stripe.Subscription): Date | null {
  const canceledAtSec = (sub as any).canceled_at as number | undefined;
  if (canceledAtSec != null) return new Date(canceledAtSec * 1000);

  const cancelAtSec = (sub as any).cancel_at as number | undefined;
  if (cancelAtSec != null) return new Date(cancelAtSec * 1000);

  const byItems = getMinCurrentPeriodEnd(sub);
  if (byItems) return byItems;

  const cpe = (sub as any).current_period_end as number | undefined;
  return typeof cpe === "number" ? new Date(cpe * 1000) : null;
}

/** Para o caso específico de "não renovar", sempre use o current_period_end do topo */
function computeExpiresAtAfterUpdate(sub: Stripe.Subscription): Date | null {
  const cancelAtPeriodEnd = Boolean((sub as any).cancel_at_period_end);
  if (cancelAtPeriodEnd && typeof (sub as any).current_period_end === "number") {
    return new Date(((sub as any).current_period_end as number) * 1000);
  }
  // Cancelamento imediato ou estados problemáticos: cai no resolvedor genérico
  return resolvePlanExpiresAt(sub);
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401, headers: cacheHeader }
      );
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user?.stripeSubscriptionId) {
      return NextResponse.json(
        { ok: false, message: "No active subscription" },
        { status: 400, headers: cacheHeader }
      );
    }

    // 1) Estado atual
    const subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId,
      { expand: ["items.data.price"] }
    );

    // 2) Ação: cancela na hora se estiver problemática, senão agenda no fim do ciclo
    let finalSubscription: Stripe.Subscription;
    if (
      subscription.status === "past_due" ||
      subscription.status === "incomplete"
    ) {
      finalSubscription = await stripe.subscriptions.cancel(
        user.stripeSubscriptionId
      );
    } else {
      finalSubscription = await stripe.subscriptions.update(
        user.stripeSubscriptionId,
        { cancel_at_period_end: true }
      );
    }

    // 3) Datas/flags (agora determinístico para não renovar)
    const cancelAtPeriodEnd = Boolean(
      (finalSubscription as any).cancel_at_period_end
    );
    const expiresAt = computeExpiresAtAfterUpdate(finalSubscription);

    // 4) Persistência (NÃO usar "non_renewing" no DB)
    const firstItem = finalSubscription.items?.data?.[0];
    const stripePriceId = firstItem?.price?.id ?? null;
    const planInterval = getInterval(finalSubscription);
    const currency = firstItem?.price?.currency
      ? String(firstItem.price.currency).toUpperCase()
      : undefined;

    user.stripeSubscriptionId = finalSubscription.id;
    user.stripePriceId = stripePriceId;
    // Mantém o status "real" do Stripe (active/trialing/etc) no DB
    user.planStatus = finalSubscription.status as any;
    if (planInterval !== undefined) user.planInterval = planInterval;
    user.planExpiresAt = expiresAt ?? user.planExpiresAt ?? null;
    (user as any).currentPeriodEnd = user.planExpiresAt;
    user.cancelAtPeriodEnd = cancelAtPeriodEnd;
    if (currency) (user as any).currency = currency;

    await user.save();

    logger.info("billing_cancel_success", {
      endpoint: "POST /api/billing/cancel",
      userId: String(user._id),
      customerId: (user as any).stripeCustomerId ?? null,
      subscriptionId: finalSubscription.id,
      status: finalSubscription.status,
      stripeRequestId: (finalSubscription as any)?.lastResponse?.requestId ?? null,
    });

    return NextResponse.json(
      {
        ok: true,
        // Dados para o client reagir imediatamente e reduzir “delay”:
        shouldUpdateSession: true,
        status: finalSubscription.status, // status cru do Stripe (referência)
        effectiveStatus: finalSubscription.status, // sem "non_renewing"
        cancelAtPeriodEnd,
        planExpiresAtISO: user.planExpiresAt
          ? new Date(user.planExpiresAt).toISOString()
          : null,
      },
      { headers: cacheHeader }
    );
  } catch (err: any) {
    const message = err?.message || "Cancel failed";
    const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;
    logger.error("[billing/cancel] error", err);
    return NextResponse.json(
      { ok: false, message },
      { status: statusCode, headers: cacheHeader }
    );
  }
}
