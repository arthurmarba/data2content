'use client';

// CORREÇÃO: Removidas todas as classes de tema escuro (dark:) para unificar o design.
import React, { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useGlobalTimePeriod } from './components/filters/GlobalTimePeriodContext';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';
import {
    ArrowUpIcon,
    ArrowDownIcon,
    ChartBarIcon,
    ArrowsUpDownIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline';

import {
    TopMoverEntityType,
    TopMoverMetric,
    TopMoverSortBy,
    ISegmentDefinition,
    ITopMoverResult,
    IPeriod
} from '@/app/lib/dataService/marketAnalysis/types';

import SkeletonBlock from './SkeletonBlock';
import EmptyState from './EmptyState';
import { TrendChart } from '../widgets/TopMoversWidget';


// --- Tipos e Opções para a UI ---

interface PeriodState {
    startDate: string;
    endDate: string;
}

const initialPeriodState: PeriodState = { startDate: '', endDate: '' };

const ENTITY_TYPE_OPTIONS: { value: TopMoverEntityType; label: string; disabled?: boolean }[] = [
    { value: 'content', label: 'Conteúdo' },
    { value: 'creator', label: 'Criador' },
];

const METRIC_OPTIONS: { value: TopMoverMetric; label: string }[] = [
    { value: 'cumulativeViews', label: 'Visualizações (acumulado até a data)' },
    { value: 'cumulativeLikes', label: 'Likes (acumulado até a data)' },
    { value: 'cumulativeShares', label: 'Compartilhamentos (acumulado até a data)' },
    { value: 'cumulativeComments', label: 'Comentários (acumulado até a data)' },
    { value: 'cumulativeSaved', label: 'Salvamentos (acumulado até a data)' },
    { value: 'cumulativeReach', label: 'Alcance (acumulado até a data)' },
    { value: 'cumulativeImpressions', label: 'Impressões (acumulado até a data)' },
    { value: 'cumulativeTotalInteractions', label: 'Interações Totais (acumulado até a data)' },
];

const SORT_BY_OPTIONS: { value: TopMoverSortBy; label: string }[] = [
    { value: 'absoluteChange_decrease', label: 'Maior Queda Absoluta' },
    { value: 'absoluteChange_increase', label: 'Maior Crescimento Absoluto' },
    { value: 'percentageChange_decrease', label: 'Maior Queda Percentual' },
    { value: 'percentageChange_increase', label: 'Maior Crescimento Percentual' },
];

const FORMAT_OPTIONS_TOP_MOVERS = ["", "Reel", "Post Estático", "Carrossel", "Story", "Video Longo"];

const DEFAULT_CONTEXTS = [""];


// --- Funções Utilitárias ---
const formatDisplayNumberIntl = (num: number, decimals = 0) => (
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num)
);

const formatDisplayNumberCompact = (num: number) => (
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(num)
);

const formatDisplayNumberTM = (num?: number, decimals = 0, compact = true): string => {
  if (num === null || typeof num === 'undefined') return 'N/A';
  return compact ? formatDisplayNumberCompact(num) : formatDisplayNumberIntl(num, decimals);
};

const formatDisplayPercentageTM = (num?: number | null): string => {
  if (num === null || typeof num === 'undefined') return 'N/A';
  return `${(num * 100).toFixed(1)}%`;
};


export default function TopMoversWidget({ apiPrefix = '/api/admin' }: { apiPrefix?: string }) {
  const [entityType, setEntityType] = useState<TopMoverEntityType>('content');
  const [metric, setMetric] = useState<TopMoverMetric>('cumulativeViews');
  const [previousPeriod, setPreviousPeriod] = useState<PeriodState>(initialPeriodState);
  const [currentPeriod, setCurrentPeriod] = useState<PeriodState>(initialPeriodState);
  const [topN, setTopN] = useState<number>(10);
  const [sortBy, setSortBy] = useState<TopMoverSortBy>('absoluteChange_increase');

  const [contentFilters, setContentFilters] = useState<ISegmentDefinition>({});
  const [contextOptions, setContextOptions] = useState<string[]>(DEFAULT_CONTEXTS);
  
  const [results, setResults] = useState<ITopMoverResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [useCompactNumbers, setUseCompactNumbers] = useState(true);

  const { timePeriod: globalTimePeriod } = useGlobalTimePeriod();

  useEffect(() => {
    async function loadContexts() {
      try {
        const contextsUrl = `${apiPrefix}/dashboard/contexts`;
        const res = await fetch(contextsUrl);
        if (res.ok) {
          const data = await res.json();
          setContextOptions(['', ...data.contexts]);
        }
      } catch (e) {
        console.error('Failed to load contexts', e);
      }
    }
    loadContexts();
  }, [apiPrefix]);

  useEffect(() => {
    const today = new Date();
    const currStart = getStartDateFromTimePeriod(today, globalTimePeriod);
    const prevEnd = new Date(currStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = getStartDateFromTimePeriod(prevEnd, globalTimePeriod);
    setCurrentPeriod({
      startDate: currStart.toISOString().slice(0, 10),
      endDate: today.toISOString().slice(0, 10),
    });
    setPreviousPeriod({
      startDate: prevStart.toISOString().slice(0, 10),
      endDate: prevEnd.toISOString().slice(0, 10),
    });
  }, [globalTimePeriod]);

  // Helpers para alternar modo de ordenação (absoluto vs percentual) e direção (crescimento vs queda)
  const sortMode: 'absolute' | 'percentage' = sortBy.startsWith('absolute') ? 'absolute' : 'percentage';
  const sortDirection: 'increase' | 'decrease' = sortBy.endsWith('_increase') ? 'increase' : 'decrease';

  const setSortMode = (mode: 'absolute' | 'percentage') => {
    const dir = sortDirection; // manter direção atual
    const newSort = (mode === 'absolute' ? 'absoluteChange' : 'percentageChange') + '_' + dir as TopMoverSortBy;
    setSortBy(newSort);
  };
  const setSortDirection = (dir: 'increase' | 'decrease') => {
    const mode = sortMode; // manter modo atual
    const newSort = (mode === 'absolute' ? 'absoluteChange' : 'percentageChange') + '_' + dir as TopMoverSortBy;
    setSortBy(newSort);
  };

  const handleContentFilterChange = (field: keyof ISegmentDefinition, value: string) => {
    setContentFilters(prev => ({ ...prev, [field]: value === "" ? undefined : value }));
  };

  const handleClearFilters = () => {
    setContentFilters({});
  };

  const hasActiveFilters = Object.keys(contentFilters).length > 0;

  const handleFetchTopMovers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    
    interface IFetchTopMoversArgs {
        entityType: TopMoverEntityType;
        metric: TopMoverMetric;
        previousPeriod: IPeriod;
        currentPeriod: IPeriod;
        topN: number;
        sortBy: TopMoverSortBy;
        contentFilters?: ISegmentDefinition;
        creatorFilters?: any;
    }

    const apiPayload: IFetchTopMoversArgs = {
      entityType,
      metric,
      previousPeriod: {
        startDate: new Date(previousPeriod.startDate),
        endDate: new Date(previousPeriod.endDate)
      },
      currentPeriod: {
        startDate: new Date(currentPeriod.startDate),
        endDate: new Date(currentPeriod.endDate)
      },
      topN,
      sortBy,
    };

    if (entityType === 'content' && Object.keys(contentFilters).length > 0) {
      apiPayload.contentFilters = contentFilters;
    } else if (entityType === 'creator') {
      apiPayload.creatorFilters = undefined;
    }

    try {
      const topMoversUrl = `${apiPrefix}/dashboard/top-movers`;
      const response = await fetch(topMoversUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Falha ao buscar Top Movers`);
      }
      const data: ITopMoverResult[] = await response.json();
      setResults(data);
    } catch (e: any) {
      setError(e.message);
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [entityType, metric, previousPeriod, currentPeriod, topN, sortBy, contentFilters, apiPrefix]);

  useEffect(() => {
    if (!previousPeriod.startDate || !currentPeriod.startDate) return;
    handleFetchTopMovers();
  }, [entityType, metric, sortBy, topN, contentFilters, previousPeriod, currentPeriod, handleFetchTopMovers]);


  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ChartBarIcon className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            {`Top Movers — ${ENTITY_TYPE_OPTIONS.find(e => e.value === entityType)?.label}`}
            <span className="mx-2 text-gray-400">•</span>
            <span className="text-gray-700">{METRIC_OPTIONS.find(m => m.value === metric)?.label}</span>
            <span className="mx-2 text-gray-400">•</span>
            <span className="text-gray-700">{SORT_BY_OPTIONS.find(s => s.value === sortBy)?.label}</span>
            <InformationCircleIcon
              className="h-4 w-4 text-gray-400 ml-2 cursor-help"
              title={
                'Como ler: os valores são acumulados até o fim de cada período. O Δ (variação) é o incremento no intervalo entre as duas datas finais. Δ% = (Atual − Anterior) / Anterior.'
              }
            />
          </h3>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-indigo-700"
        >
          {isCollapsed ? 'Expandir' : 'Recolher'}
        </button>
      </div>
      {!isCollapsed && (
        <>
        <div className="text-sm text-gray-600 mt-1 mb-4 ml-7">
          <PeriodSummary previous={previousPeriod} current={currentPeriod} />
        </div>

        {/* --- UI de Seleção de Parâmetros --- */}
        <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="tm-entityType" className="block text-xs font-medium text-gray-600 mb-1">Entidade</label>
            <select id="tm-entityType" value={entityType} onChange={(e) => setEntityType(e.target.value as TopMoverEntityType)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-gray-900 h-[38px]">
              {ENTITY_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="tm-metric" className="block text-xs font-medium text-gray-600 mb-1">Métrica</label>
            <select id="tm-metric" value={metric} onChange={(e) => setMetric(e.target.value as TopMoverMetric)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-gray-900 h-[38px]">
              {METRIC_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ordenar</label>
            <div className="flex gap-2">
              <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                <button type="button" onClick={() => setSortMode('absolute')} className={`px-2 py-1 text-xs ${sortMode === 'absolute' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>Δ Absoluto</button>
                <button type="button" onClick={() => setSortMode('percentage')} className={`px-2 py-1 text-xs ${sortMode === 'percentage' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>Δ %</button>
              </div>
              <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                <button type="button" onClick={() => setSortDirection('increase')} className={`px-2 py-1 text-xs ${sortDirection === 'increase' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}>Crescimento</button>
                <button type="button" onClick={() => setSortDirection('decrease')} className={`px-2 py-1 text-xs ${sortDirection === 'decrease' ? 'bg-red-600 text-white' : 'bg-white text-gray-700'}`}>Queda</button>
              </div>
            </div>
            <div className="sr-only">
              <label htmlFor="tm-sortBy">Ordenar Por</label>
              <select id="tm-sortBy" value={sortBy} onChange={(e) => setSortBy(e.target.value as TopMoverSortBy)}>
                {SORT_BY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="tm-topN" className="block text-xs font-medium text-gray-600 mb-1">Top N</label>
            <input type="number" id="tm-topN" value={topN} onChange={(e) => setTopN(Math.max(1, parseInt(e.target.value, 10) || 1))} min="1" max="50" className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-gray-900 h-[38px]" />
          </div>

          {entityType === 'content' && (
            <>
              <div className="mt-2">
                <label htmlFor="tm-contentFormat" className="block text-xs font-medium text-gray-600 mb-1">Formato (Conteúdo)</label>
                <select id="tm-contentFormat" value={contentFilters.format || ""} onChange={e => handleContentFilterChange('format', e.target.value)} className="w-full px-3 py-1.5 border-gray-300 rounded-md h-[38px] sm:text-sm bg-white text-gray-900">
                  {FORMAT_OPTIONS_TOP_MOVERS.map(f => <option key={f} value={f}>{f === "" ? "Todos Formatos" : f}</option>)}
                </select>
              </div>
              <div className="mt-2">
                <label htmlFor="tm-contentContext" className="block text-xs font-medium text-gray-600 mb-1">Contexto (Conteúdo)</label>
                <select id="tm-contentContext" value={contentFilters.context || ""} onChange={e => handleContentFilterChange('context', e.target.value)} className="w-full px-3 py-1.5 border-gray-300 rounded-md h-[38px] sm:text-sm bg-white text-gray-900">
                  {contextOptions.map(c => <option key={c} value={c}>{c === "" ? "Todos Contextos" : c}</option>)}
                </select>
              </div>
            </>
          )}
          <div className="mt-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Formato de número</label>
            <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
              <button type="button" onClick={() => setUseCompactNumbers(true)} className={`px-2 py-1 text-xs ${useCompactNumbers ? 'bg-gray-800 text-white' : 'bg-white text-gray-700'}`}>Compacto</button>
              <button type="button" onClick={() => setUseCompactNumbers(false)} className={`px-2 py-1 text-xs ${!useCompactNumbers ? 'bg-gray-800 text-white' : 'bg-white text-gray-700'}`}>Completo</button>
            </div>
          </div>
        </div>
        {hasActiveFilters && (
          <div className="mt-3">
            <button onClick={handleClearFilters} className="text-xs px-2.5 py-1 bg-blue-500 text-white rounded">Limpar filtros</button>
          </div>
        )}
      </div>
      
      {/* --- Área de Resultados --- */}
      <div className="mt-6">
        {isLoading && (<SkeletonBlock height="h-48" />)}
        {error && ( <div className="text-center py-4 text-red-500">Erro: {error}</div> )}
        {!isLoading && !error && results === null && (
            <EmptyState icon={<ChartBarIcon className="w-12 h-12"/>} title="Analisar Top Movers" message="Configure os parâmetros e aguarde a atualização automática." />
        )}
        {!isLoading && !error && results?.length === 0 && (
            <EmptyState icon={<ArrowsUpDownIcon className="w-12 h-12"/>} title="Nenhum 'Mover' Encontrado" message="Não foram encontradas variações com os filtros selecionados." />
        )}
        {!isLoading && !error && results && results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{entityType === 'content' ? 'Conteúdo' : 'Criador'}</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell" title="Acumulado até o fim do período anterior">Acum. fim período anterior</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" title="Acumulado até o fim do período atual">Acum. fim período atual</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell" title="Δ Absoluto no intervalo entre as duas datas finais">Δ Absoluto (intervalo)</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" title="Δ Percentual no intervalo">Δ (%)</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tendência</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map((item) => (
                  <tr key={item.entityId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800">
                      <div className="flex items-center">
                      {entityType === 'creator' && item.profilePictureUrl && (
                          <Image
                            width={24}
                            height={24}
                            src={item.profilePictureUrl}
                            alt={item.entityName}
                            className="h-6 w-6 rounded-full mr-2 object-cover" />
                        )}
                        {entityType === 'creator' && !item.profilePictureUrl && (
                           <div className="h-6 w-6 rounded-full bg-gray-200 mr-2 flex items-center justify-center text-xs">{item.entityName?.substring(0,1).toUpperCase()}</div>
                        )}
                        {entityType === 'content' && item.coverUrl && (
                          <Image src={item.coverUrl} alt={item.entityName} className="h-20 w-20 object-cover rounded mr-2" width={80} height={80} />
                        )}
                        {entityType === 'content' && !item.coverUrl && (
                          <div className="h-6 w-6 rounded bg-gray-200 mr-2 flex items-center justify-center text-gray-400">
                            <ChartBarIcon className="h-4 w-4" />
                          </div>
                        )}
                        <span className="truncate max-w-[200px]" title={item.entityName}>{item.entityName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500 hidden sm:table-cell">{formatDisplayNumberTM(item.previousValue, 0, useCompactNumbers)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{formatDisplayNumberTM(item.currentValue, 0, useCompactNumbers)}</td>
                    <td className={`px-3 py-2 text-right font-semibold hidden sm:table-cell ${item.absoluteChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.absoluteChange > 0 ? <ArrowUpIcon className="h-3 w-3 inline" /> : <ArrowDownIcon className="h-3 w-3 inline" />} {formatDisplayNumberTM(item.absoluteChange, 0, useCompactNumbers)}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${item.percentageChange && item.percentageChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.percentageChange ? formatDisplayPercentageTM(item.percentageChange) : 'N/A'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center items-center">
                        <TrendChart v1={item.previousValue} v2={item.currentValue} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}
    </div>  );}

// Componente simples de resumo de períodos
function PeriodSummary({ previous, current }: { previous: { startDate: string; endDate: string }, current: { startDate: string; endDate: string } }) {
  const fmt = (s: string) => {
    if (!s) return '';
    const d = new Date(s);
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(d);
  };
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-gray-700 font-medium">Períodos:</span>
      <span className="text-gray-600">Anterior: {fmt(previous.startDate)} — {fmt(previous.endDate)}</span>
      <span className="text-gray-400">•</span>
      <span className="text-gray-600">Atual: {fmt(current.startDate)} — {fmt(current.endDate)}</span>
    </div>
  );
}
