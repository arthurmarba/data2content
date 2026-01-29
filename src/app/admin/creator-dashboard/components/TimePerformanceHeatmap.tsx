/*
================================================================================
ARQUIVO 1/4: TimePerformanceHeatmap.tsx
FUNÇÃO: Componente React do front-end que exibe o heatmap e os filtros.
STATUS: Nenhuma alteração adicional necessária. O arquivo já envia os
parâmetros de filtro corretamente para a API.
================================================================================
*/
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useGlobalTimePeriod } from "./filters/GlobalTimePeriodContext";
import { formatCategories, proposalCategories, contextCategories, toneCategories, referenceCategories, idsToLabels } from "@/app/lib/classification";
import PostsBySliceModal from '@/app/dashboard/planning/components/PostsBySliceModal';
import PostReviewModal from './PostReviewModal';
import PostDetailModal from '../PostDetailModal';
import DiscoverVideoModal from '@/app/discover/components/DiscoverVideoModal';
import { LightBulbIcon, CalendarDaysIcon, ChartBarIcon } from '@heroicons/react/24/solid';



// --- Funções Auxiliares ---

const getPortugueseWeekdayNameForList = (day: number): string => {
  switch (day) {
    case 1: return 'Domingo';
    case 2: return 'Segunda';
    case 3: return 'Terça';
    case 4: return 'Quarta';
    case 5: return 'Quinta';
    case 6: return 'Sexta';
    case 7: return 'Sábado';
    default: return '';
  }
};

// Função auxiliar para converter a hora de volta para o formato de bloco, para o modal.
const hourToTimeBlock = (hour: number): string => {
  if (hour <= 5) return "0-6";
  if (hour <= 11) return "6-12";
  if (hour <= 17) return "12-18";
  return "18-24";
};

const createOptionsFromCategories = (categories: any[]) => {
  const options: { value: string; label: string }[] = [];
  const traverse = (cats: any[], prefix = '') => {
    cats.forEach((cat) => {
      const label = prefix ? `${prefix} > ${cat.label}` : cat.label;
      options.push({ value: cat.id, label });
      if (cat.subcategories && cat.subcategories.length) {
        traverse(cat.subcategories, label);
      }
    });
  };
  traverse(categories);
  return options;
};

const SkeletonLoader = () => (
  <div className="animate-pulse">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg border">
      <div className="h-10 bg-gray-200 rounded-md"></div>
      <div className="h-10 bg-gray-200 rounded-md"></div>
      <div className="h-10 bg-gray-200 rounded-md"></div>
      <div className="h-10 bg-gray-200 rounded-md"></div>
    </div>
    <div className="h-64 bg-gray-200 rounded-lg"></div>
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="h-24 bg-gray-200 rounded-lg"></div>
      <div className="h-24 bg-gray-200 rounded-lg"></div>
    </div>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="text-center py-10">
    <ChartBarIcon className="mx-auto h-12 w-12 text-gray-300" />
    <h3 className="mt-2 text-sm font-semibold text-gray-800">Nenhum dado encontrado</h3>
    <p className="mt-1 text-sm text-gray-500">{message}</p>
  </div>
);


// --- Tipos e Constantes ---
interface HeatmapCell {
  dayOfWeek: number;
  hour: number;
  average: number;
  count: number;
}

interface TimePerformanceResponse {
  buckets: HeatmapCell[];
  bestSlots: HeatmapCell[];
  worstSlots: HeatmapCell[];
  insightSummary?: string;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const metricOptions = [
  { value: 'stats.total_interactions', label: 'Média de Engajamento por Post' },
  { value: 'stats.engagement_rate_on_reach', label: 'Taxa de Engajamento Média' },
];

const formatOptions = createOptionsFromCategories(formatCategories);
const proposalOptions = createOptionsFromCategories(proposalCategories);
const contextOptions = createOptionsFromCategories(contextCategories);
const toneOptions = createOptionsFromCategories(toneCategories);
const referenceOptions = createOptionsFromCategories(referenceCategories);

// --- Componente Principal ---
interface TimePerformanceHeatmapProps {
  /** Se fornecido, filtra os dados para o usuário indicado */
  userId?: string | null;
  apiPrefix?: string;
  onlyActiveSubscribers?: boolean;
  forcedContext?: string;
  forcedCreatorContext?: string;
  dataOverride?: TimePerformanceResponse | null;
  dataOverrideFilters?: {
    timePeriod: string;
    metric: string;
    format: string;
    proposal: string;
    context: string;
    tone: string;
    reference: string;
    onlyActiveSubscribers?: boolean;
    creatorContext?: string;
    userId?: string | null;
  };
  loadingOverride?: boolean;
  errorOverride?: string | null;
}

const TimePerformanceHeatmap: React.FC<TimePerformanceHeatmapProps> = ({
  userId,
  apiPrefix = '/api/admin',
  onlyActiveSubscribers = false,
  forcedContext,
  forcedCreatorContext,
  dataOverride,
  dataOverrideFilters,
  loadingOverride,
  errorOverride,
}) => {
  const { timePeriod } = useGlobalTimePeriod();

  const [format, setFormat] = useState('');
  const [proposal, setProposal] = useState('');
  const [context, setContext] = useState(forcedContext || '');
  const [tone, setTone] = useState('');
  const [reference, setReference] = useState('');
  const [metric, setMetric] = useState(metricOptions[0]!.value);

  // Modal State
  const [sliceModal, setSliceModal] = useState<{ open: boolean; title: string; subtitle?: string; posts: any[] }>({
    open: false,
    title: '',
    subtitle: '',
    posts: [],
  });


  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedPostForReview, setSelectedPostForReview] = useState<any>(null);
  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<any>(null);
  const [selectedPostIdForDetail, setSelectedPostIdForDetail] = useState<string | null>(null);

  const handleOpenReview = useCallback((post: any) => {
    setSelectedPostForReview(post);
    setIsReviewModalOpen(true);
  }, []);

  const handlePlayVideo = useCallback((post: any) => {
    setSelectedVideoForPlayer(post);
    setIsVideoPlayerOpen(true);
  }, []);

  const handleOpenDetail = useCallback((postId: string) => {
    setSelectedPostIdForDetail(postId);
  }, []);



  const [postsLoading, setPostsLoading] = useState(false);

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({ timePeriod, metric });
    if (format) params.set('format', format);
    if (proposal) params.set('proposal', proposal);
    if (context) params.set('context', context);
    if (tone) params.set('tone', tone);
    if (reference) params.set('reference', reference);
    if (onlyActiveSubscribers) params.set('onlyActiveSubscribers', 'true');
    if (forcedCreatorContext) params.set('creatorContext', forcedCreatorContext);

    const baseUrl = userId
      ? `${apiPrefix}/dashboard/users/${userId}/performance/time-distribution`
      : `${apiPrefix}/dashboard/performance/time-distribution`;
    return `${baseUrl}?${params.toString()}`;
  }, [timePeriod, metric, format, proposal, context, onlyActiveSubscribers, forcedCreatorContext, userId, apiPrefix]);

  const fetcher = useCallback(async (url: string): Promise<TimePerformanceResponse> => {
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || res.statusText);
    }
    return res.json() as Promise<TimePerformanceResponse>;
  }, []);

  const overrideMatches = Boolean(
    dataOverride
    && dataOverrideFilters
    && dataOverrideFilters.timePeriod === timePeriod
    && dataOverrideFilters.metric === metric
    && (dataOverrideFilters.format || '') === format
    && (dataOverrideFilters.proposal || '') === proposal
    && (dataOverrideFilters.context || '') === context
    && (dataOverrideFilters.tone || '') === tone
    && (dataOverrideFilters.reference || '') === reference
    && Boolean(dataOverrideFilters.onlyActiveSubscribers) === Boolean(onlyActiveSubscribers)
    && (dataOverrideFilters.creatorContext || '') === (forcedCreatorContext || '')
    && (dataOverrideFilters.userId || null) === (userId || null)
  );
  const shouldBlockFetch = Boolean(loadingOverride) && !overrideMatches;
  const fallbackData = overrideMatches ? dataOverride ?? undefined : undefined;

  const { data: swrData, error: swrError, isLoading: swrLoading } = useSWR<TimePerformanceResponse>(
    shouldBlockFetch ? null : apiUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60 * 1000,
      fallbackData,
      revalidateOnMount: !overrideMatches,
    }
  );

  const handleSlotClick = async (dayOfWeek: number, hour: number, value: number, count: number) => {
    if (count === 0) return;

    setSliceModal({
      open: true,
      title: "Carregando posts...",
      subtitle: `${getPortugueseWeekdayNameForList(dayOfWeek)} ${hour}h`,
      posts: []
    });
    setPostsLoading(true);

    try {
      const params = new URLSearchParams({
        dayOfWeek: String(dayOfWeek),
        hour: String(hour),
        timePeriod,
        metric,
      });
      if (format) params.append('format', format);
      if (proposal) params.append('proposal', proposal);
      if (context) params.append('context', context);
      if (tone) params.append('tone', tone);
      if (reference) params.append('reference', reference);
      if (onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');

      const base = userId
        ? `/api/v1/users/${userId}/performance/time-distribution/posts`
        : '/api/v1/platform/performance/time-distribution/posts';

      const res = await fetch(`${base}?${params.toString()}`);
      if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
      const json = await res.json();

      // Normalize posts for PostsBySliceModal (similar to AdminPlanningCharts)
      const normalizedPosts = (json.posts || []).map((p: any) => {
        const toArray = (v: any) => (Array.isArray(v) ? v : (v ? [v] : []));

        // IDs to Labels conversion using idsToLabels from classification lib
        // The API returns IDs usually, so ensure we have labels
        const fmt = idsToLabels(toArray(p.format), 'format');
        const prop = idsToLabels(toArray(p.proposal), 'proposal');
        const ctx = idsToLabels(toArray(p.context), 'context');
        const tone = idsToLabels(toArray(p.tone), 'tone');
        const refs = idsToLabels(toArray(p.references), 'reference');

        const metaLabel = [
          fmt.length ? `Formato: ${fmt.join(", ")}` : null,
          prop.length ? `Proposta: ${prop.join(", ")}` : null,
          ctx.length ? `Contexto: ${ctx.join(", ")}` : null
        ].filter(Boolean).join(" • ");

        return {
          ...p,
          format: fmt,
          proposal: prop,
          context: ctx,
          tone: tone,
          references: refs,
          metaLabel,
          postDate: p.postDate, // Already ISODate usually
          stats: {
            reach: p.stats?.reach || p.metricValue || 0, // Fallback if metricValue represents reach
            total_interactions: p.stats?.total_interactions || 0,
            likes: p.stats?.likes || 0,
            comments: p.stats?.comments || 0,
            shares: p.stats?.shares || 0,
            saved: p.stats?.saved || p.stats?.saves || 0
          },
          // Map coverUrl to thumbnailUrl for the modal if needed, but Modal checks both
          thumbnailUrl: p.coverUrl
        };
      });

      setSliceModal(prev => ({
        ...prev,
        title: `Top posts (${count})`,
        posts: normalizedPosts
      }));
    } catch (e: any) {
      console.error(e);
      setSliceModal(prev => ({
        ...prev,
        title: "Erro ao carregar posts",
        subtitle: "Tente novamente"
      }));
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof forcedContext === "string") {
      setContext(forcedContext);
    }
  }, [forcedContext]);

  const errorMessage = swrError ? (swrError instanceof Error ? swrError.message : String(swrError)) : null;
  const finalData = overrideMatches ? (dataOverride ?? null) : (swrData ?? null);
  const finalLoading = shouldBlockFetch ? true : (overrideMatches ? (loadingOverride ?? false) : swrLoading);
  const finalError = shouldBlockFetch ? (errorOverride ?? null) : (overrideMatches ? (errorOverride ?? null) : errorMessage);

  const getCell = (day: number, hour: number) => {
    return finalData?.buckets.find(b => b.dayOfWeek === day && b.hour === hour);
  };

  const maxValue = finalData?.buckets.reduce((max, c) => Math.max(max, c.average), 0) || 0;
  const selectedMetricLabel = metricOptions.find(opt => opt.value === metric)?.label || '';

  return (
    <>
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <CalendarDaysIcon className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-800">Análise de Performance por Horário</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4 p-4 bg-gray-50 rounded-lg border">
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-[11px] shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Todos Formatos</option>
            {formatOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <select value={proposal} onChange={(e) => setProposal(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-[11px] shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Todas Propostas</option>
            {proposalOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <select value={context} onChange={(e) => setContext(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-[11px] shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Todos Contextos</option>
            {contextOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-[11px] shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Todos Tons</option>
            {toneOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <select value={reference} onChange={(e) => setReference(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-[11px] shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Referências</option>
            {referenceOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <select value={metric} onChange={(e) => setMetric(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-[11px] shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-semibold text-indigo-700">
            {metricOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>

        {finalLoading && <SkeletonLoader />}
        {finalError && <div className="text-center text-sm text-red-600 p-10">Erro: {finalError}</div>}
        {!finalLoading && !finalError && finalData && (
          <div>
            {finalData.buckets.length === 0 ? (
              <EmptyState message="Tente ajustar os filtros ou o período de tempo." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-center text-xs border-separate border-spacing-px table-fixed">
                    <thead>
                      <tr>
                        <th className="p-1 w-10"></th>
                        {HOURS.map(h => (
                          <th key={h} className="p-1 font-normal text-gray-500 text-[9px]">{h.toString().padStart(2, '0')}h</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map((d, idx) => (
                        <tr key={d}>
                          <td className="p-1 font-semibold text-gray-600 text-right">{d}</td>
                          {HOURS.map(h => {
                            const cell = getCell(idx + 1, h);
                            const val = cell ? cell.average : 0;
                            const intensity = maxValue === 0 ? 0 : 0.15 + (val / maxValue) * 0.85;
                            const style = val === 0 ? { backgroundColor: '#f8fafc' } : { backgroundColor: `rgba(79, 70, 229, ${intensity})` };
                            const tooltip = cell ? `${val.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} de média de engajamento (${cell.count} post${cell.count > 1 ? 's' : ''})` : 'Nenhum post';
                            return (
                              <td
                                key={h}
                                className="h-8 cursor-pointer rounded-sm transition-all duration-200 hover:scale-125 hover:shadow-lg hover:z-10"
                                style={style}
                                title={tooltip}
                                onClick={() => cell && cell.count > 0 && handleSlotClick(cell.dayOfWeek, cell.hour, val, cell.count)}
                              >
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {finalData.bestSlots.length > 0 && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <p className="font-semibold mb-1 text-green-800">✅ Melhores Horários</p>
                      <p className="text-green-700 text-[11px] mb-2">{selectedMetricLabel}</p>
                      <ul className="space-y-2">
                        {finalData.bestSlots.slice(0, 3).map((s, i) => (
                          <li key={i} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-700">{getPortugueseWeekdayNameForList(s.dayOfWeek)} • {s.hour.toString().padStart(2, '0')}:00h</span>
                              <span className="font-bold text-gray-800">{s.average.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span>
                            </div>
                            <div className="w-full bg-green-200 rounded-full h-1.5">
                              <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${(s.average / maxValue) * 100}%` }}></div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {finalData.worstSlots.length > 0 && (
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="font-semibold mb-1 text-red-800">❌ Piores Horários</p>
                      <p className="text-red-700 text-[11px] mb-2">{selectedMetricLabel}</p>
                      <ul className="space-y-2">
                        {finalData.worstSlots.slice(0, 3).map((s, i) => (
                          <li key={i} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-700">{getPortugueseWeekdayNameForList(s.dayOfWeek)} • {s.hour.toString().padStart(2, '0')}:00h</span>
                              <span className="font-bold text-gray-800">{s.average.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span>
                            </div>
                            <div className="w-full bg-red-200 rounded-full h-1.5">
                              <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${(s.average / maxValue) * 100}%` }}></div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {finalData.insightSummary && (
                  <div className="mt-4 p-3 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                    <LightBulbIcon className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                    <span>{finalData.insightSummary}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <PostsBySliceModal
        isOpen={sliceModal.open}
        title={sliceModal.title}
        subtitle={sliceModal.subtitle}
        posts={sliceModal.posts}
        onClose={() => setSliceModal(prev => ({ ...prev, open: false }))}
        onReviewClick={handleOpenReview}
        onPlayClick={handlePlayVideo}
        onDetailClick={handleOpenDetail}
      />


      <PostReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        apiPrefix="/api/admin"
        post={selectedPostForReview ? {
          _id: selectedPostForReview._id,
          coverUrl: selectedPostForReview.thumbnailUrl || selectedPostForReview.coverUrl || selectedPostForReview.thumbnail,
          description: selectedPostForReview.caption || selectedPostForReview.description,
          creatorName: "Criador",
        } : null}
      />

      <PostDetailModal
        isOpen={selectedPostIdForDetail !== null}
        onClose={() => setSelectedPostIdForDetail(null)}
        postId={selectedPostIdForDetail}
      />

      <DiscoverVideoModal
        open={isVideoPlayerOpen}
        onClose={() => setIsVideoPlayerOpen(false)}
        videoUrl={selectedVideoForPlayer?.mediaUrl || selectedVideoForPlayer?.media_url || undefined}
        posterUrl={selectedVideoForPlayer?.thumbnailUrl || selectedVideoForPlayer?.coverUrl || undefined}
        postLink={selectedVideoForPlayer?.permalink || undefined}
      />
    </>

  );
};


export default TimePerformanceHeatmap;
