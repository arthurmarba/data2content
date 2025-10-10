// src/app/hooks/useBillingStatus.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPlanAccessMeta } from "@/utils/planStatus";

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

export type BillingStatus = {
  planStatus: PlanStatus | null;
  planExpiresAt: Date | null;
  interval: "month" | "year" | null;
  priceId: string | null;
  cancelAtPeriodEnd: boolean;
  /** Ajuda a UI a decidir qual CTA exibir */
  nextAction?: "cancel" | "reactivate" | "resubscribe";
  normalizedStatus?: string | null;
  hasPremiumAccess?: boolean;
  isGracePeriod?: boolean;
};

type Options = {
  auto?: boolean;
  pollOn?: PlanStatus[];
  intervalMs?: number;
};

export function useBillingStatus(opts: Options = {}) {
  const {
    auto = true,
    // Poll em estados que tendem a mudar logo após uma ação do usuário:
    // /api/plan/status já mapeia 'past_due' e 'incomplete' -> 'pending'
    pollOn = ["pending", "incomplete", "past_due"],
    intervalMs = 4000,
  } = opts;

  const [data, setData] = useState<BillingStatus>({
    planStatus: null,
    planExpiresAt: null,
    interval: null,
    priceId: null,
    cancelAtPeriodEnd: false,
  });
  const [loading, setLoading] = useState<boolean>(!!auto);
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/plan/status`, {
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
      });
      const j = await res.json();

      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || "Falha ao obter status");
      }

      const planExpiresAt: Date | null = j?.planExpiresAt ? new Date(j.planExpiresAt) : null;

      setData({
        planStatus: (j?.status ?? null) as PlanStatus | null, // 'status' já vem mapeado p/ UI
        planExpiresAt,
        interval: (j?.interval ?? null) as "month" | "year" | null,
        priceId: j?.priceId ?? null,
        cancelAtPeriodEnd: !!j?.cancelAtPeriodEnd,
      });
    } catch (e: any) {
      setError(e?.message || "Erro inesperado");
      setData((prev) => ({ ...prev }));
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => fetchOnce(), [fetchOnce]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(fetchOnce, intervalMs);
  }, [fetchOnce, intervalMs]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (auto) fetchOnce();
    return () => {
      stopPolling();
      abortRef.current?.abort();
    };
  }, [auto, fetchOnce, stopPolling]);

  useEffect(() => {
    if (!data.planStatus) return;
    if (pollOn.includes(data.planStatus)) startPolling();
    else stopPolling();
  }, [data.planStatus, pollOn, startPolling, stopPolling]);

  const flags = useMemo(() => {
    const meta = getPlanAccessMeta(data.planStatus, data.cancelAtPeriodEnd);
    const normalizedStatus = meta.normalizedStatus;

    const isActive =
      normalizedStatus === "active" || normalizedStatus === "trialing" || normalizedStatus === "trial";
    const isNonRenewing = normalizedStatus === "non_renewing" || data.cancelAtPeriodEnd === true;
    const isAnnual = data.interval === "year";
    const isMonthly = data.interval === "month";
    const hasPremiumAccess = meta.hasPremiumAccess;
    const isGracePeriod = meta.isGracePeriod;

    const shouldResubscribe =
      normalizedStatus === "inactive" ||
      normalizedStatus === "expired" ||
      normalizedStatus === "canceled" ||
      normalizedStatus === "unpaid" ||
      normalizedStatus === "incomplete_expired";

    const nextAction: "cancel" | "reactivate" | "resubscribe" = shouldResubscribe
      ? "resubscribe"
      : isNonRenewing
      ? "reactivate"
      : "cancel";

    return {
      isActive,
      isNonRenewing,
      isAnnual,
      isMonthly,
      hasPremiumAccess,
      isGracePeriod,
      normalizedStatus,
      nextAction,
    };
  }, [data.planStatus, data.cancelAtPeriodEnd, data.interval]);

  return useMemo(
    () => ({
      ...data,
      isLoading: loading,
      error,
      refetch,
      startPolling,
      stopPolling,
      ...flags,
      nextAction: flags.nextAction,
      hasPremiumAccess: flags.hasPremiumAccess,
      isGracePeriod: flags.isGracePeriod,
      normalizedStatus: flags.normalizedStatus,
    }),
    [data, loading, error, refetch, startPolling, stopPolling, flags]
  );
}

export default useBillingStatus;
