"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LightBulbIcon } from '@heroicons/react/24/outline';
import VideoDrillDownModal from "./VideoDrillDownModal";
import VideoListPreview from "./VideoListPreview";
import PostDetailModal from "../PostDetailModal";
import { useGlobalTimePeriod } from "./filters/GlobalTimePeriodContext";

interface VideoMetricsData {
  averageViews: number | null;
  averageWatchTimeSeconds: number | null;
  averageLikes: number | null;
  averageComments: number | null;
  numberOfVideoPosts: number | null;
  averageShares: number | null;
  averageSaves: number | null;
}

interface VideoMetricsResponse extends VideoMetricsData {
  insightSummary?: string;
}

const TIME_PERIOD_OPTIONS = [
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "last_90_days", label: "Últimos 90 dias" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_12_months", label: "Últimos 12 meses" },
  { value: "all_time", label: "Todo o período" },
];

interface UserVideoPerformanceMetricsProps {
  userId: string | null;
  chartTitle?: string;
}

const formatWatchTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
};

// Sub-componente MetricDisplay e InfoIcon (assumindo que estão definidos em outro lugar ou copiados aqui se necessário)
// Para este exemplo, vou copiá-los para manter o componente autocontido, mas em um projeto real seriam importados.
const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className || "h-4 w-4"}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const MetricDisplay: React.FC<{
  label: string;
  value: string | number | null;
  unit?: string;
  tooltip?: string;
}> = ({ label, value, unit, tooltip }) => (
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
      {value !== null && value !== undefined
        ? `${typeof value === 'number' ? value.toLocaleString() : value}${unit || ""}`
        : "-"}
    </div>
  </div>
);

const UserVideoPerformanceMetrics: React.FC<
  UserVideoPerformanceMetricsProps
> = ({ userId, chartTitle = "Performance de Vídeos do Criador" }) => {
  const [metrics, setMetrics] = useState<VideoMetricsData | null>(null);
  const [insightSummary, setInsightSummary] = useState<string | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [drillDownMetric, setDrillDownMetric] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const { timePeriod: globalTimePeriod } = useGlobalTimePeriod();
  const [timePeriod, setTimePeriod] = useState<string>(
    globalTimePeriod ||
      TIME_PERIOD_OPTIONS[1]?.value ||
      TIME_PERIOD_OPTIONS[0]?.value ||
      "last_90_days",
  );

  useEffect(() => {
    setTimePeriod(globalTimePeriod);
  }, [globalTimePeriod]);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setMetrics(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/users/${userId}/performance/video-metrics?timePeriod=${timePeriod}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`,
        );
      }
      const result: VideoMetricsResponse = await response.json();
      setMetrics({
        averageViews: result.averageViews,
        averageWatchTimeSeconds: result.averageWatchTimeSeconds,
        averageLikes: result.averageLikes,
        averageComments: result.averageComments,
        numberOfVideoPosts: result.numberOfVideoPosts,
        averageShares: result.averageShares ?? null,
        averageSaves: result.averageSaves ?? null,
      });
      setInsightSummary(result.insightSummary);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ocorreu um erro desconhecido.",
      );
      setMetrics(null);
      setInsightSummary(undefined);
    } finally {
      setLoading(false);
    }
  }, [userId, timePeriod]);

  useEffect(() => {
    if (userId) {
      fetchData();
    } else {
      setMetrics(null);
      setLoading(false);
    }
  }, [userId, fetchData]);

  const handleTimePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimePeriod(e.target.value);
  };

  const handleMetricClick = (metric: string) => {
    setDrillDownMetric(metric);
    setIsModalOpen(true);
  };

  if (!userId) {
    return (
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
        <h3 className="text-md font-semibold text-gray-700 mb-3">
          {chartTitle}
        </h3>
        <div className="text-center py-5 text-gray-500">
          Selecione um criador.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-md font-semibold text-gray-700">{chartTitle}</h3>
        <div className="flex items-center gap-2">
          <label
            htmlFor={`timePeriodUserVideo-${userId || "default"}`}
            className="text-xs font-medium text-gray-600"
          >
            Período
          </label>
          <select
            id={`timePeriodUserVideo-${userId || "default"}`}
            value={timePeriod}
            onChange={handleTimePeriodChange}
            disabled={loading}
            className="p-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs"
          >
            {TIME_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="text-center py-5">
          <p className="text-gray-500">Carregando métricas de vídeo...</p>
        </div>
      )}
      {error && (
        <div className="text-center py-5">
          <p className="text-red-500">Erro: {error}</p>
        </div>
      )}

      {!loading && !error && metrics && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
            <div
              className="cursor-pointer"
              onClick={() => handleMetricClick("views")}
            >
              <MetricDisplay
                label="Visualizações Médias"
                value={metrics.averageViews !== null ? metrics.averageViews.toFixed(1) : null}
                tooltip="Média de visualizações por vídeo."
              />
            </div>
            <div
              className="cursor-pointer"
              onClick={() => handleMetricClick("average_video_watch_time_seconds")}
            >
              <MetricDisplay
                label="Tempo Médio de Visualização"
                value={
                  metrics.averageWatchTimeSeconds !== null
                    ? formatWatchTime(metrics.averageWatchTimeSeconds)
                    : null
                }
                tooltip="Tempo médio que os espectadores passam assistindo a cada vídeo."
              />
            </div>
            <div
              className="cursor-pointer"
              onClick={() => handleMetricClick("likes")}
            >
              <MetricDisplay
                label="Curtidas Médias"
                value={metrics.averageLikes !== null ? metrics.averageLikes.toFixed(1) : null}
                tooltip="Média de curtidas por vídeo."
              />
            </div>
            <div
              className="cursor-pointer"
              onClick={() => handleMetricClick("comments")}
            >
              <MetricDisplay
                label="Comentários Médios"
                value={metrics.averageComments !== null ? metrics.averageComments.toFixed(1) : null}
                tooltip="Média de comentários por vídeo."
              />
            </div>
            <div
              className="cursor-pointer"
              onClick={() => handleMetricClick("views")}
            >
              <MetricDisplay
                label="Total de Vídeos Analisados"
                value={metrics.numberOfVideoPosts}
                tooltip="Número de posts de vídeo considerados para estas métricas no período."
              />
            </div>
            <div
              className="cursor-pointer"
              onClick={() => handleMetricClick("shares")}
            >
              <MetricDisplay
                label="Compartilhamentos Médios"
                value={metrics.averageShares !== null ? metrics.averageShares.toFixed(1) : null}
                tooltip="Média de compartilhamentos por vídeo."
              />
            </div>
            <div
              className="cursor-pointer"
              onClick={() => handleMetricClick("saves")}
            >
              <MetricDisplay
                label="Salvamentos Médios"
                value={metrics.averageSaves !== null ? metrics.averageSaves.toFixed(1) : null}
                tooltip="Média de salvamentos por vídeo."
              />
            </div>
          </div>
          <VideoListPreview
            userId={userId!}
            timePeriod={timePeriod}
            onRowClick={(id) => setSelectedPostId(id)}
            onExpand={() => {
              setDrillDownMetric('views');
              setIsModalOpen(true);
            }}
          />
          <div className="mt-4">
            <button
              onClick={() => {
                setDrillDownMetric('views');
                setIsModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            >
              Ver Todos os Vídeos
            </button>
          </div>
          {insightSummary && (
            <p className="text-xs text-gray-600 mt-3 pt-2 border-t border-gray-100 flex items-start">
              <LightBulbIcon className="w-4 h-4 text-yellow-500 mr-1 flex-shrink-0" />
              {insightSummary}
            </p>
          )}
        </>
      )}
      {!loading && !error && !metrics && (
        <div className="text-center py-5">
          <p className="text-gray-500">Nenhuma métrica de vídeo encontrada.</p>
        </div>
      )}
      <VideoDrillDownModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userId={userId!}
        timePeriod={timePeriod}
        drillDownMetric={drillDownMetric}
      />
      <PostDetailModal
        isOpen={selectedPostId !== null}
        onClose={() => setSelectedPostId(null)}
        postId={selectedPostId}
      />
    </div>
  );
};

export default React.memo(UserVideoPerformanceMetrics);
