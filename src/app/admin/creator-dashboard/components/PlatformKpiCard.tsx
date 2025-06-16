"use client";

import React from 'react';

interface PlatformKpiCardProps {
  title: string;
  value: string | number | null;
  // Opcional: para mostrar mudanças percentuais ou informações adicionais
  change?: string | null;
  changeType?: 'positive' | 'negative' | 'neutral';
  tooltip?: string;
  isLoading?: boolean;
  error?: string | null;
  // Mini-chart data (a ser adicionado em uma iteração futura)
  // chartData?: { comparisonPair: string; periodName: string; value: number; periodKey: string }[];
}

const PlatformKpiCard: React.FC<PlatformKpiCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  tooltip,
  isLoading = false,
  error = null,
}) => {
  const getChangeColor = () => {
    if (error) return "text-red-500";
    switch (changeType) {
      case 'positive':
        return "text-green-500";
      case 'negative':
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md min-h-[120px] flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium text-gray-500 truncate">{title}</h3>
          {tooltip && (
            <div className="relative group">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs text-white bg-gray-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                {tooltip}
              </div>
            </div>
          )}
        </div>

        {isLoading && (
          <p className="text-2xl font-semibold text-gray-400 animate-pulse">Carregando...</p>
        )}
        {error && (
          <p className="text-sm font-semibold text-red-500">Erro: {error.length > 50 ? error.substring(0,50)+'...' : error}</p>
        )}
        {!isLoading && !error && value !== null && (
          <p className="text-2xl md:text-3xl font-semibold text-gray-800">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        )}
         {!isLoading && !error && value === null && (
          <p className="text-2xl font-semibold text-gray-400">-</p>
        )}
      </div>

      {!isLoading && !error && change && (
        <p className={`text-xs mt-1 ${getChangeColor()}`}>
          {change}
        </p>
      )}
      {/* Placeholder para mini-chart a ser adicionado no futuro */}
      {/* {chartData && chartData.length > 0 && <div className="mt-2 h-16"> Mini Chart Aqui </div>} */}
    </div>
  );
};

export default PlatformKpiCard;
