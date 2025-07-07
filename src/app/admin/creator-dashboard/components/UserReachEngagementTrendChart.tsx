"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useGlobalTimePeriod } from "./filters/GlobalTimePeriodContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ApiReachEngagementDataPoint {
  date: string;
  reach: number | null;
  totalInteractions: number | null;
}

interface UserReachEngagementTrendResponse {
  chartData: ApiReachEngagementDataPoint[];
  insightSummary?: string;
}

const TIME_PERIOD_OPTIONS = [
  { value: "last_7_days", label: "Últimos 7 dias" },
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "last_90_days", label: "Últimos 90 dias" },
];

const GRANULARITY_OPTIONS = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
];

interface UserReachEngagementTrendChartProps {
  userId: string | null;
  chartTitle?: string;
  initialGranularity?: string;
}

const UserReachEngagementTrendChart: React.FC<
  UserReachEngagementTrendChartProps
> = ({
  userId,
  chartTitle = "Evolução de Alcance e Contas Engajadas do Criador",
  initialGranularity,
}) => {
  const [data, setData] = useState<
    UserReachEngagementTrendResponse["chartData"]
  >([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { timePeriod: globalTimePeriod } = useGlobalTimePeriod();
  const [timePeriod, setTimePeriod] = useState<string>(
    globalTimePeriod ||
      TIME_PERIOD_OPTIONS[1]?.value ||
      TIME_PERIOD_OPTIONS[0]?.value ||
      "last_30_days",
  );
  const [granularity, setGranularity] = useState<string>(
    initialGranularity || GRANULARITY_OPTIONS[0]?.value || "daily",
  );

  useEffect(() => {
    setTimePeriod(globalTimePeriod);
  }, [globalTimePeriod]);

  useEffect(() => {
    if (initialGranularity) {
      setGranularity(initialGranularity);
    }
  }, [initialGranularity]);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/users/${userId}/trends/reach-engagement?timePeriod=${timePeriod}&granularity=${granularity}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`,
        );
      }
      const result: UserReachEngagementTrendResponse = await response.json();
      setData(result.chartData);
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocorreu um erro desconhecido ao buscar dados.",
      );
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
    return [value !== null ? value.toLocaleString() : "N/A", name];
  };

  const xAxisTickFormatter = (tick: string) => {
    if (granularity === "weekly" && tick.includes("-")) {
      return `S${tick.split("-")[1]}`;
    }
    // Para diário, poderia formatar YYYY-MM-DD para DD/MM
    // const d = new Date(tick + "T00:00:00Z"); // Assume tick é YYYY-MM-DD
    // return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}`;
    return tick;
  };

  if (!userId) {
    return (
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
        <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">
          {chartTitle}
        </h2>
        <div className="flex justify-center items-center h-[300px]">
          <p className="text-gray-500">
            Selecione um criador para ver os dados de alcance e engajamento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">
        {chartTitle}
      </h2>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div>
          <label
            htmlFor={`timePeriodUserReachEng-${userId || "default"}`}
            className="block text-sm font-medium text-gray-600 mb-1"
          >
            Período:
          </label>
          <select
            id={`timePeriodUserReachEng-${userId || "default"}`}
            value={timePeriod}
            onChange={handleTimePeriodChange}
            disabled={loading}
            className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {TIME_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`granularityUserReachEng-${userId || "default"}`}
            className="block text-sm font-medium text-gray-600 mb-1"
          >
            Granularidade:
          </label>
          <select
            id={`granularityUserReachEng-${userId || "default"}`}
            value={granularity}
            onChange={handleGranularityChange}
            disabled={loading}
            className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {GRANULARITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ width: "100%", height: 300 }}>
        {loading && (
          <div className="flex justify-center items-center h-full">
            <p className="text-gray-500">Carregando dados...</p>
          </div>
        )}
        {error && (
          <div className="flex justify-center items-center h-full">
            <p className="text-red-500">Erro: {error}</p>
          </div>
        )}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer>
            <LineChart
              data={data}
              margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
            >
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
              <Tooltip
                formatter={tooltipFormatter}
                labelStyle={{ color: "#333" }}
              />
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
                connectNulls={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="totalInteractions"
                name="Interações"
                stroke="#82ca9d"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="flex justify-center items-center h-full">
            <p className="text-gray-500">Sem dados no período selecionado.</p>
          </div>
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

export default React.memo(UserReachEngagementTrendChart);
