"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';
import { useGlobalTimePeriod } from './filters/GlobalTimePeriodContext';
import { TrendingUp, TrendingDown, Sparkles } from 'lucide-react'; // Ícones
import HighlightCard from './HighlightCard';

// Reutilizar as interfaces e componentes auxiliares
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
  lowPerformingFormat: PerformanceHighlightItem | null;
  topPerformingContext: PerformanceHighlightItem | null;
  insightSummary: string;
}

// TIME_PERIOD_OPTIONS não é mais necessário aqui, será controlado pelo pai
// const TIME_PERIOD_OPTIONS = [ ... ];


// Ícone de Informação (mantido como estava)
const InfoIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

interface PlatformPerformanceHighlightsProps {
  sectionTitle?: string;
}

const PlatformPerformanceHighlights: React.FC<PlatformPerformanceHighlightsProps> = ({
  sectionTitle = "Destaques de Performance da Plataforma"
}) => {
  const { timePeriod } = useGlobalTimePeriod();
  const [summary, setSummary] = useState<PerformanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // timePeriod vem do contexto global

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Usa timePeriod do contexto na URL da API
      const apiUrl = `/api/v1/platform/highlights/performance-summary?timePeriod=${timePeriod}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: PerformanceSummaryResponse = await response.json();
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [timePeriod]); // Adicionado timePeriod às dependências

  useEffect(() => {
    fetchData();
  }, [fetchData]); // fetchData já inclui timePeriod

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md"> {/* Removido mt-6 para ser controlado pelo grid pai */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h3 className="text-md font-semibold text-gray-700 mb-2 sm:mb-0">{sectionTitle}</h3>
        {/* Seletor de timePeriod removido */}
      </div>

      {loading && <div className="text-center py-5"><p className="text-gray-500">Carregando destaques...</p></div>}
      {error && <div className="text-center py-5"><p className="text-red-500">Erro: {error}</p></div>}

      {!loading && !error && summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <HighlightCard
              title="Melhor Formato (Plataforma)"
              highlight={summary.topPerformingFormat}
              icon={<TrendingUp size={18} className="mr-2 text-green-500"/>}
              bgColorClass="bg-green-50"
              textColorClass="text-green-600"
            />
            <HighlightCard
              title="Contexto Principal (Plataforma)"
              highlight={summary.topPerformingContext}
              icon={<Sparkles size={18} className="mr-2 text-blue-500"/>}
              bgColorClass="bg-blue-50"
              textColorClass="text-blue-600"
            />
            <HighlightCard
              title="Menor Performance (Formato, Plataforma)"
              highlight={summary.lowPerformingFormat}
              icon={<TrendingDown size={18} className="mr-2 text-red-500"/>}
              bgColorClass="bg-red-50"
              textColorClass="text-red-600"
            />
          </div>
          {summary.insightSummary && (
            <p className="text-xs text-gray-600 mt-4 pt-3 border-t border-gray-200">{summary.insightSummary}</p>
          )}
        </>
      )}
       {!loading && !error && !summary && (
         <div className="text-center py-5"><p className="text-gray-500">Nenhum destaque de performance encontrado para a plataforma.</p></div>
      )}
    </div>
  );
};

export default memo(PlatformPerformanceHighlights);

