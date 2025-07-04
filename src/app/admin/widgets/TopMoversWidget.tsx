'use client';

import React, { useState, useCallback, useEffect, memo } from 'react';
// import Image from 'next/image'; // Removido para compatibilidade
import { subDays, startOfDay, endOfDay, format } from 'date-fns';
import {
    ArrowUpIcon,
    ArrowDownIcon,
    ExclamationTriangleIcon,
    ChartBarIcon,
    ArrowsUpDownIcon,
    ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';

import SkeletonBlock from '../components/SkeletonBlock';
import EmptyState from '../components/EmptyState';

import {
    TopMoverEntityType,
    TopMoverMetric,
    TopMoverSortBy,
    ISegmentDefinition,
    ITopMoverResult,
    IPeriod
} from '@/app/lib/dataService/marketAnalysis/types';


// --- Componente de Gráfico de Tendência (Sparkline) ---
const TrendChart = memo(function TrendChart({ v1, v2 }: { v1: number, v2: number }) {
    const isIncrease = v2 > v1;
    const isDecrease = v2 < v1;
    const color = isIncrease ? 'stroke-green-500' : isDecrease ? 'stroke-red-500' : 'stroke-gray-400';
    
    const maxVal = Math.max(v1, v2);
    const minVal = Math.min(v1, v2);
    const range = maxVal - minVal;

    const y1 = range === 0 ? 10 : 18 - ((v1 - minVal) / range) * 16;
    const y2 = range === 0 ? 10 : 18 - ((v2 - minVal) / range) * 16;
    
    return (
        <svg viewBox="0 0 100 20" className="w-24 h-5" preserveAspectRatio="none">
            <line x1="5" y1={y1} x2="95" y2={y2} className={`${color} stroke-2`} strokeLinecap="round" />
            <circle cx="5" cy={y1} r="2" className={`${color} fill-current`} />
            <circle cx="95" cy={y2} r="2" className={`${color} fill-current`} />
        </svg>
    );
});


// --- Tipos e Opções para a UI ---

interface PeriodState {
    startDate: string;
    endDate: string;
}

const formatDateForInput = (date: Date): string => format(date, 'yyyy-MM-dd');

const initialPeriodState: PeriodState = { startDate: '', endDate: '' };

const ENTITY_TYPE_OPTIONS: { value: TopMoverEntityType; label: string; }[] = [
    { value: 'content', label: 'Conteúdo' },
    { value: 'creator', label: 'Criador' },
];

const METRIC_OPTIONS: { value: TopMoverMetric; label: string }[] = [
    { value: 'cumulativeViews', label: 'Visualizações' },
    { value: 'cumulativeLikes', label: 'Likes' },
    { value: 'cumulativeShares', label: 'Partilhas' },
    { value: 'cumulativeTotalInteractions', label: 'Interações' },
];

const SORT_BY_OPTIONS: { value: TopMoverSortBy; label: string }[] = [
    { value: 'absoluteChange_decrease', label: 'Maior Queda Absoluta' },
    { value: 'absoluteChange_increase', label: 'Maior Crescimento Absoluto' },
    { value: 'percentageChange_decrease', label: 'Maior Queda Percentual' },
    { value: 'percentageChange_increase', label: 'Maior Crescimento Percentual' },
];

const FORMAT_OPTIONS_TOP_MOVERS = ["", "Reel", "Post Estático", "Carrossel"];
const CONTEXT_OPTIONS_TOP_MOVERS = ["", "Finanças", "Tecnologia", "Moda"];

const formatDisplayNumberTM = (num?: number) => num?.toLocaleString('pt-BR') ?? 'N/A';
const formatDisplayPercentageTM = (num?: number | null) => num ? `${(num * 100).toFixed(1)}%` : 'N/A';


const TopMoversWidget = memo(function TopMoversWidget() {
  const [entityType, setEntityType] = useState<TopMoverEntityType>('content');
  const [metric, setMetric] = useState<TopMoverMetric>('cumulativeViews');
  const [previousPeriod, setPreviousPeriod] = useState<PeriodState>(initialPeriodState);
  const [currentPeriod, setCurrentPeriod] = useState<PeriodState>(initialPeriodState);
  const [topN, setTopN] = useState<number>(5);
  const [sortBy, setSortBy] = useState<TopMoverSortBy>('absoluteChange_increase');
  const [contentFilters, setContentFilters] = useState<ISegmentDefinition>({});
  
  const [results, setResults] = useState<ITopMoverResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleContentFilterChange = (field: keyof ISegmentDefinition, value: string) => {
    setContentFilters(prev => ({ ...prev, [field]: value === "" ? undefined : value }));
  };

  const handleSetPeriodPreset = useCallback((days: number) => {
    const today = endOfDay(new Date());
    const currentStartDate = startOfDay(subDays(today, days - 1));
    const previousEndDate = endOfDay(subDays(currentStartDate, 1));
    const previousStartDate = startOfDay(subDays(previousEndDate, days - 1));

    setCurrentPeriod({
        startDate: formatDateForInput(currentStartDate),
        endDate: formatDateForInput(today),
    });
    setPreviousPeriod({
        startDate: formatDateForInput(previousStartDate),
        endDate: formatDateForInput(previousEndDate),
    });
    setValidationError(null);
  }, []);

  useEffect(() => {
    handleSetPeriodPreset(7);
  }, [handleSetPeriodPreset]);


  const validatePeriods = useCallback((): boolean => {
    if (!previousPeriod.startDate || !previousPeriod.endDate || !currentPeriod.startDate || !currentPeriod.endDate) {
      setValidationError("Todos os campos de data são obrigatórios.");
      return false;
    }
    const prevStart = new Date(previousPeriod.startDate);
    const prevEnd = new Date(previousPeriod.endDate);
    const currStart = new Date(currentPeriod.startDate);
    const currEnd = new Date(currentPeriod.endDate);

    if (prevStart > prevEnd || currStart > currEnd) {
      setValidationError("A data de início não pode ser posterior à de fim.");
      return false;
    }
    if (prevEnd >= currStart) {
      setValidationError("O período anterior deve terminar antes do início do atual.");
      return false;
    }
    setValidationError(null);
    return true;
  }, [previousPeriod, currentPeriod]);

  const handleFetchTopMovers = useCallback(async () => {
    if (!validatePeriods()) return;
    
    setIsLoading(true);
    setError(null);
    setResults(null);
    
    const apiPayload = {
      entityType, metric, topN, sortBy,
      previousPeriod: { startDate: new Date(previousPeriod.startDate), endDate: new Date(previousPeriod.endDate) },
      currentPeriod: { startDate: new Date(currentPeriod.startDate), endDate: new Date(currentPeriod.endDate) },
      contentFilters: Object.keys(contentFilters).length > 0 ? contentFilters : undefined,
    };

    try {
      await new Promise(res => setTimeout(res, 1000));
      const mockResults: ITopMoverResult[] = Array.from({ length: topN }).map((_, i) => ({
          entityId: `id_${i}`,
          entityName: `${entityType === 'content' ? 'Post sobre Vendas' : 'Criador'} ${i + 1}`,
          metricName: metric,
          previousValue: 10000 - (i * 1500),
          currentValue: 10000 - (i * 1500) + (Math.random() - 0.4) * 5000,
          absoluteChange: 0,
          percentageChange: 0,
          profilePictureUrl: entityType === 'creator' ? `https://i.pravatar.cc/40?u=${i}` : undefined,
      })).map(item => {
          item.absoluteChange = item.currentValue - item.previousValue;
          // --- INÍCIO DA CORREÇÃO ---
          // O erro de tipo ocorria aqui. `percentageChange` espera um `number`, mas `null` era fornecido.
          // Alterado para `0` para casos de divisão por zero, garantindo a compatibilidade de tipo.
          item.percentageChange = item.previousValue !== 0 ? item.absoluteChange / item.previousValue : 0;
          // --- FIM DA CORREÇÃO ---
          return item;
      }).sort((a, b) => {
          if (sortBy.includes('decrease')) return a.absoluteChange - b.absoluteChange;
          return b.absoluteChange - a.absoluteChange;
      });

      setResults(mockResults);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [entityType, metric, previousPeriod, currentPeriod, topN, sortBy, contentFilters, validatePeriods]);

  useEffect(() => {
    validatePeriods();
  }, [validatePeriods]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">
          {`Top Movers – ${ENTITY_TYPE_OPTIONS.find(e => e.value === entityType)?.label} por ${METRIC_OPTIONS.find(m => m.value === metric)?.label} (${SORT_BY_OPTIONS.find(s => s.value === sortBy)?.label})`}
        </h3>
        <p className="text-sm text-gray-500 mt-1">Identifique as maiores variações de performance entre dois períodos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div><label htmlFor="tm-entityType" className="block text-xs font-medium text-gray-600 mb-1">Entidade</label><select id="tm-entityType" value={entityType} onChange={(e) => setEntityType(e.target.value as TopMoverEntityType)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md h-[38px]"><option value="content">Conteúdo</option><option value="creator">Criador</option></select></div>
        <div><label htmlFor="tm-metric" className="block text-xs font-medium text-gray-600 mb-1">Métrica</label><select id="tm-metric" value={metric} onChange={(e) => setMetric(e.target.value as TopMoverMetric)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md h-[38px]">{METRIC_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
        <div><label htmlFor="tm-sortBy" className="block text-xs font-medium text-gray-600 mb-1">Ordenar Por</label><select id="tm-sortBy" value={sortBy} onChange={(e) => setSortBy(e.target.value as TopMoverSortBy)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md h-[38px]">{SORT_BY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
        <div><label htmlFor="tm-topN" className="block text-xs font-medium text-gray-600 mb-1">Top N</label><input type="number" id="tm-topN" value={topN} onChange={(e) => setTopN(parseInt(e.target.value, 10) || 5)} min="1" max="20" className="w-full px-3 py-1.5 border border-gray-300 rounded-md h-[38px]"/></div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4 mt-4">
        <span className="text-sm font-medium text-gray-600">Períodos Rápidos:</span>
        <button onClick={() => handleSetPeriodPreset(7)} className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-full">Últimos 7 dias</button>
        <button onClick={() => handleSetPeriodPreset(14)} className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-full">Últimos 14 dias</button>
        <button onClick={() => handleSetPeriodPreset(30)} className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-full">Últimos 30 dias</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <fieldset className="border p-3 rounded-md">
            <legend className="text-xs font-medium text-gray-500 px-1">Período Anterior</legend>
            <div className="flex gap-2">
                <input type="date" value={previousPeriod.startDate} onChange={e => setPreviousPeriod(p => ({...p, startDate: e.target.value}))} className="w-full text-sm p-1.5 border-gray-300 rounded-md"/>
                <input type="date" value={previousPeriod.endDate} onChange={e => setPreviousPeriod(p => ({...p, endDate: e.target.value}))} className="w-full text-sm p-1.5 border-gray-300 rounded-md"/>
            </div>
        </fieldset>
        <fieldset className="border p-3 rounded-md">
            <legend className="text-xs font-medium text-gray-500 px-1">Período Atual</legend>
            <div className="flex gap-2">
                <input type="date" value={currentPeriod.startDate} onChange={e => setCurrentPeriod(p => ({...p, startDate: e.target.value}))} className="w-full text-sm p-1.5 border-gray-300 rounded-md"/>
                <input type="date" value={currentPeriod.endDate} onChange={e => setCurrentPeriod(p => ({...p, endDate: e.target.value}))} className="w-full text-sm p-1.5 border-gray-300 rounded-md"/>
            </div>
        </fieldset>
      </div>
      
      <div className="mt-4">
        <button onClick={handleFetchTopMovers} disabled={isLoading || !!validationError} className="flex items-center justify-center px-5 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 disabled:opacity-50">
            <ArrowTrendingUpIcon className="w-5 h-5 mr-2" />
            {isLoading ? 'A analisar...' : 'Analisar Top Movers'}
        </button>
        {validationError && <p className="text-xs text-red-500 mt-2 flex items-center"><ExclamationTriangleIcon className="w-4 h-4 mr-1.5"/> {validationError}</p>}
      </div>

      <div className="mt-6">
        {isLoading ? ( <SkeletonBlock height="h-48" /> ) : 
         error ? ( <EmptyState icon={<ExclamationTriangleIcon className="w-12 h-12 text-red-400"/>} title="Erro ao Analisar" message={error} /> ) : 
         !results ? ( <EmptyState icon={<ChartBarIcon className="w-12 h-12"/>} title="Analisar Top Movers" message="Configure os períodos e clique em 'Analisar'." /> ) : 
         results.length === 0 ? ( <EmptyState icon={<ArrowsUpDownIcon className="w-12 h-12"/>} title="Nenhum 'Mover' Encontrado" message="Não foram encontradas variações com os filtros selecionados." /> ) : 
        (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Entidade</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Val. Anterior</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Val. Atual</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Mud. Absoluta</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Mud. (%)</th>
                  {/* OTIMIZAÇÃO: Nova coluna para o gráfico de tendência */}
                  <th className="px-3 py-2 text-center font-medium text-gray-500 uppercase">Tendência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map(item => (
                  <tr key={item.entityId}>
                    <td className="px-3 py-2 font-medium text-gray-800">
                      <div className="flex items-center">
                        {entityType === 'creator' && item.profilePictureUrl && (
                          <img src={item.profilePictureUrl} alt={item.entityName} width="24" height="24" className="h-6 w-6 rounded-full mr-2 object-cover" />
                        )}
                        <span title={item.entityName}>{item.entityName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">{formatDisplayNumberTM(item.previousValue)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{formatDisplayNumberTM(item.currentValue)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${item.absoluteChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.absoluteChange > 0 ? '▲' : '▼'} {formatDisplayNumberTM(item.absoluteChange)}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${item.percentageChange && item.percentageChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatDisplayPercentageTM(item.percentageChange)}
                    </td>
                    {/* OTIMIZAÇÃO: Célula que renderiza o gráfico de tendência */}
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
    </div>
  );
});

export default TopMoversWidget;
