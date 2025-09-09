import React from 'react';

export interface ConfidencePillProps {
  confidence?: number; // 0..1
  n?: number;
  className?: string;
}

export default function ConfidencePill({ confidence = 0, n, className = '' }: ConfidencePillProps) {
  const level = confidence >= 0.75 ? 'alta' : confidence >= 0.45 ? 'média' : 'baixa';
  const color = level === 'alta' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : level === 'média' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-gray-700 bg-gray-50 border-gray-200';
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs ${color} ${className}`}>
      Confiança: {level}{typeof n === 'number' ? ` · n=${n}` : ''}
    </span>
  );
}

