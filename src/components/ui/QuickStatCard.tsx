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
  const deltaColor = pct !== null ? (pct > 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : pct < 0 ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-gray-700 bg-gray-50 border-gray-200') : '';

  return (
    <section className="border border-gray-200 border-t-4 border-pink-500 rounded-xl bg-white shadow-md p-4">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </div>
      {hint && <div className="text-xs text-gray-500 mt-0.5">{hint}</div>}
      {pct !== null && (
        <div className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[11px] mt-2 ${deltaColor}`}>
          {pct > 0 ? '▲' : pct < 0 ? '▼' : '•'} {pct > 0 ? '+' : ''}{pct}%
        </div>
      )}
    </section>
  );
}
