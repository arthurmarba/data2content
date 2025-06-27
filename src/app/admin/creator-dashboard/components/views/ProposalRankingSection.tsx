"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import ProposalRankingCard from "../../ProposalRankingCard";

interface Props {
  rankingDateRange: { startDate: string; endDate: string };
  rankingDateLabel: string;
}

const ProposalRankingSection: React.FC<Props> = ({
  rankingDateRange,
  rankingDateLabel,
}) => (
  <section id="proposal-ranking" className="mb-10">
    <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
      Ranking por Proposta <GlobalPeriodIndicator />
    </h2>
    <ProposalRankingCard
      title="Propostas com Mais Interações"
      apiEndpoint="/api/admin/dashboard/rankings/proposals?metric=total_interactions"
      dateRangeFilter={rankingDateRange}
      dateRangeLabel={rankingDateLabel}
      limit={5}
    />
  </section>
);

export default ProposalRankingSection;
