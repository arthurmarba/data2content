/**
 * @fileoverview Componente reutilizável para exibir um Indicador Chave de Performance (KPI).
 * @version 2.0.0
 * @description Adicionada a funcionalidade `onAskAi` para integração com o chat de IA.
 */
'use client';

import React from 'react';
import { InformationCircleIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import SkeletonBlock from './SkeletonBlock'; // Importa o componente centralizado

interface KpiCardProps {
  label: string;
  value?: number | string;
  icon: React.ElementType;
  isLoading: boolean;
  tooltip?: string;
  onAskAi?: () => void;
  formatAs?: 'number' | 'currency' | 'percentage'; // Changed from implicit string default to optional literal type
  variant?: 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'indigo';
}

export default function KpiCard({
  label,
  value,
  icon: Icon,
  isLoading,
  tooltip,
  onAskAi,
  formatAs = 'number',
  variant = 'neutral',
}: KpiCardProps) {

  const formatValue = (val: number | string | undefined) => {
    if (val === undefined || val === null) return 'N/A';
    const num = Number(val);
    if (isNaN(num)) return val.toString();
    switch (formatAs) {
      case 'percentage':
        return `${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
      case 'currency':
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      case 'number':
      default:
        return num.toLocaleString('pt-BR');
    }
  };

  const variants = {
    neutral: 'bg-gray-100 text-gray-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    indigo: 'bg-indigo-100 text-indigo-600',
  };

  return (
    <div className="relative bg-white p-5 rounded-lg shadow-sm border border-gray-200 group hover:border-indigo-300 transition-colors">
      {isLoading ? (
        <>
          <div className="flex justify-between items-start mb-2">
            <SkeletonBlock width="w-24" height="h-4" />
            <SkeletonBlock width="w-8" height="h-8" className="rounded-full" />
          </div>
          <SkeletonBlock width="w-32" height="h-8" />
        </>
      ) : (
        <>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 flex items-center gap-1">
                {label}
                {tooltip && (
                  <span className="relative flex items-center group/tooltip cursor-help">
                    <InformationCircleIcon className="h-4 w-4 text-gray-400" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10 text-center shadow-lg">
                      {tooltip}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                    </span>
                  </span>
                )}
              </p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">{formatValue(value)}</h3>
            </div>
            <div className={`p-2 rounded-lg ${variants[variant]}`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </>
      )}
      {onAskAi && !isLoading && (
        <button
          onClick={onAskAi}
          title="Perguntar à IA sobre este KPI"
          className="absolute bottom-2 right-2 p-1.5 rounded-full text-indigo-500 opacity-0 group-hover:opacity-100 hover:bg-indigo-50 transition-all hover:scale-110"
        >
          <ChatBubbleLeftRightIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
