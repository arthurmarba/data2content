// src/app/api/plan/status/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// UI PlanStatus aceito no front:
type UiPlanStatus = "active" | "non_renewing" | "pending" | "inactive" | "expired";

// ---------- Helpers de UI ----------
function mapStripeToUiStatus(
  raw: string | null | undefined,
  cancelAtPeriodEnd: boolean | null | undefined
): UiPlanStatus | null {
  if (cancelAtPeriodEnd) return "non_renewing";
  switch (raw) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "incomplete":
      return "pending";
    case "unpaid":
    case "incomplete_expired":
    case "canceled":
      return "inactive";
    default:
      return raw ? "inactive" : null;
  }
}

// ---------- Helpers de normalização (consistentes com o webhook) ----------
type NormalizedPlanStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "canceled"
  | "inactive"
  | "non_renewing";

function coerceInterval(v: any): "month" | "year" | undefined {
  return v === "month" || v === "year" ? v : undefined;
}

function normalizeFromSubscription(sub: Stripe.Subscription) {
  const cancelAtPeriodEnd = !!(sub as any).cancel_at_period_end;
  const baseStatus = ((sub as any).status ?? "inactive") as NormalizedPlanStatus;
  const planStatus: NormalizedPlanStatus = cancelAtPeriodEnd ? "non_renewing" : baseStatus;

  const item = sub.items?.data?.[0];
  const planInterval = coerceInterval(item?.price?.recurring?.interval);

  const itemEnds: number[] =
    sub.items?.data?.map((it: any) => it?.current_period_end).filter((n: any) => typeof n === "number") ?? [];

  let planExpiresAt: Date | null = null;
  if (typeof (sub as any).cancel_at === "number") {
    planExpiresAt = new Date((sub as any).cancel_at * 1000);
  } else if (itemEnds.length > 0) {
    planExpiresAt = new Date(Math.min(...itemEnds) * 1000);
  } else if (typeof (sub as any).current_period_end === "number") {
    planExpiresAt = new Date((sub as any).current_period_end * 1000);
  }

  const stripePriceId = item?.price?.id ?? null;

  return { planStatus, planInterval, planExpiresAt, cancelAtPeriodEnd, stripePriceId };
}

function isPendingPlanChangePayment(inv: Stripe.Invoice | null | undefined) {
  if (!inv) return false;

  const reasonOk = inv.billing_reason === "subscription_update";
  const createdRecent =
    typeof inv.created === "number"
      ? Date.now() - inv.created * 1000 < 15 * 60 * 1000
      : false;

  // Alguns tipos do Stripe não expõem `payment_intent` no Invoice
  // (apesar de existir no runtime quando expandido). Acessamos via `any`.
  const piRaw = (inv as any)?.payment_intent ?? null;
  const piStatus: Stripe.PaymentIntent.Status | undefined =
    piRaw && typeof piRaw !== "string" ? (piRaw.status as Stripe.PaymentIntent.Status) : undefined;

  const pendingPI =
    piStatus === "requires_action" ||
    piStatus === "requires_payment_method" ||
    piStatus === "requires_confirmation" ||
    piStatus === "processing";

  return Boolean(reasonOk && createdRecent && pendingPI);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id).lean();
  if (!user) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const respondFromDb = () => {
    const ui = mapStripeToUiStatus((user as any).planStatus ?? null, (user as any).cancelAtPeriodEnd ?? false);

    let status: UiPlanStatus | null = ui;
    const expires = (user as any).planExpiresAt ? new Date((user as any).planExpiresAt) : null;
    if (status === "inactive" && expires && expires.getTime() < Date.now()) {
      status = "expired";
    }

    return NextResponse.json({
      ok: true,
      status,
      interval: (user as any).planInterval ?? null,
      priceId: (user as any).stripePriceId ?? null,
      planExpiresAt: (user as any).planExpiresAt ?? null,
      cancelAtPeriodEnd: !!(user as any).cancelAtPeriodEnd,
    });
  };

  // Fast-path: se DB já tem interval + status, evita roundtrip ao Stripe
  if ((user as any).planInterval && (user as any).planStatus) {
    return respondFromDb();
  }

  if (!(user as any).stripeCustomerId) {
    return respondFromDb();
  }

  // ---------- Busca assinatura no Stripe ----------
  let sub: Stripe.Subscription | null = null;
  try {
    if ((user as any).stripeSubscriptionId) {
      try {
        sub = await stripe.subscriptions.retrieve((user as any).stripeSubscriptionId, {
          expand: ["items.data.price", "latest_invoice.payment_intent"],
        } as any);
      } catch {
        // cai para list()
      }
    }

    if (!sub) {
      const listed = await stripe.subscriptions.list({
        customer: (user as any).stripeCustomerId,
        status: "all",
        limit: 5,
        expand: ["data.items.data.price", "data.latest_invoice.payment_intent"],
      } as any);
      sub = listed.data.find((s: any) => !s.cancel_at_period_end) ?? listed.data[0] ?? null;
    }
  } catch {
    return respondFromDb();
  }

  if (!sub) return respondFromDb();

  // ---------- Normaliza e aplica heurística anti-past_due ----------
  const n = normalizeFromSubscription(sub);

  // Decide o status a persistir no DB (evita gravar past_due “transitório”)
  let planStatusToPersist: NormalizedPlanStatus = n.planStatus;
  if (
    n.planStatus === "past_due" &&
    isPendingPlanChangePayment(sub.latest_invoice as Stripe.Invoice | null | undefined)
  ) {
    const prev = (user as any).planStatus as NormalizedPlanStatus | undefined;
    if (prev === "trialing") planStatusToPersist = "trialing";
    else if (n.cancelAtPeriodEnd || (user as any).cancelAtPeriodEnd) planStatusToPersist = "non_renewing";
    else planStatusToPersist = "active";
  }

  // Campos para resposta
  const interval: "month" | "year" | null = (sub.items?.data?.[0]?.price?.recurring?.interval as any) ?? null;
  const priceId: string | null = n.stripePriceId ?? null;
  const cancelAtPeriodEnd: boolean = n.cancelAtPeriodEnd;
  const planExpiresAt: Date | null = n.planExpiresAt;

  // Status de UI
  let uiStatus = mapStripeToUiStatus(
    planStatusToPersist === "non_renewing" ? "active" : planStatusToPersist, // UI usa cancelAtPeriodEnd
    cancelAtPeriodEnd
  );
  if (!uiStatus) uiStatus = "inactive";
  if (uiStatus === "inactive" && planExpiresAt && planExpiresAt.getTime() < Date.now()) {
    uiStatus = "expired";
  }

  // ---------- Persiste normalizado no DB (não derruba para past_due transitório) ----------
  try {
    await User.updateOne(
      { _id: (user as any)._id },
      {
        $set: {
          planStatus: planStatusToPersist,       // normalizado (pode ser 'non_renewing')
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          planInterval: n.planInterval ?? null,  // null permitido no schema
          planExpiresAt: planExpiresAt ?? null,
          cancelAtPeriodEnd,
        },
      }
    );
  } catch {
    // ignora falha de persistência
  }

  return NextResponse.json({
    ok: true,
    status: uiStatus,
    interval,
    priceId,
    planExpiresAt,
    cancelAtPeriodEnd,
  });
}
