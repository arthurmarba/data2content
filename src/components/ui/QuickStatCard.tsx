import React from 'react';

interface QuickStatCardProps {
  title: string;
  value: string | number;
  hint?: string;
  deltaPct?: number | null;
}

export default function QuickStatCard({ title, value, hint, deltaPct }: QuickStatCardProps) {
  const hasDelta = typeof deltaPct === 'number' && Number.isFinite(deltaPct);
  const pct = hasDelta ? Number((deltaPct as number).toFixed(1)) : null;
  const deltaColor =
    pct !== null
      ? pct > 0
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : pct < 0
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-zinc-200 bg-zinc-100 text-zinc-600'
      : '';

  return (
    <section className="dashboard-panel-subtle relative overflow-hidden rounded-[1.35rem] p-4">
      <div className="dashboard-muted-label">{title}</div>
      <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-zinc-950">
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </div>
      {hint && <div className="mt-1 text-xs leading-5 text-zinc-500">{hint}</div>}
      {pct !== null && (
        <div className={`mt-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${deltaColor}`}>
          {pct > 0 ? '▲' : pct < 0 ? '▼' : '•'} {pct > 0 ? '+' : ''}{pct}%
        </div>
      )}
    </section>
  );
}
