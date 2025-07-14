"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import PlatformPerformanceHighlights from "../PlatformPerformanceHighlights";
import TimePerformanceHeatmap from "../TimePerformanceHeatmap";


interface Props {
  startDate: string;
  endDate: string;
  apiPrefix?: string;
}

const PlatformContentAnalysisSection: React.FC<Props> = ({
  startDate,
  endDate,
  apiPrefix = '/api/admin'
}) => (
  <section id="platform-content-analysis" className="mb-10">
    <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
      Destaques de Performance da Plataforma <GlobalPeriodIndicator />
    </h2>
    <PlatformPerformanceHighlights apiPrefix={apiPrefix} />
    <div className="mt-6">
      <TimePerformanceHeatmap apiPrefix={apiPrefix} />
    </div>
  </section>
);

export default PlatformContentAnalysisSection;