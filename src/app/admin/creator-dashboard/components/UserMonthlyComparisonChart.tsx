"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useGlobalTimePeriod } from "./filters/GlobalTimePeriodContext";
import { LightBulbIcon } from '@heroicons/react/24/outline';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface ApiChartDataPoint {
  comparisonPair: string;
  periodName: string;
  value: number;
  periodKey: "M-1" | "M0" | "M1";
}

interface MonthlyComparisonResponse {
  chartData: ApiChartDataPoint[];
  metricCompared: string;
  insightSummary?: string;
}

interface GroupedChartData {
  pairLabel: string;
  previousValue: number;
  currentValue: number;
  previousLabel: string;
  currentLabel: string;
}

const METRIC_OPTIONS = [
  { value: "totalPosts", label: "Total de Posts" },
  { value: "stats.total_interactions", label: "Total de Interações" },
];

interface UserMonthlyComparisonChartProps {
  userId: string | null;
  initialMetric?: string;
  chartTitle?: string;
}

const UserMonthlyComparisonChart: React.FC<UserMonthlyComparisonChartProps> = ({
  userId,
  initialMetric = METRIC_OPTIONS[0]!.value,
  chartTitle = "Comparação Mensal",
}) => {
  const [data, setData] = useState<GroupedChartData[]>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<string>(initialMetric);
  const { timePeriod } = useGlobalTimePeriod();

  useEffect(() => {
    setMetric(initialMetric);
  }, [initialMetric]);

  const transformData = (apiData: ApiChartDataPoint[]): GroupedChartData[] => {
    const map = new Map<string, GroupedChartData>();
    for (const point of apiData) {
      const existing = map.get(point.comparisonPair) || {
        pairLabel: point.comparisonPair,
        previousValue: 0,
        currentValue: 0,
        previousLabel: "",
        currentLabel: "",
      };
      if (!existing.previousLabel) {
        existing.previousValue = point.value;
        existing.previousLabel = point.periodName;
      } else {
        existing.currentValue = point.value;
        existing.currentLabel = point.periodName;
      }
      map.set(point.comparisonPair, existing);
    }
    return Array.from(map.values());
  };

  const fetchData = useCallback(async () => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/users/${userId}/charts/monthly-comparison?metric=${encodeURIComponent(metric)}&timePeriod=${timePeriod}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: MonthlyComparisonResponse = await response.json();
      setData(transformData(result.chartData));
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
      setData([]);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [userId, metric, timePeriod]);

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
    if (!props || !props.payload) return [value, name];
    const label = name === 'Período Atual' ? props.payload.currentLabel : props.payload.previousLabel;
    return [value.toLocaleString(), label];
  };

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
          <label htmlFor={`metricMonthlyComp-${userId || 'default'}`} className="sr-only">Métrica</label>
          <select
            id={`metricMonthlyComp-${userId || 'default'}`}
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            disabled={loading}
            className="p-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs"
          >
            {METRIC_OPTIONS.map(option => (
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
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="pairLabel" stroke="#666" tick={{ fontSize: 12 }} />
              <YAxis stroke="#666" tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
              <Tooltip formatter={tooltipFormatter} labelStyle={{ color: '#333' }} wrapperStyle={{ zIndex: 1000 }} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Bar dataKey="previousValue" name="Período Anterior" fill="#8884d8" />
              <Bar dataKey="currentValue" name="Período Atual" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="flex justify-center items-center h-full"><p className="text-gray-500">Nenhum dado disponível.</p></div>
        )}
      </div>
      {insightSummary && !loading && !error && (
        <p className="text-xs md:text-sm text-gray-600 mt-3 pt-2 border-t border-gray-100 flex items-start">
          <LightBulbIcon className="w-4 h-4 text-yellow-500 mr-1 flex-shrink-0" />
          {insightSummary}
        </p>
      )}
    </div>
  );
};

export default React.memo(UserMonthlyComparisonChart);

