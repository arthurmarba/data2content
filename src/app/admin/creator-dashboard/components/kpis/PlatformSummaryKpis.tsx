"use client";

import React, { useState, useEffect, memo } from 'react';
import PlatformKpiCard from '../PlatformKpiCard';

interface PlatformSummaryData {
  totalCreators: number;
  pendingCreators: number;
  activeCreatorsInPeriod: number;
  averageEngagementRateInPeriod: number;
  averageReachInPeriod: number;
}

interface PlatformSummaryKpisProps {
  startDate: string;
  endDate: string;
}

const PlatformSummaryKpis: React.FC<PlatformSummaryKpisProps> = ({ startDate, endDate }) => {
  const [data, setData] = useState<PlatformSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ startDate, endDate });
        const response = await fetch(`/api/admin/dashboard/platform-summary?${params.toString()}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
        }
        const result: PlatformSummaryData = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  const formatPercentage = (num?: number | null) => {
    if (num === null || typeof num === 'undefined') return null;
    return `${(num * 100).toFixed(1)}%`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
      <PlatformKpiCard
        title="Criadores Totais"
        value={data?.totalCreators ?? null}
        isLoading={loading}
        error={error}
        tooltip="Número total de criadores cadastrados."
      />
      <PlatformKpiCard
        title="Pendentes"
        value={data?.pendingCreators ?? null}
        isLoading={loading}
        error={error}
        tooltip="Criadores aguardando aprovação."
      />
      <PlatformKpiCard
        title="Ativos no Período"
        value={data?.activeCreatorsInPeriod ?? null}
        isLoading={loading}
        error={error}
        tooltip="Criadores que postaram no período informado."
      />
      <PlatformKpiCard
        title="Engajamento Médio"
        value={formatPercentage(data?.averageEngagementRateInPeriod)}
        isLoading={loading}
        error={error}
        tooltip="Taxa média de engajamento sobre alcance no período."
      />
      <PlatformKpiCard
        title="Alcance Médio"
        value={data?.averageReachInPeriod ?? null}
        isLoading={loading}
        error={error}
        tooltip="Alcance médio das postagens no período."
      />
    </div>
  );
};

export default memo(PlatformSummaryKpis);

