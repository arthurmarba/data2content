// src/app/admin/components/KpiCard.tsx
'use client';

import React from 'react';
import SkeletonBlock from '../creator-dashboard/SkeletonBlock'; // Ajuste o caminho se o SkeletonBlock estiver em outro lugar

interface KpiCardProps {
  label: string;
  value: string | number | undefined; // Undefined para estado de carregamento
  unit?: string;
  icon?: React.ElementType; // Ex: um ícone do Heroicons
  isLoading?: boolean;
}

export default function KpiCard({ label, value, unit, icon: Icon, isLoading = false }: KpiCardProps) {
  const displayValue = value === undefined || value === null ? '-' : String(value);

  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow border border-gray-200 dark:border-gray-700 flex flex-col justify-between h-full"> {/* dark: classes mantidas para flexibilidade futura */}
      <div>
        <div className="flex items-center text-gray-500 dark:text-gray-400 mb-1">
          {Icon && <Icon className="w-4 h-4 mr-2" />}
          <h4 className="text-sm font-medium truncate" title={label}>
            {label}
          </h4>
        </div>
        {isLoading ? (
          <SkeletonBlock width="w-3/4" height="h-8 mt-1" />
        ) : (
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
            {displayValue}
            {unit && <span className="text-lg ml-1">{unit}</span>}
          </p>
        )}
      </div>
      {/* Pode adicionar um link "Ver mais" ou uma pequena tendência aqui no futuro */}
      {/* Ex: <div className="text-xs text-gray-400 mt-3">Ver detalhes &rarr;</div> */}
    </div>
  );
}
