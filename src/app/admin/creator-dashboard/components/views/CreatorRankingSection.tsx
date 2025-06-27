"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import CreatorRankingCard from "../../CreatorRankingCard";
import TopCreatorsWidget from "../../TopCreatorsWidget";

interface Props {
  rankingDateRange: { startDate: string; endDate: string };
  rankingDateLabel: string;
}

const CreatorRankingSection: React.FC<Props> = ({
  rankingDateRange,
  rankingDateLabel,
}) => (
  <section id="creator-rankings" className="mb-10">
    <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
      Rankings de Criadores <GlobalPeriodIndicator />
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <CreatorRankingCard
        title="Maior Engajamento"
        apiEndpoint="/api/admin/dashboard/rankings/creators/top-engaging"
        dateRangeFilter={rankingDateRange}
        dateRangeLabel={rankingDateLabel}
        metricLabel="%"
        limit={5}
      />
      <CreatorRankingCard
        title="Mais Interações"
        apiEndpoint="/api/admin/dashboard/rankings/creators/top-interactions"
        dateRangeFilter={rankingDateRange}
        dateRangeLabel={rankingDateLabel}
        limit={5}
      />
      <CreatorRankingCard
        title="Mais Posts"
        apiEndpoint="/api/admin/dashboard/rankings/creators/most-prolific"
        dateRangeFilter={rankingDateRange}
        dateRangeLabel={rankingDateLabel}
        limit={5}
      />
      <CreatorRankingCard
        title="Mais Compartilhamentos"
        apiEndpoint="/api/admin/dashboard/rankings/creators/top-sharing"
        dateRangeFilter={rankingDateRange}
        dateRangeLabel={rankingDateLabel}
        limit={5}
      />
      <TopCreatorsWidget
        title="Top Criadores"
        metric="total_interactions"
        days={30}
        limit={5}
      />
    </div>
  </section>
);

export default CreatorRankingSection;
