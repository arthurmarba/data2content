"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useGlobalTimePeriod } from './filters/GlobalTimePeriodContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

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
}

const PlatformReachEngagementTrendChart: React.FC<PlatformReachEngagementTrendChartProps> = ({
  initialGranularity = GRANULARITY_OPTIONS[0]!.value,
  apiPrefix = '/api/admin'
}) => {
  const { timePeriod } = useGlobalTimePeriod();
  const [data, setData] = useState<PlatformChartResponse['chartData']>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<string>(initialGranularity);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `${apiPrefix}/dashboard/trends/reach-engagement?timePeriod=${timePeriod}&granularity=${granularity}`;
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
  }, [timePeriod, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGranularityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGranularity(e.target.value);
  };

  const yAxisFormatter = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  const tooltipFormatter = (value: number, name: string) => {
      return [value !== null ? value.toLocaleString() : 'N/A', name];
  };

  const xAxisTickFormatter = (tick: string) => {
    if (granularity === 'weekly' && tick.includes('-')) {
        return `S${tick.split('-')[1]}`;
    }
    return tick;
  };

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
                value={granularity}
                onChange={handleGranularityChange}
                disabled={loading}
                className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
                {GRANULARITY_OPTIONS.map(option => (
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
            <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                stroke="#666"
                tick={{ fontSize: 12 }}
                tickFormatter={xAxisTickFormatter}
              />
              <YAxis
                stroke="#666"
                tick={{ fontSize: 12 }}
                tickFormatter={yAxisFormatter}
                yAxisId="left"
              />
              <Tooltip formatter={tooltipFormatter} labelStyle={{ color: '#333' }} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="reach"
                name="Alcance"
                stroke="#8884d8"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
              />
              {/* ===== CORREÇÃO: dataKey e name atualizados para "Interações" ===== */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="totalInteractions"
                name="Interações"
                stroke="#82ca9d"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="flex justify-center items-center h-full"><p className="text-gray-500">Sem dados no período selecionado.</p></div>
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

export default memo(PlatformReachEngagementTrendChart);
