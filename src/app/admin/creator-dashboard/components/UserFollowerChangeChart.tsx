"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TooltipProps } from 'recharts';
import { formatNullableNumberTooltip } from '@/utils/chartFormatters';

interface ApiChangePoint {
  date: string;
  change: number | null;
}

interface UserFollowerChangeResponse {
  chartData: ApiChangePoint[];
  insightSummary?: string;
}

const TIME_PERIOD_OPTIONS = [
  { value: 'last_7_days', label: 'Últimos 7 dias' },
  { value: 'last_30_days', label: 'Últimos 30 dias' },
  { value: 'last_90_days', label: 'Últimos 90 dias' },
  { value: 'last_6_months', label: 'Últimos 6 meses' },
  { value: 'last_12_months', label: 'Últimos 12 meses' },
  { value: 'all_time', label: 'Todo o período' },
];

interface UserFollowerChangeChartProps {
  userId: string | null;
  chartTitle?: string;
  initialTimePeriod?: string;
}

const UserFollowerChangeChart: React.FC<UserFollowerChangeChartProps> = ({
  userId,
  chartTitle = 'Variação Diária de Seguidores',
  initialTimePeriod,
}) => {
  const [data, setData] = useState<UserFollowerChangeResponse['chartData']>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<string>(
    initialTimePeriod || TIME_PERIOD_OPTIONS[1]?.value || 'last_30_days'
  );

  useEffect(() => {
    if (initialTimePeriod) setTimePeriod(initialTimePeriod);
  }, [initialTimePeriod]);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/users/${userId}/trends/follower-change?timePeriod=${timePeriod}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: UserFollowerChangeResponse = await response.json();
      setData(result.chartData);
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido ao buscar dados.');
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

  const handleTimePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimePeriod(e.target.value);
  };

  const tooltipFormatter: TooltipProps<number, string>["formatter"] = (
    value,
    name
  ) => formatNullableNumberTooltip(value as number | null, name);

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{chartTitle}</h2>
      {userId && (
        <div className="mb-4">
          <label htmlFor={`timePeriodUserFollowerChange-${userId}`} className="block text-sm font-medium text-gray-600 mb-1">Período:</label>
          <select
            id={`timePeriodUserFollowerChange-${userId}`}
            value={timePeriod}
            onChange={handleTimePeriodChange}
            disabled={loading}
            className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {TIME_PERIOD_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}
      <div style={{ width: '100%', height: 300 }}>
        {loading && <div className="flex justify-center items-center h-full"><p className="text-gray-500">Carregando dados...</p></div>}
        {error && <div className="flex justify-center items-center h-full"><p className="text-red-500">Erro: {error}</p></div>}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 12 }} />
              <YAxis stroke="#666" tick={{ fontSize: 12 }} />
              <Tooltip<number | null, string> formatter={tooltipFormatter} labelStyle={{ color: '#333' }} itemStyle={{ color: '#8884d8' }} />
              <Bar dataKey="change" name="Variação" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="flex justify-center items-center h-full"><p className="text-gray-500">Sem dados no período selecionado.</p></div>
        )}
      </div>
      {insightSummary && !loading && !error && (
        <p className="text-xs md:text-sm text-gray-600 mt-4 pt-2 border-t border-gray-200">{insightSummary}</p>
      )}
    </div>
  );
};

export default React.memo(UserFollowerChangeChart);
