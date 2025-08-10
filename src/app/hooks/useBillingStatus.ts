"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PlanStatus = "active" | "non_renewing" | "inactive" | "pending" | "expired";
type BillingStatus = {
  planStatus: PlanStatus | null;
  planExpiresAt: string | null;
};

type Options = {
  userId?: string | null;
  auto?: boolean;        // se true, carrega imediatamente
  pollOn?: PlanStatus[]; // estados que devem ligar polling automático
  intervalMs?: number;   // período do polling
};

export function useBillingStatus(opts: Options = {}) {
  const {
    userId = null,
    auto = true,
    pollOn = ["pending"],
    intervalMs = 4000,
  } = opts;

  const [data, setData] = useState<BillingStatus>({ planStatus: null, planExpiresAt: null });
  const [loading, setLoading] = useState<boolean>(!!auto);
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<any>(null);

  const fetchOnce = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/plan/status?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Falha ao obter status");
      setData({
        planStatus: j?.planStatus ?? null,
        planExpiresAt: j?.planExpiresAt ?? null,
      });
    } catch (e: any) {
      setError(e?.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refetch = useCallback(() => fetchOnce(), [fetchOnce]);

  const startPolling = useCallback(() => {
    if (pollingRef.current || !userId) return;
    pollingRef.current = setInterval(fetchOnce, intervalMs);
  }, [fetchOnce, intervalMs, userId]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // auto-load
  useEffect(() => {
    if (auto) fetchOnce();
    return () => stopPolling();
  }, [auto, fetchOnce, stopPolling]);

  // liga/desliga polling baseado em estado
  useEffect(() => {
    if (!data.planStatus) return;
    if (pollOn.includes(data.planStatus)) startPolling();
    else stopPolling();
  }, [data.planStatus, pollOn, startPolling, stopPolling]);

  return useMemo(
    () => ({
      ...data,
      isLoading: loading,
      error,
      refetch,
      startPolling,
      stopPolling,
    }),
    [data, loading, error, refetch, startPolling, stopPolling]
  );
}

