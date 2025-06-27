"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import PlatformFollowerTrendChart from "../PlatformFollowerTrendChart";
import PlatformFollowerChangeChart from "../PlatformFollowerChangeChart";
import PlatformReachEngagementTrendChart from "../PlatformReachEngagementTrendChart";
import PlatformMovingAverageEngagementChart from "../PlatformMovingAverageEngagementChart";
import TotalActiveCreatorsKpi from "../kpis/TotalActiveCreatorsKpi";
import PlatformComparativeKpi from "../kpis/PlatformComparativeKpi";

interface Props {
  comparisonPeriod: string;
}

const PlatformOverviewSection: React.FC<Props> = ({ comparisonPeriod }) => (
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
      <PlatformFollowerTrendChart />
      <PlatformFollowerChangeChart />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
      <PlatformReachEngagementTrendChart />
      <PlatformMovingAverageEngagementChart />
    </div>
  </section>
);

export default PlatformOverviewSection;
