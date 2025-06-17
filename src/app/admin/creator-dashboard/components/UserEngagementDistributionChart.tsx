"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ApiEngagementDistributionDataPoint {
  name: string;
  value: number;
  percentage: number;
}

interface UserEngagementDistributionResponse {
  chartData: ApiEngagementDistributionDataPoint[];
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A230ED', '#D930ED', '#ED308C', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948'];
const DEFAULT_MAX_SLICES = 7;

interface UserEngagementDistributionChartProps {
  userId: string | null;
  chartTitle?: string;
  initialTimePeriod?: string; // Recebido de UserDetailView
}

const UserEngagementDistributionChart: React.FC<UserEngagementDistributionChartProps> = ({
  userId,
  chartTitle = "Distribuição de Engajamento por Formato",
  initialTimePeriod // Usar para o estado inicial do seletor de período
}) => {
  const [data, setData] = useState<UserEngagementDistributionResponse['chartData']>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Estado 'timePeriod' é inicializado com initialTimePeriod ou um default
  const [timePeriod, setTimePeriod] = useState<string>(initialTimePeriod || TIME_PERIOD_OPTIONS[2].value);
  const [engagementMetric, setEngagementMetric] = useState<string>(ENGAGEMENT_METRIC_OPTIONS[0].value);
  const maxSlices = DEFAULT_MAX_SLICES;

  // Efeito para atualizar timePeriod se initialTimePeriod (prop) mudar
  useEffect(() => {
    if (initialTimePeriod) {
      setTimePeriod(initialTimePeriod);
    }
  }, [initialTimePeriod]);


  const fetchData = useCallback(async () => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/users/${userId}/performance/engagement-distribution-format?timePeriod=${timePeriod}&engagementMetricField=${engagementMetric}&maxSlices=${maxSlices}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: UserEngagementDistributionResponse = await response.json();
      setData(result.chartData);
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
      setData([]);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [userId, timePeriod, engagementMetric, maxSlices]);

  useEffect(() => {
    if (userId) {
      fetchData();
    } else {
      setData([]);
      setLoading(false);
    }
  }, [userId, fetchData]);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    if ((percent * 100) < 5) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight="bold">
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  const tooltipFormatter = (value: number, name: string, props: { payload: ApiEngagementDistributionDataPoint } ) => {
      return [`${value.toLocaleString()} (${props.payload.percentage.toFixed(1)}%)`, name];
  };

  if (!userId) {
    return (
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
        <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{chartTitle}</h2>
        <div className="flex justify-center items-center h-[300px]">
          <p className="text-gray-500">Selecione um criador para ver os dados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{chartTitle}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor={`timePeriodUserEngDistro-${userId || 'default'}`} className="block text-sm font-medium text-gray-600 mb-1">Período:</label>
          <select
            id={`timePeriodUserEngDistro-${userId || 'default'}`}
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            disabled={loading}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {TIME_PERIOD_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`metricUserEngDistro-${userId || 'default'}`} className="block text-sm font-medium text-gray-600 mb-1">Métrica de Engajamento:</label>
          <select
            id={`metricUserEngDistro-${userId || 'default'}`}
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
      </div>

      <div style={{ width: '100%', height: 300 }}>
        {loading && <div className="flex justify-center items-center h-full"><p className="text-gray-500">Carregando dados...</p></div>}
        {error && <div className="flex justify-center items-center h-full"><p className="text-red-500">Erro: {error}</p></div>}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={tooltipFormatter} />
              <Legend wrapperStyle={{ fontSize: 12 }} layout="vertical" align="right" verticalAlign="middle" />
            </PieChart>
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

export default UserEngagementDistributionChart;
```
