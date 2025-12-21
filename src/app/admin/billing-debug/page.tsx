"use client";

import { useState } from "react";

type DebugResponse = {
  ok: boolean;
  db?: Record<string, unknown>;
  stripe?: Record<string, unknown> | null;
  stripeRequestId?: string | null;
  error?: string;
};

export default function BillingDebugPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DebugResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<"reconcile" | "abort" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);

  const fetchDebug = async () => {
    const q = query.trim();
    if (!q) {
      setError("Informe userId, email, cus_... ou sub_...");
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/billing/debug?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as DebugResponse;
      if (!res.ok) {
        setError(body?.error || "Falha ao consultar.");
        setData(null);
        return;
      }
      setData(body);
    } catch (err: any) {
      setError(err?.message || "Erro inesperado");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const userId =
    typeof data?.db?.userId === "string" ? (data?.db?.userId as string) : null;
  const planStatus =
    typeof data?.db?.planStatus === "string" ? (data?.db?.planStatus as string) : null;
  const canAbort =
    planStatus === "pending" || planStatus === "incomplete" || planStatus === "incomplete_expired";

  const runReconcile = async () => {
    if (!userId) return;
    setActionLoading("reconcile");
    setActionError(null);
    setActionOk(null);
    try {
      const res = await fetch("/api/admin/billing/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(body?.error || "Falha ao reconciliar.");
        return;
      }
      setActionOk("Reconciliação concluída.");
      await fetchDebug();
    } catch (err: any) {
      setActionError(err?.message || "Erro ao reconciliar.");
    } finally {
      setActionLoading(null);
    }
  };

  const runAbort = async () => {
    if (!userId) return;
    setActionLoading("abort");
    setActionError(null);
    setActionOk(null);
    try {
      const res = await fetch("/api/admin/billing/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(body?.error || "Falha ao abortar tentativa.");
        return;
      }
      setActionOk("Tentativa abortada.");
      await fetchDebug();
    } catch (err: any) {
      setActionError(err?.message || "Erro ao abortar.");
    } finally {
      setActionLoading(null);
    }
  };

  const renderCard = (title: string, payload: Record<string, unknown> | null | undefined) => (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      {!payload ? (
        <p className="mt-2 text-sm text-gray-500">Sem dados disponíveis.</p>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          {Object.entries(payload).map(([key, value]) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <span className="text-gray-600">{key}</span>
              <span className="text-gray-900 break-all text-right">{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing Debug</h1>
        <p className="text-sm text-gray-600">
          Consulte o status do usuário no DB e o estado atual no Stripe (ao vivo).
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="userId, email, cus_..., sub_..."
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={fetchDebug}
            disabled={loading}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {data?.stripeRequestId && (
          <p className="mt-3 text-xs text-gray-500">stripeRequestId: {data.stripeRequestId}</p>
        )}
        {userId && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runReconcile}
              disabled={actionLoading !== null}
              className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-60"
            >
              {actionLoading === "reconcile" ? "Reconciliando..." : "Reconciliar"}
            </button>
            {canAbort && (
              <button
                type="button"
                onClick={runAbort}
                disabled={actionLoading !== null}
                className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-60"
              >
                {actionLoading === "abort" ? "Abortando..." : "Abortar tentativa"}
              </button>
            )}
          </div>
        )}
        {actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}
        {actionOk && <p className="mt-3 text-sm text-emerald-600">{actionOk}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {renderCard("DB", data?.db)}
        {renderCard("Stripe (ao vivo)", data?.stripe ?? null)}
      </div>
    </div>
  );
}
