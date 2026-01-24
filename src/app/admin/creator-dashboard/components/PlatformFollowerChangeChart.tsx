"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useGlobalTimePeriod } from './filters/GlobalTimePeriodContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TooltipProps } from 'recharts';
import { formatNullableNumberTooltip, formatAxisNumberCompact, formatDateLabel } from '@/utils/chartFormatters';

interface ApiChangePoint {
  date: string;
  change: number | null;
}

interface PlatformFollowerChangeResponse {
  chartData: ApiChangePoint[];
  insightSummary?: string;
}

interface PlatformFollowerChangeChartProps {
  apiPrefix?: string;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
  dataOverride?: PlatformFollowerChangeResponse['chartData'] | null;
  insightOverride?: string;
  loadingOverride?: boolean;
  errorOverride?: string | null;
  disableFetch?: boolean;
}

const PlatformFollowerChangeChart: React.FC<PlatformFollowerChangeChartProps> = ({
  apiPrefix = '/api/admin',
  onlyActiveSubscribers = false,
  contextFilter,
  creatorContextFilter,
  dataOverride,
  insightOverride,
  loadingOverride,
  errorOverride,
  disableFetch = false,
}) => {
  const { timePeriod } = useGlobalTimePeriod();
  const [data, setData] = useState<PlatformFollowerChangeResponse['chartData']>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const hasOverride = Boolean(disableFetch)
    || typeof dataOverride !== 'undefined'
    || typeof loadingOverride !== 'undefined'
    || typeof errorOverride !== 'undefined'
    || typeof insightOverride !== 'undefined';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ timePeriod });
      if (onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');
      if (contextFilter) params.append('context', contextFilter);
      if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);
      const apiUrl = `${apiPrefix}/dashboard/trends/follower-change?${params.toString()}`;
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
  }, [timePeriod, apiPrefix, onlyActiveSubscribers, contextFilter, creatorContextFilter]);

  useEffect(() => {
    if (!hasOverride) {
      fetchData();
    }
  }, [fetchData, hasOverride]);

  const tooltipFormatter: TooltipProps<number, string>["formatter"] = (
    value,
    name
  ) => formatNullableNumberTooltip(value as number | null, name);

  const finalData = hasOverride ? (dataOverride ?? []) : data;
  const finalLoading = hasOverride ? (loadingOverride ?? false) : loading;
  const finalError = hasOverride ? (errorOverride ?? null) : error;
  const finalInsight = hasOverride ? insightOverride : insightSummary;

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-2 sm:mb-0">
          Variação Diária de Seguidores da Plataforma
        </h2>
      </div>
      <div style={{ width: '100%', height: 300 }}>
        {finalLoading && <div className="flex justify-center items-center h-full"><p className="text-gray-500">Carregando dados...</p></div>}
        {finalError && <div className="flex justify-center items-center h-full"><p className="text-red-500">Erro: {finalError}</p></div>}
        {!finalLoading && !finalError && finalData.length > 0 && (
          <ResponsiveContainer>
            <BarChart data={finalData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 12 }} tickFormatter={formatDateLabel} />
              <YAxis stroke="#666" tick={{ fontSize: 12 }} tickFormatter={formatAxisNumberCompact} />
              <Tooltip<number, string> formatter={tooltipFormatter} labelFormatter={formatDateLabel} labelStyle={{ color: '#333' }} itemStyle={{ color: '#8884d8' }} />
              <Bar dataKey="change" name="Variação" fill="#8884d8" radius={[4, 4, 0, 0]} />
            </BarChart>
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

export default memo(PlatformFollowerChangeChart);
