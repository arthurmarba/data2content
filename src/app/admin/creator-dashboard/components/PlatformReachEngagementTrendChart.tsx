"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useGlobalTimePeriod } from './filters/GlobalTimePeriodContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatAxisNumberCompact, formatNullableNumberTooltip, formatDateLabel, formatWeekStartLabel } from '@/utils/chartFormatters';

interface ApiChartDataPoint {
  date: string;
  reach: number | null;
  totalInteractions: number | null;
}

interface PlatformChartResponse {
  chartData: ApiChartDataPoint[];
  insightSummary?: string;
}

const GRANULARITY_OPTIONS = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
];

interface PlatformReachEngagementTrendChartProps {
  initialGranularity?: string;
  apiPrefix?: string;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
  dataOverride?: PlatformChartResponse['chartData'] | null;
  insightOverride?: string;
  loadingOverride?: boolean;
  errorOverride?: string | null;
  disableFetch?: boolean;
  granularityOverride?: string;
  onGranularityChange?: (value: string) => void;
}

const PlatformReachEngagementTrendChart: React.FC<PlatformReachEngagementTrendChartProps> = ({
  initialGranularity = GRANULARITY_OPTIONS[0]!.value,
  apiPrefix = '/api/admin',
  onlyActiveSubscribers = false,
  contextFilter,
  creatorContextFilter,
  dataOverride,
  insightOverride,
  loadingOverride,
  errorOverride,
  disableFetch = false,
  granularityOverride,
  onGranularityChange,
}) => {
  const { timePeriod } = useGlobalTimePeriod();
  const [data, setData] = useState<PlatformChartResponse['chartData']>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<string>(initialGranularity);
  const granularityValue = granularityOverride ?? granularity;
  const hasOverride = Boolean(disableFetch)
    || typeof dataOverride !== 'undefined'
    || typeof loadingOverride !== 'undefined'
    || typeof errorOverride !== 'undefined'
    || typeof insightOverride !== 'undefined';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ timePeriod, granularity: granularityValue });
      if (onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');
      if (contextFilter) params.append('context', contextFilter);
      if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);
      const apiUrl = `${apiPrefix}/dashboard/trends/reach-engagement?${params.toString()}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: PlatformChartResponse = await response.json();
      setData(result.chartData);
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido ao buscar dados.');
      setData([]);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [timePeriod, granularityValue, apiPrefix, onlyActiveSubscribers, contextFilter, creatorContextFilter]);

  useEffect(() => {
    if (!hasOverride) {
      fetchData();
    }
  }, [fetchData, hasOverride]);

  const handleGranularityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextValue = e.target.value;
    if (onGranularityChange) {
      onGranularityChange(nextValue);
    } else {
      setGranularity(nextValue);
    }
  };

  const yAxisFormatter = (value: number) => formatAxisNumberCompact(value);
  const tooltipFormatter = (value: number, name: string) => formatNullableNumberTooltip(value, name);

  const xAxisTickFormatter = (tick: string) => {
    if (granularityValue === 'weekly') {
      return formatWeekStartLabel(tick);
    }
    return formatDateLabel(tick);
  };

  const finalData = hasOverride ? (dataOverride ?? []) : data;
  const finalLoading = hasOverride ? (loadingOverride ?? false) : loading;
  const finalError = hasOverride ? (errorOverride ?? null) : error;
  const finalInsight = hasOverride ? insightOverride : insightSummary;

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6 md:mt-0">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        {/* ===== CORREÇÃO: Título do gráfico atualizado ===== */}
        <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-2 sm:mb-0">
            Evolução de Alcance e Interações (Plataforma)
        </h2>
        <div>
            <label htmlFor="granularityReachEngPlatform" className="sr-only">Granularidade:</label>
            <select
                id="granularityReachEngPlatform"
                value={granularityValue}
                onChange={handleGranularityChange}
                disabled={finalLoading}
                className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
                {GRANULARITY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        </div>
      </div>

      <div style={{ width: '100%', height: 300 }}>
        {finalLoading && <div className="flex justify-center items-center h-full"><p className="text-gray-500">Carregando dados...</p></div>}
        {finalError && <div className="flex justify-center items-center h-full"><p className="text-red-500">Erro: {finalError}</p></div>}
        {!finalLoading && !finalError && finalData.length > 0 && (
          <ResponsiveContainer>
            <LineChart data={finalData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="reachStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8884d8" stopOpacity={1} />
                  <stop offset="100%" stopColor="#8884d8" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="interactionsStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#82ca9d" stopOpacity={1} />
                  <stop offset="100%" stopColor="#82ca9d" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                stroke="#666"
                tick={{ fontSize: 12 }}
                tickFormatter={(t) => xAxisTickFormatter(t)}
              />
              <YAxis
                stroke="#666"
                tick={{ fontSize: 12 }}
                tickFormatter={yAxisFormatter}
                yAxisId="left"
              />
              <Tooltip
                formatter={tooltipFormatter}
                labelFormatter={(label) => (
                  granularityValue === 'weekly'
                    ? formatWeekStartLabel(String(label))
                    : formatDateLabel(String(label))
                )}
                labelStyle={{ color: '#333' }}
              />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="reach"
                name="Alcance"
                stroke="url(#reachStroke)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
              {/* ===== CORREÇÃO: dataKey e name atualizados para "Interações" ===== */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="totalInteractions"
                name="Interações"
                stroke="url(#interactionsStroke)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        {!finalLoading && !finalError && finalData.length === 0 && (
          <div className="flex justify-center items-center h-full"><p className="text-gray-500">Sem dados no período selecionado.</p></div>
        )}
      </div>
      {finalInsight && !finalLoading && !finalError && (
        <p className="text-xs md:text-sm text-gray-600 mt-4 pt-2 border-t border-gray-200 flex items-start">
          <LightBulbIcon className="w-4 h-4 text-yellow-500 mr-1 flex-shrink-0" />
          {finalInsight}
        </p>
      )}
    </div>
  );
};

export default memo(PlatformReachEngagementTrendChart);
