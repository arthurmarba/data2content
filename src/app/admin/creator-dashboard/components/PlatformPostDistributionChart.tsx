"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useGlobalTimePeriod } from './filters/GlobalTimePeriodContext';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getCategoryById } from "../../../lib/classification";

const FORMAT_LABEL_MAP: Record<string, string> = {
  IMAGE: 'photo',
  IMAGEM: 'photo',
  PHOTO: 'photo',
  FOTO: 'photo',
  VIDEO: 'long_video',
  REEL: 'reel',
  CAROUSEL_ALBUM: 'carousel',
  CAROUSEL: 'carousel',
  CARROSSEL: 'carousel',
  STORY: 'story',
  LIVE: 'live',
  LONG_VIDEO: 'long_video',
};

function toFormatLabel(raw: string): string {
  const key = raw.trim().toUpperCase();
  const mappedId = FORMAT_LABEL_MAP[key];
  return (
    (mappedId && getCategoryById(mappedId, 'format')?.label) ||
    getCategoryById(raw.trim().toLowerCase(), 'format')?.label ||
    raw.trim()
  );
}

interface ApiPostDistributionDataPoint {
  name: string;
  value: number; // Agora representa contagem de posts
  percentage: number;
}

interface PlatformPostDistributionResponse {
  chartData: ApiPostDistributionDataPoint[];
  insightSummary?: string;
}

const TIME_PERIOD_OPTIONS = [
  { value: "all_time", label: "Todo o período" },
  { value: "last_7_days", label: "Últimos 7 dias" },
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "last_90_days", label: "Últimos 90 dias" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_12_months", label: "Últimos 12 meses" },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A230ED', '#D930ED', '#ED308C', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948'];
const DEFAULT_MAX_SLICES = 7;

interface PlatformPostDistributionChartProps {
  chartTitle?: string;
  // initialEngagementMetric foi removido, pois este gráfico agora é fixo para contagem de posts
}

const PlatformPostDistributionChart: React.FC<PlatformPostDistributionChartProps> = ({
  chartTitle = "Distribuição de Posts por Formato (Plataforma)"
}) => {
  const { timePeriod } = useGlobalTimePeriod();
  const [data, setData] = useState<PlatformPostDistributionResponse['chartData']>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // timePeriod vem do contexto global.
  // engagementMetric não é mais necessário.
  const maxSlices = DEFAULT_MAX_SLICES; // Pode ser uma prop se necessário

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Alterada a URL da API e removido engagementMetricField
      const apiUrl = `/api/v1/platform/performance/post-distribution-format?timePeriod=${timePeriod}&maxSlices=${maxSlices}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: PlatformPostDistributionResponse = await response.json();
      const mapped = result.chartData.map(d => ({
        ...d,
        name: toFormatLabel(d.name),
      }));
      setData(mapped);
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido ao buscar dados.');
      setData([]);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [timePeriod, maxSlices]); // Removido engagementMetric das dependências

  useEffect(() => {
    fetchData();
  }, [fetchData]); // fetchData agora depende de timePeriod (contexto) e maxSlices (constante)

  // handleTimePeriodChange não é mais necessário aqui, pois o período vem do contexto
  // handleEngagementMetricChange não é mais necessário

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    if ((percent * 100) < 5) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight="bold">
        {/* O nome do formato já está na legenda, mostrar apenas o percentual */}
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  const tooltipFormatter = (value: number, name: string, props: { payload?: ApiPostDistributionDataPoint } ) => {
        // 'value' agora é a contagem de posts
        const percentage = props.payload?.percentage !== undefined ? props.payload.percentage.toFixed(1) : '0';
        return [`${value.toLocaleString()} posts (${percentage}%)`, name];
    };

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6 md:mt-0">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-2 sm:mb-0">{chartTitle}</h2>
        {/* Seletores de timePeriod e engagementMetric removidos. TimePeriod é fornecido pelo contexto. */}
        {/* Seletor de maxSlices poderia ser adicionado aqui se desejado */}
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
          <div className="flex justify-center items-center h-full"><p className="text-gray-500">Sem dados no período selecionado.</p></div>
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

export default memo(PlatformPostDistributionChart);

