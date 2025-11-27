"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import TopMoversWidget from "../../TopMoversWidget";

const TopMoversSection: React.FC<{
  apiPrefix?: string;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
}> = ({
  apiPrefix = '/api/admin',
  onlyActiveSubscribers = false,
  contextFilter,
  creatorContextFilter,
}) => (
    <section id="top-movers" className="mb-10">
      <div className="mb-6 flex flex-col gap-1">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <GlobalPeriodIndicator />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">
          Top Movers
        </h2>
      </div>
      <TopMoversWidget
        apiPrefix={apiPrefix}
        onlyActiveSubscribers={onlyActiveSubscribers}
        contextFilter={contextFilter}
        creatorContext={creatorContextFilter}
      />
    </section>
  );

export default TopMoversSection;
