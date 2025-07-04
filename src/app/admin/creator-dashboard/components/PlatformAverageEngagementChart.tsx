"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useGlobalTimePeriod } from './filters/GlobalTimePeriodContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { commaSeparatedIdsToLabels } from '../../../lib/classification';
import { FullDataModal } from './FullDataModal';

// --- Interfaces e Constantes ---
type GroupingType = "format" | "context" | "proposal";
interface ApiAverageEngagementDataPoint { name: string; value: number; postsCount: number; }
interface PlatformAverageEngagementResponse { chartData: ApiAverageEngagementDataPoint[]; groupBy: GroupingType; metricUsed: string; insightSummary?: string; }
const ENGAGEMENT_METRIC_OPTIONS = [ { value: "stats.total_interactions", label: "Total de Interações" }, { value: "stats.views", label: "Visualizações" }, { value: "stats.likes", label: "Curtidas" }, ];
const GROUP_BY_OPTIONS = [ { value: "format", label: "Formato" }, { value: "context", label: "Contexto" }, { value: "proposal", label: "Proposta" }, ];
interface PlatformAverageEngagementChartProps { initialGroupBy: GroupingType; chartTitle: string; initialEngagementMetric?: string; }


// --- Componente Customizado para Labels do Eixo Y (com alinhamento final) ---
const CustomYAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const { value } = payload;
  const parts = value.split(', ');
  const line1 = parts[0];
  const line2 = parts.length > 1 ? parts.slice(1).join(', ') : null;

  // Se houver duas linhas, o dy da primeira linha é -0.6em para "puxar" o bloco para cima.
  // Se houver uma linha, o dy é 0, pois o dominant-baseline já centraliza.
  const initialDy = line2 ? "-0.6em" : "0";

  return (
    <g transform={`translate(${x},${y})`}>
      {/* A propriedade 'dominantBaseline' é a chave para o alinhamento vertical preciso */}
      <text x={-10} y={0} textAnchor="end" fill="#666" fontSize={12} dominantBaseline="middle">
        <tspan x={-10} dy={initialDy}>{line1}</tspan> 
        {line2 && (
          // A segunda linha é sempre desenhada 1.2em abaixo da primeira
          <tspan x={-10} dy="1.2em">{line2}</tspan>
        )}
      </text>
    </g>
  );
};


// --- Componente Principal do Gráfico ---
const PlatformAverageEngagementChart: React.FC<PlatformAverageEngagementChartProps> = ({
  initialGroupBy,
  chartTitle,
  initialEngagementMetric = ENGAGEMENT_METRIC_OPTIONS[0]!.value
}) => {
  const { timePeriod } = useGlobalTimePeriod();
  const [data, setData] = useState<ApiAverageEngagementDataPoint[]>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [engagementMetric, setEngagementMetric] = useState<string>(initialEngagementMetric);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupingType>(initialGroupBy);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/platform/performance/average-engagement?timePeriod=${timePeriod}&engagementMetricField=${engagementMetric}&groupBy=${groupBy}&sortOrder=desc&limit=10`;
      const response = await fetch(apiUrl);
      if (!response.ok) { throw new Error(`Erro HTTP: ${response.status}`); }
      const result: PlatformAverageEngagementResponse = await response.json();
      const mapped = result.chartData.map((d) => ({
        ...d,
        name: commaSeparatedIdsToLabels(d.name, groupBy as any) || d.name,
      }));
      setData(mapped);
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

  const chartHeight = 400;

  const yAxisFormatter = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  const tooltipFormatter = (value: number, name: string, props: {payload?: ApiAverageEngagementDataPoint}) => {
      const { postsCount } = props.payload || { postsCount: 0 };
      return [`${value.toLocaleString('pt-BR')} (de ${postsCount} posts)`, name];
  };

  return (
    <>
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6 md:mt-0">
        <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{chartTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
         <div>
            <label htmlFor={`metricAvgEngPlatform-${groupBy}`} className="block text-sm font-medium text-gray-600 mb-1">Métrica:</label>
            <select id={`metricAvgEngPlatform-${groupBy}`} value={engagementMetric} onChange={(e) => setEngagementMetric(e.target.value)} disabled={loading} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" >
              {ENGAGEMENT_METRIC_OPTIONS.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
            </select>
          </div>
          <div>
            <label htmlFor={`groupByAvgEngPlatform-${groupBy}`} className="block text-sm font-medium text-gray-600 mb-1">Agrupar por:</label>
            <select
              id={`groupByAvgEngPlatform-${groupBy}`}
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupingType)}
              disabled={loading}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              {GROUP_BY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ width: '100%', height: chartHeight }}>
          {loading && <div className="flex justify-center items-center h-full"><p className="text-gray-500">Carregando dados...</p></div>}
          {error && <div className="flex justify-center items-center h-full"><p className="text-red-500">Erro: {error}</p></div>}
          {!loading && !error && data.length > 0 && (
            <ResponsiveContainer>
              {/* ✅ AJUSTE VISUAL: Reduz a margem esquerda para ocupar melhor o espaço */}
              <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis type="number" stroke="#666" tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
                {/* ✅ AJUSTE VISUAL: Reduz a largura do eixo Y para dar mais espaço às barras */}
                <YAxis type="category" dataKey="name" width={160} tick={<CustomYAxisTick />} interval={0} />
                <Tooltip formatter={tooltipFormatter} labelStyle={{ color: '#333' }} wrapperStyle={{ zIndex: 1000 }} contentStyle={{whiteSpace: 'normal'}}/>
                <Legend wrapperStyle={{ fontSize: 14 }} />
                <Bar dataKey="value" name={`Média de ${ENGAGEMENT_METRIC_OPTIONS.find(m=>m.value === engagementMetric)?.label || 'Engajamento'}`} fill="#8884d8" barSize={15} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {!loading && !error && data.length === 0 && (
            <div className="flex justify-center items-center h-full"><p className="text-gray-500">Nenhum dado disponível.</p></div>
          )}
        </div>
        
        <div className="mt-4 text-center border-t border-gray-100 pt-3">
          <button
              onClick={() => setIsModalOpen(true)}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors duration-200"
          >
              Analisar Todos os Itens &rarr;
          </button>
        </div>

        {insightSummary && !loading && !error && (
          <p className="text-xs md:text-sm text-gray-600 mt-4 pt-2 border-t border-gray-200 flex items-start">
            <LightBulbIcon className="w-4 h-4 text-yellow-500 mr-1 flex-shrink-0" />
            {insightSummary}
          </p>
        )}
      </div>

      <FullDataModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        groupBy={groupBy}
        metricUsed={engagementMetric}
        chartTitle={chartTitle}
      />
    </>
  );
};

export default memo(PlatformAverageEngagementChart);
