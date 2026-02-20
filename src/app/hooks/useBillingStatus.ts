// src/app/hooks/useBillingStatus.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPlanAccessMeta } from "@/utils/planStatus";
import type {
  AccessPerksInfo,
  InstagramAccessInfo,
  PlanStatusExtras,
  PlanStatusResponse,
  ProTrialInfo,
  ProTrialState,
} from "@/types/billing";

// Estados reais do Stripe + aliases de UI
export type PlanStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "canceled"
  | "inactive"
  | "non_renewing"
  // compat legado/UI:
  | "pending"
  | "expired";

export type TrialSnapshot = {
  state: ProTrialState;
  activatedAt: Date | null;
  expiresAt: Date | null;
  remainingMs: number | null;
};

export type InstagramSnapshot = {
  connected: boolean;
  needsReconnect: boolean;
  lastSuccessfulSyncAt: Date | null;
  accountId: string | null;
  username?: string | null;
};

export type BillingPerks = {
  hasBasicStrategicReport: boolean;
  hasFullStrategicReport: boolean;
  microInsightAvailable: boolean;
  weeklyRaffleEligible: boolean;
};

export type BillingExtras = PlanStatusExtras | undefined;

export type BillingStatus = {
  planStatus: PlanStatus | null;
  planExpiresAt: Date | null;
  interval: "month" | "year" | null;
  priceId: string | null;
  cancelAtPeriodEnd: boolean;
  trial: TrialSnapshot | null;
  instagram: InstagramSnapshot | null;
  perks: BillingPerks;
  extras?: BillingExtras;
  needsBilling?: boolean;
  needsPaymentAction?: boolean;
  needsCheckout?: boolean;
  needsAbort?: boolean;
  needsPaymentUpdate?: boolean;
  /** Ajuda a UI a decidir qual CTA exibir */
  nextAction?: "cancel" | "reactivate" | "resubscribe";
  normalizedStatus?: string | null;
  hasPremiumAccess?: boolean;
  isGracePeriod?: boolean;
  isTrialActive?: boolean;
  trialRemainingMs?: number | null;
  hasBasicReport?: boolean;
  hasFullReportAccess?: boolean;
  hasLoadedOnce?: boolean;
  hasResolvedOnce?: boolean;
};

type Options = {
  auto?: boolean;
  pollOn?: PlanStatus[];
  intervalMs?: number;
};

const EMPTY_PERKS: BillingPerks = {
  hasBasicStrategicReport: false,
  hasFullStrategicReport: false,
  microInsightAvailable: false,
  weeklyRaffleEligible: false,
};

const DEFAULT_POLL_ON: PlanStatus[] = ["pending", "incomplete", "past_due"];
const BILLING_STATUS_CLIENT_CACHE_TTL_MS = (() => {
  const parsed = Number(process.env.NEXT_PUBLIC_BILLING_STATUS_CLIENT_CACHE_TTL_MS ?? 12_000);
  return Number.isFinite(parsed) && parsed >= 2_000 ? Math.floor(parsed) : 12_000;
})();

let billingStatusResponseCache: { payload: PlanStatusResponse; expiresAt: number } | null = null;
let billingStatusResponseInFlight: Promise<PlanStatusResponse> | null = null;

async function fetchPlanStatusPayload(force = false): Promise<PlanStatusResponse> {
  const nowTs = Date.now();
  if (!force && billingStatusResponseCache && billingStatusResponseCache.expiresAt > nowTs) {
    return billingStatusResponseCache.payload;
  }

  if (billingStatusResponseInFlight) {
    return billingStatusResponseInFlight;
  }

  billingStatusResponseInFlight = (async () => {
    const suffix = force ? "?force=true" : "";
    const res = await fetch(`/api/plan/status${suffix}`, {
      cache: "no-store",
      credentials: "include",
    });
    const payload = (await res.json()) as PlanStatusResponse & { error?: string };

    if (!res.ok || !payload?.ok) {
      throw new Error(payload?.error || "Falha ao obter status");
    }

    billingStatusResponseCache = {
      payload,
      expiresAt: Date.now() + BILLING_STATUS_CLIENT_CACHE_TTL_MS,
    };
    return payload;
  })();

  try {
    return await billingStatusResponseInFlight;
  } finally {
    billingStatusResponseInFlight = null;
  }
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const asDate = new Date(value as any);
  return Number.isNaN(asDate.getTime()) ? null : asDate;
}

function normalizePerks(perks?: AccessPerksInfo | null): BillingPerks {
  if (!perks) return { ...EMPTY_PERKS };
  return {
    hasBasicStrategicReport: Boolean(perks.hasBasicStrategicReport),
    hasFullStrategicReport: Boolean(perks.hasFullStrategicReport),
    microInsightAvailable: Boolean(perks.microInsightAvailable),
    weeklyRaffleEligible: Boolean(perks.weeklyRaffleEligible),
  };
}

function parseTrialInfo(trial?: ProTrialInfo | null): TrialSnapshot | null {
  if (!trial) return null;
  const activatedAt = toDate(trial.activatedAt ?? null);
  const expiresAt = toDate(trial.expiresAt ?? null);
  const remainingMs =
    expiresAt && expiresAt.getTime() > Date.now()
      ? Math.max(expiresAt.getTime() - Date.now(), 0)
      : trial.remainingMs ?? null;

  return {
    state: trial.state,
    activatedAt,
    expiresAt,
    remainingMs,
  };
}

function parseInstagramInfo(info?: InstagramAccessInfo | null): InstagramSnapshot | null {
  if (!info) return null;
  return {
    connected: Boolean(info.connected),
    needsReconnect: Boolean(info.needsReconnect),
    lastSuccessfulSyncAt: toDate(info.lastSuccessfulSyncAt ?? null),
    accountId: info.accountId ?? null,
    username: info.username ?? undefined,
  };
}

export function useBillingStatus(opts: Options = {}) {
  const auto = opts.auto ?? true;
  const intervalMs = opts.intervalMs ?? 7000;
  const pollOn = useMemo(
    () =>
      Array.from(
        new Set((opts.pollOn && opts.pollOn.length > 0 ? opts.pollOn : DEFAULT_POLL_ON) as PlanStatus[])
      ),
    [opts.pollOn]
  );

  const [data, setData] = useState<BillingStatus>({
    planStatus: null,
    planExpiresAt: null,
    interval: null,
    priceId: null,
    cancelAtPeriodEnd: false,
    trial: null,
    instagram: null,
    perks: { ...EMPTY_PERKS },
    extras: undefined,
  });
  const [loading, setLoading] = useState<boolean>(!!auto);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [hasResolvedOnce, setHasResolvedOnce] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestIdRef = useRef(0);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const isDocumentVisible = useCallback(
    () => typeof document === "undefined" || !document.hidden,
    []
  );

  const fetchOnce = useCallback(async (force = false) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    let keepLoading = false;

    try {
      const j = await fetchPlanStatusPayload(force);

      const planStatus = (j.status ?? null) as PlanStatus | null;
      const trial = parseTrialInfo(j.trial ?? null);
      const instagram = parseInstagramInfo(j.instagram ?? null);
      const perks = normalizePerks(j.perks ?? null);
      const extras: BillingExtras = j.extras;
      const planExpiresAt =
        toDate(j.planExpiresAt ?? null) ?? trial?.expiresAt ?? null;

      if (requestId !== requestIdRef.current) return;
      clearRetryTimer();
      retryCountRef.current = 0;
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
      setHasResolvedOnce(true);
      setData({
        planStatus,
        planExpiresAt,
        interval: (j.interval ?? null) as "month" | "year" | null,
        priceId: j.priceId ?? null,
        cancelAtPeriodEnd: Boolean(j.cancelAtPeriodEnd),
        trial,
        instagram,
        perks,
        extras,
      });
    } catch (e: any) {
      if (requestId !== requestIdRef.current) return;

      const maxRetries = 2;
      if (!hasLoadedOnceRef.current && retryCountRef.current < maxRetries) {
        retryCountRef.current += 1;
        const delayMs = 600 * retryCountRef.current;
        clearRetryTimer();
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          fetchOnce(true);
        }, delayMs);
        keepLoading = true;
        return;
      }

      setError(e?.message || "Erro inesperado");
      setHasResolvedOnce(true);
      setData((prev) => ({ ...prev }));
    } finally {
      if (requestId !== requestIdRef.current) return;
      if (!keepLoading) setLoading(false);
    }
  }, [clearRetryTimer]);

  const refetch = useCallback(() => fetchOnce(true), [fetchOnce]);

  const startPolling = useCallback(() => {
    if (pollingRef.current || !isDocumentVisible()) return;
    pollingRef.current = setInterval(() => {
      if (!isDocumentVisible()) return;
      void fetchOnce();
    }, intervalMs);
  }, [fetchOnce, intervalMs, isDocumentVisible]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (auto) {
      void fetchOnce();
    }
    return () => {
      stopPolling();
      clearRetryTimer();
    };
  }, [auto, fetchOnce, stopPolling, clearRetryTimer]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleRefresh = () => {
      refetch();
    };
    window.addEventListener("billing-status-refresh", handleRefresh);
    return () => {
      window.removeEventListener("billing-status-refresh", handleRefresh);
    };
  }, [refetch]);

  useEffect(() => {
    if (!data.planStatus) return;
    if (pollOn.includes(data.planStatus)) startPolling();
    else stopPolling();
  }, [data.planStatus, pollOn, startPolling, stopPolling]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
        return;
      }
      if (data.planStatus && pollOn.includes(data.planStatus)) {
        void fetchOnce();
        startPolling();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [data.planStatus, pollOn, fetchOnce, startPolling, stopPolling]);

  const flags = useMemo(() => {
    const baseMeta = getPlanAccessMeta(data.planStatus, data.cancelAtPeriodEnd);
    const normalizedStatus = data.extras?.normalizedStatus ?? baseMeta.normalizedStatus;
    const planHasPremiumAccess = data.extras?.hasPremiumAccess ?? baseMeta.hasPremiumAccess;
    const isGracePeriod = data.extras?.isGracePeriod ?? baseMeta.isGracePeriod ?? false;
    const needsBilling = data.extras?.needsBilling ?? baseMeta.needsBilling ?? false;

    const trialExpiresAt = data.trial?.expiresAt ?? null;
    const trialActive =
      Boolean(data.trial?.state === "active" && trialExpiresAt && trialExpiresAt.getTime() > Date.now());
    const trialRemainingMs = trialExpiresAt
      ? Math.max(trialExpiresAt.getTime() - Date.now(), 0)
      : null;

    const hasPremiumAccess = planHasPremiumAccess || trialActive;

    const isActive =
      trialActive ||
      normalizedStatus === "active" ||
      normalizedStatus === "trialing" ||
      normalizedStatus === "trial";
    const isActiveLikeStatus =
      normalizedStatus === "active" ||
      normalizedStatus === "trialing" ||
      normalizedStatus === "trial";
    const isNonRenewing =
      normalizedStatus === "non_renewing" ||
      (isActiveLikeStatus && data.cancelAtPeriodEnd === true);
    const isAnnual = data.interval === "year";
    const isMonthly = data.interval === "month";

    const shouldResubscribe =
      !trialActive &&
      (normalizedStatus === "inactive" ||
        normalizedStatus === "expired" ||
        normalizedStatus === "canceled" ||
        normalizedStatus === "unpaid" ||
        normalizedStatus === "incomplete_expired");

    const needsPaymentUpdate =
      normalizedStatus === "past_due" || normalizedStatus === "unpaid";
    const needsCheckout =
      normalizedStatus === "incomplete" || normalizedStatus === "pending";
    const needsAbort = normalizedStatus === "incomplete_expired";
    const needsPaymentAction = needsPaymentUpdate || needsCheckout;

    const nextAction: "cancel" | "reactivate" | "resubscribe" = trialActive
      ? "cancel"
      : shouldResubscribe
      ? "resubscribe"
      : isNonRenewing
      ? "reactivate"
      : "cancel";

    const hasBasicReport = data.perks?.hasBasicStrategicReport ?? false;
    const hasFullReportAccess =
      data.perks?.hasFullStrategicReport ?? hasPremiumAccess;

    return {
      isActive,
      isNonRenewing,
      isAnnual,
      isMonthly,
      hasPremiumAccess,
      isGracePeriod,
      needsBilling,
      needsPaymentAction,
      needsCheckout,
      needsAbort,
      needsPaymentUpdate,
      normalizedStatus,
      nextAction,
      isTrialActive: trialActive,
      trialRemainingMs,
      hasBasicReport,
      hasFullReportAccess,
    };
  }, [data.planStatus, data.cancelAtPeriodEnd, data.interval, data.trial, data.perks, data.extras]);

  return useMemo(
    () => ({
      ...data,
      isLoading: loading,
      error,
      refetch,
      startPolling,
      stopPolling,
      hasLoadedOnce,
      hasResolvedOnce,
      ...flags,
      nextAction: flags.nextAction,
      hasPremiumAccess: flags.hasPremiumAccess,
      isGracePeriod: flags.isGracePeriod,
      needsBilling: flags.needsBilling,
      needsPaymentAction: flags.needsPaymentAction,
      needsCheckout: flags.needsCheckout,
      needsAbort: flags.needsAbort,
      needsPaymentUpdate: flags.needsPaymentUpdate,
      normalizedStatus: flags.normalizedStatus,
      isTrialActive: flags.isTrialActive,
      trialRemainingMs: flags.trialRemainingMs,
      hasBasicReport: flags.hasBasicReport,
      hasFullReportAccess: flags.hasFullReportAccess,
    }),
    [data, loading, error, refetch, startPolling, stopPolling, flags, hasLoadedOnce, hasResolvedOnce]
  );
}

export default useBillingStatus;
