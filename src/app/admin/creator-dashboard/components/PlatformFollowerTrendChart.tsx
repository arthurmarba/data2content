"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface ApiChartDataPoint {
  date: string;
  value: number | null;
}

interface PlatformFollowerTrendResponse {
  chartData: ApiChartDataPoint[];
  insightSummary?: string;
}

// TIME_PERIOD_OPTIONS não é mais necessário aqui, pois será controlado pelo pai.
// const TIME_PERIOD_OPTIONS = [ ... ];

const GRANULARITY_OPTIONS = [
  { value: "daily", label: "Diário" },
  { value: "monthly", label: "Mensal" },
];

interface PlatformFollowerTrendChartProps {
  timePeriod: string; // Recebido do pai (page.tsx)
  initialGranularity?: string;
}

const PlatformFollowerTrendChart: React.FC<PlatformFollowerTrendChartProps> = ({
  timePeriod, // Prop vinda da página principal
  initialGranularity = GRANULARITY_OPTIONS[0].value
}) => {
  const [data, setData] = useState<PlatformFollowerTrendResponse['chartData']>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // timePeriod não é mais um estado local
  const [granularity, setGranularity] = useState<string>(initialGranularity);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Usa timePeriod da prop e granularity do estado local
      const apiUrl = `/api/v1/platform/trends/followers?timePeriod=${timePeriod}&granularity=${granularity}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: PlatformFollowerTrendResponse = await response.json();
      setData(result.chartData);
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido ao buscar dados.');
      setData([]);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [timePeriod, granularity]); // Adicionado timePeriod às dependências

  useEffect(() => {
    fetchData();
  }, [fetchData]); // fetchData já inclui timePeriod e granularity

  // handleTimePeriodChange não é mais necessário aqui

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

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-2 sm:mb-0">
          Evolução de Seguidores da Plataforma
        </h2>
        {/* Seletor de timePeriod removido */}
        <div>
          <label htmlFor="granularityFollowersPlatform" className="block text-sm font-medium text-gray-600 mb-1 sr-only">Granularidade:</label>
          <select
            id="granularityFollowersPlatform"
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
              />
              <YAxis stroke="#666" tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
              <Tooltip formatter={tooltipFormatter} labelStyle={{ color: '#333' }} itemStyle={{ color: '#8884d8' }} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Line
                type="monotone"
                dataKey="value"
                name="Seguidores"
                stroke="#8884d8"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="flex justify-center items-center h-full"><p className="text-gray-500">Nenhum dado disponível para o período selecionado.</p></div>
        )}
      </div>
      {insightSummary && !loading && !error && (
        <p className="text-xs md:text-sm text-gray-600 mt-4 pt-2 border-t border-gray-200">{insightSummary}</p>
      )}
    </div>
  );
};

export default memo(PlatformFollowerTrendChart);
```
