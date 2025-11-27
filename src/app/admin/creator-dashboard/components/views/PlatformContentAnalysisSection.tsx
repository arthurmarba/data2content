"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import PlatformPerformanceHighlights from "../PlatformPerformanceHighlights";
import TimePerformanceHeatmap from "../TimePerformanceHeatmap";


interface Props {
  startDate: string;
  endDate: string;
  apiPrefix?: string;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
}

const PlatformContentAnalysisSection: React.FC<Props> = ({
  startDate,
  endDate,
  apiPrefix = '/api/admin',
  onlyActiveSubscribers = false,
  contextFilter,
  creatorContextFilter,
}) => (
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
    />
    <div className="mt-6">
      <TimePerformanceHeatmap
        apiPrefix={apiPrefix}
        onlyActiveSubscribers={onlyActiveSubscribers}
        forcedContext={contextFilter}
        forcedCreatorContext={creatorContextFilter}
      />
    </div>
  </section>
);

export default PlatformContentAnalysisSection;
