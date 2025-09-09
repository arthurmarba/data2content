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
        className="inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs text-gray-700 bg-gray-50 border-gray-200"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={title}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M18 10A8 8 0 11.001 10 8 8 0 0118 10zM9 7a1 1 0 102 0 1 1 0 00-2 0zm2 2.5a1 1 0 10-2 0V14a1 1 0 102 0V9.5z" clipRule="evenodd"/></svg>
        {title}
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-72 right-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs text-gray-800">
          {refs && refs.length > 0 ? (
            <ul className="space-y-2">
              {refs.map((r) => (
                <li key={r.key} className="leading-snug">
                  <div className="font-medium text-gray-900">{r.description || r.key}</div>
                  <div className="text-[11px] text-gray-600">
                    {r.metric ? `métrica: ${r.metric}` : ''}
                    {typeof r.value === 'number' ? ` · valor: ${r.value}` : ''}
                    {typeof r.deltaPct === 'number' ? ` · Δ: ${r.deltaPct}%` : ''}
                    {typeof r.n === 'number' ? ` · n=${r.n}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-gray-600">Sem referências registradas.</div>
          )}
          <div className="mt-2 text-[11px] text-gray-500">Baseado em dados do período selecionado.</div>
          <div className="mt-2 text-right">
            <button className="text-[11px] text-gray-700 border rounded px-2 py-0.5" onClick={() => setOpen(false)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

