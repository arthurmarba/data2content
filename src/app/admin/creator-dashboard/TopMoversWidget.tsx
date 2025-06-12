'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
    ArrowUpIcon,
    ArrowDownIcon,
    ExclamationTriangleIcon,
    ChartBarIcon,
    ArrowsUpDownIcon,
    ChartTrendingUpIcon // For Analyze button
} from '@heroicons/react/24/outline';

import EmptyState from './EmptyState';
import SkeletonBlock from './SkeletonBlock';

import {
    TopMoverEntityType,
    TopMoverMetric,
    TopMoverSortBy,
    ISegmentDefinition, // For contentFilters
    ITopMoverResult,
    // IFetchTopMoversArgs, // For constructing payload
    // IPeriod, // For period state
} from '@/app/lib/dataService/marketAnalysisService'; // Assuming these are exported

// --- Types and Options for UI ---

interface PeriodState {
    startDate: string; // Store as string for input type="date"
    endDate: string;
}

const initialPeriodState: PeriodState = { startDate: '', endDate: '' };

const ENTITY_TYPE_OPTIONS: { value: TopMoverEntityType; label: string; disabled?: boolean }[] = [
    { value: 'content', label: 'Conteúdo' },
    { value: 'creator', label: 'Criador' }, // Removed disabled: true
];

const METRIC_OPTIONS: { value: TopMoverMetric; label: string }[] = [
    { value: 'cumulative_views', label: 'Visualizações Acumuladas' },
    { value: 'cumulative_likes', label: 'Likes Acumulados' },
    { value: 'cumulative_shares', label: 'Compartilhamentos Acumulados' },
    { value: 'cumulative_comments', label: 'Comentários Acumulados' },
    { value: 'cumulative_saves', label: 'Salvamentos Acumulados' },
    { value: 'cumulative_reach', label: 'Alcance Acumulado' },
    { value: 'cumulative_impressions', label: 'Impressões Acumuladas' },
    { value: 'cumulative_total_interactions', label: 'Interações Totais Acumuladas' },
];

const SORT_BY_OPTIONS: { value: TopMoverSortBy; label: string }[] = [
    { value: 'absoluteChange_decrease', label: 'Maior Queda Absoluta' },
    { value: 'absoluteChange_increase', label: 'Maior Crescimento Absoluto' },
    { value: 'percentageChange_decrease', label: 'Maior Queda Percentual' },
    { value: 'percentageChange_increase', label: 'Maior Crescimento Percentual' },
];

// Simplified content filter options for now
const FORMAT_OPTIONS_TOP_MOVERS = ["", "Reel", "Post Estático", "Carrossel", "Story", "Video Longo"];
const CONTEXT_OPTIONS_TOP_MOVERS = ["", "Finanças", "Tecnologia", "Moda", "Saúde", "Educação", "Entretenimento"];


// --- Helper Functions ---
const formatDisplayNumberTM = (num?: number, decimals = 0): string => {
  if (num === null || typeof num === 'undefined') return 'N/A';
  return num.toLocaleString('pt-BR', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
};

const formatDisplayPercentageTM = (num?: number | null): string => {
  if (num === null || typeof num === 'undefined') return 'N/A';
  return `${(num * 100).toFixed(1)}%`;
};


export default function TopMoversWidget() { // Already memoized in a previous step, no React.memo needed here directly
  const [entityType, setEntityType] = useState<TopMoverEntityType>('content');
  const [metric, setMetric] = useState<TopMoverMetric>('cumulative_views');
  const [previousPeriod, setPreviousPeriod] = useState<PeriodState>(initialPeriodState);
  const [currentPeriod, setCurrentPeriod] = useState<PeriodState>(initialPeriodState);
  const [topN, setTopN] = useState<number>(10);
  const [sortBy, setSortBy] = useState<TopMoverSortBy>('absoluteChange_decrease');

  const [contentFilters, setContentFilters] = useState<ISegmentDefinition>({});
  // creatorFilters state can be added here if UI is built for them. For now, it's passed as undefined.

  const [results, setResults] = useState<ITopMoverResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleContentFilterChange = (field: keyof ISegmentDefinition, value: string) => {
    setContentFilters(prev => ({ ...prev, [field]: value === "" ? undefined : value }));
  };

  const validatePeriods = (): boolean => {
    if (!previousPeriod.startDate || !previousPeriod.endDate || !currentPeriod.startDate || !currentPeriod.endDate) {
      setValidationError("Todos os campos de data são obrigatórios.");
      return false;
    }
    const prevStart = new Date(previousPeriod.startDate);
    const prevEnd = new Date(previousPeriod.endDate);
    const currStart = new Date(currentPeriod.startDate);
    const currEnd = new Date(currentPeriod.endDate);

    if (prevStart > prevEnd) {
      setValidationError("Período Anterior: Data de início não pode ser posterior à data de fim.");
      return false;
    }
    if (currStart > currEnd) {
      setValidationError("Período Atual: Data de início não pode ser posterior à data de fim.");
      return false;
    }
    if (prevEnd >= currStart) {
      setValidationError("O período anterior deve terminar antes do início do período atual.");
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleFetchTopMovers = useCallback(async () => {
    if (!validatePeriods()) {
      return;
    }
    // Removed client-side block for entityType === 'creator'
    // if (entityType === 'creator') {
    //     setError("A análise de Top Movers para 'Criador' ainda não está implementada.");
    //     setResults(null);
    //     return;
    // }

    setIsLoading(true);
    setError(null);
    setResults(null);

    const apiPayload: any = { // Using 'any' temporarily for flexibility before stricter typing
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
      // apiPayload.creatorFilters = {}; // Send empty object or undefined if no UI for these yet
      apiPayload.creatorFilters = undefined;
    }


    try {
      const response = await fetch('/api/admin/dashboard/top-movers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Falha ao buscar Top Movers: ${response.statusText}`);
      }
      const data: ITopMoverResult[] = await response.json();
      setResults(data);
    } catch (e: any) {
      setError(e.message);
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [entityType, metric, previousPeriod, currentPeriod, topN, sortBy, contentFilters]);

  // Clear validation error when inputs change
  useEffect(() => {
    if (validationError) validatePeriods();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousPeriod, currentPeriod]);


  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-6">
      <div> {/* Wrapper for title and subtitle */}
        <div className="flex items-center space-x-2">
          <ChartBarIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> {/* Slightly smaller icon */}
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white"> {/* Changed from h2 to h3 */}
            Top Movers ({ENTITY_TYPE_OPTIONS.find(e=>e.value === entityType)?.label})
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-7"> {/* Aligned with title text */}
          Identifique conteúdos ou criadores com as maiores variações de performance entre dois períodos.
        </p>
      </div>

      {/* --- Parameter Selection UI --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
        {/* Entity Type */}
        <div>
          <label htmlFor="tm-entityType" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Entidade</label>
          <select
            id="tm-entityType"
            value={entityType}
            onChange={(e) => {
                setEntityType(e.target.value as TopMoverEntityType);
                setResults(null); setError(null); // Clear results on entity change
            }}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 h-[38px]"
          >
            {ENTITY_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>)}
          </select>
        </div>

        {/* Metric */}
        <div>
          <label htmlFor="tm-metric" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Métrica</label>
          <select
            id="tm-metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as TopMoverMetric)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 h-[38px]"
          >
            {METRIC_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>

        {/* Sort By */}
        <div>
          <label htmlFor="tm-sortBy" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Ordenar Por</label>
          <select
            id="tm-sortBy"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as TopMoverSortBy)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 h-[38px]"
          >
            {SORT_BY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>

        {/* Top N */}
        <div>
          <label htmlFor="tm-topN" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Top N</label>
          <input
            type="number"
            id="tm-topN"
            value={topN}
            onChange={(e) => setTopN(Math.max(1, parseInt(e.target.value, 10) || 1))} // Ensure positive integer
            min="1" max="50"
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 h-[38px]"
          />
        </div>
      </div>

      {/* Date Pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
        <fieldset className="border p-2 rounded-md border-gray-300 dark:border-gray-600">
            <legend className="text-xs font-medium text-gray-500 dark:text-gray-400 px-1">Período Anterior</legend>
            <div className="space-y-2">
                <div>
                    <label htmlFor="tm-prevStart" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-0.5">Início</label>
                    <input type="date" id="tm-prevStart" value={previousPeriod.startDate} onChange={e => setPreviousPeriod(p => ({...p, startDate: e.target.value}))} className="w-full text-xs p-1.5 border-gray-300 dark:border-gray-500 rounded-md h-[34px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"/>
                </div>
                <div>
                    <label htmlFor="tm-prevEnd" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-0.5">Fim</label>
                    <input type="date" id="tm-prevEnd" value={previousPeriod.endDate} onChange={e => setPreviousPeriod(p => ({...p, endDate: e.target.value}))} className="w-full text-xs p-1.5 border-gray-300 dark:border-gray-500 rounded-md h-[34px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"/>
                </div>
            </div>
        </fieldset>
        <fieldset className="border p-2 rounded-md border-gray-300 dark:border-gray-600">
            <legend className="text-xs font-medium text-gray-500 dark:text-gray-400 px-1">Período Atual</legend>
            <div className="space-y-2">
                <div>
                    <label htmlFor="tm-currStart" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-0.5">Início</label>
                    <input type="date" id="tm-currStart" value={currentPeriod.startDate} onChange={e => setCurrentPeriod(p => ({...p, startDate: e.target.value}))} className="w-full text-xs p-1.5 border-gray-300 dark:border-gray-500 rounded-md h-[34px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"/>
                </div>
                <div>
                    <label htmlFor="tm-currEnd" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-0.5">Fim</label>
                    <input type="date" id="tm-currEnd" value={currentPeriod.endDate} onChange={e => setCurrentPeriod(p => ({...p, endDate: e.target.value}))} className="w-full text-xs p-1.5 border-gray-300 dark:border-gray-500 rounded-md h-[34px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"/>
                </div>
            </div>
        </fieldset>

        {/* Content Filters (Simplified for now) */}
        {entityType === 'content' && (
          <>
            <div>
              <label htmlFor="tm-contentFormat" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Formato (Conteúdo)</label>
              <select id="tm-contentFormat" value={contentFilters.format || ""} onChange={e => handleContentFilterChange('format', e.target.value)} className="w-full px-3 py-1.5 border-gray-300 dark:border-gray-500 rounded-md h-[38px] sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                {FORMAT_OPTIONS_TOP_MOVERS.map(f => <option key={f} value={f}>{f === "" ? "Todos Formatos" : f}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tm-contentContext" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Contexto (Conteúdo)</label>
              <select id="tm-contentContext" value={contentFilters.context || ""} onChange={e => handleContentFilterChange('context', e.target.value)} className="w-full px-3 py-1.5 border-gray-300 dark:border-gray-500 rounded-md h-[38px] sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                {CONTEXT_OPTIONS_TOP_MOVERS.map(c => <option key={c} value={c}>{c === "" ? "Todos Contextos" : c}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Action Button & Validation Error */}
      <div className="mt-4 flex flex-col items-start">
        <button
            onClick={handleFetchTopMovers}
            disabled={isLoading || !!validationError}
            className="flex items-center justify-center px-5 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed dark:disabled:bg-gray-600 dark:disabled:text-gray-400 text-sm"
        >
            <ChartTrendingUpIcon className="w-5 h-5 mr-2" aria-hidden="true" />
            {isLoading ? 'Analisando...' : `Analisar Top ${entityType === 'content' ? 'Conteúdos' : 'Criadores'}`}
        </button>
        {validationError && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-2 flex items-center">
                <ExclamationTriangleIcon className="w-4 h-4 mr-1.5"/> {validationError}
            </p>
        )}
      </div>

      {/* --- Results Display Area --- */}
      <div className="mt-6">
        {isLoading && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  {/* Skeleton Headers */}
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider"><SkeletonBlock width="w-24" height="h-3"/></th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider"><SkeletonBlock width="w-20" height="h-3" className="ml-auto"/></th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider"><SkeletonBlock width="w-20" height="h-3" className="ml-auto"/></th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider"><SkeletonBlock width="w-24" height="h-3" className="ml-auto"/></th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider"><SkeletonBlock width="w-20" height="h-3" className="ml-auto"/></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {Array.from({ length: Math.min(topN, 5) }).map((_, index) => ( // Show up to 5 skeleton rows or topN
                  <tr key={`skel-mover-${index}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        <SkeletonBlock variant="circle" width="w-6" height="h-6" />
                        <SkeletonBlock width="w-32" height="h-3" className="ml-2" />
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right"><SkeletonBlock width="w-16" height="h-3" className="ml-auto"/></td>
                    <td className="px-3 py-2 whitespace-nowrap text-right"><SkeletonBlock width="w-16" height="h-3" className="ml-auto"/></td>
                    <td className="px-3 py-2 whitespace-nowrap text-right"><SkeletonBlock width="w-12" height="h-3" className="ml-auto"/></td>
                    <td className="px-3 py-2 whitespace-nowrap text-right"><SkeletonBlock width="w-12" height="h-3" className="ml-auto"/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error && (
          <div className="text-center py-8"><p className="text-red-600 dark:text-red-400">Erro ao buscar dados: {error}</p></div>
        )}
        {!isLoading && !error && results === null && !validationError && (
             <div className="text-center py-8"> {/* Keep initial prompt simple, or use EmptyState if preferred */}
                <EmptyState
                    icon={<ChartBarIcon className="w-12 h-12"/>}
                    title="Analisar Top Movers"
                    message="Configure os parâmetros acima e clique em 'Analisar' para ver os conteúdos ou criadores com maiores variações de performance."
                />
             </div>
        )}
        {!isLoading && !error && results && results.length === 0 && (
          <div className="text-center py-8">
            <EmptyState
                icon={<ArrowsUpDownIcon className="w-12 h-12"/>}
                title="Nenhum 'Mover' Encontrado"
                message={`Não foram encontrados ${entityType === 'content' ? 'conteúdos' : 'criadores'} com variações significativas nos períodos e com os filtros selecionados. Tente ajustar os parâmetros.`}
            />
          </div>
        )}
        {!isLoading && !error && results && results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{entityType === 'content' ? 'Conteúdo' : 'Criador'}</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider truncate" title={`Valor Anterior (${METRIC_OPTIONS.find(m=>m.value === metric)?.label})`}>Val. Anterior</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Val. Atual</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Mud. Absoluta</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Mud. (%)</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {results.map((item) => (
                  <tr key={item.entityId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800 dark:text-gray-100">
                      <div className="flex items-center">
                        {entityType === 'creator' && item.profilePictureUrl && (
                          <Image src={item.profilePictureUrl} alt={item.entityName} width={24} height={24} className="h-6 w-6 rounded-full mr-2 object-cover" />
                        )}
                        {entityType === 'creator' && !item.profilePictureUrl && (
                           <div className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-600 mr-2 flex items-center justify-center text-xs">
                                {item.entityName?.substring(0,1).toUpperCase()}
                           </div>
                        )}
                        <span className="truncate max-w-[150px] sm:max-w-[200px]" title={item.entityName}>{item.entityName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-gray-500 dark:text-gray-400">{formatDisplayNumberTM(item.previousValue)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-gray-500 dark:text-gray-400">{formatDisplayNumberTM(item.currentValue)}</td>
                    <td className={`px-3 py-2 whitespace-nowrap text-right font-semibold ${item.absoluteChange > 0 ? 'text-green-600 dark:text-green-400' : item.absoluteChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {item.absoluteChange > 0 && <ArrowUpIcon className="h-3 w-3 inline mr-0.5 align-text-bottom" />}
                      {item.absoluteChange < 0 && <ArrowDownIcon className="h-3 w-3 inline mr-0.5 align-text-bottom" />}
                      {formatDisplayNumberTM(item.absoluteChange)}
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap text-right font-semibold ${item.percentageChange !== null && item.percentageChange > 0 ? 'text-green-600 dark:text-green-400' : item.percentageChange !== null && item.percentageChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {item.percentageChange !== null && item.percentageChange > 0 && <ArrowUpIcon className="h-3 w-3 inline mr-0.5 align-text-bottom" />}
                      {item.percentageChange !== null && item.percentageChange < 0 && <ArrowDownIcon className="h-3 w-3 inline mr-0.5 align-text-bottom" />}
                      {formatDisplayPercentageTM(item.percentageChange)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
