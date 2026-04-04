import React from 'react';

export interface ConfidencePillProps {
  confidence?: number; // 0..1
  n?: number;
  className?: string;
}

export default function ConfidencePill({ confidence = 0, n, className = '' }: ConfidencePillProps) {
  const level = confidence >= 0.75 ? 'alta' : confidence >= 0.45 ? 'média' : 'baixa';
  const color =
    level === 'alta'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : level === 'média'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-zinc-200 bg-zinc-100 text-zinc-600';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${color} ${className}`}>
      Confiança: {level}{typeof n === 'number' ? ` · n=${n}` : ''}
    </span>
  );
}
