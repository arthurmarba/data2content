"use client";

import React from "react";
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

interface Props {
  apiPrefix?: string;
  followerTrendTitle?: string;
}

const PlatformOverviewSection: React.FC<Props> = ({ apiPrefix = '/api/admin', followerTrendTitle = 'Evolução de Seguidores da Plataforma' }) => {
  const { timePeriod } = useGlobalTimePeriod();
  const comparisonPeriod = TIME_PERIOD_TO_COMPARISON[timePeriod] || "month_vs_previous";

  return (
  <section id="platform-overview" className="mb-10">
    <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
      Visão Geral da Plataforma <GlobalPeriodIndicator />
    </h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
      <TotalActiveCreatorsKpi />
      <PlatformComparativeKpi
        kpiName="platformFollowerGrowth"
        title="Crescimento de Seguidores"
        comparisonPeriod={comparisonPeriod}
        tooltip="Crescimento total de seguidores na plataforma comparado ao período anterior selecionado."
      />
      <PlatformComparativeKpi
        kpiName="platformTotalEngagement"
        title="Engajamento Total"
        comparisonPeriod={comparisonPeriod}
        tooltip="Soma total de interações em todos os posts da plataforma comparado ao período anterior selecionado."
      />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
      <PlatformFollowerTrendChart apiPrefix={apiPrefix} title={followerTrendTitle} />
      <PlatformFollowerChangeChart apiPrefix={apiPrefix} />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
      <PlatformReachEngagementTrendChart apiPrefix={apiPrefix} />
      <PlatformMovingAverageEngagementChart apiPrefix={apiPrefix} />
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
