"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import CreatorsScatterPlot from "../CreatorsScatterPlot";

const CreatorHighlightsSection: React.FC = () => (
  <section id="creator-highlights-and-scatter-plot" className="mb-10">
    <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
      Destaques e Análise Comparativa de Criadores <GlobalPeriodIndicator />
    </h2>
    <p className="text-sm text-gray-500 mb-4 italic">
      (Em breve: Tabelas de Criadores com melhor performance)
    </p>
    <CreatorsScatterPlot />
  </section>
);

export default CreatorHighlightsSection;
