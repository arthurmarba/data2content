"use client";

import React, { useEffect, useState } from "react";

type CategoryStat = {
  category: string;
  count: number;
  csatAvg: number | null;
  thumbsDown: number;
  thumbsUp: number;
  fixed: number;
  tickets: number;
  auto: number;
  manual: number;
};

export default function QualityPage() {
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/chat/reviews/summary");
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setCategories(json.categories || []);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar categorias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quality</p>
          <h1 className="text-2xl font-bold text-slate-900">Categorias</h1>
        </div>
        <button
          onClick={load}
          className="text-xs font-semibold text-brand-primary rounded-lg border border-brand-primary/20 px-3 py-1 hover:bg-brand-primary/5"
        >
          Atualizar
        </button>
      </div>
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}
      <div className="overflow-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600 font-semibold">
            <tr>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Casos</th>
              <th className="px-4 py-3">Auto</th>
              <th className="px-4 py-3">Manual</th>
              <th className="px-4 py-3">CSAT médio</th>
              <th className="px-4 py-3">👎</th>
              <th className="px-4 py-3">👍</th>
              <th className="px-4 py-3">Fixed</th>
              <th className="px-4 py-3">Tickets</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map((c) => (
              <tr key={c.category} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-800">{c.category}</td>
                <td className="px-4 py-3">{c.count}</td>
                <td className="px-4 py-3">{c.auto}</td>
                <td className="px-4 py-3">{c.manual}</td>
                <td className="px-4 py-3">{c.csatAvg?.toFixed?.(2) ?? "—"}</td>
                <td className="px-4 py-3">{c.thumbsDown}</td>
                <td className="px-4 py-3">{c.thumbsUp}</td>
                <td className="px-4 py-3">{c.fixed}</td>
                <td className="px-4 py-3">{c.tickets}</td>
              </tr>
            ))}
            {loading ? (
              <tr><td className="px-4 py-3 text-slate-500" colSpan={9}>Carregando...</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
