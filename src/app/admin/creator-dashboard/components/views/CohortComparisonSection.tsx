"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import CohortComparisonChart from "../CohortComparisonChart";

interface Props {
  startDate: string;
  endDate: string;
}

const CohortComparisonSection: React.FC<Props> = ({ startDate, endDate }) => (
  <section id="cohort-comparison" className="mb-10">
    <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
      Comparação de Coortes <GlobalPeriodIndicator />
    </h2>
    <CohortComparisonChart
      metric="engagement_rate_on_reach"
      startDate={startDate}
      endDate={endDate}
      cohorts={[
        { filterBy: "planStatus", value: "Pro", name: "Plano Pro" },
        { filterBy: "planStatus", value: "Free", name: "Plano Free" },
      ]}
    />
  </section>
);

export default CohortComparisonSection;
