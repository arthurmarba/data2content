"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useGlobalTimePeriod } from "./filters/GlobalTimePeriodContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { commaSeparatedIdsToLabels } from "../../../lib/classification";

type GroupingType = "format" | "context" | "proposal";

interface ApiUserAverageEngagementDataPoint {
  name: string;
  value: number;
  postsCount: number;
}

interface UserAverageEngagementResponse {
  chartData: ApiUserAverageEngagementDataPoint[];
  groupBy: GroupingType;
  metricUsed: string;
  insightSummary?: string;
}

const TIME_PERIOD_OPTIONS = [
  { value: "all_time", label: "Todo o período" },
  { value: "last_7_days", label: "Últimos 7 dias" },
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "last_90_days", label: "Últimos 90 dias" },
];

const ENGAGEMENT_METRIC_OPTIONS = [
  { value: "stats.total_interactions", label: "Total de Interações" },
  { value: "stats.views", label: "Visualizações" },
  { value: "stats.likes", label: "Curtidas" },
];

const GROUP_BY_OPTIONS = [
  { value: "format", label: "Formato" },
  { value: "context", label: "Contexto" },
  { value: "proposal", label: "Proposta" },
];

interface UserAverageEngagementChartProps {
  userId: string | null;
  chartTitle: string;
  initialGroupBy?: GroupingType;
  initialEngagementMetric?: string;
}

const UserAverageEngagementChart: React.FC<UserAverageEngagementChartProps> = ({
  userId,
  chartTitle,
  initialGroupBy = "format",
  initialEngagementMetric = ENGAGEMENT_METRIC_OPTIONS[0]!.value,
}) => {
  const [data, setData] = useState<ApiUserAverageEngagementDataPoint[]>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { timePeriod: globalTimePeriod } = useGlobalTimePeriod();
  const [timePeriod, setTimePeriod] = useState<string>(globalTimePeriod);
  const [engagementMetric, setEngagementMetric] = useState<string>(
    initialEngagementMetric,
  );
  const [groupBy, setGroupBy] = useState<GroupingType>(initialGroupBy);

  useEffect(() => {
    setTimePeriod(globalTimePeriod);
  }, [globalTimePeriod]);

  useEffect(() => {
    // Se uma métrica inicial diferente for passada como prop e mudar
    setEngagementMetric(initialEngagementMetric);
  }, [initialEngagementMetric]);

  useEffect(() => {
    setGroupBy(initialGroupBy);
  }, [initialGroupBy]);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/users/${userId}/performance/average-engagement?timePeriod=${timePeriod}&engagementMetricField=${engagementMetric}&groupBy=${groupBy}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`,
        );
      }
      const result: UserAverageEngagementResponse = await response.json();
      const mapped = result.chartData.map(d => ({
        ...d,
        name: commaSeparatedIdsToLabels(d.name, groupBy as any) || d.name,
      }));
      setData(mapped);
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ocorreu um erro desconhecido.",
      );
      setData([]);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [userId, timePeriod, engagementMetric, groupBy]);

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

  const tooltipFormatter = (
    value: number,
    name: string,
    props?: { payload?: ApiUserAverageEngagementDataPoint },
  ) => {
    const postsCount = props?.payload?.postsCount ?? 0;
    return [`${value.toLocaleString()} (de ${postsCount} posts)`, name];
  };
  const xAxisTickFormatter = (value: string) => {
    if (value && value.length > 12) {
      return `${value.substring(0, 10)}...`;
    }
    return value;
  };

  if (!userId) {
    return (
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
        <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">
          {chartTitle}
        </h2>
        <div className="flex justify-center items-center h-[350px]">
          <p className="text-gray-500">
            Selecione um criador para ver os dados.
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label
            htmlFor={`timePeriodUserAvgEng-${groupBy}-${userId || "default"}`}
            className="block text-sm font-medium text-gray-600 mb-1"
          >
            Período:
          </label>
          <select
            id={`timePeriodUserAvgEng-${groupBy}-${userId || "default"}`}
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            disabled={loading}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
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
            htmlFor={`metricUserAvgEng-${groupBy}-${userId || "default"}`}
            className="block text-sm font-medium text-gray-600 mb-1"
          >
            Métrica:
          </label>
          <select
            id={`metricUserAvgEng-${groupBy}-${userId || "default"}`}
            value={engagementMetric}
            onChange={(e) => setEngagementMetric(e.target.value)}
            disabled={loading}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {ENGAGEMENT_METRIC_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`groupByUserAvgEng-${userId || "default"}`}
            className="block text-sm font-medium text-gray-600 mb-1"
          >
            Agrupar por:
          </label>
          <select
            id={`groupByUserAvgEng-${userId || "default"}`}
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupingType)}
            disabled={loading}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {GROUP_BY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ width: "100%", height: 350 }}>
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
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                type="number"
                stroke="#666"
                tick={{ fontSize: 12 }}
                tickFormatter={yAxisFormatter}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#666"
                tick={{ fontSize: 12 }}
                width={120}
                interval={0}
                tickFormatter={xAxisTickFormatter}
              />
              <Tooltip
                formatter={tooltipFormatter}
                labelStyle={{ color: "#333" }}
                wrapperStyle={{ zIndex: 1000 }}
              />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Bar
                dataKey="value"
                name={`Média de ${ENGAGEMENT_METRIC_OPTIONS.find((m) => m.value === engagementMetric)?.label || "Engajamento"}`}
                fill="#8884d8"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="flex justify-center items-center h-full">
            <p className="text-gray-500">
              Nenhum dado disponível para os filtros selecionados.
            </p>
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

export default React.memo(UserAverageEngagementChart);
