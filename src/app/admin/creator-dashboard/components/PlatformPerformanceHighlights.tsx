"use client";

import React, { useCallback, useMemo, memo } from 'react';
import useSWR from 'swr';
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useGlobalTimePeriod } from './filters/GlobalTimePeriodContext';
import { TrendingUp, Sparkles, CalendarDays } from 'lucide-react';
import { getPortugueseWeekdayName } from '@/utils/weekdays';
import HighlightCard from './HighlightCard';
// CORREÇÃO: Importa a função para traduzir os IDs de contexto.
import { commaSeparatedIdsToLabels } from '../../../lib/classification';
import FormatPerformanceRankingTable from './FormatPerformanceRankingTable';

interface PerformanceHighlightItem {
  name: string;
  metricName: string;
  value: number;
  valueFormatted: string;
  postsCount?: number;
  platformAverage?: number;
  platformAverageFormatted?: string;
  changePercentage?: number;
}

interface PerformanceSummaryResponse {
  topPerformingFormat: PerformanceHighlightItem | null;
  topPerformingContext: PerformanceHighlightItem | null;
  topPerformingProposal: PerformanceHighlightItem | null;
  topPerformingTone: PerformanceHighlightItem | null;
  topPerformingReference: PerformanceHighlightItem | null;
  bestDay: { dayOfWeek: number; average: number } | null;
  insightSummary: string;
}

interface FormatRankingResponse {
  chartData: Array<{ name: string; value: number; postsCount: number }>;
  metricUsed: string;
  groupBy: string;
}

interface PerformanceSummaryBatchResponse {
  summary: PerformanceSummaryResponse;
  formatRanking: FormatRankingResponse;
  timeDistribution?: {
    buckets: Array<{ dayOfWeek: number; hour: number; average: number; count: number }>;
    bestSlots: Array<{ dayOfWeek: number; hour: number; average: number; count: number }>;
    worstSlots: Array<{ dayOfWeek: number; hour: number; average: number; count: number }>;
    insightSummary?: string;
  };
}

interface PlatformPerformanceHighlightsProps {
  sectionTitle?: string;
  apiPrefix?: string;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
  summaryOverride?: PerformanceSummaryResponse | null;
  formatRankingOverride?: FormatRankingResponse['chartData'] | null;
  loadingOverride?: boolean;
  errorOverride?: string | null;
  disableFetch?: boolean;
}

function formatBestDay(slot: PerformanceSummaryResponse["bestDay"]): PerformanceHighlightItem | null {
  if (!slot) return null;
  const dayName = getPortugueseWeekdayName(slot.dayOfWeek);
  return {
    name: `🗓️ ${dayName}`,
    // Exibir claramente que o valor representa a média de interações
    metricName: "Interações (média)",
    value: slot.average,
    valueFormatted: slot.average.toFixed(1),
  };
}

const PlatformPerformanceHighlights: React.FC<PlatformPerformanceHighlightsProps> = ({
  sectionTitle = "Destaques de Performance da Plataforma",
  apiPrefix = '/api/admin',
  onlyActiveSubscribers = false,
  contextFilter,
  creatorContextFilter,
  summaryOverride,
  formatRankingOverride,
  loadingOverride,
  errorOverride,
  disableFetch = false,
}) => {
  const { timePeriod } = useGlobalTimePeriod();
  const hasOverride = Boolean(disableFetch)
    || typeof summaryOverride !== 'undefined'
    || typeof formatRankingOverride !== 'undefined'
    || typeof loadingOverride !== 'undefined'
    || typeof errorOverride !== 'undefined';
  const swrKey = useMemo(() => ([
    'performance-summary',
    apiPrefix,
    timePeriod,
    onlyActiveSubscribers,
    contextFilter,
    creatorContextFilter,
  ]), [apiPrefix, timePeriod, onlyActiveSubscribers, contextFilter, creatorContextFilter]);

  const fetcher = useCallback(async (): Promise<PerformanceSummaryBatchResponse> => {
    const params = new URLSearchParams({ timePeriod });
    if (onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');
    if (contextFilter) params.append('context', contextFilter);
    if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);
    const apiUrl = `${apiPrefix}/dashboard/highlights/performance-summary/batch?${params.toString()}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
    }
    return response.json() as Promise<PerformanceSummaryBatchResponse>;
  }, [timePeriod, apiPrefix, onlyActiveSubscribers, contextFilter, creatorContextFilter]);

  const { data, error, isLoading } = useSWR<PerformanceSummaryBatchResponse>(
    hasOverride ? null : swrKey,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 1000 },
  );
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;
  const resolvedError = hasOverride ? (errorOverride ?? null) : errorMessage;
  const resolvedLoading = hasOverride ? (loadingOverride ?? false) : isLoading;
  const rawSummary = hasOverride ? (summaryOverride ?? null) : data?.summary ?? null;
  const rawFormatRanking = hasOverride ? (formatRankingOverride ?? null) : data?.formatRanking?.chartData ?? null;
  const summary = resolvedError ? null : rawSummary;
  const formatRanking = resolvedError ? null : rawFormatRanking;
  const normalizeSummary = useCallback((value: PerformanceSummaryResponse | null) => {
    if (!value) return null;
    const normalize = (item: PerformanceHighlightItem | null, kind: 'context' | 'proposal' | 'tone' | 'reference') => {
      if (!item) return null;
      return {
        ...item,
        name: commaSeparatedIdsToLabels(item.name, kind) || item.name,
      };
    };
    return {
      ...value,
      topPerformingContext: normalize(value.topPerformingContext, 'context'),
      topPerformingProposal: normalize(value.topPerformingProposal, 'proposal'),
      topPerformingTone: normalize(value.topPerformingTone, 'tone'),
      topPerformingReference: normalize(value.topPerformingReference, 'reference'),
    };
  }, []);
  const normalizedSummary = useMemo(() => normalizeSummary(summary), [normalizeSummary, summary]);

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h3 className="text-md font-semibold text-gray-700 mb-2 sm:mb-0">{sectionTitle}</h3>
      </div>

      {resolvedLoading && <div className="text-center py-5"><p className="text-gray-500">Carregando destaques...</p></div>}
      {resolvedError && <div className="text-center py-5"><p className="text-red-500">Erro: {resolvedError}</p></div>}

      {!resolvedLoading && !resolvedError && normalizedSummary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
            <HighlightCard
              title="Melhor Formato (Plataforma)"
              highlight={normalizedSummary.topPerformingFormat}
              icon={<TrendingUp size={18} className="mr-2 text-green-500"/>}
              bgColorClass="bg-green-50"
              textColorClass="text-green-600"
            />
            <HighlightCard
              title="Contexto de Melhor Desempenho (Plataforma)"
              highlight={normalizedSummary.topPerformingContext}
              icon={<Sparkles size={18} className="mr-2 text-blue-500"/>}
              bgColorClass="bg-blue-50"
              textColorClass="text-blue-600"
            />
            <HighlightCard
              title="Melhor Proposta"
              highlight={normalizedSummary.topPerformingProposal}
              icon={<Sparkles size={18} className="mr-2 text-purple-500"/>}
              bgColorClass="bg-purple-50"
              textColorClass="text-purple-600"
            />
            <HighlightCard
              title="Melhor Tom"
              highlight={normalizedSummary.topPerformingTone}
              icon={<Sparkles size={18} className="mr-2 text-amber-500"/>}
              bgColorClass="bg-amber-50"
              textColorClass="text-amber-600"
            />
            <HighlightCard
              title="Melhor Referência"
              highlight={normalizedSummary.topPerformingReference}
              icon={<Sparkles size={18} className="mr-2 text-teal-500"/>}
              bgColorClass="bg-teal-50"
              textColorClass="text-teal-600"
            />
            <HighlightCard
              title="Melhor Dia"
              highlight={formatBestDay(normalizedSummary.bestDay)}
              icon={<CalendarDays size={18} className="mr-2 text-indigo-500"/>}
              bgColorClass="bg-indigo-50"
              textColorClass="text-indigo-600"
            />
        </div>
        {normalizedSummary.insightSummary && (
          <p className="text-xs text-gray-600 mt-4 pt-3 border-t border-gray-200 flex items-start">
            <LightBulbIcon className="w-4 h-4 text-yellow-500 mr-1 flex-shrink-0" />
            {normalizedSummary.insightSummary}
          </p>
        )}
        <div className="mt-6">
          <FormatPerformanceRankingTable
            apiPrefix={apiPrefix}
            dataOverride={formatRanking}
            loadingOverride={resolvedLoading}
            errorOverride={resolvedError}
            disableFetch={true}
          />
        </div>
      </>
    )}
       {!resolvedLoading && !resolvedError && !normalizedSummary && (
         <div className="text-center py-5"><p className="text-gray-500">Nenhum destaque de performance encontrado para a plataforma.</p></div>
      )}
    </div>
  );
};

export default memo(PlatformPerformanceHighlights);
