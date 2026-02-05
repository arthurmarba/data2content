"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { LightBulbIcon, XCircleIcon } from '@heroicons/react/24/outline'; 
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
  ReferenceLine,
  TooltipProps,
} from "recharts";
import { CHART_COLORS } from "@/constants/chartConfig";
import { formatDateLabel, formatWeekStartLabel } from "@/utils/chartFormatters";
import { formatCategories, proposalCategories, contextCategories, Category } from "@/app/lib/classification";

const ChartSkeletonLoader: React.FC = () => (
  <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6 animate-pulse">
    <div className="h-7 bg-gray-200 rounded-md w-3/4 mb-4"></div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      <div className="h-10 bg-gray-200 rounded-md"></div>
      <div className="h-10 bg-gray-200 rounded-md"></div>
      <div className="h-10 bg-gray-200 rounded-md"></div>
      <div className="h-10 bg-gray-200 rounded-md"></div>
      <div className="h-10 bg-gray-200 rounded-md"></div>
    </div>
    <div className="h-[300px] bg-gray-200 rounded-lg"></div>
  </div>
);

const CustomTooltip = ({ active, payload, label, granularity }: TooltipProps<number, string> & { granularity: string }) => {
  if (active && payload && payload.length) {
    const formattedLabel = granularity === 'weekly'
      ? `Semana ${formatWeekStartLabel(String(label))}`
      : new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(label));
    return (
      <div className="bg-white p-3 shadow-lg rounded-md border border-gray-200">
        <p className="font-bold text-gray-800 mb-2">{formattedLabel}</p>
        {payload.map((pld) => (
          <div key={pld.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <div className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: pld.color }} />
              <span className="text-gray-600">{`${pld.name}:`}</span>
            </div>
            <span className="font-semibold ml-4 text-gray-800">
              {pld.value !== null && pld.value !== undefined ? pld.value.toLocaleString('pt-BR') : 'N/A'}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const FilterChip = ({ label, onRemove }: { label: string; onRemove: () => void; }) => (
  <span className="inline-flex items-center gap-x-1.5 rounded-full bg-indigo-100 px-2.5 py-1 text-sm font-medium text-indigo-800">
    {label}
    <button type="button" onClick={onRemove} className="-mr-1 h-5 w-5 p-0.5 rounded-full hover:bg-indigo-200">
      <span className="sr-only">Remover</span>
      <XCircleIcon className="h-4 w-4 text-indigo-600" />
    </button>
  </span>
);

const createOptionsFromCategories = (categories: Category[]) => {
  const options: { value: string; label: string }[] = [];
  const traverse = (cats: Category[], prefix = '') => {
    cats.forEach((cat) => {
      const label = prefix ? `${prefix} > ${cat.label}` : cat.label;
      options.push({ value: cat.id, label });
      if (cat.subcategories && cat.subcategories.length) {
        traverse(cat.subcategories, label);
      }
    });
  };
  traverse(categories);
  return options;
};

const formatOptions = createOptionsFromCategories(formatCategories);
const proposalOptions = createOptionsFromCategories(proposalCategories);
const contextOptions = createOptionsFromCategories(contextCategories);

interface ApiReachEngagementDataPoint {
  date: string;
  reach: number | null;
  totalInteractions: number | null;
}
interface UserReachEngagementTrendResponse {
  chartData: ApiReachEngagementDataPoint[];
  insightSummary?: string;
  averageReach?: number;
  averageInteractions?: number;
}

// --- INÍCIO DA CORREÇÃO DE BUILD ---
interface FilterOption {
  value: string;
  label: string;
}

const TIME_PERIOD_OPTIONS: FilterOption[] = [
  { value: "last_7_days", label: "Últimos 7 dias" },
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "last_90_days", label: "Últimos 90 dias" },
];

const GRANULARITY_OPTIONS: FilterOption[] = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
];
// --- FIM DA CORREÇÃO DE BUILD ---

interface UserReachEngagementTrendChartProps {
  userId: string | null;
  chartTitle?: string;
  initialGranularity?: string;
}

const UserReachEngagementTrendChart: React.FC<
  UserReachEngagementTrendChartProps
> = ({
  userId,
  chartTitle = "Evolução de Alcance e Contas Engajadas do Criador",
  initialGranularity,
}) => {
  const [data, setData] = useState<UserReachEngagementTrendResponse["chartData"]>([]);
  const [insightSummary, setInsightSummary] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [averageReach, setAverageReach] = useState<number | undefined>();
  const [averageInteractions, setAverageInteractions] = useState<number | undefined>();
  const { timePeriod: globalTimePeriod } = useGlobalTimePeriod();
  const [timePeriod, setTimePeriod] = useState<string>(globalTimePeriod || "last_30_days");
  const [granularity, setGranularity] = useState<string>(initialGranularity || "daily");
  const [selectedFormat, setSelectedFormat] = useState('');
  const [selectedProposal, setSelectedProposal] = useState('');
  const [selectedContext, setSelectedContext] = useState('');

  useEffect(() => { setTimePeriod(globalTimePeriod); }, [globalTimePeriod]);
  useEffect(() => { if (initialGranularity) { setGranularity(initialGranularity); } }, [initialGranularity]);

  const fetchData = useCallback(async () => {
    if (!userId) { setData([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        timePeriod,
        granularity,
      });
      if (selectedFormat) params.set('format', selectedFormat);
      if (selectedProposal) params.set('proposal', selectedProposal);
      if (selectedContext) params.set('context', selectedContext);

      const apiUrl = `/api/v1/users/${userId}/trends/reach-engagement?${params.toString()}`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: UserReachEngagementTrendResponse = await response.json();
      setData(result.chartData);
      setInsightSummary(result.insightSummary);
      setAverageReach(result.averageReach);
      setAverageInteractions(result.averageInteractions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro");
      setData([]);
      setInsightSummary(undefined);
      setAverageReach(undefined);
      setAverageInteractions(undefined);
    } finally {
      setLoading(false);
    }
  }, [userId, timePeriod, granularity, selectedFormat, selectedProposal, selectedContext]);

  useEffect(() => { if (userId) { fetchData(); } else { setData([]); setLoading(false); } }, [userId, fetchData]);

  const yAxisFormatter = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  const xAxisTickFormatter = (tick: string) => {
    if (granularity === "weekly") return formatWeekStartLabel(tick);
    if (granularity === 'daily') return formatDateLabel(tick);
    return tick;
  };

  const activeFilters = useMemo(() => {
    const filters = [];
    if (selectedFormat) {
      const label = formatOptions.find(opt => opt.value === selectedFormat)?.label || selectedFormat;
      filters.push({ key: 'format', label: `Formato: ${label}`, onRemove: () => setSelectedFormat('') });
    }
    if (selectedProposal) {
      const label = proposalOptions.find(opt => opt.value === selectedProposal)?.label || selectedProposal;
      filters.push({ key: 'proposal', label: `Proposta: ${label}`, onRemove: () => setSelectedProposal('') });
    }
    if (selectedContext) {
      const label = contextOptions.find(opt => opt.value === selectedContext)?.label || selectedContext;
      filters.push({ key: 'context', label: `Contexto: ${label}`, onRemove: () => setSelectedContext('') });
    }
    return filters;
  }, [selectedFormat, selectedProposal, selectedContext]);

  if (!userId) {
    return (
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
        <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{chartTitle}</h2>
        <div className="flex justify-center items-center h-[300px]"><p className="text-gray-500">Selecione um criador para ver os dados.</p></div>
      </div>
    );
  }
  
  if (loading) { return <ChartSkeletonLoader />; }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-gray-700">{chartTitle}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div>
          <label htmlFor={`timePeriodUserReachEng-${userId}`} className="block text-sm font-medium text-gray-600 mb-1">Período:</label>
          <select id={`timePeriodUserReachEng-${userId}`} value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)} disabled={loading} className="w-full p-2 border-gray-300 rounded-md shadow-sm text-sm">
            {TIME_PERIOD_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor={`granularityUserReachEng-${userId}`} className="block text-sm font-medium text-gray-600 mb-1">Ver por:</label>
          <select id={`granularityUserReachEng-${userId}`} value={granularity} onChange={(e) => setGranularity(e.target.value)} disabled={loading} className="w-full p-2 border-gray-300 rounded-md shadow-sm text-sm">
            {GRANULARITY_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor={`formatUserReachEng-${userId}`} className="block text-sm font-medium text-gray-600 mb-1">Formato:</label>
          <select id={`formatUserReachEng-${userId}`} value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value)} disabled={loading} className="w-full p-2 border-gray-300 rounded-md shadow-sm text-sm">
            <option value="">Todos</option>
            {formatOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor={`proposalUserReachEng-${userId}`} className="block text-sm font-medium text-gray-600 mb-1">Proposta:</label>
          <select id={`proposalUserReachEng-${userId}`} value={selectedProposal} onChange={(e) => setSelectedProposal(e.target.value)} disabled={loading} className="w-full p-2 border-gray-300 rounded-md shadow-sm text-sm">
            <option value="">Todas</option>
            {proposalOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor={`contextUserReachEng-${userId}`} className="block text-sm font-medium text-gray-600 mb-1">Contexto:</label>
          <select id={`contextUserReachEng-${userId}`} value={selectedContext} onChange={(e) => setSelectedContext(e.target.value)} disabled={loading} className="w-full p-2 border-gray-300 rounded-md shadow-sm text-sm">
            <option value="">Todos</option>
            {contextOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
          </select>
        </div>
      </div>
      
      {activeFilters.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4">
          <span className="text-sm font-semibold text-gray-600 mr-2">Filtros Ativos:</span>
          {activeFilters.map(filter => (
            <FilterChip key={filter.key} label={filter.label} onRemove={filter.onRemove} />
          ))}
        </div>
      )}

      <div style={{ width: "100%", height: 300 }}>
        {error && (<div className="flex justify-center items-center h-full"><p className="text-red-500">Erro: {error}</p></div>)}
        {!error && data.length > 0 && (
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 5, right: 30, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 12 }} tickFormatter={xAxisTickFormatter} />
              <YAxis yAxisId="left" stroke={CHART_COLORS.reach} tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
              <YAxis yAxisId="right" orientation="right" stroke={CHART_COLORS.interactions} tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
              <Tooltip content={<CustomTooltip granularity={granularity} />} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              
              {averageReach !== undefined && ( <ReferenceLine y={averageReach} yAxisId="left" stroke={CHART_COLORS.average} strokeDasharray="4 4" /> )}
              {averageInteractions !== undefined && ( <ReferenceLine y={averageInteractions} yAxisId="right" stroke={CHART_COLORS.average} strokeDasharray="4 4" /> )}
              
              <Line yAxisId="left" type="monotone" dataKey="reach" name="Alcance" stroke={CHART_COLORS.reach} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} connectNulls={false}/>
              <Line yAxisId="right" type="monotone" dataKey="totalInteractions" name="Interações" stroke={CHART_COLORS.interactions} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
        {!error && data.length === 0 && (<div className="flex justify-center items-center h-full"><p className="text-gray-500">Sem dados no período selecionado.</p></div>)}
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

export default React.memo(UserReachEngagementTrendChart);
