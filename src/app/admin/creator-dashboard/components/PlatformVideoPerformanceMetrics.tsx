"use client";

import React, { useState, useEffect, useCallback } from 'react';

// Reutilizar as interfaces e componentes auxiliares
interface VideoMetricsData {
  averageRetentionRate: number | null;
  averageWatchTimeSeconds: number | null;
  numberOfVideoPosts: number | null;
}

interface VideoMetricsResponse extends VideoMetricsData {
  insightSummary?: string;
}

// TIME_PERIOD_OPTIONS não é mais necessário aqui
// const TIME_PERIOD_OPTIONS = [ ... ];

// Sub-componente para exibir cada métrica individualmente
const MetricDisplay: React.FC<{label: string, value: string | number | null, unit?: string, tooltip?: string}> = ({ label, value, unit, tooltip }) => (
  <div className="p-3 bg-gray-50 rounded-lg text-center">
    <div className="text-xs text-gray-500 mb-1 relative group">
      {label}
      {tooltip && (
        <>
          <InfoIcon className="inline-block ml-1 h-3 w-3 text-gray-400" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 w-max max-w-xs p-1.5 text-xs text-white bg-gray-600 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
            {tooltip}
          </div>
        </>
      )}
    </div>
    <div className="text-xl font-bold text-indigo-600">
      {value !== null && value !== undefined ? `${value.toLocaleString()}${unit || ''}` : '-'}
    </div>
  </div>
);

// Ícone de Informação
const InfoIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

interface PlatformVideoPerformanceMetricsProps {
  timePeriod: string; // Recebido do pai (page.tsx)
  chartTitle?: string;
}

const PlatformVideoPerformanceMetrics: React.FC<PlatformVideoPerformanceMetricsProps> = ({
  timePeriod, // Prop vinda da página principal
  chartTitle = "Performance de Vídeos da Plataforma"
}) => {
  const [metrics, setMetrics] = useState<VideoMetricsData | null>(null);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // timePeriod não é mais um estado local

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Usa timePeriod da prop na URL da API
      const apiUrl = `/api/v1/platform/performance/video-metrics?timePeriod=${timePeriod}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: VideoMetricsResponse = await response.json();
      setMetrics({
        averageRetentionRate: result.averageRetentionRate,
        averageWatchTimeSeconds: result.averageWatchTimeSeconds,
        numberOfVideoPosts: result.numberOfVideoPosts,
      });
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
      setMetrics(null);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [timePeriod]); // Adicionado timePeriod às dependências

  useEffect(() => {
    fetchData();
  }, [fetchData]); // fetchData já inclui timePeriod

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6 md:mt-0">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h3 className="text-md font-semibold text-gray-700 mb-2 sm:mb-0">{chartTitle}</h3>
        {/* Seletor de timePeriod removido */}
      </div>

      {loading && <div className="text-center py-5"><p className="text-gray-500">Carregando métricas de vídeo...</p></div>}
      {error && <div className="text-center py-5"><p className="text-red-500">Erro: {error}</p></div>}

      {!loading && !error && metrics && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricDisplay
                label="Retenção Média (Plataforma)"
                value={metrics.averageRetentionRate !== null ? (metrics.averageRetentionRate).toFixed(1) : null}
                unit="%"
                tooltip="Média da porcentagem de vídeo que os espectadores assistem em toda a plataforma."
            />
            <MetricDisplay
                label="Tempo Médio de Visualização (Plataforma)"
                value={metrics.averageWatchTimeSeconds !== null ? metrics.averageWatchTimeSeconds.toFixed(0) : null}
                unit="s"
                tooltip="Tempo médio que os espectadores passam assistindo a cada vídeo na plataforma."
            />
            <MetricDisplay
                label="Total de Vídeos Analisados (Plataforma)"
                value={metrics.numberOfVideoPosts}
                tooltip="Número total de posts de vídeo da plataforma considerados para estas métricas no período."
            />
          </div>
          {insightSummary && (
            <p className="text-xs text-gray-600 mt-3 pt-2 border-t border-gray-100">{insightSummary}</p>
          )}
        </>
      )}
       {!loading && !error && !metrics && (
         <div className="text-center py-5"><p className="text-gray-500">Nenhuma métrica de vídeo encontrada para a plataforma.</p></div>
      )}
    </div>
  );
};

export default PlatformVideoPerformanceMetrics;
