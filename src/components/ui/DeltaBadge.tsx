import React from 'react';

interface DeltaBadgeProps {
  value: number; // percentage delta
  className?: string;
}

export default function DeltaBadge({ value, className = '' }: DeltaBadgeProps) {
  const rounded = Number.isFinite(value) ? Number(value.toFixed(1)) : 0;
  const positive = rounded > 0;
  const negative = rounded < 0;
  const color = positive
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : negative
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-zinc-200 bg-zinc-100 text-zinc-600';
  const icon = positive ? (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v9.586l3.293-3.293a1 1 0 111.414 1.414l-5 5a1 1 0 01-1.414 0l-5-5A1 1 0 114.707 10.293L8 13.586V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
  ) : negative ? (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 rotate-180"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v9.586l3.293-3.293a1 1 0 111.414 1.414l-5 5a1 1 0 01-1.414 0l-5-5A1 1 0 114.707 10.293L8 13.586V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><circle cx="10" cy="10" r="2"/></svg>
  );
  const text = `${rounded > 0 ? '+' : ''}${rounded}%`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${color} ${className}`}>
      {icon}
      {text}
    </span>
  );
}
