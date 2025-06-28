"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import CreatorsScatterPlot from "../CreatorsScatterPlot";
import CreatorHighlightsTables from "../CreatorHighlightsTables";

const CreatorHighlightsSection: React.FC = () => (
  <section id="creator-highlights-and-scatter-plot" className="mb-10">
    <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
      Destaques e Análise Comparativa de Criadores <GlobalPeriodIndicator />
    </h2>
    <CreatorHighlightsTables />
    <CreatorsScatterPlot />
  </section>
);

export default CreatorHighlightsSection;
