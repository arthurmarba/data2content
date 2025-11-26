"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useGlobalTimePeriod } from './filters/GlobalTimePeriodContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatAxisNumberCompact, formatNullableNumberTooltip, formatDateLabel } from '@/utils/chartFormatters';

interface ApiMovingAverageDataPoint {
  date: string; // YYYY-MM-DD
  movingAverageEngagement: number | null;
}

interface PlatformMovingAverageResponse {
  series: ApiMovingAverageDataPoint[];
  dataStartDate?: string;
  dataEndDate?: string;
  insightSummary?: string;
}

const MOVING_AVERAGE_WINDOW_OPTIONS = [
  { value: "7", label: "7 dias (Média Semanal)" },
  { value: "14", label: "14 dias" },
  { value: "30", label: "30 dias (Média Mensal)" },
];

// Helper para converter timePeriod string para número de dias
const timePeriodToDataWindowDays = (timePeriod: string): number => {
  switch (timePeriod) {
    case "last_7_days": return 7;
    case "last_30_days": return 30;
    case "last_60_days": return 60;
    case "last_90_days": return 90;
    default: return 30; // Default
  }
};

interface PlatformMovingAverageEngagementChartProps {
  initialAvgWindow?: string;
  apiPrefix?: string;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
}

const PlatformMovingAverageEngagementChart: React.FC<PlatformMovingAverageEngagementChartProps> = ({
  initialAvgWindow = MOVING_AVERAGE_WINDOW_OPTIONS[0]?.value ?? "7",
  apiPrefix = '/api/admin',
  onlyActiveSubscribers = false,
  contextFilter,
  creatorContextFilter,
}) => {
  const { timePeriod } = useGlobalTimePeriod();
  const [data, setData] = useState<PlatformMovingAverageResponse['series']>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const dataWindowInDays = timePeriodToDataWindowDays(timePeriod);
  const [avgWindow, setAvgWindow] = useState<string>(initialAvgWindow);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const currentAvgWindowDays = parseInt(avgWindow, 10);
    if (currentAvgWindowDays > dataWindowInDays) {
      setError("A janela da média móvel não pode ser maior que a janela de dados.");
      setLoading(false);
      setData([]);
      setInsightSummary(undefined);
      return;
    }

    try {
      const params = new URLSearchParams({
        dataWindowInDays: String(dataWindowInDays),
        movingAverageWindowInDays: String(currentAvgWindowDays),
      });
      if (onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');
      if (contextFilter) params.append('context', contextFilter);
      if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);
      const apiUrl = `${apiPrefix}/dashboard/trends/moving-average-engagement?${params.toString()}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: PlatformMovingAverageResponse = await response.json();
      setData(result.series);
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido ao buscar dados.');
      setData([]);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [dataWindowInDays, avgWindow, apiPrefix, onlyActiveSubscribers, contextFilter, creatorContextFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const yAxisFormatter = (value: number) => formatAxisNumberCompact(value);
  const tooltipFormatter = (value: number, name: string) => formatNullableNumberTooltip(value, name);

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6 md:mt-0">
       <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        {/* ===== CORREÇÃO: Título do gráfico atualizado ===== */}
        <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-2 sm:mb-0">
            Tendência de Engajamento (Plataforma)
        </h2>
        <div>
          <label htmlFor="avgWindowMovingAvgPlatform" className="sr-only">Janela da Média Móvel:</label>
          <select
            id="avgWindowMovingAvgPlatform"
            value={avgWindow}
            onChange={(e) => setAvgWindow(e.target.value)}
            disabled={loading}
            className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {MOVING_AVERAGE_WINDOW_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ width: '100%', height: 300 }}>
        {loading && <div className="flex justify-center items-center h-full"><p className="text-gray-500">Carregando dados...</p></div>}
        {error && <div className="flex justify-center items-center h-full"><p className="text-red-500">Erro: {error}</p></div>}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="movingAvgStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#82ca9d" stopOpacity={1} />
                  <stop offset="100%" stopColor="#82ca9d" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 12 }} tickFormatter={formatDateLabel} />
              <YAxis stroke="#666" tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
              <Tooltip formatter={tooltipFormatter} labelFormatter={formatDateLabel} labelStyle={{ color: '#333' }} itemStyle={{ color: '#82ca9d' }} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              {/* ===== CORREÇÃO: Nome da linha na legenda atualizado ===== */}
              <Line
                type="monotone"
                dataKey="movingAverageEngagement"
                name={`Tendência (${avgWindow}d)`}
                stroke="url(#movingAvgStroke)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="flex justify-center items-center h-full"><p className="text-gray-500">Nenhum dado disponível para os filtros selecionados.</p></div>
        )}
      </div>
      {insightSummary && !loading && !error && (
        <p className="text-xs md:text-sm text-gray-600 mt-4 pt-2 border-t border-gray-200 flex items-start">
          <LightBulbIcon className="w-4 h-4 text-yellow-500 mr-1 flex-shrink-0" />
          {insightSummary}
        </p>
      )}
    </div>
  );
};

export default memo(PlatformMovingAverageEngagementChart);
