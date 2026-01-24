"use client";

import React, { useCallback, useMemo, memo } from 'react';
import useSWR from 'swr';
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

interface PlatformSummaryResponse {
  current: PlatformSummaryData;
  previous: PlatformSummaryData;
}

interface PlatformSummaryKpisProps {
  apiPrefix?: string;
  startDate: string;
  endDate: string;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
}

type PlatformSummaryKey = [
  'platform-summary',
  string,
  string,
  string,
  boolean,
  string | undefined,
  string | undefined,
];

const PlatformSummaryKpis: React.FC<PlatformSummaryKpisProps> = ({
  apiPrefix = '/api/admin',
  startDate,
  endDate,
  onlyActiveSubscribers = false,
  contextFilter,
  creatorContextFilter,
}) => {
  const swrKey = useMemo<PlatformSummaryKey>(() => ([
    'platform-summary',
    apiPrefix,
    startDate,
    endDate,
    onlyActiveSubscribers,
    contextFilter,
    creatorContextFilter,
  ]), [apiPrefix, startDate, endDate, onlyActiveSubscribers, contextFilter, creatorContextFilter]);

  const fetcher = useCallback(async (key: PlatformSummaryKey): Promise<PlatformSummaryResponse> => {
    const [, apiPrefix, startDate, endDate, onlyActiveSubscribers, contextFilter, creatorContextFilter] = key;
    const params = new URLSearchParams({ startDate, endDate });
    if (onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');
    if (contextFilter) params.append('context', contextFilter);
    if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);

    const response = await fetch(`${apiPrefix}/dashboard/platform-summary/batch?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
    }

    return response.json() as Promise<PlatformSummaryResponse>;
  }, []);

  const { data, error, isLoading } = useSWR<PlatformSummaryResponse>(
    swrKey,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 1000 },
  );
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;
  const currentData = errorMessage ? null : data?.current ?? null;
  const prevData = errorMessage ? null : data?.previous ?? null;

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
        value={currentData?.totalCreators ?? null}
        {...buildChange(currentData?.totalCreators, prevData?.totalCreators)}
        isLoading={isLoading}
        error={errorMessage}
        tooltip="Número total de criadores cadastrados."
        icon={UserGroupIcon}
        iconClassName="text-indigo-500"
      />
      <PlatformKpiCard
        title="Criadores Pendentes"
        value={currentData?.pendingCreators ?? null}
        {...buildChange(currentData?.pendingCreators, prevData?.pendingCreators)}
        isLoading={isLoading}
        error={errorMessage}
        tooltip="Criadores aguardando aprovação."
        icon={ExclamationTriangleIcon}
        iconClassName="text-yellow-500"
      />
      <PlatformKpiCard
        title="Ativos no Período"
        value={currentData?.activeCreatorsInPeriod ?? null}
        {...buildChange(currentData?.activeCreatorsInPeriod, prevData?.activeCreatorsInPeriod)}
        isLoading={isLoading}
        error={errorMessage}
        tooltip="Criadores que postaram no período informado."
        icon={UsersIcon}
        iconClassName="text-green-600"
      />
      <PlatformKpiCard
        title="Engajamento Médio"
        value={formatPercentage(currentData?.averageEngagementRateInPeriod)}
        {...buildChange(currentData?.averageEngagementRateInPeriod, prevData?.averageEngagementRateInPeriod)}
        isLoading={isLoading}
        error={errorMessage}
        tooltip="Taxa média de engajamento sobre alcance no período."
        icon={SparklesIcon}
        iconClassName="text-indigo-500"
      />
      <PlatformKpiCard
        title="Alcance Médio"
        value={currentData?.averageReachInPeriod ?? null}
        {...buildChange(currentData?.averageReachInPeriod, prevData?.averageReachInPeriod)}
        isLoading={isLoading}
        error={errorMessage}
        tooltip="Alcance médio das postagens no período."
        icon={EyeIcon}
        iconClassName="text-indigo-500"
      />
    </div>
  );
};

export default memo(PlatformSummaryKpis);
