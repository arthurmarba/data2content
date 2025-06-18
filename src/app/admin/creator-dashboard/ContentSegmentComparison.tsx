'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { PlusIcon, TrashIcon, ExclamationTriangleIcon, TableCellsIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

// --- Tipos e Componentes ---

// Importações corrigidas para apontar para o novo ficheiro de tipos modularizado
import {
    ISegmentDefinition,
    ISegmentPerformanceResult,
} from '@/app/lib/dataService/marketAnalysis/types';

// A interface SegmentComparisonResultItem viria da sua API.
// Para este exemplo, definimo-la aqui para garantir que o componente é autónomo.
interface SegmentComparisonResultItem {
  name: string;
  criteria: ISegmentDefinition;
  performance: ISegmentPerformanceResult;
}

const EmptyState = ({ icon, title, message }: { icon: React.ReactNode; title: string; message: string; }) => {
  return (
    <div className="text-center py-8">
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400">
        {icon}
      </div>
      <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
};


// --- Constantes e Tipos Locais ---
const MAX_SEGMENTS = 5;
const MIN_SEGMENTS = 1;

interface SegmentToCompare {
  id: string;
  name?: string;
  criteria: ISegmentDefinition;
}

interface ContentSegmentComparisonProps {
  dateRangeFilter?: {
    startDate?: string;
    endDate?: string;
  };
}

const FORMAT_OPTIONS = ["", "Reel", "Post Estático", "Carrossel", "Story", "Video Longo"];
const PROPOSAL_OPTIONS = ["", "Educativo", "Humor", "Notícia", "Review", "Tutorial", "Desafio", "Vlog"];
const DEFAULT_CONTEXTS = [""];

// --- Funções Utilitárias ---
const formatDisplayNumber = (num?: number): string => {
  if (num === null || typeof num === 'undefined') return 'N/A';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2});
};

const formatDisplayPercentage = (num?: number): string => {
  if (num === null || typeof num === 'undefined') return 'N/A';
  return `${(num * 100).toFixed(1)}%`;
};

function generateSegmentNameFromCriteria(criteria: ISegmentDefinition): string {
    const parts: string[] = [];
    if (criteria.format) parts.push(criteria.format);
    if (criteria.proposal) parts.push(criteria.proposal);
    if (criteria.context) parts.push(criteria.context);
    if (parts.length === 0) return 'Geral';
    return parts.join(' / ');
}


// --- Componente Principal ---
export default function ContentSegmentComparison({ dateRangeFilter }: ContentSegmentComparisonProps) {
  const [segmentsToCompare, setSegmentsToCompare] = useState<SegmentToCompare[]>([
    { id: crypto.randomUUID(), criteria: {} },
  ]);
  const [comparisonResults, setComparisonResults] = useState<SegmentComparisonResultItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextOptions, setContextOptions] = useState<string[]>(DEFAULT_CONTEXTS);

  useEffect(() => {
    async function loadContexts() {
      try {
        const res = await fetch('/api/admin/dashboard/contexts');
        if (res.ok) {
          const data = await res.json();
          setContextOptions(['', ...data.contexts]);
        }
      } catch (e) {
        console.error('Failed to load contexts', e);
      }
    }
    loadContexts();
  }, []);

  const handleSegmentChange = (id: string, field: 'name' | keyof ISegmentDefinition, value: string) => {
    setSegmentsToCompare(prevSegments =>
      prevSegments.map(segment => {
        if (segment.id === id) {
          if (field === 'name') {
            return { ...segment, name: value || undefined };
          }
          return {
            ...segment,
            criteria: {
              ...segment.criteria,
              [field]: value || undefined,
            },
          };
        }
        return segment;
      })
    );
  };

  const addSegment = () => {
    if (segmentsToCompare.length < MAX_SEGMENTS) {
      setSegmentsToCompare(prev => [...prev, { id: crypto.randomUUID(), criteria: {} }]);
    }
  };

  const removeSegment = (id: string) => {
    if (segmentsToCompare.length > MIN_SEGMENTS) {
      setSegmentsToCompare(prev => prev.filter(segment => segment.id !== id));
    }
  };

  const isSegmentCriteriaEmpty = (criteria: ISegmentDefinition): boolean => {
    return !criteria.format && !criteria.proposal && !criteria.context;
  };

  const canCompare =
    segmentsToCompare.length >= MIN_SEGMENTS &&
    segmentsToCompare.every(seg => !isSegmentCriteriaEmpty(seg.criteria)) &&
    !!dateRangeFilter?.startDate && !!dateRangeFilter?.endDate;

  const handleFetchComparisonData = useCallback(async () => {
    if (!canCompare) {
        setError("Defina critérios para todos os segmentos e selecione um período de datas.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setComparisonResults(null);

    const segmentsPayload = segmentsToCompare.map(s => ({
      name: s.name,
      criteria: s.criteria,
    }));

    try {
      const response = await fetch('/api/admin/dashboard/content-segments/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRange: dateRangeFilter,
          segments: segmentsPayload,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Falha ao buscar dados.`);
      }
      const data: SegmentComparisonResultItem[] = await response.json();
      setComparisonResults(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [segmentsToCompare, dateRangeFilter, canCompare]);

  useEffect(() => {
    if (!dateRangeFilter?.startDate || !dateRangeFilter?.endDate) {
        setComparisonResults(null);
    }
  }, [dateRangeFilter]);

  const metricsForDisplay: { label: string; key: keyof ISegmentPerformanceResult; format: (val: any) => string, isNumeric?: boolean }[] = [
    { label: 'Nº de Posts', key: 'postCount', format: formatDisplayNumber, isNumeric: true },
    { label: 'Engaj. Médio', key: 'avgEngagementRate', format: formatDisplayPercentage, isNumeric: true },
    { label: 'Likes Médios', key: 'avgLikes', format: formatDisplayNumber, isNumeric: true },
    { label: 'Compart. Médios', key: 'avgShares', format: formatDisplayNumber, isNumeric: true },
    { label: 'Comentários Médios', key: 'avgComments', format: formatDisplayNumber, isNumeric: true },
  ];

  const findBestSegmentValue = (metricKey: keyof ISegmentPerformanceResult, results: SegmentComparisonResultItem[]): number | undefined => {
    if (!results || results.length === 0) return undefined;
    const values = results.map(r => r.performance[metricKey] as number).filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) return undefined;
    return Math.max(...values);
  };

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Comparador de Performance de Segmentos</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Defina e compare métricas de diferentes segmentos de conteúdo.</p>
      </div>

      <div className="space-y-3">
        {segmentsToCompare.map((segment, index) => (
          <div key={segment.id} className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg space-y-3 bg-white dark:bg-gray-700/30 shadow">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Segmento {index + 1}</h4>
              {segmentsToCompare.length > MIN_SEGMENTS && (
                <button onClick={() => removeSegment(segment.id)} className="p-1.5 rounded-md text-red-500 hover:bg-red-100" title="Remover Segmento">
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* CORREÇÃO: Formulário do segmento foi restaurado aqui */}
            <div>
                <label htmlFor={`segmentName-${segment.id}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400">Nome do Segmento (Opcional)</label>
                <input
                type="text"
                id={`segmentName-${segment.id}`}
                value={segment.name || ''}
                onChange={(e) => handleSegmentChange(segment.id, 'name', e.target.value)}
                placeholder={`Ex: Reels de Finanças`}
                className="mt-0.5 w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                <label htmlFor={`format-${segment.id}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400">Formato</label>
                <select
                    id={`format-${segment.id}`}
                    value={segment.criteria.format || ""}
                    onChange={(e) => handleSegmentChange(segment.id, 'format', e.target.value)}
                    className="mt-0.5 w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                    {FORMAT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt === "" ? "Qualquer Formato" : opt}</option>)}
                </select>
                </div>
                <div>
                <label htmlFor={`proposal-${segment.id}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400">Proposta</label>
                <select
                    id={`proposal-${segment.id}`}
                    value={segment.criteria.proposal || ""}
                    onChange={(e) => handleSegmentChange(segment.id, 'proposal', e.target.value)}
                    className="mt-0.5 w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                    {PROPOSAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt === "" ? "Qualquer Proposta" : opt}</option>)}
                </select>
                </div>
                <div>
                <label htmlFor={`context-${segment.id}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400">Contexto</label>
                <select
                    id={`context-${segment.id}`}
                    value={segment.criteria.context || ""}
                    onChange={(e) => handleSegmentChange(segment.id, 'context', e.target.value)}
                    className="mt-0.5 w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                    {contextOptions.map(opt => <option key={opt} value={opt}>{opt === "" ? "Qualquer Contexto" : opt}</option>)}
                </select>
                </div>
            </div>
            {isSegmentCriteriaEmpty(segment.criteria) && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center mt-1">
                <ExclamationTriangleIcon className="w-3 h-3 mr-1 inline-block" />
                Defina ao menos um critério para este segmento.
                </p>
            )}
          </div>
        ))}
      </div>
      
      <div className="flex items-center space-x-3">
        <button onClick={addSegment} disabled={segmentsToCompare.length >= MAX_SEGMENTS} className="flex items-center bg-white dark:bg-gray-700 text-indigo-600 border border-indigo-300 font-medium py-1.5 px-3 rounded-md text-sm hover:bg-indigo-50 disabled:opacity-50">
          <PlusIcon className="w-5 h-5 mr-1.5" /> Adicionar
        </button>
        <button onClick={handleFetchComparisonData} disabled={!canCompare || isLoading} className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 disabled:opacity-50">
          <ArrowsRightLeftIcon className="w-5 h-5 mr-2" /> {isLoading ? 'A comparar...' : 'Comparar Segmentos'}
        </button>
      </div>
      
      {/* Zona de Resultados */}
      <div className="mt-6">
        {isLoading && <p>A carregar resultados...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {comparisonResults && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-100 dark:bg-gray-700 z-10">Métrica</th>
                  {comparisonResults.map(result => (
                    <th key={result.name} className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {result.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200">
                {metricsForDisplay.map(metric => {
                  const bestVal = metric.isNumeric ? findBestSegmentValue(metric.key, comparisonResults) : undefined;
                  return (
                    <tr key={metric.key}>
                      <td className="px-3 py-2.5 text-sm font-medium text-gray-800 sticky left-0 bg-white dark:bg-gray-800 z-0">{metric.label}</td>
                      {comparisonResults.map(result => {
                        const rawVal = result.performance[metric.key];
                        const isBest = metric.isNumeric && rawVal === bestVal && bestVal !== 0;
                        return (
                          <td key={`${result.name}-${metric.key}`} className={`px-3 py-2.5 text-sm text-right ${isBest ? 'font-bold text-green-600' : 'text-gray-600'}`}>
                            {metric.format(rawVal)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
