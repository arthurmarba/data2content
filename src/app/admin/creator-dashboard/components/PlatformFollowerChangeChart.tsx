"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ApiChangePoint {
  date: string;
  change: number | null;
}

interface PlatformFollowerChangeResponse {
  chartData: ApiChangePoint[];
  insightSummary?: string;
}

interface PlatformFollowerChangeChartProps {
  timePeriod: string;
}

const PlatformFollowerChangeChart: React.FC<PlatformFollowerChangeChartProps> = ({
  timePeriod
}) => {
  const [data, setData] = useState<PlatformFollowerChangeResponse['chartData']>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/platform/trends/follower-change?timePeriod=${timePeriod}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: PlatformFollowerChangeResponse = await response.json();
      setData(result.chartData);
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido ao buscar dados.');
      setData([]);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [timePeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tooltipFormatter = (value: number | null) => (value !== null ? value.toLocaleString() : 'N/A');

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-2 sm:mb-0">
          Variação Diária de Seguidores da Plataforma
        </h2>
      </div>
      <div style={{ width: '100%', height: 300 }}>
        {loading && <div className="flex justify-center items-center h-full"><p className="text-gray-500">Carregando dados...</p></div>}
        {error && <div className="flex justify-center items-center h-full"><p className="text-red-500">Erro: {error}</p></div>}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 12 }} />
              <YAxis stroke="#666" tick={{ fontSize: 12 }} />
              <Tooltip formatter={tooltipFormatter} labelStyle={{ color: '#333' }} itemStyle={{ color: '#8884d8' }} />
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

export default memo(PlatformFollowerChangeChart);
