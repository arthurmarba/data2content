"use client";

import React, { useCallback, useMemo } from "react";
import useSWR from "swr";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import PlatformPerformanceHighlights from "../PlatformPerformanceHighlights";
import TimePerformanceHeatmap from "../TimePerformanceHeatmap";
import { useGlobalTimePeriod } from "../filters/GlobalTimePeriodContext";


interface Props {
  startDate: string;
  endDate: string;
  apiPrefix?: string;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
}

interface PerformanceSummaryBatchResponse {
  summary: {
    topPerformingFormat: { name: string; metricName: string; value: number; valueFormatted: string; postsCount?: number } | null;
    lowPerformingFormat: { name: string; metricName: string; value: number; valueFormatted: string; postsCount?: number } | null;
    topPerformingContext: { name: string; metricName: string; value: number; valueFormatted: string; postsCount?: number } | null;
    topPerformingProposal: { name: string; metricName: string; value: number; valueFormatted: string; postsCount?: number } | null;
    topPerformingTone: { name: string; metricName: string; value: number; valueFormatted: string; postsCount?: number } | null;
    topPerformingReference: { name: string; metricName: string; value: number; valueFormatted: string; postsCount?: number } | null;
    bestDay: { dayOfWeek: number; average: number } | null;
    insightSummary: string;
  };
  formatRanking: { chartData: Array<{ name: string; value: number; postsCount: number }>; metricUsed: string; groupBy: string };
  timeDistribution?: {
    buckets: Array<{ dayOfWeek: number; hour: number; average: number; count: number }>;
    bestSlots: Array<{ dayOfWeek: number; hour: number; average: number; count: number }>;
    worstSlots: Array<{ dayOfWeek: number; hour: number; average: number; count: number }>;
    insightSummary?: string;
  };
}

const DEFAULT_HEATMAP_METRIC = "stats.total_interactions";

const PlatformContentAnalysisSection: React.FC<Props> = ({
  startDate,
  endDate,
  apiPrefix = '/api/admin',
  onlyActiveSubscribers = false,
  contextFilter,
  creatorContextFilter,
}) => {
  const { timePeriod } = useGlobalTimePeriod();
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
    if (contextFilter) params.append('heatmapContext', contextFilter);
    params.append('heatmapMetric', DEFAULT_HEATMAP_METRIC);

    const apiUrl = `${apiPrefix}/dashboard/highlights/performance-summary/batch?${params.toString()}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
    }
    return response.json() as Promise<PerformanceSummaryBatchResponse>;
  }, [timePeriod, apiPrefix, onlyActiveSubscribers, contextFilter, creatorContextFilter]);

  const { data, error, isLoading } = useSWR<PerformanceSummaryBatchResponse>(
    swrKey,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 1000 },
  );
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;
  const summary = errorMessage ? null : data?.summary ?? null;
  const formatRanking = errorMessage ? null : data?.formatRanking?.chartData ?? null;
  const timeDistribution = errorMessage ? null : data?.timeDistribution ?? null;

  return (
    <section id="platform-content-analysis" className="mb-10">
      <div className="mb-6 flex flex-col gap-1">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <GlobalPeriodIndicator />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">
          Destaques de Performance da Plataforma
        </h2>
      </div>
      <PlatformPerformanceHighlights
        apiPrefix={apiPrefix}
        onlyActiveSubscribers={onlyActiveSubscribers}
        contextFilter={contextFilter}
        creatorContextFilter={creatorContextFilter}
        summaryOverride={summary}
        formatRankingOverride={formatRanking}
        loadingOverride={isLoading}
        errorOverride={errorMessage}
        disableFetch={true}
      />
      <div className="mt-6">
        <TimePerformanceHeatmap
          apiPrefix={apiPrefix}
          onlyActiveSubscribers={onlyActiveSubscribers}
          forcedContext={contextFilter}
          forcedCreatorContext={creatorContextFilter}
          dataOverride={timeDistribution}
          dataOverrideFilters={{
            timePeriod,
            metric: DEFAULT_HEATMAP_METRIC,
            format: '',
            proposal: '',
            context: contextFilter || '',
            tone: '',
            reference: '',
            onlyActiveSubscribers,
            creatorContext: creatorContextFilter || '',
            userId: null,
          }}
          loadingOverride={isLoading}
          errorOverride={errorMessage}
        />
      </div>
    </section>
  );
};

export default PlatformContentAnalysisSection;
