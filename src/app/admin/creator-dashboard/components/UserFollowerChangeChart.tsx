"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import type { TooltipProps } from "recharts";

interface ApiChangePoint {
  date: string;
  change: number | null;
}

interface ApiTotalPoint {
  date: string;
  value: number | null;
}

interface UserFollowerChangeResponse {
  chartData: ApiChangePoint[];
  insightSummary?: string;
}

const TIME_PERIOD_OPTIONS = [
  { value: "last_7_days", label: "Últimos 7 dias" },
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "last_90_days", label: "Últimos 90 dias" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_12_months", label: "Últimos 12 meses" },
  { value: "all_time", label: "Todo o período" },
];

interface UserFollowerChangeChartProps {
  userId: string | null;
  chartTitle?: string;
}

const UserFollowerChangeChart: React.FC<UserFollowerChangeChartProps> = ({
  userId,
  chartTitle = "Evolução de seguidores (total, ganhos e perdas)",
}) => {
  const [data, setData] = useState<UserFollowerChangeResponse["chartData"]>([]);
  const [totalData, setTotalData] = useState<ApiTotalPoint[]>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { timePeriod: globalTimePeriod } = useGlobalTimePeriod();
  const [timePeriod, setTimePeriod] = useState<string>(
    globalTimePeriod || TIME_PERIOD_OPTIONS[1]?.value || "last_30_days",
  );
  const timePeriodLabel = TIME_PERIOD_OPTIONS.find((o) => o.value === timePeriod)?.label;

  useEffect(() => {
    setTimePeriod(globalTimePeriod);
  }, [globalTimePeriod]);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setData([]);
      setTotalData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const changeUrl = `/api/v1/users/${userId}/trends/follower-change?timePeriod=${timePeriod}`;
      const totalUrl = `/api/v1/users/${userId}/trends/followers?timePeriod=${timePeriod}&granularity=daily`;
      const [changeResponse, totalResponse] = await Promise.all([
        fetch(changeUrl),
        fetch(totalUrl),
      ]);
      if (!changeResponse.ok) {
        const errorData = await changeResponse.json().catch(() => ({}));
        throw new Error(
          `Erro HTTP: ${changeResponse.status} - ${errorData.error || changeResponse.statusText}`,
        );
      }
      if (!totalResponse.ok) {
        const errorData = await totalResponse.json().catch(() => ({}));
        throw new Error(
          `Erro HTTP: ${totalResponse.status} - ${errorData.error || totalResponse.statusText}`,
        );
      }
      const changeResult: UserFollowerChangeResponse = await changeResponse.json();
      const totalResult: { chartData: ApiTotalPoint[]; insightSummary?: string } = await totalResponse.json();
      setData(changeResult.chartData);
      setTotalData(totalResult.chartData || []);
      setInsightSummary(changeResult.insightSummary || totalResult.insightSummary);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocorreu um erro desconhecido ao buscar dados.",
      );
      setData([]);
      setTotalData([]);
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

  const getWeekKey = (d: string | Date) => {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return null;
    const oneJan = new Date(date.getFullYear(), 0, 1);
    const week = Math.ceil((((date.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
  };

  const formatWeekLabel = (value?: string | null) => {
    if (!value) return "";
    const match = value.match(/(\d{4})-W?(\d{1,2})/i);
    if (!match || !match[1] || !match[2]) return value;
    const year = match[1];
    const week = match[2];
    return `Sem ${String(week).padStart(2, "0")}/${year.slice(-2)}`;
  };

  const series = useMemo(() => {
    const totalByWeek = new Map<string, number>();
    const sortedTotals = [...totalData].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    sortedTotals.forEach((point) => {
      if (typeof point.value !== "number") return;
      const key = getWeekKey(point.date);
      if (!key) return;
      totalByWeek.set(key, point.value);
    });

    const agg = new Map<string, { total: number; gains: number; losses: number }>();
    data.forEach((point) => {
      if (typeof point.change !== "number") return;
      const key = getWeekKey(point.date);
      if (!key) return;
      const bucket = agg.get(key) || { total: 0, gains: 0, losses: 0 };
      const delta = point.change;
      bucket.total += delta;
      bucket.gains += Math.max(delta, 0);
      bucket.losses += Math.abs(Math.min(delta, 0));
      agg.set(key, bucket);
    });
    const keys = new Set<string>([...agg.keys(), ...totalByWeek.keys()]);
    const sortedKeys = Array.from(keys).sort((a, b) => (a > b ? 1 : -1));
    let lastTotal: number | null = null;
    return sortedKeys.map((date) => {
      const values = agg.get(date) || { total: 0, gains: 0, losses: 0 };
      const total = totalByWeek.get(date);
      if (typeof total === "number") {
        lastTotal = total;
      }
      return {
        date,
        total: lastTotal,
        gains: values.gains,
        losses: values.losses,
      };
    });
  }, [data, totalData]);

  const labelMap: Record<string, string> = {
    total: "Total de seguidores",
    gains: "Ganho de seguidores",
    losses: "Perda de seguidores",
  };

  const tooltipFormatter: TooltipProps<number, string>["formatter"] = (
    value,
    name,
  ) => {
    const numeric = typeof value === "number" ? value : null;
    const label = labelMap[name] ?? name;
    return [numeric !== null ? Math.round(numeric).toLocaleString() : "N/A", label];
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">
        {chartTitle}
        {timePeriodLabel && (
          <span className="ml-2 text-xs font-normal text-gray-500">({timePeriodLabel})</span>
        )}
      </h2>
      {userId && (
        <div className="mb-4">
          <label
            htmlFor={`timePeriodUserFollowerChange-${userId}`}
            className="block text-sm font-medium text-gray-600 mb-1"
          >
            Período:
          </label>
          <select
            id={`timePeriodUserFollowerChange-${userId}`}
            value={timePeriod}
            onChange={handleTimePeriodChange}
            disabled={loading}
            className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {TIME_PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
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
        {!loading && !error && series.length > 0 && (
          <ResponsiveContainer>
            <LineChart
              data={series}
              margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                stroke="#666"
                tick={{ fontSize: 12 }}
                tickFormatter={formatWeekLabel}
              />
              <YAxis
                yAxisId="left"
                stroke="#666"
                tick={{ fontSize: 12 }}
                tickFormatter={(value: number) => Math.round(value).toLocaleString()}
                label={{ value: "Ganhos/Perdas", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#666"
                tick={{ fontSize: 12 }}
                tickFormatter={(value: number) => Math.round(value).toLocaleString()}
                label={{ value: "Total de seguidores", angle: 90, position: "insideRight", fill: "#64748b", fontSize: 11 }}
              />
              <Tooltip<number, string>
                formatter={tooltipFormatter}
                labelFormatter={(label) => formatWeekLabel(String(label))}
                labelStyle={{ color: "#333" }}
                itemStyle={{ color: "#64748b" }}
              />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Line
                type="monotone"
                dataKey="total"
                name="Total de seguidores"
                stroke="#475569"
                strokeWidth={2.5}
                dot={{ r: 2.5 }}
                activeDot={{ r: 4 }}
                yAxisId="right"
              />
              <Line
                type="monotone"
                dataKey="gains"
                name="Ganho de seguidores"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 2.5 }}
                activeDot={{ r: 4 }}
                yAxisId="left"
              />
              <Line
                type="monotone"
                dataKey="losses"
                name="Perda de seguidores"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 2.5 }}
                activeDot={{ r: 4 }}
                yAxisId="left"
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

export default React.memo(UserFollowerChangeChart);
