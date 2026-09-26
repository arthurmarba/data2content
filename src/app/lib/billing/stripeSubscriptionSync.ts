// src/app/lib/billing/stripeSubscriptionSync.ts
//
// Como o banco deve ficar a partir de uma assinatura do Stripe. É a mesma regra
// que a tela de assinatura (`/api/billing/subscription`) aplica quando a pessoa
// abre a página, e a que a conferência (`npm run audit:stripe-subscriptions`)
// usa para corrigir quem paga uma assinatura que o banco não reconhece.
import type Stripe from "stripe";

// utilito: garante número (seguro p/ campos do Stripe que podem vir como string)
export function toNumberOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : null;
}

function pickLatest(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  if (!subs.length) return null;
  return [...subs].sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0] ?? null;
}

/** Entre as assinaturas de um cliente, a que vale: viva primeiro, a mais recente. */
export function pickBestSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  const pickByStatus = (statuses: string[]) =>
    pickLatest(subs.filter((s) => statuses.includes(String(s.status))));
  return (
    pickByStatus(["active", "trialing"]) ||
    pickByStatus(["past_due", "unpaid"]) ||
    pickByStatus(["incomplete"]) ||
    pickByStatus(["canceled"]) ||
    null
  );
}

export function getPlanInterval(sub: Stripe.Subscription): "month" | "year" | null {
  const raw =
    sub.items?.data?.[0]?.price?.recurring?.interval ??
    (sub.items?.data?.[0] as any)?.plan?.interval;
  return raw === "month" || raw === "year" ? raw : null;
}

export function planTypeFromInterval(interval: "month" | "year" | null): "monthly" | "annual" | null {
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

export type SubscriptionBillingState = {
  /** Status cru do Stripe. */
  rawStatus: string;
  /** O que vai para `user.planStatus`. */
  statusForDb: string;
  /** O que a tela mostra (`non_renewing`, `trialing`, `pending`...). */
  effectiveStatus: string;
  cancelAtPeriodEnd: boolean;
  /** Fim do ciclo em segundos (cancel_at > current_period_end > menor fim por item). */
  endSec: number | null;
  trialEndSec: number | null;
  isTrialing: boolean;
  planInterval: "month" | "year" | null;
  planType: "monthly" | "annual" | null;
  priceId: string | null;
  planExpiresAt: Date | null;
};

export function billingStateFromSubscription(
  sub: Stripe.Subscription,
  nowMs: number = Date.now()
): SubscriptionBillingState {
  const firstItem = sub.items?.data?.[0];

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

  let cancelAtPeriodEnd = Boolean((sub as any).cancel_at_period_end);
  const planInterval = getPlanInterval(sub);
  const planType = planTypeFromInterval(planInterval);

  // ---------- Trial ----------
  const trialEndSec = toNumberOrNull((sub as any).trial_end);

  // ---------- Status efetivo ----------
  const rawStatus = sub.status as string;
  const inTrialNow = typeof trialEndSec === "number" && trialEndSec * 1000 > nowMs;
  let statusForDb = rawStatus === "incomplete" ? "pending" : rawStatus;

  // (1) Força 'trialing' se há trial em andamento, mesmo se Stripe trouxer 'active'
  let effectiveStatus: string = inTrialNow ? "trialing" : rawStatus;

  const nonRenewingEnded =
    cancelAtPeriodEnd &&
    typeof endSec === "number" &&
    endSec * 1000 <= nowMs &&
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

  const planExpiresAt =
    statusForDb === "pending"
      ? null
      : isTrialing && trialEndSec
      ? new Date(trialEndSec * 1000)
      : endSec
      ? new Date(endSec * 1000)
      : null;

  return {
    rawStatus,
    statusForDb,
    effectiveStatus,
    cancelAtPeriodEnd,
    endSec,
    trialEndSec,
    isTrialing,
    planInterval,
    planType,
    priceId: firstItem?.price?.id ?? null,
    planExpiresAt,
  };
}

/**
 * Sincroniza o usuário com a assinatura (sem cancelar pendências). Altera o
 * documento em memória e diz se algo mudou; quem chama decide se salva.
 */
export function applyBillingStateToUser(
  user: Record<string, any>,
  customerId: string | null,
  sub: Stripe.Subscription,
  state: SubscriptionBillingState
): boolean {
  let shouldSave = false;

  if (user.stripeCustomerId !== customerId && customerId) {
    user.stripeCustomerId = customerId;
    shouldSave = true;
  }
  if (user.stripeSubscriptionId !== sub.id) {
    user.stripeSubscriptionId = sub.id;
    shouldSave = true;
  }
  if (user.stripePriceId !== state.priceId) {
    user.stripePriceId = state.priceId;
    shouldSave = true;
  }
  if (user.planStatus !== state.statusForDb) {
    user.planStatus = state.statusForDb;
    shouldSave = true;
  }
  if (state.planInterval && user.planInterval !== state.planInterval) {
    user.planInterval = state.planInterval;
    shouldSave = true;
  }
  if (state.planType && user.planType !== state.planType) {
    user.planType = state.planType;
    shouldSave = true;
  }
  if (user.cancelAtPeriodEnd !== state.cancelAtPeriodEnd) {
    user.cancelAtPeriodEnd = state.cancelAtPeriodEnd;
    shouldSave = true;
  }
  if (!datesEqual(user.planExpiresAt, state.planExpiresAt)) {
    user.planExpiresAt = state.planExpiresAt;
    shouldSave = true;
  }
  if (!datesEqual(user.currentPeriodEnd, state.planExpiresAt)) {
    user.currentPeriodEnd = state.planExpiresAt;
    shouldSave = true;
  }

  return shouldSave;
}

/**
 * Como o banco fica quando a assinatura acaba: os mesmos campos que o aviso de
 * cancelamento do Stripe grava (`customer.subscription.deleted`). O fim é o
 * `ended_at` — não o fim do ciclo, que pode estar no futuro para quem foi
 * cancelado por falta de pagamento.
 */
export function applyEndedSubscriptionToUser(
  user: Record<string, any>,
  sub: Stripe.Subscription,
  now: Date = new Date()
): void {
  const endedAtSec = toNumberOrNull((sub as any).ended_at);
  const endedAt = endedAtSec ? new Date(endedAtSec * 1000) : now;
  user.planStatus = "canceled";
  user.cancelAtPeriodEnd = false;
  user.stripeSubscriptionId = sub.id;
  user.stripePriceId = null;
  user.planInterval = undefined; // não usar null aqui
  user.planExpiresAt = endedAt;
  user.currentPeriodEnd = endedAt;
}
