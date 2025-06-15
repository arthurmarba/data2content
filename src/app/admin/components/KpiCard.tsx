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
  formatAs?: 'number' | 'percentage' | 'currency'; // Added formatAs
}

export default function KpiCard({ label, value, icon: Icon, isLoading, tooltip, onAskAi, formatAs = 'number' }: KpiCardProps) { // Added formatAs with default

  const formatValue = (val: number | string | undefined) => {
    if (val === undefined || val === null) return 'N/A';

    const num = Number(val);
    if (isNaN(num)) return val.toString(); // Return as string if not a valid number after conversion attempt

    switch (formatAs) {
      case 'percentage':
        return `${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
      case 'currency': // Assuming BRL, can be made more dynamic
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      case 'number':
      default:
        return num.toLocaleString('pt-BR');
    }
  };

  return (
    <div className="relative bg-white p-5 rounded-lg shadow-sm border border-gray-200 group">
      {isLoading ? (
        <>
          <SkeletonBlock width="w-3/4" height="h-3 mb-2" />
          <SkeletonBlock width="w-1/2" height="h-8" />
        </>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <h4 className="text-sm text-gray-500 font-medium truncate flex items-center" title={label}>
              <Icon className="h-4 w-4 text-gray-400 mr-2" />
              {label}
            </h4>
            {tooltip && (
                <div className="relative flex items-center">
                    <InformationCircleIcon className="h-4 w-4 text-gray-400 peer" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 peer-hover:opacity-100 transition-opacity pointer-events-none">
                        {tooltip}
                    </div>
                </div>
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{formatValue(value)}</p>
        </>
      )}
      {onAskAi && !isLoading && (
        <button 
          onClick={onAskAi} 
          title="Perguntar à IA sobre este KPI" 
          className="absolute top-2 right-2 p-1 rounded-full text-indigo-500 opacity-0 group-hover:opacity-100 hover:bg-indigo-100 transition-opacity"
        >
            <ChatBubbleLeftRightIcon className="h-4 w-4"/>
        </button>
      )}
    </div>
  );
}
