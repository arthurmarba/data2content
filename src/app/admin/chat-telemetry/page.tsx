"use client";

import React, { useEffect, useMemo, useState } from "react";

type MetricsResponse = {
  kpis: Record<string, any>;
  top: Record<string, any>;
  timeseries?: Array<{ _id: string; sessions: number; csatPrompted: number; csatSubmitted: number }>;
};

const Card = ({ title, value, helper }: { title: string; value: React.ReactNode; helper?: string }) => (
  <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
    <p className="text-sm font-semibold text-slate-500">{title}</p>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    {helper ? <p className="text-xs text-slate-500 mt-1">{helper}</p> : null}
  </div>
);

export default function ChatTelemetryOverviewPage() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/chat/metrics");
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e?.message || "Falha ao carregar métricas");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const timeseries = useMemo(() => data?.timeseries || [], [data]);

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">{error}</div> : null}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="CSAT médio" value={data?.kpis?.csatAvg?.toFixed?.(2) ?? "—"} helper={`Distribuição: ${JSON.stringify(data?.kpis?.csatDistribution || {})}`} />
        <Card title="CSAT coverage" value={`${Math.round((data?.kpis?.csatCoverage || 0) * 100)}%`} helper={`Response rate: ${Math.round((data?.kpis?.csatResponseRate || 0) * 100)}%`} />
        <Card title="% fallback" value={`${Math.round((data?.kpis?.fallbackRate || 0) * 100)}%`} helper={`Fallback reasons: ver tabela`} />
        <Card title="Msgs / sessão" value={data?.kpis?.messagesPerSession?.toFixed?.(1) ?? "—"} helper={`Duração média: ${(data?.kpis?.avgSessionDurationMs / 60000 || 0).toFixed(1)} min`} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="👍" value={data?.kpis?.thumbsUp ?? "—"} />
        <Card title="👎" value={data?.kpis?.thumbsDown ?? "—"} />
        <Card title="TFR p50 / p95" value={`${(data?.kpis?.timeToFirstAssistantP50 / 1000 || 0).toFixed(1)}s / ${(data?.kpis?.timeToFirstAssistantP95 / 1000 || 0).toFixed(1)}s`} helper={`LLM p50/p95: ${(data?.kpis?.llmLatencyP50 / 1000 || 0).toFixed(1)}s / ${(data?.kpis?.llmLatencyP95 / 1000 || 0).toFixed(1)}s`} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Top intents com 👎</h2>
          <ul className="space-y-2 text-sm text-slate-700">
            {(data?.top?.intentsWithThumbsDown || []).map((item: any, idx: number) => (
              <li key={idx} className="flex justify-between border-b border-slate-100 pb-1">
                <span>{item._id?.intent || "(sem intent)"} {item._id?.fallback ? `• ${item._id.fallback}` : ""}</span>
                <span className="font-semibold">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Fallback por motivo</h2>
          <ul className="space-y-2 text-sm text-slate-700">
            {(data?.top?.fallbackReasons || []).map((item: any, idx: number) => (
              <li key={idx} className="flex justify-between border-b border-slate-100 pb-1">
                <span>{item._id || "(indefinido)"}</span>
                <span className="font-semibold">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-2">Context sources com mais 👎</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            {(data?.top?.contextSourcesWithThumbsDown || []).map((item: any, idx: number) => (
              <li key={idx} className="flex justify-between border-b border-slate-100 pb-1">
                <span>{item._id || "(vazio)"}</span>
                <span className="font-semibold">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-2">Motivos do 👎</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            {(data?.top?.thumbsDownReasons || []).map((item: any, idx: number) => (
              <li key={idx} className="flex justify-between border-b border-slate-100 pb-1">
                <span>{item._id || "(sem motivo)"}</span>
                <span className="font-semibold">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-2">Perguntas em fallback</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            {(data?.top?.fallbackQuestions || []).map((item: any, idx: number) => (
              <li key={idx} className="border-b border-slate-100 pb-1">
                <p className="font-semibold text-slate-800">{item.sample?.slice(0, 120) || "(sem texto)"}</p>
                <p className="text-xs text-slate-500">{item._id?.fallbackReason || "(motivo indefinido)"} • {item._id?.intent || "intent?"} • {item.count}x</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Tendência (sessões)</h2>
        <div className="flex gap-4 overflow-x-auto text-sm text-slate-700">
          {timeseries.map((t) => (
            <div key={t._id} className="min-w-[120px] rounded-xl border border-slate-100 p-3">
              <p className="text-xs font-semibold text-slate-500">{t._id}</p>
              <p className="text-base font-bold text-slate-900">{t.sessions} sessões</p>
              <p className="text-[11px] text-slate-500">CSAT prompted: {t.csatPrompted} | CSAT enviados: {t.csatSubmitted}</p>
            </div>
          ))}
        </div>
      </section>

      {loading ? <p className="text-sm text-slate-500">Carregando...</p> : null}
    </div>
  );
}

