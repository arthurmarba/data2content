"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import CreatorsScatterPlot from "../CreatorsScatterPlot";
import CreatorHighlightsTables from "../CreatorHighlightsTables";

const CreatorHighlightsSection: React.FC<{ creatorContextFilter?: string }> = ({ creatorContextFilter }) => (
  <section id="creator-highlights-and-scatter-plot" className="mb-10">
    <div className="mb-6 flex flex-col gap-1">
      <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        <GlobalPeriodIndicator />
      </div>
      <h2 className="text-2xl font-semibold text-slate-900">
        Destaques e Análise Comparativa de Criadores
      </h2>
    </div>
    <CreatorHighlightsTables creatorContextFilter={creatorContextFilter} />
    <CreatorsScatterPlot />
  </section>
);

export default CreatorHighlightsSection;
