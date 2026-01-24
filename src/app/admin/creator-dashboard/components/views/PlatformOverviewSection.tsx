"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import { useGlobalTimePeriod } from "../filters/GlobalTimePeriodContext";
import PlatformFollowerTrendChart from "../PlatformFollowerTrendChart";
import PlatformFollowerChangeChart from "../PlatformFollowerChangeChart";
import PlatformReachEngagementTrendChart from "../PlatformReachEngagementTrendChart";
import PlatformMovingAverageEngagementChart from "../PlatformMovingAverageEngagementChart";
import TotalActiveCreatorsKpi from "../kpis/TotalActiveCreatorsKpi";
import PlatformComparativeKpi from "../kpis/PlatformComparativeKpi";
import PlatformDemographicsWidget from "../PlatformDemographicsWidget";
import CreatorBrazilMap from "../CreatorBrazilMap";

const TIME_PERIOD_TO_COMPARISON: Record<string, string> = {
  last_7_days: "last_7d_vs_previous_7d",
  last_30_days: "last_30d_vs_previous_30d",
  last_90_days: "last_30d_vs_previous_30d",
  last_6_months: "month_vs_previous",
  last_12_months: "month_vs_previous",
  all_time: "month_vs_previous",
};

const MOVING_AVERAGE_WINDOW_OPTIONS = [7, 14, 30];

const timePeriodToDataWindowDays = (timePeriod: string): number => {
  switch (timePeriod) {
    case "last_7_days":
      return 7;
    case "last_30_days":
      return 30;
    case "last_60_days":
      return 60;
    case "last_90_days":
      return 90;
    default:
      return 30;
  }
};

const normalizeMovingAverageWindow = (avgWindow: string, dataWindowInDays: number): string => {
  const parsed = parseInt(avgWindow, 10);
  const eligible = MOVING_AVERAGE_WINDOW_OPTIONS.filter((value) => value <= dataWindowInDays);
  const fallback = eligible.length ? eligible[eligible.length - 1] : MOVING_AVERAGE_WINDOW_OPTIONS[0];

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return String(fallback);
  }

  if (parsed > dataWindowInDays || !MOVING_AVERAGE_WINDOW_OPTIONS.includes(parsed)) {
    return String(fallback);
  }

  return String(parsed);
};

interface Props {
  apiPrefix?: string;
  followerTrendTitle?: string;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
}

interface MiniChartDataPoint {
  name: string;
  value: number;
}

interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null;
  chartData?: MiniChartDataPoint[];
}

interface PlatformPeriodicComparisonResponse {
  platformFollowerGrowth: KPIComparisonData;
  platformTotalEngagement: KPIComparisonData;
  platformPostingFrequency?: KPIComparisonData;
  platformActiveCreators?: KPIComparisonData;
}

interface FollowerTrendPoint {
  date: string;
  value: number | null;
}

interface FollowerTrendResponse {
  chartData: FollowerTrendPoint[];
  insightSummary?: string;
}

interface FollowerChangePoint {
  date: string;
  change: number | null;
}

interface FollowerChangeResponse {
  chartData: FollowerChangePoint[];
  insightSummary?: string;
}

interface ReachEngagementPoint {
  date: string;
  reach: number | null;
  totalInteractions: number | null;
}

interface ReachEngagementResponse {
  chartData: ReachEngagementPoint[];
  insightSummary?: string;
}

interface MovingAverageSeriesResponse {
  series: { date: string; movingAverageEngagement: number | null }[];
  insightSummary?: string;
}

interface TrendsBatchResponse {
  followerTrend: FollowerTrendResponse;
  followerChange: FollowerChangeResponse;
  reachEngagement: ReachEngagementResponse;
  movingAverage: MovingAverageSeriesResponse;
}

const PlatformOverviewSection: React.FC<Props> = ({
  apiPrefix = '/api/admin',
  followerTrendTitle = 'Evolução de Seguidores da Plataforma',
  onlyActiveSubscribers = false,
  contextFilter,
  creatorContextFilter,
}) => {
  const { timePeriod } = useGlobalTimePeriod();
  const [followerGranularity, setFollowerGranularity] = useState<string>("daily");
  const [reachGranularity, setReachGranularity] = useState<string>("daily");
  const [avgWindow, setAvgWindow] = useState<string>("7");

  const comparisonPeriod = TIME_PERIOD_TO_COMPARISON[timePeriod] || "month_vs_previous";
  const comparisonUrl = useMemo(() => {
    const params = new URLSearchParams({ comparisonPeriod });
    if (onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');
    if (contextFilter) params.append('context', contextFilter);
    if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);
    return `${apiPrefix}/dashboard/platform-kpis/periodic-comparison?${params.toString()}`;
  }, [apiPrefix, comparisonPeriod, onlyActiveSubscribers, contextFilter, creatorContextFilter]);

  const comparisonFetcher = useCallback(async (url: string): Promise<PlatformPeriodicComparisonResponse> => {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
    }
    return response.json() as Promise<PlatformPeriodicComparisonResponse>;
  }, []);

  const dataWindowInDays = useMemo(() => timePeriodToDataWindowDays(timePeriod), [timePeriod]);
  const effectiveAvgWindow = useMemo(
    () => normalizeMovingAverageWindow(avgWindow, dataWindowInDays),
    [avgWindow, dataWindowInDays]
  );

  useEffect(() => {
    if (effectiveAvgWindow !== avgWindow) {
      setAvgWindow(effectiveAvgWindow);
    }
  }, [avgWindow, effectiveAvgWindow]);

  const trendsBatchUrl = useMemo(() => {
    const params = new URLSearchParams({
      timePeriod,
      followerGranularity,
      reachGranularity,
      dataWindowInDays: String(dataWindowInDays),
      movingAverageWindowInDays: effectiveAvgWindow,
    });
    if (onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');
    if (contextFilter) params.append('context', contextFilter);
    if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);
    return `${apiPrefix}/dashboard/trends/batch?${params.toString()}`;
  }, [
    apiPrefix,
    timePeriod,
    followerGranularity,
    reachGranularity,
    dataWindowInDays,
    effectiveAvgWindow,
    onlyActiveSubscribers,
    contextFilter,
    creatorContextFilter,
  ]);

  const trendsFetcher = useCallback(async (url: string): Promise<TrendsBatchResponse> => {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
    }
    return response.json() as Promise<TrendsBatchResponse>;
  }, []);

  const { data: comparisonData, error, isLoading } = useSWR<PlatformPeriodicComparisonResponse>(
    comparisonUrl,
    comparisonFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 1000 },
  );
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;
  const sharedKpiProps = { loadingOverride: isLoading, errorOverride: errorMessage, disableFetch: true };

  const {
    data: trendsData,
    error: trendsError,
    isLoading: trendsLoading,
  } = useSWR<TrendsBatchResponse>(
    trendsBatchUrl,
    trendsFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 1000 },
  );
  const trendsErrorMessage = trendsError ? (trendsError instanceof Error ? trendsError.message : String(trendsError)) : null;
  const sharedTrendProps = { loadingOverride: trendsLoading, errorOverride: trendsErrorMessage, disableFetch: true };

  return (
    <section id="platform-overview" className="mb-10">
      <div className="mb-6 flex flex-col gap-1">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <GlobalPeriodIndicator />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">
          Visão Geral da Plataforma
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <TotalActiveCreatorsKpi
          apiPrefix={apiPrefix}
          onlyActiveSubscribers={onlyActiveSubscribers}
          contextFilter={contextFilter}
          creatorContextFilter={creatorContextFilter}
          dataOverride={comparisonData?.platformActiveCreators ?? null}
          {...sharedKpiProps}
        />
        <PlatformComparativeKpi
          apiPrefix={apiPrefix}
          kpiName="platformFollowerGrowth"
          title="Crescimento de Seguidores"
          comparisonPeriod={comparisonPeriod}
          tooltip="Crescimento total de seguidores na plataforma comparado ao período anterior selecionado."
          onlyActiveSubscribers={onlyActiveSubscribers}
          contextFilter={contextFilter}
          creatorContextFilter={creatorContextFilter}
          dataOverride={comparisonData?.platformFollowerGrowth ?? null}
          {...sharedKpiProps}
        />
        <PlatformComparativeKpi
          apiPrefix={apiPrefix}
          kpiName="platformTotalEngagement"
          title="Engajamento Total"
          comparisonPeriod={comparisonPeriod}
          tooltip="Soma total de interações em todos os posts da plataforma comparado ao período anterior selecionado."
          onlyActiveSubscribers={onlyActiveSubscribers}
          contextFilter={contextFilter}
          creatorContextFilter={creatorContextFilter}
          dataOverride={comparisonData?.platformTotalEngagement ?? null}
          {...sharedKpiProps}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
        <PlatformFollowerTrendChart
          apiPrefix={apiPrefix}
          title={followerTrendTitle}
          onlyActiveSubscribers={onlyActiveSubscribers}
          contextFilter={contextFilter}
          creatorContextFilter={creatorContextFilter}
          dataOverride={trendsData?.followerTrend?.chartData ?? null}
          insightOverride={trendsData?.followerTrend?.insightSummary}
          granularityOverride={followerGranularity}
          onGranularityChange={setFollowerGranularity}
          {...sharedTrendProps}
        />
        <PlatformFollowerChangeChart
          apiPrefix={apiPrefix}
          onlyActiveSubscribers={onlyActiveSubscribers}
          contextFilter={contextFilter}
          creatorContextFilter={creatorContextFilter}
          dataOverride={trendsData?.followerChange?.chartData ?? null}
          insightOverride={trendsData?.followerChange?.insightSummary}
          {...sharedTrendProps}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
        <PlatformReachEngagementTrendChart
          apiPrefix={apiPrefix}
          onlyActiveSubscribers={onlyActiveSubscribers}
          contextFilter={contextFilter}
          creatorContextFilter={creatorContextFilter}
          dataOverride={trendsData?.reachEngagement?.chartData ?? null}
          insightOverride={trendsData?.reachEngagement?.insightSummary}
          granularityOverride={reachGranularity}
          onGranularityChange={setReachGranularity}
          {...sharedTrendProps}
        />
        <PlatformMovingAverageEngagementChart
          apiPrefix={apiPrefix}
          onlyActiveSubscribers={onlyActiveSubscribers}
          contextFilter={contextFilter}
          creatorContextFilter={creatorContextFilter}
          dataOverride={trendsData?.movingAverage?.series ?? null}
          insightOverride={trendsData?.movingAverage?.insightSummary}
          avgWindowOverride={effectiveAvgWindow}
          onAvgWindowChange={setAvgWindow}
          {...sharedTrendProps}
        />
      </div>

      {/* --- CORREÇÃO APLICADA AQUI --- */}
      {/* Colocamos o widget de demografia e o mapa lado a lado em um grid para controlar o tamanho. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <PlatformDemographicsWidget apiPrefix={apiPrefix} />
        <CreatorBrazilMap apiPrefix={apiPrefix} />
      </div>

    </section>
  );
};

export default PlatformOverviewSection;
