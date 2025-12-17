"use client";

import React, { useEffect, useState } from "react";

type QueueItem = {
  id: string;
  startedAt: string;
  csat: number | null;
  fallbackCount: number;
  lowConfidenceCount: number;
  thumbsDown: number;
  score: number;
  scoreBreakdown: Record<string, number>;
  reviewStatus: string;
  category?: string | null;
  severity?: number | null;
  ticketUrl?: string | null;
};

export default function ReviewQueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/chat/reviews/queue?days=7&limit=50");
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setQueue(json.queue || []);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar fila");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quality Ops</p>
          <h1 className="text-2xl font-bold text-slate-900">Review queue</h1>
        </div>
        <button
          onClick={loadQueue}
          className="text-xs font-semibold text-brand-primary rounded-lg border border-brand-primary/20 px-3 py-1 hover:bg-brand-primary/5"
        >
          Atualizar
        </button>
      </div>
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {queue.map((item) => (
          <a key={item.id} href={`/admin/chat-telemetry/sessions#${item.id}`} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 hover:border-brand-primary/30">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">{new Date(item.startedAt).toLocaleString()}</div>
              <div className="text-xs font-bold text-brand-primary">Score {item.score}</div>
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
              {item.csat !== null ? <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">CSAT {item.csat}</span> : null}
              {item.fallbackCount ? <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">Fallback {item.fallbackCount}</span> : null}
              {item.lowConfidenceCount ? <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">Low conf {item.lowConfidenceCount}</span> : null}
              {item.thumbsDown ? <span className="rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-700">👎 {item.thumbsDown}</span> : null}
              {item.category ? <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{item.category}</span> : null}
              {item.severity ? <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">Sev {item.severity}</span> : null}
              <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{item.reviewStatus}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">Score breakdown: {Object.entries(item.scoreBreakdown || {}).map(([k, v]) => `${k}:${v}`).join(' | ')}</div>
            {item.ticketUrl ? <p className="text-[11px] text-brand-primary mt-1 truncate">Ticket: {item.ticketUrl}</p> : null}
          </a>
        ))}
        {loading ? <p className="text-sm text-slate-500">Carregando...</p> : null}
      </div>
    </div>
  );
}

