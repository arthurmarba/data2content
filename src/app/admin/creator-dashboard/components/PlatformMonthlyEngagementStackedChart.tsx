"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface MonthlyEngagementDataPoint {
  month: string;
  likes: number;
  comments: number;
  shares: number;
  saved?: number;
  total: number;
}

interface MonthlyEngagementResponse {
  chartData: MonthlyEngagementDataPoint[];
  insightSummary?: string;
}

// TIME_PERIOD_OPTIONS não é mais necessário aqui
// const TIME_PERIOD_OPTIONS = [ ... ];

interface PlatformMonthlyEngagementStackedChartProps {
  timePeriod: string; // Recebido do pai (page.tsx)
  chartTitle?: string;
}

const PlatformMonthlyEngagementStackedChart: React.FC<PlatformMonthlyEngagementStackedChartProps> = ({
  timePeriod, // Prop vinda da página principal
  chartTitle = "Engajamento Mensal Detalhado da Plataforma"
}) => {
  const [data, setData] = useState<MonthlyEngagementResponse['chartData']>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // timePeriod não é mais um estado local

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Usa timePeriod da prop na URL da API
      const apiUrl = `/api/v1/platform/charts/monthly-engagement-stacked?timePeriod=${timePeriod}`;
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
  }, [timePeriod]); // Adicionado timePeriod às dependências

  useEffect(() => {
    fetchData();
  }, [fetchData]); // fetchData já inclui timePeriod

  const yAxisFormatter = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  const tooltipFormatter = (value: number, name: string, props: any) => {
    return [value.toLocaleString(), name];
  };

  const hasSavedData = data.some(d => d.saved !== undefined && d.saved !== null && d.saved > 0);

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6 md:mt-0">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h3 className="text-md font-semibold text-gray-700 mb-2 sm:mb-0">{chartTitle}</h3>
        {/* Seletor de timePeriod removido */}
      </div>

      <div style={{ width: '100%', height: 350 }}>
        {loading && <div className="flex justify-center items-center h-full"><p className="text-gray-500">Carregando dados...</p></div>}
        {error && <div className="flex justify-center items-center h-full"><p className="text-red-500">Erro: {error}</p></div>}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
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
          <div className="flex justify-center items-center h-full"><p className="text-gray-500">Sem dados de engajamento no período selecionado.</p></div>
        )}
      </div>
      {insightSummary && !loading && !error && (
        <p className="text-xs md:text-sm text-gray-600 mt-3 pt-2 border-t border-gray-100">{insightSummary}</p>
      )}
    </div>
  );
};

export default memo(PlatformMonthlyEngagementStackedChart);

