"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import TopMoversWidget from "../../TopMoversWidget";

const TopMoversSection: React.FC = () => (
  <section id="top-movers" className="mb-10">
    <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
      Top Movers <GlobalPeriodIndicator />
    </h2>
    <TopMoversWidget />
  </section>
);

export default TopMoversSection;
