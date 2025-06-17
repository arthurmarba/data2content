"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ApiEngagementDistributionDataPoint {
  name: string;
  value: number;
  percentage: number;
}

interface PlatformEngagementDistributionApiResponse {
  chartData: ApiEngagementDistributionDataPoint[];
  metricUsed: string;
  insightSummary?: string;
}

const ENGAGEMENT_METRIC_OPTIONS = [
  { value: 'stats.total_interactions', label: 'Total de Interações' },
  { value: 'stats.views', label: 'Visualizações' },
  { value: 'stats.likes', label: 'Curtidas' },
  { value: 'stats.comments', label: 'Comentários' },
  { value: 'stats.shares', label: 'Compartilhamentos' },
] as const;

type EngagementMetricValue = typeof ENGAGEMENT_METRIC_OPTIONS[number]['value'];

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A230ED',
  '#D930ED', '#ED308C', '#F28E2B', '#E15759', '#76B7B2',
  '#59A14F', '#EDC948'
];
const DEFAULT_MAX_SLICES = 7;

interface PlatformEngagementDistributionByFormatChartProps {
  timePeriod: string;
  chartTitle?: string;
  initialEngagementMetric?: EngagementMetricValue;
}

const PlatformEngagementDistributionByFormatChart: React.FC<PlatformEngagementDistributionByFormatChartProps> = ({
  timePeriod,
  chartTitle = 'Distribuição de Engajamento por Formato (Plataforma)',
  initialEngagementMetric,
}) => {
  // Garantir valor padrão não indefinido
  const defaultMetric = ENGAGEMENT_METRIC_OPTIONS[0].value;
  const initMetric = initialEngagementMetric ?? defaultMetric;

  const [data, setData] = useState<ApiEngagementDistributionDataPoint[]>([]);
  const [insightSummary, setInsightSummary] = useState<string>();
  const [metricUsed, setMetricUsed] = useState<string>(initMetric);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentEngagementMetric, setCurrentEngagementMetric] = useState<string>(initMetric);
  const maxSlices = DEFAULT_MAX_SLICES;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/platform/performance/engagement-distribution-format?timePeriod=${timePeriod}&engagementMetricField=${currentEngagementMetric}&maxSlices=${maxSlices}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: PlatformEngagementDistributionApiResponse = await response.json();
      setData(result.chartData);
      setInsightSummary(result.insightSummary);
      setMetricUsed(result.metricUsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido ao buscar dados.');
      setData([]);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [timePeriod, currentEngagementMetric, maxSlices]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if ((percent * 100) < 5) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={10}
        fontWeight="bold"
      >
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  const tooltipFormatter = (
    value: number,
    name: string,
    entry: any
  ): [string, string] => {
    const metricLabel = ENGAGEMENT_METRIC_OPTIONS.find(m => m.value === metricUsed)?.label || metricUsed.replace('stats.', '');
    const payload: ApiEngagementDistributionDataPoint = entry.payload;
    return [
      `${value.toLocaleString()} ${metricLabel.toLowerCase()} (${payload.percentage.toFixed(1)}%)`,
      name
    ];
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6 md:mt-0">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-2 sm:mb-0">{chartTitle}</h2>
        <div className="flex gap-4">
          <div>
            <label htmlFor="engagementMetricPlatformEngDistro" className="sr-only">Métrica de Engajamento:</label>
            <select
              id="engagementMetricPlatformEngDistro"
              value={currentEngagementMetric}
              onChange={(e) => setCurrentEngagementMetric(e.target.value as EngagementMetricValue)}
              disabled={loading}
              className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              {ENGAGEMENT_METRIC_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
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
              <Legend
                wrapperStyle={{ fontSize: 12, marginLeft: '10px' }}
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconSize={10}
              />
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

export default memo(PlatformEngagementDistributionByFormatChart);
