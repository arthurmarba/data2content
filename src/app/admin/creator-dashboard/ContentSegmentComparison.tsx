'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { PlusIcon, TrashIcon, ExclamationTriangleIcon, TableCellsIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import EmptyState from './EmptyState'; // Import EmptyState
import {
    ISegmentDefinition,
    ISegmentPerformanceResult,
} from '@/app/lib/dataService/marketAnalysisService';
import { SegmentComparisonResultItem } from '@/app/api/admin/dashboard/content-segments/compare/route';

// --- Constants & Types ---
const MAX_SEGMENTS = 5;
const MIN_SEGMENTS = 1; // Can compare a single segment against overall, or require 2 for true comparison

interface SegmentToCompare {
  id: string; // Client-side unique ID
  name?: string;
  criteria: ISegmentDefinition;
}

interface ContentSegmentComparisonProps {
  dateRangeFilter?: { // From parent page (CreatorDashboardPage)
    startDate?: string;
    endDate?: string;
  };
  // refreshKey from parent can be added if this component needs to auto-refresh on global filter changes
}

// Options for criteria dropdowns - can be moved to a shared constants file
const FORMAT_OPTIONS = ["", "Reel", "Post Estático", "Carrossel", "Story", "Video Longo"];
const PROPOSAL_OPTIONS = ["", "Educativo", "Humor", "Notícia", "Review", "Tutorial", "Desafio", "Vlog"];
const CONTEXT_OPTIONS = ["", "Finanças", "Tecnologia", "Moda", "Saúde", "Educação", "Entretenimento", "Viagem", "Gastronomia"];


// Helper to format numbers - can be expanded
const formatDisplayNumber = (num?: number): string => {
  if (num === null || typeof num === 'undefined') return 'N/A';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2});
};

const formatDisplayPercentage = (num?: number): string => {
  if (num === null || typeof num === 'undefined') return 'N/A';
  return `${(num * 100).toFixed(1)}%`;
};
const getSafeDisplayString = (value: any, defaultValue: string = 'N/A'): string => {
    if (value === null || typeof value === 'undefined' || value === '') return defaultValue;
    return String(value);
};


export default function ContentSegmentComparison({ dateRangeFilter }: ContentSegmentComparisonProps) {
  const [segmentsToCompare, setSegmentsToCompare] = useState<SegmentToCompare[]>([
    { id: crypto.randomUUID(), criteria: { format: undefined, proposal: undefined, context: undefined } },
  ]);
  const [comparisonResults, setComparisonResults] = useState<SegmentComparisonResultItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSegmentChange = (id: string, field: 'name' | keyof ISegmentDefinition, value: string) => {
    setSegmentsToCompare(prevSegments =>
      prevSegments.map(segment => {
        if (segment.id === id) {
          if (field === 'name') {
            return { ...segment, name: value === '' ? undefined : value };
          }
          return {
            ...segment,
            criteria: {
              ...segment.criteria,
              [field]: value === '' ? undefined : value, // Store empty string as undefined for criteria
            },
          };
        }
        return segment;
      })
    );
  };

  const addSegment = () => {
    if (segmentsToCompare.length < MAX_SEGMENTS) {
      setSegmentsToCompare(prevSegments => [
        ...prevSegments,
        { id: crypto.randomUUID(), criteria: { format: undefined, proposal: undefined, context: undefined } },
      ]);
    }
  };

  const removeSegment = (id: string) => {
    if (segmentsToCompare.length > MIN_SEGMENTS) {
      setSegmentsToCompare(prevSegments => prevSegments.filter(segment => segment.id !== id));
    }
  };

  const isSegmentCriteriaEmpty = (criteria: ISegmentDefinition): boolean => {
    return !criteria.format && !criteria.proposal && !criteria.context;
  };

  const canCompare =
    segmentsToCompare.length >= MIN_SEGMENTS &&
    segmentsToCompare.every(seg => !isSegmentCriteriaEmpty(seg.criteria)) &&
    dateRangeFilter?.startDate && dateRangeFilter?.endDate;


  const handleFetchComparisonData = useCallback(async () => {
    if (!canCompare) {
        setError("Por favor, defina critérios para todos os segmentos e selecione um período de datas global.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setComparisonResults(null);

    const segmentsPayload = segmentsToCompare.map(s => ({
      name: s.name, // Name can be undefined, API will generate one
      criteria: { // Ensure criteria sent to API only contains actual values, not empty strings
          format: s.criteria.format || undefined,
          proposal: s.criteria.proposal || undefined,
          context: s.criteria.context || undefined,
      }
    }));

    try {
      const response = await fetch('/api/admin/dashboard/content-segments/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRange: dateRangeFilter, // Already validated by parent (CreatorDashboardPage)
          segments: segmentsPayload,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Falha ao buscar dados de comparação: ${response.statusText}`);
      }
      const data: SegmentComparisonResultItem[] = await response.json();
      setComparisonResults(data);
    } catch (e: any) {
      setError(e.message);
      setComparisonResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [segmentsToCompare, dateRangeFilter, canCompare]);

  // Effect to clear results if dateRangeFilter becomes incomplete
  useEffect(() => {
    if (!dateRangeFilter?.startDate || !dateRangeFilter?.endDate) {
        setComparisonResults(null); // Clear results if global date range is cleared
    }
  }, [dateRangeFilter]);


  // --- UI for Defining Segments ---
  const segmentDefinitionForms = segmentsToCompare.map((segment, index) => (
    <div key={segment.id} className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg space-y-3 bg-white dark:bg-gray-700/30 shadow">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Segmento {index + 1}</h4>
        {segmentsToCompare.length > MIN_SEGMENTS && (
          <button
            onClick={() => removeSegment(segment.id)}
            className="p-1.5 rounded-md text-red-500 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-800/50 dark:hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-400" // Icon Button Style (adjusted for red color)
            title="Remover Segmento"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>
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
            {CONTEXT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt === "" ? "Qualquer Contexto" : opt}</option>)}
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
  ));

  // --- UI for Displaying Results ---
  const metricsForDisplay: { label: string; key: keyof ISegmentPerformanceResult; format: (val: any) => string, isNumeric?: boolean }[] = [
    { label: 'Nº de Posts', key: 'postCount', format: formatDisplayNumber, isNumeric: true },
    { label: 'Taxa de Engaj. Média', key: 'avgEngagementRate', format: formatDisplayPercentage, isNumeric: true },
    { label: 'Likes Médios', key: 'avgLikes', format: formatDisplayNumber, isNumeric: true },
    { label: 'Compart. Médios', key: 'avgShares', format: formatDisplayNumber, isNumeric: true },
    { label: 'Comentários Médios', key: 'avgComments', format: formatDisplayNumber, isNumeric: true },
  ];

  const findBestSegmentValue = (metricKey: keyof ISegmentPerformanceResult, results: SegmentComparisonResultItem[]): number | undefined => {
    if (!results || results.length === 0) return undefined;
    const values = results.map(r => r.performance[metricKey] as number).filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) return undefined;
    return Math.max(...values); // Assuming higher is better for all these metrics
  };


  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-6">
      <div> {/* Added a div to group title and subtitle */}
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white"> {/* Changed from h2 to h3 for consistency under page's h2 */}
          Comparador de Performance de Segmentos de Conteúdo
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Defina até {MAX_SEGMENTS} segmentos de conteúdo (usando formato, proposta ou contexto) e compare suas métricas de performance lado a lado.
        </p>
      </div>

      {/* Segment Definition Area */}
      <div className="space-y-3">{segmentDefinitionForms}</div>

      <div className="flex items-center space-x-3">
        <button
          onClick={addSegment}
          disabled={segmentsToCompare.length >= MAX_SEGMENTS}
            className="flex items-center bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500 font-medium py-1.5 px-3 rounded-md shadow-sm text-sm hover:bg-indigo-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 dark:focus:ring-offset-gray-900 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
        >
          <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden="true" />
          Adicionar Segmento
        </button>
        <button
          onClick={handleFetchComparisonData}
          disabled={!canCompare || isLoading}
          className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed dark:disabled:bg-gray-600 dark:disabled:text-gray-400 text-sm"
        >
          <ArrowsRightLeftIcon className="w-5 h-5 mr-2" aria-hidden="true" /> {/* Added ArrowsRightLeftIcon */}
          {isLoading ? 'Comparando...' : 'Comparar Segmentos'}
        </button>
      </div>
      {(!dateRangeFilter?.startDate || !dateRangeFilter?.endDate) && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center">
            <ExclamationTriangleIcon className="w-4 h-4 mr-1.5 inline-block" />
            Por favor, selecione um período de datas nos filtros globais para habilitar a comparação.
          </p>
      )}


      {/* Results Area */}
      <div className="mt-6">
        {isLoading && (
          <div className="text-center py-8"><p className="text-gray-500 dark:text-gray-400">Carregando resultados da comparação...</p></div>
        )}
        {error && (
          <div className="text-center py-8"><p className="text-red-500 dark:text-red-400">Erro ao comparar segmentos: {error}</p></div>
        )}
        {!isLoading && !error && comparisonResults === null && !canCompare && segmentsToCompare.some(s => isSegmentCriteriaEmpty(s.criteria)) && (
             <div className="text-center py-8">
                <EmptyState
                    icon={<ExclamationTriangleIcon className="w-12 h-12" />}
                    title="Pronto para Comparar?"
                    message="Defina critérios para cada segmento que deseja analisar e clique em 'Comparar Segmentos'."
                />
             </div>
        )}
        {!isLoading && !error && comparisonResults && comparisonResults.length === 0 && (
          <div className="text-center py-8">
            <EmptyState
                icon={<TableCellsIcon className="w-12 h-12" />}
                title="Sem Dados para Comparação"
                message="Nenhum dos segmentos definidos retornou dados para o período selecionado. Verifique os critérios e o intervalo de datas."
            />
          </div>
        )}
        {!isLoading && !error && comparisonResults && comparisonResults.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border-collapse border border-gray-300 dark:border-gray-600">
              <thead className="bg-gray-100 dark:bg-gray-700/50 sticky top-0 z-0">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border border-gray-300 dark:border-gray-600 sticky left-0 bg-gray-100 dark:bg-gray-700/50 z-10">Métrica</th>
                  {comparisonResults.map(result => (
                    <th key={result.name} className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border border-gray-300 dark:border-gray-600 whitespace-normal break-words max-w-[150px]" title={result.name}>
                      <span className="block truncate">{result.name}</span>
                      <div className="text-xxs font-normal text-gray-400 dark:text-gray-500 normal-case truncate" title={generateSegmentNameFromCriteria(result.criteria)}>
                        {`(${generateSegmentNameFromCriteria(result.criteria)})`}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {metricsForDisplay.map(metric => {
                  const bestVal = metric.isNumeric ? findBestSegmentValue(metric.key, comparisonResults) : undefined;
                  return (
                    <tr key={metric.label} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 sticky left-0 bg-white dark:bg-gray-800 z-0 whitespace-nowrap">{metric.label}</td>
                      {comparisonResults.map(result => {
                        const rawVal = result.performance[metric.key];
                        const displayVal = metric.format(rawVal);
                        const isBest = metric.isNumeric && typeof rawVal === 'number' && rawVal === bestVal && bestVal !== 0; // Highlight non-zero bests
                        return (
                          <td key={`${result.name}-${metric.key}`} className={`px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 text-right whitespace-nowrap ${isBest ? 'font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-800/20' : ''}`}>
                            {displayVal}
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

// Helper to generate name from criteria for display in table header if needed
function generateSegmentNameFromCriteria(criteria: ISegmentDefinition): string {
    const parts: string[] = [];
    if (criteria.format) parts.push(criteria.format);
    if (criteria.proposal) parts.push(criteria.proposal);
    if (criteria.context) parts.push(criteria.context);
    if (parts.length === 0) return 'Geral';
    return parts.join(' / ');
}
