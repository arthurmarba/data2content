"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PlanStatus = "active" | "non_renewing" | "inactive" | "pending" | "expired";
type BillingStatus = {
  planStatus: PlanStatus | null;
  planExpiresAt: string | null;
  interval: 'month' | 'year' | null;
  priceId: string | null;
};

type Options = {
  auto?: boolean;        // se true, carrega imediatamente
  pollOn?: PlanStatus[]; // estados que devem ligar polling automático
  intervalMs?: number;   // período do polling
};

export function useBillingStatus(opts: Options = {}) {
  const {
    auto = true,
    pollOn = ["pending"],
    intervalMs = 4000,
  } = opts;

  const [data, setData] = useState<BillingStatus>({ planStatus: null, planExpiresAt: null, interval: null, priceId: null });
  const [loading, setLoading] = useState<boolean>(!!auto);
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<any>(null);

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/plan/status`, { cache: "no-store", credentials: 'include' });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j?.error || "Falha ao obter status");
      setData({
        planStatus: j?.status ?? null,
        planExpiresAt: j?.planExpiresAt ?? null,
        interval: j?.interval ?? null,
        priceId: j?.priceId ?? null,
      });
    } catch (e: any) {
      setError(e?.message || "Erro inesperado");
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

