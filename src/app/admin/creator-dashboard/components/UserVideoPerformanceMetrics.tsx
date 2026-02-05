"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { LightBulbIcon } from '@heroicons/react/24/outline';
import VideoDrillDownModal from "./VideoDrillDownModal";
import VideoListPreview from "./VideoListPreview";
import PostDetailModal from "../PostDetailModal";
import PostReviewModal from "./PostReviewModal";
import DiscoverVideoModal from "@/app/discover/components/DiscoverVideoModal";
import { PlayIcon, CheckCircleIcon, ExclamationCircleIcon, ArrowRightIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { formatCategories, proposalCategories, contextCategories, toneCategories, referenceCategories } from '@/app/lib/classification';
import { useGlobalTimePeriod } from "./filters/GlobalTimePeriodContext";

import { VideoListItem } from "@/types/mediakit";


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
  { value: "last_7_days", label: "Últimos 7 dias" },
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "last_90_days", label: "Últimos 90 dias" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_12_months", label: "Últimos 12 meses" },
  { value: "all_time", label: "Todo o período" },
];

interface UserVideoPerformanceMetricsProps {
  userId: string | null;
  chartTitle?: string;
  dataOverride?: VideoMetricsResponse | null;
  dataOverrideFilters?: { timePeriod: string; userId?: string | null };
  loadingOverride?: boolean;
  errorOverride?: string | null;
  disableFetch?: boolean;
}

const formatWatchTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
};

const formatCompactNumber = (
  num: number | null | undefined,
): string | null => {
  if (num === null || num === undefined) return null;
  return num.toLocaleString('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
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
  <div className="p-3 bg-white border border-slate-100 rounded-lg text-center shadow-sm">
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

const createOptionsFromCategories = (categories: any[]) => {
  return categories.map((cat) => ({
    value: cat.id,
    label: cat.label,
  }));
};

const formatOptions = createOptionsFromCategories(formatCategories);
const proposalOptions = createOptionsFromCategories(proposalCategories);
const contextOptions = createOptionsFromCategories(contextCategories);
const toneOptions = createOptionsFromCategories(toneCategories);
const referenceOptions = createOptionsFromCategories(referenceCategories);

const UserVideoPerformanceMetrics: React.FC<
  UserVideoPerformanceMetricsProps
> = ({
  userId,
  chartTitle = "Performance de Vídeos do Criador",
  dataOverride,
  dataOverrideFilters,
  loadingOverride,
  errorOverride,
  disableFetch = false,
}) => {
    const [metrics, setMetrics] = useState<VideoMetricsData | null>(null);
    const [insightSummary, setInsightSummary] = useState<string | undefined>(
      undefined,
    );
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [drillDownMetric, setDrillDownMetric] = useState<string | null>(null);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [selectedVideoForReview, setSelectedVideoForReview] = useState<VideoListItem | null>(null);
    const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
    const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<VideoListItem | null>(null);


    const { timePeriod: globalTimePeriod } = useGlobalTimePeriod();

    const [format, setFormat] = useState('');
    const [proposal, setProposal] = useState('');
    const [context, setContext] = useState('');
    const [tone, setTone] = useState('');
    const [reference, setReference] = useState('');

    const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);
    const [timePeriod, setTimePeriod] = useState<string>(
      globalTimePeriod ||
      TIME_PERIOD_OPTIONS[1]?.value ||
      TIME_PERIOD_OPTIONS[0]?.value ||
      "last_90_days",
    );

    useEffect(() => {
      setTimePeriod(globalTimePeriod);
    }, [globalTimePeriod]);
    const overrideMatches = Boolean(
      dataOverride
      && (!dataOverrideFilters
        || (dataOverrideFilters.timePeriod === timePeriod
          && (dataOverrideFilters.userId || null) === (userId || null)))
    );
    const shouldBlockFetch = Boolean(loadingOverride) && !overrideMatches;
    const shouldFetch = !disableFetch && !overrideMatches && !shouldBlockFetch;
    const resolvedLoading = shouldBlockFetch ? true : (overrideMatches ? (loadingOverride ?? false) : loading);
    const resolvedError = shouldBlockFetch ? (errorOverride ?? null) : (overrideMatches ? (errorOverride ?? null) : error);
    const resolvedMetrics = overrideMatches
      ? (dataOverride ? {
        averageViews: dataOverride.averageViews ?? null,
        averageWatchTimeSeconds: dataOverride.averageWatchTimeSeconds ?? null,
        averageLikes: dataOverride.averageLikes ?? null,
        averageComments: dataOverride.averageComments ?? null,
        numberOfVideoPosts: dataOverride.numberOfVideoPosts ?? null,
        averageShares: dataOverride.averageShares ?? null,
        averageSaves: dataOverride.averageSaves ?? null,
      } : null)
      : metrics;
    const resolvedInsightSummary = overrideMatches ? dataOverride?.insightSummary : insightSummary;

    const fetchData = useCallback(async () => {
      if (!userId) {
        setMetrics(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      // Fetch metrics data
      const metricsUrl = `/api/v1/users/${userId}/performance/video-metrics?${(function () {
        const params = new URLSearchParams({
          timePeriod,
        });
        if (format) params.set('format', format);
        if (proposal) params.set('proposal', proposal);
        if (context) params.set('context', context);
        if (tone) params.set('tone', tone);
        if (reference) params.set('reference', reference);
        return params.toString();
      })()}`;
      try {
        const response = await fetch(metricsUrl);
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
    }, [userId, timePeriod, format, proposal, context, tone, reference]);

    useEffect(() => {
      if (!userId) {
        setMetrics(null);
        setLoading(false);
        return;
      }
      if (shouldFetch) {
        fetchData();
      }
    }, [userId, fetchData, shouldFetch]);

    const handleTimePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setTimePeriod(e.target.value);
    };

    const handleMetricClick = (metric: string) => {
      setDrillDownMetric(metric);
      setIsModalOpen(true);
    };

    const handleOpenReviewModal = (video: VideoListItem) => {
      setSelectedVideoForReview(video);
      setIsReviewModalOpen(true);
      setIsModalOpen(false); // Close drilldown
    };

    const handlePlayVideo = (video: VideoListItem) => {
      setSelectedVideoForPlayer(video);
      setIsVideoPlayerOpen(true);
      setIsModalOpen(false); // Close drilldown
    };

    const handleOpenDetail = (postId: string) => {
      setSelectedPostId(postId);
      setIsModalOpen(false); // Close drilldown
    };



    if (!userId) {
      return (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 group-flex items-center gap-2">
              Performance de Vídeos do Criador
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Análise detalhada de retenção e engajamento dos últimos conteúdos em vídeo.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold text-slate-900">{chartTitle}</h3>
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
              disabled={resolvedLoading}
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

        {/* Filters Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="w-full p-2 border border-gray-200 rounded-lg text-xs shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none bg-white"
          >
            <option value="">Formato</option>
            {formatOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <select
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
            className="w-full p-2 border border-gray-200 rounded-lg text-xs shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none bg-white"
          >
            <option value="">Proposta</option>
            {proposalOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <select
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="w-full p-2 border border-gray-200 rounded-lg text-xs shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none bg-white"
          >
            <option value="">Contexto</option>
            {contextOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full p-2 border border-gray-200 rounded-lg text-xs shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none bg-white"
          >
            <option value="">Tom</option>
            {toneOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <select
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="w-full p-2 border border-gray-200 rounded-lg text-xs shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none bg-white"
          >
            <option value="">Referência</option>
            {referenceOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>

        {resolvedLoading && (
          <div className="text-center py-5">
            <p className="text-gray-500">Carregando métricas de vídeo...</p>
          </div>
        )}
        {resolvedError && (
          <div className="text-center py-5">
            <p className="text-red-500">Erro: {resolvedError}</p>
          </div>
        )}

        {!resolvedLoading && !resolvedError && resolvedMetrics && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <div
                className="cursor-pointer"
                onClick={() => handleMetricClick("views")}
              >
                <MetricDisplay
                  label="Visualizações Médias"
                  value={formatCompactNumber(resolvedMetrics.averageViews)}
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
                    resolvedMetrics.averageWatchTimeSeconds !== null
                      ? formatWatchTime(resolvedMetrics.averageWatchTimeSeconds)
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
                  value={formatCompactNumber(resolvedMetrics.averageLikes)}
                  tooltip="Média de curtidas por vídeo."
                />
              </div>
              <div
                className="cursor-pointer"
                onClick={() => handleMetricClick("comments")}
              >
                <MetricDisplay
                  label="Comentários Médios"
                  value={formatCompactNumber(resolvedMetrics.averageComments)}
                  tooltip="Média de comentários por vídeo."
                />
              </div>
              <div
                className="cursor-pointer"
                onClick={() => handleMetricClick("views")}
              >
                <MetricDisplay
                  label="Total de Vídeos Analisados"
                  value={resolvedMetrics.numberOfVideoPosts}
                  tooltip="Número de posts de vídeo considerados para estas métricas no período."
                />
              </div>
              <div
                className="cursor-pointer"
                onClick={() => handleMetricClick("shares")}
              >
                <MetricDisplay
                  label="Compartilhamentos Médios"
                  value={formatCompactNumber(resolvedMetrics.averageShares)}
                  tooltip="Média de compartilhamentos por vídeo."
                />
              </div>
              <div
                className="cursor-pointer"
                onClick={() => handleMetricClick("saves")}
              >
                <MetricDisplay
                  label="Salvamentos Médios"
                  value={formatCompactNumber(resolvedMetrics.averageSaves)}
                  tooltip="Média de salvamentos por vídeo."
                />
              </div>
            </div>
            <VideoListPreview
              userId={userId!}
              timePeriod={timePeriod}
              filters={{
                format: format || undefined,
                proposal: proposal || undefined,
                context: context || undefined,
                tone: tone || undefined,
                reference: reference || undefined,
              }}
              onPlayClick={handlePlayVideo}
              onDetailClick={handleOpenDetail}
              onReviewClick={handleOpenReviewModal}
              onExpand={() => {
                setDrillDownMetric('views');
                setIsModalOpen(true);
              }}
            />


            {resolvedInsightSummary && (
              <p className="text-xs text-gray-600 mt-3 pt-2 border-t border-gray-100 flex items-start">
                <LightBulbIcon className="w-4 h-4 text-yellow-500 mr-1 flex-shrink-0" />
                {resolvedInsightSummary}
              </p>
            )}
          </>
        )}
        {!resolvedLoading && !resolvedError && !resolvedMetrics && (
          <div className="text-center py-5">
            <p className="text-gray-500">Nenhuma métrica de vídeo encontrada.</p>
          </div>
        )}
        <VideoDrillDownModal
          userId={userId!}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialFilters={{
            format: format || undefined,
            proposal: proposal || undefined,
            context: context || undefined,
            tone: tone || undefined,
            references: reference || undefined,
          }}
          timePeriod={timePeriod}
          drillDownMetric={drillDownMetric}
          initialTypes="REEL,VIDEO"
          onReviewClick={handleOpenReviewModal}
          onPlayClick={handlePlayVideo}
          onDetailClick={handleOpenDetail}
        />

        <PostDetailModal
          isOpen={selectedPostId !== null}
          onClose={() => setSelectedPostId(null)}
          postId={selectedPostId}
        />
        <PostReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          apiPrefix="/api/admin"
          post={selectedVideoForReview ? {
            _id: selectedVideoForReview._id,
            coverUrl: selectedVideoForReview.thumbnailUrl,
            description: selectedVideoForReview.caption,
            creatorName: "Criador",
          } : null}
        />
        <DiscoverVideoModal
          open={isVideoPlayerOpen}
          onClose={() => setIsVideoPlayerOpen(false)}
          videoUrl={selectedVideoForPlayer?.mediaUrl || selectedVideoForPlayer?.media_url || undefined}
          posterUrl={selectedVideoForPlayer?.thumbnailUrl || selectedVideoForPlayer?.coverUrl || undefined}
          postLink={selectedVideoForPlayer?.permalink || undefined}
          onReviewClick={() => {
            setIsVideoPlayerOpen(false);
            handleOpenReviewModal(selectedVideoForPlayer!);
          }}
        />
      </div>

    );
  };

export default React.memo(UserVideoPerformanceMetrics);
