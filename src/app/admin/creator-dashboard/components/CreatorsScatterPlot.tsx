"use client";

import React, { useState, useCallback } from 'react';
import CreatorSelector from './CreatorSelector';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ScatterPlotMetricConfig } from '@/charts/getCreatorsScatterPlotData';

interface ScatterPlotDataPoint {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface ScatterPlotResponse {
  plotData: ScatterPlotDataPoint[];
  xAxisMetricLabel?: string;
  yAxisMetricLabel?: string;
  insightSummary?: string;
}

interface SelectedCreator {
  id: string;
  name: string;
}

interface MetricOption {
  label: string;
  config: ScatterPlotMetricConfig;
  requiresPeriod?: boolean;
}

const METRIC_OPTIONS: MetricOption[] = [
  {
    label: 'Total de Seguidores',
    config: {
      id: 'totalFollowers',
      label: 'Total de Seguidores',
      calculationLogic: 'getFollowersCount_current',
      params: [{ periodInDays: 0 }],
    },
    requiresPeriod: false,
  },
  {
    label: 'Engajamento Médio/Post',
    config: {
      id: 'avgEngagementPerPost',
      label: 'Engajamento Médio/Post',
      calculationLogic: 'getAverageEngagementPerPost_avgPerPost',
      params: [{ periodInDays: 30 }],
    },
    requiresPeriod: true,
  },
];

export default function CreatorsScatterPlot() {
  const [selectedCreators, setSelectedCreators] = useState<SelectedCreator[]>([]);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [xMetricIndex, setXMetricIndex] = useState(0);
  const [yMetricIndex, setYMetricIndex] = useState(1);
  const [xPeriod, setXPeriod] = useState(30);
  const [yPeriod, setYPeriod] = useState(30);
  const [data, setData] = useState<ScatterPlotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addCreator = (c: SelectedCreator) => {
    setSelectedCreators((prev) =>
      prev.find((p) => p.id === c.id) ? prev : [...prev, c]
    );
  };

  const removeCreator = (id: string) => {
    setSelectedCreators((prev) => prev.filter((c) => c.id !== id));
  };

  const buildMetricConfig = (opt: MetricOption, period: number): ScatterPlotMetricConfig => {
    if (opt.requiresPeriod) {
      return { ...opt.config, params: [{ periodInDays: period }] };
    }
    return opt.config;
  };

  const fetchData = useCallback(async () => {
    if (selectedCreators.length === 0) {
      setError('Selecione pelo menos um criador.');
      setData(null);
      return;
    }

    const xConfig = buildMetricConfig(METRIC_OPTIONS[xMetricIndex], xPeriod);
    const yConfig = buildMetricConfig(METRIC_OPTIONS[yMetricIndex], yPeriod);

    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/v1/creators/scatter-plot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedCreators.map((c) => c.id),
          xAxisMetricConfig: xConfig,
          yAxisMetricConfig: yConfig,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || resp.statusText);
      }
      const json: ScatterPlotResponse = await resp.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Erro ao buscar dados');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedCreators, xMetricIndex, yMetricIndex, xPeriod, yPeriod]);

  const formatNumber = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
    return v.toString();
  };

  const tooltipFormatter = (value: number, name: string, { payload }: any) => {
    const label = payload?.label;
    return [formatNumber(value), `${name} - ${label}`];
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">
        Comparativo de Criadores (Scatter)
      </h2>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <button
            onClick={() => setIsSelectorOpen(true)}
            className="p-2 rounded-md text-sm bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
          >
            Adicionar Criadores
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedCreators.map((c) => (
            <span
              key={c.id}
              className="bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-md flex items-center gap-1"
            >
              {c.name}
              <button onClick={() => removeCreator(c.id)} className="ml-1">×</button>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="metric-x" className="block text-sm font-medium text-gray-600 mb-1">
            Métrica X
          </label>
          <select
            id="metric-x"
            value={xMetricIndex}
            onChange={(e) => setXMetricIndex(parseInt(e.target.value, 10))}
            className="w-full p-2 border border-gray-300 rounded-md text-sm"
          >
            {METRIC_OPTIONS.map((opt, idx) => (
              <option key={opt.config.id} value={idx}>
                {opt.label}
              </option>
            ))}
          </select>
          {METRIC_OPTIONS[xMetricIndex].requiresPeriod && (
            <input
              type="number"
              className="mt-2 p-2 border border-gray-300 rounded-md text-sm w-full"
              value={xPeriod}
              onChange={(e) => setXPeriod(parseInt(e.target.value, 10) || 0)}
              placeholder="Período (dias)"
            />
          )}
        </div>
        <div>
          <label htmlFor="metric-y" className="block text-sm font-medium text-gray-600 mb-1">
            Métrica Y
          </label>
          <select
            id="metric-y"
            value={yMetricIndex}
            onChange={(e) => setYMetricIndex(parseInt(e.target.value, 10))}
            className="w-full p-2 border border-gray-300 rounded-md text-sm"
          >
            {METRIC_OPTIONS.map((opt, idx) => (
              <option key={opt.config.id} value={idx}>
                {opt.label}
              </option>
            ))}
          </select>
          {METRIC_OPTIONS[yMetricIndex].requiresPeriod && (
            <input
              type="number"
              className="mt-2 p-2 border border-gray-300 rounded-md text-sm w-full"
              value={yPeriod}
              onChange={(e) => setYPeriod(parseInt(e.target.value, 10) || 0)}
              placeholder="Período (dias)"
            />
          )}
        </div>
      </div>

      <button
        onClick={fetchData}
        className="mb-4 p-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
      >
        Gerar Gráfico
      </button>

      <div style={{ width: '100%', height: 360 }}>
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
        {!loading && !error && data && data.plotData.length > 0 && (
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                type="number"
                dataKey="x"
                name={data.xAxisMetricLabel}
                tickFormatter={formatNumber}
                stroke="#666"
              />
              <YAxis
                type="number"
                dataKey="y"
                name={data.yAxisMetricLabel}
                tickFormatter={formatNumber}
                stroke="#666"
              />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Scatter data={data.plotData} fill="#8884d8" name="Criadores" />
            </ScatterChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data && data.plotData.length === 0 && (
          <div className="flex justify-center items-center h-full">
            <p className="text-gray-500">Nenhum dado disponível.</p>
          </div>
        )}
      </div>

      {data?.insightSummary && !loading && !error && (
        <p className="text-xs md:text-sm text-gray-600 mt-4 pt-2 border-t border-gray-200">
          {data.insightSummary}
        </p>
      )}

      <CreatorSelector
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        onSelect={addCreator}
      />
    </div>
  );
}
