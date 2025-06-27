"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import RadarEffectivenessWidget from "../widgets/RadarEffectivenessWidget";

const AdvancedAnalysisSection: React.FC = () => (
  <section id="advanced-analysis" className="mb-10">
    <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
      Análise Avançada <GlobalPeriodIndicator />
    </h2>
    <RadarEffectivenessWidget />
  </section>
);

export default AdvancedAnalysisSection;
