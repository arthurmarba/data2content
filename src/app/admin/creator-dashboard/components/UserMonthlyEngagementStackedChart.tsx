"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface MonthlyEngagementDataPoint {
  month: string;
  likes: number;
  comments: number;
  shares: number;
  saved?: number; // Opcional, dependendo da API
  total: number;
}

interface MonthlyEngagementResponse {
  chartData: MonthlyEngagementDataPoint[];
  insightSummary?: string;
}

const TIME_PERIOD_OPTIONS = [
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_12_months", label: "Últimos 12 meses" },
];

interface UserMonthlyEngagementStackedChartProps {
  userId: string | null;
  initialTimePeriod?: string;
  chartTitle?: string;
}

const UserMonthlyEngagementStackedChart: React.FC<UserMonthlyEngagementStackedChartProps> = ({
  userId,
  initialTimePeriod = TIME_PERIOD_OPTIONS[1].value, // Default last_6_months
  chartTitle = "Engajamento Mensal Detalhado do Criador"
}) => {
  const [data, setData] = useState<MonthlyEngagementResponse['chartData']>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<string>(initialTimePeriod);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/users/${userId}/charts/monthly-engagement-stacked?timePeriod=${timePeriod}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: MonthlyEngagementResponse = await response.json();
      setData(result.chartData);
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
      setData([]);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [userId, timePeriod]);

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

  const tooltipFormatter = (value: number, name: string, props: any) => {
    return [value.toLocaleString(), name];
  };

  const hasSavedData = data.some(d => d.saved !== undefined && d.saved !== null && d.saved > 0);


  if (!userId) {
    return (
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
        <h3 className="text-md font-semibold text-gray-700 mb-3">{chartTitle}</h3>
        <div className="flex justify-center items-center h-[350px]">
          <p className="text-gray-500">Selecione um criador para ver os dados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-md font-semibold text-gray-700">{chartTitle}</h3>
        <div>
          <label htmlFor={`timePeriodUserStackedEng-${userId}`} className="sr-only">Período</label>
          <select
            id={`timePeriodUserStackedEng-${userId}`}
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            className="p-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs"
          >
            {TIME_PERIOD_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ width: '100%', height: 350 }}>
        {loading && <div className="flex justify-center items-center h-full"><p className="text-gray-500">Carregando dados...</p></div>}
        {error && <div className="flex justify-center items-center h-full"><p className="text-red-500">Erro: {error}</p></div>}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}> {/* Ajuste de margem esquerda */}
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="month" stroke="#666" tick={{ fontSize: 12 }} />
              <YAxis stroke="#666" tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
              <Tooltip formatter={tooltipFormatter} labelStyle={{ color: '#333' }} wrapperStyle={{ zIndex: 1000 }} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Bar dataKey="likes" stackId="engagement" fill="#8884d8" name="Curtidas" />
              <Bar dataKey="comments" stackId="engagement" fill="#82ca9d" name="Comentários" />
              <Bar dataKey="shares" stackId="engagement" fill="#ffc658" name="Compart." />
              {hasSavedData && <Bar dataKey="saved" stackId="engagement" fill="#ff8042" name="Salvos" />}
            </BarChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="flex justify-center items-center h-full"><p className="text-gray-500">Nenhum dado de engajamento disponível para o período.</p></div>
        )}
      </div>
      {insightSummary && !loading && !error && (
        <p className="text-xs md:text-sm text-gray-600 mt-3 pt-2 border-t border-gray-100">{insightSummary}</p>
      )}
    </div>
  );
};

export default UserMonthlyEngagementStackedChart;
```
