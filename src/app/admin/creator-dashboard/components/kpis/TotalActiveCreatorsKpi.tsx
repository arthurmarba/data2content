"use client";

import React, { memo } from "react";
import PlatformComparativeKpi from "./PlatformComparativeKpi";
import { useGlobalTimePeriod } from "../filters/GlobalTimePeriodContext";

const TIME_PERIOD_TO_COMPARISON: Record<string, string> = {
  last_7_days: "last_7d_vs_previous_7d",
  last_30_days: "last_30d_vs_previous_30d",
  last_90_days: "last_30d_vs_previous_30d",
  last_6_months: "month_vs_previous",
  last_12_months: "month_vs_previous",
  all_time: "month_vs_previous",
};

const TotalActiveCreatorsKpi: React.FC<{
  apiPrefix?: string;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
  dataOverride?: { currentValue: number | null; previousValue: number | null; percentageChange: number | null; chartData?: { name: string; value: number }[] } | null;
  loadingOverride?: boolean;
  errorOverride?: string | null;
  disableFetch?: boolean;
}> = ({
  apiPrefix = '/api/admin',
  onlyActiveSubscribers = false,
  contextFilter,
  creatorContextFilter,
  dataOverride,
  loadingOverride,
  errorOverride,
  disableFetch = false,
}) => {
  const { timePeriod } = useGlobalTimePeriod();
  const comparisonPeriod = TIME_PERIOD_TO_COMPARISON[timePeriod] || "month_vs_previous";

  return (
    <PlatformComparativeKpi
      apiPrefix={apiPrefix}
      kpiName="platformActiveCreators"
      title="Total de Criadores Ativos"
      comparisonPeriod={comparisonPeriod}
      tooltip="Número total de criadores considerados ativos na plataforma comparado ao período anterior."
      onlyActiveSubscribers={onlyActiveSubscribers}
      contextFilter={contextFilter}
      creatorContextFilter={creatorContextFilter}
      dataOverride={dataOverride}
      loadingOverride={loadingOverride}
      errorOverride={errorOverride}
      disableFetch={disableFetch}
    />
  );
};

export default memo(TotalActiveCreatorsKpi);
