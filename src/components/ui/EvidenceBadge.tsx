"use client";

import React, { useState } from 'react';

export interface EvidenceRefUI {
  key: string;
  description?: string;
  metric?: string;
  n?: number;
  deltaPct?: number;
  value?: number;
}

interface EvidenceBadgeProps {
  title?: string;
  refs: EvidenceRefUI[];
  className?: string;
}

export default function EvidenceBadge({ title = 'Evidências', refs, className = '' }: EvidenceBadgeProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 transition hover:border-zinc-300 hover:bg-white hover:text-zinc-900"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={title}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M18 10A8 8 0 11.001 10 8 8 0 0118 10zM9 7a1 1 0 102 0 1 1 0 00-2 0zm2 2.5a1 1 0 10-2 0V14a1 1 0 102 0V9.5z" clipRule="evenodd"/></svg>
        {title}
      </button>
      {open && (
        <div className="dashboard-panel absolute right-0 z-50 mt-2 w-72 rounded-[1.35rem] p-3 text-xs text-zinc-800">
          {refs && refs.length > 0 ? (
            <ul className="space-y-2">
              {refs.map((r) => (
                <li key={r.key} className="leading-snug">
                  <div className="font-medium text-zinc-900">{r.description || r.key}</div>
                  <div className="text-[11px] text-zinc-500">
                    {r.metric ? `métrica: ${r.metric}` : ''}
                    {typeof r.value === 'number' ? ` · valor: ${r.value}` : ''}
                    {typeof r.deltaPct === 'number' ? ` · Δ: ${r.deltaPct}%` : ''}
                    {typeof r.n === 'number' ? ` · n=${r.n}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-zinc-500">Sem referências registradas.</div>
          )}
          <div className="mt-2 text-[11px] text-zinc-500">Baseado em dados do período selecionado.</div>
          <div className="mt-2 text-right">
            <button className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50" onClick={() => setOpen(false)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
