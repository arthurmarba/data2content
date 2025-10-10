"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useGlobalTimePeriod } from './filters/GlobalTimePeriodContext';
import { TrendingUp, TrendingDown, Sparkles, CalendarDays } from 'lucide-react';
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

interface PlatformPerformanceHighlightsProps {
  sectionTitle?: string;
  apiPrefix?: string;
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
  apiPrefix = '/api/admin'
}) => {
  const { timePeriod } = useGlobalTimePeriod();
  const [summary, setSummary] = useState<PerformanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `${apiPrefix}/dashboard/highlights/performance-summary?timePeriod=${timePeriod}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: PerformanceSummaryResponse = await response.json();

      // CORREÇÃO APLICADA AQUI
      // Verifica se o campo 'topPerformingContext' existe e traduz seu nome
      // antes de salvar os dados no estado do componente.
      if (result.topPerformingContext) {
        result.topPerformingContext.name = commaSeparatedIdsToLabels(result.topPerformingContext.name, 'context') || result.topPerformingContext.name;
      }
      if (result.topPerformingProposal) {
        result.topPerformingProposal.name = commaSeparatedIdsToLabels(result.topPerformingProposal.name, 'proposal') || result.topPerformingProposal.name;
      }
      if (result.topPerformingTone) {
        result.topPerformingTone.name = commaSeparatedIdsToLabels(result.topPerformingTone.name, 'tone') || result.topPerformingTone.name;
      }
      if (result.topPerformingReference) {
        result.topPerformingReference.name = commaSeparatedIdsToLabels(result.topPerformingReference.name, 'reference') || result.topPerformingReference.name;
      }

      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [timePeriod, apiPrefix]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h3 className="text-md font-semibold text-gray-700 mb-2 sm:mb-0">{sectionTitle}</h3>
      </div>

      {loading && <div className="text-center py-5"><p className="text-gray-500">Carregando destaques...</p></div>}
      {error && <div className="text-center py-5"><p className="text-red-500">Erro: {error}</p></div>}

      {!loading && !error && summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
            <HighlightCard
              title="Melhor Formato (Plataforma)"
              highlight={summary.topPerformingFormat}
              icon={<TrendingUp size={18} className="mr-2 text-green-500"/>}
              bgColorClass="bg-green-50"
              textColorClass="text-green-600"
            />
            <HighlightCard
              title="Contexto de Melhor Desempenho (Plataforma)"
              highlight={summary.topPerformingContext}
              icon={<Sparkles size={18} className="mr-2 text-blue-500"/>}
              bgColorClass="bg-blue-50"
              textColorClass="text-blue-600"
            />
            <HighlightCard
              title="Melhor Proposta"
              highlight={summary.topPerformingProposal}
              icon={<Sparkles size={18} className="mr-2 text-purple-500"/>}
              bgColorClass="bg-purple-50"
              textColorClass="text-purple-600"
            />
            <HighlightCard
              title="Melhor Tom"
              highlight={summary.topPerformingTone}
              icon={<Sparkles size={18} className="mr-2 text-amber-500"/>}
              bgColorClass="bg-amber-50"
              textColorClass="text-amber-600"
            />
            <HighlightCard
              title="Melhor Referência"
              highlight={summary.topPerformingReference}
              icon={<Sparkles size={18} className="mr-2 text-teal-500"/>}
              bgColorClass="bg-teal-50"
              textColorClass="text-teal-600"
            />
            <HighlightCard
              title="Melhor Dia"
              highlight={formatBestDay(summary.bestDay)}
              icon={<CalendarDays size={18} className="mr-2 text-indigo-500"/>}
              bgColorClass="bg-indigo-50"
              textColorClass="text-indigo-600"
            />
        </div>
        {summary.insightSummary && (
          <p className="text-xs text-gray-600 mt-4 pt-3 border-t border-gray-200 flex items-start">
            <LightBulbIcon className="w-4 h-4 text-yellow-500 mr-1 flex-shrink-0" />
            {summary.insightSummary}
          </p>
        )}
        <div className="mt-6">
          <FormatPerformanceRankingTable apiPrefix={apiPrefix} />
        </div>
      </>
    )}
       {!loading && !error && !summary && (
         <div className="text-center py-5"><p className="text-gray-500">Nenhum destaque de performance encontrado para a plataforma.</p></div>
      )}
    </div>
  );
};

export default memo(PlatformPerformanceHighlights);
