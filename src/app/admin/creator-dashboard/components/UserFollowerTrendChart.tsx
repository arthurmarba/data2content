"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Tipos para os dados da API
interface ApiChartDataPoint {
  date: string;
  value: number | null;
}

interface UserFollowerTrendResponse {
  chartData: ApiChartDataPoint[];
  insightSummary?: string;
}

// Lista de opções para os seletores
const TIME_PERIOD_OPTIONS = [
  { value: "last_7_days", label: "Últimos 7 dias" },
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "last_90_days", label: "Últimos 90 dias" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_12_months", label: "Últimos 12 meses" },
  { value: "all_time", label: "Todo o período" },
];

const GRANULARITY_OPTIONS = [
  { value: "daily", label: "Diário" },
  { value: "monthly", label: "Mensal" },
];

interface UserFollowerTrendChartProps {
  userId: string | null;
  chartTitle?: string;
}

const UserFollowerTrendChart: React.FC<UserFollowerTrendChartProps> = ({
  userId,
  chartTitle = "Evolução de Seguidores do Criador"
}) => {
  const [data, setData] = useState<UserFollowerTrendResponse['chartData']>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Corrigido: Adicionado optional chaining e fallback para segurança
  const [timePeriod, setTimePeriod] = useState<string>(TIME_PERIOD_OPTIONS?.[1]?.value || 'last_30_days');
  const [granularity, setGranularity] = useState<string>(GRANULARITY_OPTIONS?.[0]?.value || 'daily');

  const fetchData = useCallback(async () => {
    if (!userId) {
      setData([]);
      setLoading(false);
      setError("User ID não fornecido.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/users/${userId}/trends/followers?timePeriod=${timePeriod}&granularity=${granularity}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: UserFollowerTrendResponse = await response.json();
      setData(result.chartData);
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido ao buscar dados.');
      setData([]);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [userId, timePeriod, granularity]);

  useEffect(() => {
    if (userId) {
      fetchData();
    } else {
      setData([]);
      setLoading(false);
    }
  }, [userId, fetchData]);

  const handleTimePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimePeriod(e.target.value);
  };

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

  if (!userId) {
    return (
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
        <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{chartTitle}</h2>
        <div className="flex justify-center items-center h-[300px]">
          <p className="text-gray-500">Selecione um criador para ver a evolução de seguidores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{chartTitle}</h2>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div>
          <label htmlFor={`timePeriodUserFollowers-${userId}`} className="block text-sm font-medium text-gray-600 mb-1">Período:</label>
          <select
            id={`timePeriodUserFollowers-${userId}`}
            value={timePeriod}
            onChange={handleTimePeriodChange}
            className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {TIME_PERIOD_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`granularityUserFollowers-${userId}`} className="block text-sm font-medium text-gray-600 mb-1">Granularidade:</label>
          <select
            id={`granularityUserFollowers-${userId}`}
            value={granularity}
            onChange={handleGranularityChange}
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
              <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 12 }} />
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
                connectNulls={true}
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

export default UserFollowerTrendChart;
