"use client";

import React, { useState, useEffect, memo } from 'react';
import PlatformKpiCard from '../PlatformKpiCard';
import {
  UserGroupIcon,
  ExclamationTriangleIcon,
  UsersIcon,
  SparklesIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

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
  const [prevData, setPrevData] = useState<PlatformSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ startDate, endDate });

        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffMs = end.getTime() - start.getTime();
        const prevEnd = new Date(start.getTime() - 1000);
        const prevStart = new Date(prevEnd.getTime() - diffMs);
        const prevParams = new URLSearchParams({
          startDate: prevStart.toISOString(),
          endDate: prevEnd.toISOString(),
        });

        const [response, prevResponse] = await Promise.all([
          fetch(`/api/admin/dashboard/platform-summary?${params.toString()}`),
          fetch(`/api/admin/dashboard/platform-summary?${prevParams.toString()}`),
        ]);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
        }
        if (!prevResponse.ok) {
          const errorData = await prevResponse.json().catch(() => ({}));
          throw new Error(`Erro HTTP: ${prevResponse.status} - ${errorData.error || prevResponse.statusText}`);
        }

        const result: PlatformSummaryData = await response.json();
        const prevResult: PlatformSummaryData = await prevResponse.json();
        setData(result);
        setPrevData(prevResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
        setData(null);
        setPrevData(null);
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

  const buildChange = (current?: number | null, previous?: number | null) => {
    if (
      current === null ||
      typeof current === 'undefined' ||
      previous === null ||
      typeof previous === 'undefined' ||
      previous === 0
    ) {
      return { change: null, type: 'neutral' as const };
    }

    const diff = ((current - previous) / previous) * 100;
    const change = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}% vs período anterior`;
    let type: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (diff > 0.1) type = 'positive';
    else if (diff < -0.1) type = 'negative';
    return { change, type };
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
      <PlatformKpiCard
        title="Criadores Totais"
        value={data?.totalCreators ?? null}
        {...buildChange(data?.totalCreators, prevData?.totalCreators)}
        isLoading={loading}
        error={error}
        tooltip="Número total de criadores cadastrados."
        icon={UserGroupIcon}
        iconClassName="text-indigo-500"
      />
      <PlatformKpiCard
        title="Criadores Pendentes"
        value={data?.pendingCreators ?? null}
        {...buildChange(data?.pendingCreators, prevData?.pendingCreators)}
        isLoading={loading}
        error={error}
        tooltip="Criadores aguardando aprovação."
        icon={ExclamationTriangleIcon}
        iconClassName="text-yellow-500"
      />
      <PlatformKpiCard
        title="Ativos no Período"
        value={data?.activeCreatorsInPeriod ?? null}
        {...buildChange(data?.activeCreatorsInPeriod, prevData?.activeCreatorsInPeriod)}
        isLoading={loading}
        error={error}
        tooltip="Criadores que postaram no período informado."
        icon={UsersIcon}
        iconClassName="text-green-600"
      />
      <PlatformKpiCard
        title="Engajamento Médio"
        value={formatPercentage(data?.averageEngagementRateInPeriod)}
        {...buildChange(data?.averageEngagementRateInPeriod, prevData?.averageEngagementRateInPeriod)}
        isLoading={loading}
        error={error}
        tooltip="Taxa média de engajamento sobre alcance no período."
        icon={SparklesIcon}
        iconClassName="text-indigo-500"
      />
      <PlatformKpiCard
        title="Alcance Médio"
        value={data?.averageReachInPeriod ?? null}
        {...buildChange(data?.averageReachInPeriod, prevData?.averageReachInPeriod)}
        isLoading={loading}
        error={error}
        tooltip="Alcance médio das postagens no período."
        icon={EyeIcon}
        iconClassName="text-indigo-500"
      />
    </div>
  );
};

export default memo(PlatformSummaryKpis);

