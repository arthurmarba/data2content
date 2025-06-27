"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import PlatformPerformanceHighlights from "../PlatformPerformanceHighlights";
import PlatformAverageEngagementChart from "../PlatformAverageEngagementChart";
import PlatformPostDistributionChart from "../PlatformPostDistributionChart";
import PlatformVideoPerformanceMetrics from "../PlatformVideoPerformanceMetrics";
import PlatformMonthlyEngagementStackedChart from "../PlatformMonthlyEngagementStackedChart";
import PlatformEngagementDistributionByFormatChart from "../PlatformEngagementDistributionByFormatChart";
import ContentPerformanceByTypeChart from "../../ContentPerformanceByTypeChart";

interface Props {
  startDate: string;
  endDate: string;
}

const PlatformContentAnalysisSection: React.FC<Props> = ({
  startDate,
  endDate,
}) => (
  <section id="platform-content-analysis" className="mb-10">
    <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
      Análise de Conteúdo da Plataforma <GlobalPeriodIndicator />
    </h2>
    <div className="mb-6 md:mb-8">
      <PlatformPerformanceHighlights />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 md:mb-8">
      <PlatformAverageEngagementChart
        initialGroupBy="format"
        chartTitle="Engajamento Médio por Formato (Plataforma)"
      />
      <PlatformAverageEngagementChart
        initialGroupBy="context"
        chartTitle="Engajamento Médio por Contexto (Plataforma)"
      />
      <PlatformAverageEngagementChart
        initialGroupBy="proposal"
        chartTitle="Engajamento Médio por Proposta (Plataforma)"
      />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 md:mb-8">
      <PlatformPostDistributionChart chartTitle="Distribuição de Posts por Formato (Plataforma)" />
      <PlatformVideoPerformanceMetrics />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <PlatformMonthlyEngagementStackedChart />
      <PlatformEngagementDistributionByFormatChart />
    </div>
    <div className="mt-6">
      <ContentPerformanceByTypeChart dateRangeFilter={{ startDate, endDate }} />
    </div>
  </section>
);

export default PlatformContentAnalysisSection;
