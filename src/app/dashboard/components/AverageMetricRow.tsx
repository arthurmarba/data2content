'use client';

import React from 'react';

interface AverageMetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | number | null | undefined;
}

const AverageMetricRow: React.FC<AverageMetricRowProps> = ({ icon, label, value }) => {
  const formattedValue =
    typeof value === 'number'
      ? value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
      : typeof value === 'string' && value.trim().length > 0
        ? value
        : '—';

  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100/90 py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          {icon}
        </div>
        <span className="min-w-0 text-sm font-medium text-zinc-700">{label}</span>
      </div>
      <span className="shrink-0 text-sm font-bold text-zinc-900">{formattedValue}</span>
    </div>
  );
};

export default AverageMetricRow;
