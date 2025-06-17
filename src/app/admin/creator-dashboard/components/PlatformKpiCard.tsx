"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'; // Adicionado Cell para cores

// Interface para os dados do mini-gráfico
interface MiniChartDataPoint {
  name: string; // Ex: "Anterior", "Atual"
  value: number;
}

interface PlatformKpiCardProps {
  title: string;
  value: string | number | null;
  change?: string | null;
  changeType?: 'positive' | 'negative' | 'neutral';
  tooltip?: string;
  isLoading?: boolean;
  error?: string | null;
  chartData?: MiniChartDataPoint[]; // Nova prop para o mini-gráfico
}

// Cores para o mini-gráfico (Anterior, Atual)
const MINI_CHART_COLORS = ['#cbd5e1', '#6366f1']; // Cinza claro para anterior, Indigo para atual


const InfoIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const PlatformKpiCard: React.FC<PlatformKpiCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  tooltip,
  isLoading = false,
  error = null,
  chartData,
}) => {
  const getChangeColor = () => {
    if (error) return "text-red-500"; // Erro tem prioridade na cor da mudança
    switch (changeType) {
      case 'positive':
        return "text-green-500";
      case 'negative':
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const mainValueDisplay = () => {
    if (isLoading) return <p className="text-2xl font-semibold text-gray-400 animate-pulse">Carregando...</p>;
    if (error) return <p className="text-sm font-semibold text-red-500 truncate" title={error}>Erro: {error.length > 30 ? error.substring(0,27)+'...' : error}</p>;
    if (value === null || value === undefined) return <p className="text-2xl md:text-3xl font-semibold text-gray-400">-</p>;
    return <p className="text-2xl md:text-3xl font-semibold text-gray-800">{typeof value === 'number' ? value.toLocaleString() : value}</p>;
  };

  const changeDisplay = () => {
    if (isLoading || error || !change ) return <div className="h-4"></div>; // Placeholder para manter altura
    return <p className={`text-xs mt-1 ${getChangeColor()}`}>{change}</p>;
  };


  return (
    <div className="bg-white p-4 rounded-lg shadow-md min-h-[120px] flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium text-gray-500 truncate" title={title}>{title}</h3>
          {tooltip && (
            <div className="relative group">
              <InfoIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-pointer" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs p-1.5 text-xs text-white bg-gray-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                {tooltip}
              </div>
            </div>
          )}
        </div>

        {mainValueDisplay()}
        {changeDisplay()}
      </div>

      {/* Mini-gráfico de barras comparativas */}
      {!isLoading && !error && chartData && chartData.length === 2 && (
        <div className="mt-2 h-16 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              {/* Não mostrar CartesianGrid, XAxis, YAxis, Legend, Tooltip para um mini-gráfico limpo */}
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" hide />
              <Bar dataKey="value" barSize={12} radius={[4, 4, 4, 4]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={MINI_CHART_COLORS[index % MINI_CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default React.memo(PlatformKpiCard);

