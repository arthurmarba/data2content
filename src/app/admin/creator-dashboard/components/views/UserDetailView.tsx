"use client";

import React, { useCallback, useMemo } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import useSWR from "swr";
import UserComparativeKpiSection from "../kpis/UserComparativeKpiSection";
import UserPerformanceHighlights from "../UserPerformanceHighlights";
import DeferredSection from "../DeferredSection";
import { useGlobalTimePeriod } from "../filters/GlobalTimePeriodContext";

interface UserDetailViewProps {
  userId: string;
  userName: string;
  userPhotoUrl?: string | null;
  onBack: () => void;
}

const AdminPlanningCharts = dynamic(() => import("../AdminPlanningCharts"));
const UserDemographicsWidget = dynamic(() => import("../UserDemographicsWidget"));
const CreatorBrazilMap = dynamic(() => import("../CreatorBrazilMap"));
const TimePerformanceHeatmap = dynamic(() => import("../TimePerformanceHeatmap"));
const UserVideoPerformanceMetrics = dynamic(() => import("../UserVideoPerformanceMetrics"));
const UserFollowerChangeChart = dynamic(() => import("../UserFollowerChangeChart"));
const UserAlertsWidget = dynamic(() => import("../widgets/UserAlertsWidget"));

const DEFAULT_ALERTS_LIMIT = 3;
const DEFAULT_HEATMAP_METRIC = "stats.total_interactions";

const TIME_PERIOD_TO_COMPARISON: Record<string, string> = {
  last_7_days: "last_7d_vs_previous_7d",
  last_30_days: "last_30d_vs_previous_30d",
  last_90_days: "last_30d_vs_previous_30d",
  last_6_months: "month_vs_previous",
  last_12_months: "month_vs_previous",
  all_time: "month_vs_previous",
};

interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null;
  chartData?: Array<{ name: string; value: number }>;
}

interface UserPeriodicComparisonResponse {
  followerGrowth: KPIComparisonData;
  engagementRate: KPIComparisonData;
  totalEngagement: KPIComparisonData;
  postingFrequency: KPIComparisonData;
}

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

interface DemographicsData {
  follower_demographics: {
    country: Record<string, number>;
    city: Record<string, number>;
    age: Record<string, number>;
    gender: Record<string, number>;
  };
}

interface StateBreakdown {
  state: string;
  count: number;
  density?: number;
  gender: Record<string, number>;
  age: Record<string, number>;
  cities: Record<string, { count: number; gender: Record<string, number>; age: Record<string, number> }>;
}

interface VideoMetricsResponse {
  averageViews: number;
  averageWatchTimeSeconds: number;
  averageLikes: number;
  averageComments: number;
  numberOfVideoPosts: number;
  averageShares: number;
  averageSaves: number;
  insightSummary?: string;
}

interface UserAlertsResponse {
  alerts: Array<{
    alertId: string;
    type: string;
    date: string;
    title: string;
    finalUserMessage: string;
    details: any;
  }>;
  totalAlerts: number;
  insightSummary?: string;
}

interface TimeDistributionResponse {
  buckets: Array<{ dayOfWeek: number; hour: number; average: number; count: number }>;
  bestSlots: Array<{ dayOfWeek: number; hour: number; average: number; count: number }>;
  worstSlots: Array<{ dayOfWeek: number; hour: number; average: number; count: number }>;
  insightSummary?: string;
}

interface UserDetailWidgetsBatchResponse {
  kpis: UserPeriodicComparisonResponse | null;
  performanceSummary: PerformanceSummaryResponse | null;
  formatRanking: FormatRankingResponse | null;
  demographics: DemographicsData | null;
  regionSummary: Record<string, StateBreakdown>;
  videoMetrics: VideoMetricsResponse | null;
  alerts: UserAlertsResponse | null;
  timeDistribution: TimeDistributionResponse | null;
}

const SectionPlaceholder = () => (
  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
    <div className="space-y-3">
      <div className="h-4 w-48 bg-gray-200 animate-pulse rounded" />
      <div className="h-32 bg-gray-200 animate-pulse rounded" />
    </div>
  </div>
);

const UserDetailView: React.FC<UserDetailViewProps> = ({
  userId,
  userName,
  userPhotoUrl,
  onBack,
}) => {
  const { timePeriod } = useGlobalTimePeriod();
  const effectiveComparisonPeriod =
    TIME_PERIOD_TO_COMPARISON[timePeriod] || "month_vs_previous";
  const swrKey = useMemo(() => ([
    "user-detail-widgets",
    userId,
    timePeriod,
    effectiveComparisonPeriod,
    DEFAULT_ALERTS_LIMIT,
    DEFAULT_HEATMAP_METRIC,
  ]), [userId, timePeriod, effectiveComparisonPeriod]);

  const fetcher = useCallback(async (): Promise<UserDetailWidgetsBatchResponse> => {
    const params = new URLSearchParams({
      timePeriod,
      comparisonPeriod: effectiveComparisonPeriod,
      alertsLimit: String(DEFAULT_ALERTS_LIMIT),
      heatmapMetric: DEFAULT_HEATMAP_METRIC,
    });
    const apiUrl = `/api/admin/dashboard/users/${userId}/widgets/batch?${params.toString()}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
    }
    return response.json() as Promise<UserDetailWidgetsBatchResponse>;
  }, [userId, timePeriod, effectiveComparisonPeriod]);

  const { data, error, isLoading } = useSWR<UserDetailWidgetsBatchResponse>(
    userId ? swrKey : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 1000, refreshInterval: 60 * 1000 },
  );
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;
  const kpis = errorMessage ? null : (data?.kpis ?? null);
  const performanceSummary = errorMessage ? null : (data?.performanceSummary ?? null);
  const formatRanking = errorMessage ? null : (data?.formatRanking?.chartData ?? null);
  const demographics = errorMessage ? null : (data?.demographics ?? null);
  const regionSummary = errorMessage ? null : (data?.regionSummary ?? {});
  const videoMetrics = errorMessage ? null : (data?.videoMetrics ?? null);
  const alerts = errorMessage ? null : (data?.alerts ?? null);
  const timeDistribution = errorMessage ? null : (data?.timeDistribution ?? null);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
            aria-label="Voltar"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            {userPhotoUrl ? (
              <div className="relative w-12 h-12 rounded-full overflow-hidden border border-slate-200 shadow-sm">
                <Image
                  src={userPhotoUrl}
                  alt={userName}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight">
                {userName}
              </h2>
              <p className="text-xs text-slate-500">Visão detalhada do criador</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs Section */}
      <section>
        <UserComparativeKpiSection
          userId={userId}
          dataOverride={kpis}
          loadingOverride={isLoading}
          errorOverride={errorMessage}
          disableFetch={true}
        />
      </section>

      {/* Highlights Section */}
      <section>
        <UserPerformanceHighlights
          userId={userId}
          summaryOverride={performanceSummary}
          formatRankingOverride={formatRanking}
          loadingOverride={isLoading}
          errorOverride={errorMessage}
          disableFetch={true}
        />
      </section>

      {/* Video Performance Metrics - Moved up as per user request */}
      <section>
        <DeferredSection minHeight="320px" placeholder={<SectionPlaceholder />}>
          <UserVideoPerformanceMetrics
            userId={userId}
            dataOverride={videoMetrics}
            dataOverrideFilters={{ timePeriod, userId }}
            loadingOverride={isLoading}
            errorOverride={errorMessage}
          />
        </DeferredSection>
      </section>

      {/* Follower Growth Evolution */}
      <section>
        <DeferredSection minHeight="320px" placeholder={<SectionPlaceholder />}>
          <UserFollowerChangeChart userId={userId} />
        </DeferredSection>
      </section>

      {/* Main Charts Section (Trend, Format, etc.) */}
      <section>
        <DeferredSection minHeight="360px" placeholder={<SectionPlaceholder />}>
          <AdminPlanningCharts userId={userId} hideHeatmap={true} hideTopDiscovery={true} />
        </DeferredSection>
      </section>



      {/* Time Performance Heatmap Section */}
      <section>
        <DeferredSection minHeight="360px" placeholder={<SectionPlaceholder />}>
          <TimePerformanceHeatmap
            userId={userId}
            dataOverride={timeDistribution}
            dataOverrideFilters={{
              timePeriod,
              metric: DEFAULT_HEATMAP_METRIC,
              format: "",
              proposal: "",
              context: "",
              tone: "",
              reference: "",
              userId,
            }}
            loadingOverride={isLoading}
            errorOverride={errorMessage}
          />
        </DeferredSection>
      </section>

      {/* Demographics & Region Section - Stacked vertically as per user request */}
      <section className="space-y-6">
        <DeferredSection minHeight="320px" placeholder={<SectionPlaceholder />}>
          <UserDemographicsWidget
            userId={userId}
            dataOverride={demographics}
            loadingOverride={isLoading}
            errorOverride={errorMessage}
            disableFetch={true}
          />
        </DeferredSection>
        {/* Usamos o mesmo componente de mapa da visão geral, mas filtrado pelo usuário */}
        <DeferredSection minHeight="320px" placeholder={<SectionPlaceholder />}>
          <CreatorBrazilMap
            userId={userId}
            dataOverride={regionSummary}
            dataOverrideFilters={{ region: "", gender: "", ageRange: "", userId, apiPrefix: "/api/admin" }}
            loadingOverride={isLoading}
            errorOverride={errorMessage}
          />
        </DeferredSection>
      </section>


    </div>
  );
};

export default UserDetailView;
