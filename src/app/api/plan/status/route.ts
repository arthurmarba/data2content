// src/app/api/plan/status/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import type Stripe from "stripe";
import { getPlanAccessMeta } from "@/utils/planStatus";
import type {
  InstagramAccessInfo,
  PlanStatusResponse,
  ProTrialInfo,
  ProTrialState,
  UiPlanStatus,
} from "@/types/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// UI PlanStatus aceito no front:
// ---------- Helpers de UI ----------
function mapStripeToUiStatus(
  raw: string | null | undefined,
  cancelAtPeriodEnd: boolean | null | undefined
): UiPlanStatus | null {
  if (cancelAtPeriodEnd) return "non_renewing";
  const v = (raw || "").toString().toLowerCase();
  switch (v) {
    case "active":
    case "trial": // normaliza legado de DB
    case "trialing":
      return "active";
    case "non_renewing":
      return "non_renewing";
    case "past_due":
    case "incomplete":
      return "pending";
    case "unpaid":
    case "incomplete_expired":
    case "canceled":
      return "inactive";
    default:
      return v ? "inactive" : null;
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

function isInactiveLike(v: unknown): boolean {
  if (!v) return true;
  const s = String(v).toLowerCase();
  return (
    s === "inactive" ||
    s === "canceled" ||
    s === "unpaid" ||
    s === "incomplete_expired" ||
    s === "expired" ||
    s === "pending"
  );
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const asDate = new Date(value as any);
  return Number.isNaN(asDate.getTime()) ? null : asDate;
}

const PRO_TRIAL_STATE_SET: ReadonlySet<ProTrialState> = new Set<ProTrialState>([
  "eligible",
  "active",
  "expired",
  "converted",
  "unavailable",
]);

function ensureProTrialState(value: unknown): ProTrialState {
  if (typeof value !== "string") return "eligible";
  const normalized = value.toLowerCase() as ProTrialState;
  return PRO_TRIAL_STATE_SET.has(normalized) ? normalized : "eligible";
}

function deriveInstagramInfo(user: any): InstagramAccessInfo {
  const connected = Boolean(user?.isInstagramConnected && user?.instagramAccountId);
  const tokenExpiresAt = toDate(user?.instagramAccessTokenExpiresAt);
  const lastAttempt = toDate(user?.lastInstagramSyncAttempt);
  const lastSuccessfulSyncAt =
    connected && user?.lastInstagramSyncSuccess && lastAttempt ? lastAttempt.toISOString() : null;
  const hasSyncError = Boolean(user?.instagramSyncErrorCode || user?.instagramSyncErrorMsg);
  const tokenExpired = tokenExpiresAt ? tokenExpiresAt.getTime() <= Date.now() : false;
  const needsReconnect = Boolean(connected && (tokenExpired || hasSyncError));

  return {
    connected,
    needsReconnect,
    lastSuccessfulSyncAt,
    accountId: user?.instagramAccountId ?? null,
    username: user?.instagramUsername ?? user?.username ?? undefined,
  };
}

type TrialComputation = {
  info: ProTrialInfo;
  updates: Record<string, any> | null;
  expiresAtDate: Date | null;
  activatedAtDate: Date | null;
};

function computeTrialInfo(user: any, opts: { planHasPremium: boolean }): TrialComputation {
  const now = Date.now();
  const rawStatus = ensureProTrialState((user as any)?.proTrialStatus);
  let state: ProTrialState = rawStatus;
  const activatedAtDate = toDate((user as any)?.proTrialActivatedAt);
  const expiresAtDate = toDate((user as any)?.proTrialExpiresAt);
  const convertedAtDate = toDate((user as any)?.proTrialConvertedAt);

  const updates: Record<string, any> = {};

  if (state === "active" && expiresAtDate && expiresAtDate.getTime() <= now) {
    state = "expired";
    if (rawStatus !== "expired") updates.proTrialStatus = "expired";
  }

  if (opts.planHasPremium && state !== "converted") {
    state = "converted";
    if (rawStatus !== "converted") updates.proTrialStatus = "converted";
    if (!convertedAtDate) {
      const stamp = new Date();
      updates.proTrialConvertedAt = stamp;
    }
  }

  const remainingMs =
    state === "active" && expiresAtDate ? Math.max(expiresAtDate.getTime() - now, 0) : null;

  const info: ProTrialInfo = {
    state,
    activatedAt: activatedAtDate ? activatedAtDate.toISOString() : null,
    expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
    remainingMs,
  };

  return {
    info,
    updates: Object.keys(updates).length > 0 ? updates : null,
    expiresAtDate,
    activatedAtDate,
  };
}

type BuildOptions = {
  planStatus?: string | null;
  uiStatus?: UiPlanStatus | null;
  interval?: "month" | "year" | null;
  priceId?: string | null;
  planExpiresAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
};

function buildPlanStatusPayload(user: any, options: BuildOptions = {}): {
  payload: PlanStatusResponse;
  updates: Record<string, any> | null;
} {
  const intervalValue =
    options.interval !== undefined ? options.interval : (user as any)?.planInterval ?? null;
  const priceValue =
    options.priceId !== undefined ? options.priceId : (user as any)?.stripePriceId ?? null;
  const planStatusRaw =
    options.planStatus !== undefined ? options.planStatus : (user as any)?.planStatus ?? null;
  const cancelAtPeriodEnd =
    options.cancelAtPeriodEnd !== undefined
      ? options.cancelAtPeriodEnd
      : Boolean((user as any)?.cancelAtPeriodEnd);
  const planExpiresAtValue =
    options.planExpiresAt !== undefined ? options.planExpiresAt : (user as any)?.planExpiresAt;
  const planExpiresAtDate = toDate(planExpiresAtValue);

  const planMeta = getPlanAccessMeta(planStatusRaw, cancelAtPeriodEnd);
  const instagramInfo = deriveInstagramInfo(user);
  const {
    info: trialInfo,
    updates,
    expiresAtDate: trialExpiresAtDate,
  } = computeTrialInfo(user, {
    planHasPremium: planMeta.hasPremiumAccess,
  });

  const hasPremiumAccess = planMeta.hasPremiumAccess || trialInfo.state === "active";
  const isGracePeriod = planMeta.isGracePeriod || false;

  let uiStatus: UiPlanStatus | null =
    options.uiStatus !== undefined
      ? options.uiStatus ?? null
      : mapStripeToUiStatus(planStatusRaw, cancelAtPeriodEnd);

  const effectivePlanExpiresAtDate =
    planExpiresAtDate ?? (trialInfo.state === "active" ? trialExpiresAtDate : null);

  if (
    uiStatus === "inactive" &&
    effectivePlanExpiresAtDate &&
    effectivePlanExpiresAtDate.getTime() < Date.now()
  ) {
    uiStatus = "expired";
  }

  const payload: PlanStatusResponse = {
    ok: true,
    status: uiStatus,
    interval: intervalValue ?? null,
    priceId: priceValue ?? null,
    planExpiresAt: effectivePlanExpiresAtDate ? effectivePlanExpiresAtDate.toISOString() : null,
    cancelAtPeriodEnd,
    trial: trialInfo,
    instagram: instagramInfo,
    perks: {
      hasBasicStrategicReport: instagramInfo.connected,
      hasFullStrategicReport: hasPremiumAccess,
      microInsightAvailable: instagramInfo.connected,
      weeklyRaffleEligible: instagramInfo.connected,
    },
    extras: {
      normalizedStatus: planMeta.normalizedStatus,
      hasPremiumAccess,
      isGracePeriod,
    },
  };

  return { payload, updates };
}

async function respondWithPayload(user: any, options: BuildOptions = {}) {
  const { payload, updates } = buildPlanStatusPayload(user, options);
  if (updates) {
    try {
      await User.updateOne({ _id: (user as any)?._id }, { $set: updates });
    } catch {
      // ignora falha de persistência de atualização de trial
    }
  }
  return NextResponse.json(payload);
}

export async function GET(req: Request) {
  const force = (() => {
    try {
      const url = new URL(req.url);
      return url.searchParams.get("force") === "true";
    } catch {
      return false;
    }
  })();

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id).lean();
  if (!user) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const respondFromDb = () => respondWithPayload(user);

  // Fast-path mais seguro: permite auto-healing quando DB está "inactive-like"
  const hasStripeCustomer = Boolean((user as any).stripeCustomerId);
  const hasDbIntervalAndStatus = Boolean((user as any).planInterval && (user as any).planStatus);
  const dbStatusRaw = (user as any).planStatus ?? null;
  if (!force) {
    if (hasDbIntervalAndStatus) {
      // Se não temos customer no Stripe, não tem o que buscar
      if (!hasStripeCustomer) return respondFromDb();
      // Se o DB NÃO está em estado inativo, pode responder do DB
      if (!isInactiveLike(dbStatusRaw)) return respondFromDb();
    }
  }

  if (!hasStripeCustomer) {
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

  const userSnapshot = {
    ...user,
    planStatus: planStatusToPersist,
    planInterval: n.planInterval ?? null,
    stripePriceId: priceId,
    planExpiresAt: planExpiresAt ?? null,
    cancelAtPeriodEnd,
  };

  return respondWithPayload(userSnapshot, {
    planStatus: planStatusToPersist,
    interval,
    priceId,
    planExpiresAt,
    cancelAtPeriodEnd,
    uiStatus,
  });
}
