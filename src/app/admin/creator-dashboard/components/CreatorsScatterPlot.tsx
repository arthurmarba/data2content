"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface ScatterPlotDataPoint {
  id: string;
  label: string;
  x: number | null;
  y: number | null;
}

interface ScatterPlotResponse {
  plotData: ScatterPlotDataPoint[];
  xAxisMetricLabel?: string;
  yAxisMetricLabel?: string;
  insightSummary?: string;
}

// Metric options available for the axes
const METRIC_OPTIONS = [
  {
    value: "followers",
    label: "Seguidores Totais",
    config: {
      id: "totalFollowers",
      label: "Seguidores Totais",
      calculationLogic: "getFollowersCount_current",
      params: [{ periodInDays: 0 }],
    },
  },
  {
    value: "avg_engagement_per_post",
    label: "Engajamento Médio/Post",
    config: {
      id: "avgEngagementPerPost",
      label: "Engajamento Médio/Post",
      calculationLogic: "getAverageEngagementPerPost_avgPerPost",
      params: [{ periodInDays: 30 }],
    },
  },
];

const CreatorsScatterPlot: React.FC = () => {
  const [xMetric, setXMetric] = useState<string>(METRIC_OPTIONS[0].value);
  const [yMetric, setYMetric] = useState<string>(METRIC_OPTIONS[1].value);

  const [data, setData] = useState<ScatterPlotDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch a small list of top creators to determine which IDs to compare
      const rankingResp = await fetch(
        "/api/admin/dashboard/rankings/top-creators?metric=total_interactions&days=30&limit=10"
      );
      if (!rankingResp.ok) {
        const err = await rankingResp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao buscar criadores");
      }
      const rankingData = await rankingResp.json();
      const userIds = (rankingData || []).map((c: any) => c.creatorId);

      const xCfg = METRIC_OPTIONS.find((m) => m.value === xMetric)?.config;
      const yCfg = METRIC_OPTIONS.find((m) => m.value === yMetric)?.config;

      const resp = await fetch("/api/v1/creators/scatter-plot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds,
          xAxisMetricConfig: xCfg,
          yAxisMetricConfig: yCfg,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao buscar gráfico");
      }

      const json: ScatterPlotResponse = await resp.json();
      setData(json.plotData);
      setInsight(json.insightSummary);
    } catch (e: any) {
      setError(e.message);
      setData([]);
      setInsight(undefined);
    } finally {
      setLoading(false);
    }
  }, [xMetric, yMetric]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const xLabel = METRIC_OPTIONS.find((m) => m.value === xMetric)?.label || "X";
  const yLabel = METRIC_OPTIONS.find((m) => m.value === yMetric)?.label || "Y";

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-4">
        <div>
          <label htmlFor="scatter-x" className="block text-xs font-medium text-gray-600 mb-1">
            Métrica (Eixo X)
          </label>
          <select
            id="scatter-x"
            value={xMetric}
            onChange={(e) => setXMetric(e.target.value)}
            className="p-2 border border-gray-300 rounded-md text-sm"
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="scatter-y" className="block text-xs font-medium text-gray-600 mb-1">
            Métrica (Eixo Y)
          </label>
          <select
            id="scatter-y"
            value={yMetric}
            onChange={(e) => setYMetric(e.target.value)}
            className="p-2 border border-gray-300 rounded-md text-sm"
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchData}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm self-end"
        >
          Atualizar
        </button>
      </div>
      <div style={{ width: "100%", height: 300 }}>
        {loading && (
          <div className="flex justify-center items-center h-full text-gray-500">Carregando...</div>
        )}
        {error && (
          <div className="flex justify-center items-center h-full text-red-500">Erro: {error}</div>
        )}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                name={xLabel}
                tick={{ fontSize: 12 }}
                label={{ value: xLabel, position: "insideBottom", offset: -10 }}
              />
              <YAxis
                dataKey="y"
                name={yLabel}
                tick={{ fontSize: 12 }}
                label={{ value: yLabel, angle: -90, position: "insideLeft" }}
              />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v: number) => v.toLocaleString("pt-BR")}/>
              <Scatter data={data} fill="#8884d8" />
            </ScatterChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="flex justify-center items-center h-full text-gray-500">Nenhum dado disponível.</div>
        )}
      </div>
      {insight && !loading && !error && (
        <p className="text-xs md:text-sm text-gray-600 mt-4">{insight}</p>
      )}
    </div>
  );
};

export default CreatorsScatterPlot;

