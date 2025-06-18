"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

type GroupingType = "format" | "context" | "proposal";

interface ApiAverageEngagementDataPoint {
  name: string;
  value: number;
  postsCount: number;
}

interface PlatformAverageEngagementResponse {
  chartData: ApiAverageEngagementDataPoint[];
  groupBy: GroupingType;
  metricUsed: string;
  insightSummary?: string;
}

// TIME_PERIOD_OPTIONS não é mais necessário aqui
// ENGAGEMENT_METRIC_OPTIONS e GROUP_BY_OPTIONS podem ser mantidos ou movidos para um local compartilhado se usados por mais componentes
const ENGAGEMENT_METRIC_OPTIONS = [
  { value: "stats.total_interactions", label: "Total de Interações" },
  { value: "stats.views", label: "Visualizações" },
  { value: "stats.likes", label: "Curtidas" },
];

const GROUP_BY_OPTIONS = [ // Usado apenas se o seletor de groupBy fosse habilitado
  { value: "format", label: "Formato" },
  { value: "context", label: "Contexto" },
  { value: "proposal", label: "Proposta" },
];

interface PlatformAverageEngagementChartProps {
  timePeriod: string; // Recebido do pai (page.tsx)
  initialGroupBy: GroupingType;
  chartTitle: string;
  initialEngagementMetric?: string;
}

const PlatformAverageEngagementChart: React.FC<PlatformAverageEngagementChartProps> = ({
  timePeriod,
  initialGroupBy,
  chartTitle,
  initialEngagementMetric = ENGAGEMENT_METRIC_OPTIONS[0]!.value
}) => {
  const [data, setData] = useState<ApiAverageEngagementDataPoint[]>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // timePeriod é agora uma prop
  const [engagementMetric, setEngagementMetric] = useState<string>(initialEngagementMetric);
  // groupBy é controlado por initialGroupBy, não muda internamente por seletor neste componente
  const groupBy = initialGroupBy;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Usa timePeriod da prop
      const apiUrl = `/api/v1/platform/performance/average-engagement?timePeriod=${timePeriod}&engagementMetricField=${engagementMetric}&groupBy=${groupBy}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: PlatformAverageEngagementResponse = await response.json();
      setData(result.chartData);
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
      setData([]);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [timePeriod, engagementMetric, groupBy]); // Adicionado timePeriod às dependências

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const yAxisFormatter = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  const tooltipFormatter = (value: number, name: string, props: {payload?: ApiAverageEngagementDataPoint}) => {
      const { postsCount } = props.payload || { postsCount: 0 };
      return [`${value.toLocaleString()} (de ${postsCount} posts)`, name];
  };
  const xAxisTickFormatter = (value: string) => {
    if (value && value.length > 15) {
        return `${value.substring(0, 13)}...`;
    }
    return value;
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6 md:mt-0">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{chartTitle}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6"> {/* Removido o terceiro slot do grid */}
        {/* Seletor de timePeriod removido */}
        <div>
          <label htmlFor={`metricAvgEngPlatform-${groupBy}`} className="block text-sm font-medium text-gray-600 mb-1">Métrica:</label>
          <select
            id={`metricAvgEngPlatform-${groupBy}`}
            value={engagementMetric}
            onChange={(e) => setEngagementMetric(e.target.value)}
            disabled={loading}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {ENGAGEMENT_METRIC_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`groupByAvgEngPlatform-${groupBy}`} className="block text-sm font-medium text-gray-600 mb-1">Agrupar por:</label>
          <input
            type="text"
            id={`groupByAvgEngPlatform-${groupBy}`}
            value={GROUP_BY_OPTIONS.find(opt => opt.value === groupBy)?.label || groupBy}
            disabled
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-sm"
          />
        </div>
      </div>

      <div style={{ width: '100%', height: 350 }}>
        {loading && <div className="flex justify-center items-center h-full"><p className="text-gray-500">Carregando dados...</p></div>}
        {error && <div className="flex justify-center items-center h-full"><p className="text-red-500">Erro: {error}</p></div>}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis type="number" stroke="#666" tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#666"
                tick={{ fontSize: 12 }}
                width={100}
                interval={0}
                tickFormatter={xAxisTickFormatter}
              />
              <Tooltip formatter={tooltipFormatter} labelStyle={{ color: '#333' }} wrapperStyle={{ zIndex: 1000 }}/>
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Bar dataKey="value" name={`Média de ${ENGAGEMENT_METRIC_OPTIONS.find(m=>m.value === engagementMetric)?.label || 'Engajamento'}`} fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="flex justify-center items-center h-full"><p className="text-gray-500">Nenhum dado disponível para os filtros selecionados.</p></div>
        )}
      </div>
      {insightSummary && !loading && !error && (
        <p className="text-xs md:text-sm text-gray-600 mt-4 pt-2 border-t border-gray-200">{insightSummary}</p>
      )}
    </div>
  );
};

export default memo(PlatformAverageEngagementChart);

