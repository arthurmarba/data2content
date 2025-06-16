"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Tipos de dados da API (espelhando a resposta do endpoint)
type GroupingType = "format" | "context";

interface ApiAverageEngagementDataPoint {
  name: string; // Nome do formato ou contexto
  value: number; // Média da métrica de performance
  postsCount: number; // Número de posts nesse grupo
}

interface PlatformAverageEngagementResponse {
  chartData: ApiAverageEngagementDataPoint[];
  groupBy: GroupingType;
  metricUsed: string;
  insightSummary?: string;
}

// Constantes para seletores (podem ser importadas ou definidas aqui)
const TIME_PERIOD_OPTIONS = [
  { value: "all_time", label: "Todo o período" },
  { value: "last_7_days", label: "Últimos 7 dias" },
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "last_90_days", label: "Últimos 90 dias" },
  // Adicionar mais conforme necessário
];

const ENGAGEMENT_METRIC_OPTIONS = [
  { value: "stats.total_interactions", label: "Total de Interações" },
  { value: "stats.views", label: "Visualizações" },
  { value: "stats.likes", label: "Curtidas" },
  // Adicionar mais conforme necessário
];

const GROUP_BY_OPTIONS = [
  { value: "format", label: "Formato" },
  { value: "context", label: "Contexto" },
];

interface PlatformAverageEngagementChartProps {
  initialGroupBy: GroupingType; // Para diferenciar instâncias do gráfico (Formato vs Contexto)
  chartTitle: string; // Ex: "Engajamento Médio da Plataforma por Formato"
}

const PlatformAverageEngagementChart: React.FC<PlatformAverageEngagementChartProps> = ({
  initialGroupBy,
  chartTitle,
}) => {
  const [data, setData] = useState<ApiAverageEngagementDataPoint[]>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para os seletores
  const [timePeriod, setTimePeriod] = useState<string>(TIME_PERIOD_OPTIONS[3].value); // Default: last_90_days
  const [engagementMetric, setEngagementMetric] = useState<string>(ENGAGEMENT_METRIC_OPTIONS[0].value);
  const [groupBy, setGroupBy] = useState<GroupingType>(initialGroupBy);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
  }, [timePeriod, engagementMetric, groupBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Atualizar groupBy se initialGroupBy mudar (caso raro, mas para consistência)
  useEffect(() => {
    setGroupBy(initialGroupBy);
  }, [initialGroupBy]);


  const yAxisFormatter = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  const tooltipFormatter = (value: number, name: string, props: {payload: ApiAverageEngagementDataPoint}) => {
      const { postsCount } = props.payload;
      return [`${value.toLocaleString()} (de ${postsCount} posts)`, name];
  };
  const xAxisTickFormatter = (value: string) => {
    if (value && value.length > 15) { // Limitar tamanho do tick no eixo X
        return `${value.substring(0, 13)}...`;
    }
    return value;
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{chartTitle}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label htmlFor={`timePeriodAvgEng-${groupBy}`} className="block text-sm font-medium text-gray-600 mb-1">Período:</label>
          <select
            id={`timePeriodAvgEng-${groupBy}`}
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {TIME_PERIOD_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`metricAvgEng-${groupBy}`} className="block text-sm font-medium text-gray-600 mb-1">Métrica:</label>
          <select
            id={`metricAvgEng-${groupBy}`}
            value={engagementMetric}
            onChange={(e) => setEngagementMetric(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {ENGAGEMENT_METRIC_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`groupByAvgEng-${groupBy}`} className="block text-sm font-medium text-gray-600 mb-1">Agrupar por:</label>
          <select // Este seletor pode ser fixo dependendo da instância do gráfico (ex: sempre "format")
            id={`groupByAvgEng-${groupBy}`}
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupingType)}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            disabled // Desabilitar se initialGroupBy for para fixar o tipo de gráfico
          >
            {GROUP_BY_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ width: '100%', height: 350 }}> {/* Aumentar altura para bar chart */}
        {loading && <div className="flex justify-center items-center h-full"><p className="text-gray-500">Carregando dados...</p></div>}
        {error && <div className="flex justify-center items-center h-full"><p className="text-red-500">Erro: {error}</p></div>}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}> {/* Ajustar margens para labels */}
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis type="number" stroke="#666" tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#666"
                tick={{ fontSize: 12 }}
                width={100} // Ajustar largura para caber os nomes
                interval={0} // Mostrar todos os ticks
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

export default PlatformAverageEngagementChart;
```
