"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface ApiMovingAverageDataPoint {
  date: string; // YYYY-MM-DD
  movingAverageEngagement: number | null;
}

interface UserMovingAverageResponse { // Nome da interface pode ser genérico
  series: ApiMovingAverageDataPoint[];
  // dataStartDate?: string; // A API retorna, mas não usamos diretamente no gráfico
  // dataEndDate?: string;
  insightSummary?: string;
}

const DATA_WINDOW_OPTIONS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

const MOVING_AVERAGE_WINDOW_OPTIONS = [
  { value: "7", label: "7 dias (Média Semanal)" },
  { value: "14", label: "14 dias" },
  { value: "30", label: "30 dias (Média Mensal)" },
];

interface UserMovingAverageEngagementChartProps {
  userId: string | null;
  chartTitle?: string;
}

const UserMovingAverageEngagementChart: React.FC<UserMovingAverageEngagementChartProps> = ({
  userId,
  chartTitle = "Média Móvel de Engajamento Diário"
}) => {
  const [data, setData] = useState<UserMovingAverageResponse['series']>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [dataWindow, setDataWindow] = useState<string>(DATA_WINDOW_OPTIONS[0].value);
  const [avgWindow, setAvgWindow] = useState<string>(MOVING_AVERAGE_WINDOW_OPTIONS[0].value);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (parseInt(avgWindow, 10) > parseInt(dataWindow, 10)) {
      setError("A janela da média móvel não pode ser maior que a janela de dados.");
      setLoading(false);
      setData([]);
      setInsightSummary(undefined);
      return;
    }

    try {
      const apiUrl = `/api/v1/users/${userId}/trends/moving-average-engagement?dataWindowInDays=${dataWindow}&movingAverageWindowInDays=${avgWindow}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: UserMovingAverageResponse = await response.json();
      setData(result.series);
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido ao buscar dados.');
      setData([]);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [userId, dataWindow, avgWindow]);

  useEffect(() => {
    if (userId) {
      fetchData();
    } else {
      setData([]);
      setLoading(false);
    }
  }, [userId, fetchData]);

  const yAxisFormatter = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  const tooltipFormatter = (value: number, name: string) => {
      return [value !== null ? value.toLocaleString() : 'N/A', name];
  };

  if (!userId) {
    return (
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
        <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{chartTitle}</h2>
        <div className="flex justify-center items-center h-[300px]">
          <p className="text-gray-500">Selecione um criador para ver a média móvel de engajamento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{chartTitle}</h2>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div>
          <label htmlFor={`dataWindowUserMovingAvg-${userId}`} className="block text-sm font-medium text-gray-600 mb-1">Janela de Dados:</label>
          <select
            id={`dataWindowUserMovingAvg-${userId}`}
            value={dataWindow}
            onChange={(e) => setDataWindow(e.target.value)}
            className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {DATA_WINDOW_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`avgWindowUserMovingAvg-${userId}`} className="block text-sm font-medium text-gray-600 mb-1">Janela da Média Móvel:</label>
          <select
            id={`avgWindowUserMovingAvg-${userId}`}
            value={avgWindow}
            onChange={(e) => setAvgWindow(e.target.value)}
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
            <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 12 }} />
              <YAxis stroke="#666" tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
              <Tooltip formatter={tooltipFormatter} labelStyle={{ color: '#333' }} itemStyle={{ color: '#82ca9d' }} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Line
                type="monotone"
                dataKey="movingAverageEngagement"
                name={`Média Móvel (${avgWindow}d)`}
                stroke="#82ca9d"
                strokeWidth={2}
                dot={{ r: 2 }}
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
        <p className="text-xs md:text-sm text-gray-600 mt-4 pt-2 border-t border-gray-200">{insightSummary}</p>
      )}
    </div>
  );
};

export default UserMovingAverageEngagementChart;
```
