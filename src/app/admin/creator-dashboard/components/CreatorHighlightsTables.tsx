'use client';

import React, { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import TopCreatorsWidget from '../TopCreatorsWidget';
import { useGlobalTimePeriod } from './filters/GlobalTimePeriodContext';
import { TimePeriod } from '@/app/lib/constants/timePeriods'; // Importa o tipo específico
import { timePeriodToDays } from '@/utils/timePeriodHelpers';

const METRICS = [
  'total_interactions',
  'engagement_rate_on_reach',
  'likes',
  'shares',
] as const;

interface TopCreatorsBatchResponse {
  total_interactions: any[];
  engagement_rate_on_reach: any[];
  likes: any[];
  shares: any[];
}

const CreatorHighlightsTables: React.FC<{ creatorContextFilter?: string; apiPrefix?: string }> = ({
  creatorContextFilter,
  apiPrefix = '/api/admin',
}) => {
  const { timePeriod } = useGlobalTimePeriod();
  
  // A correção é aplicar uma asserção de tipo para garantir ao TypeScript
  // que a string 'timePeriod' é um dos valores permitidos pelo tipo TimePeriod.
  const validatedTimePeriod = timePeriod as TimePeriod;
  const days = timePeriodToDays(validatedTimePeriod);
  const batchUrl = useMemo(() => {
    const params = new URLSearchParams({
      metrics: METRICS.join(','),
      days: String(days),
      limit: String(5),
    });
    if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);
    return `${apiPrefix}/dashboard/rankings/top-creators/batch?${params.toString()}`;
  }, [apiPrefix, creatorContextFilter, days]);

  const fetcher = useCallback(async (url: string): Promise<TopCreatorsBatchResponse> => {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch rankings');
    }
    return response.json() as Promise<TopCreatorsBatchResponse>;
  }, []);

  const { data: batchData, error, isLoading } = useSWR<TopCreatorsBatchResponse>(
    batchUrl,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 1000 },
  );
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;
  const sharedProps = { loadingOverride: isLoading, errorOverride: errorMessage, disableFetch: true };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <TopCreatorsWidget
        title="Top Interações"
        metric="total_interactions"
        timePeriod={validatedTimePeriod}
        limit={5}
        creatorContext={creatorContextFilter}
        dataOverride={batchData?.total_interactions ?? null}
        {...sharedProps}
      />
      <TopCreatorsWidget
        title="Maior Engajamento"
        metric="engagement_rate_on_reach"
        metricLabel="%"
        timePeriod={validatedTimePeriod}
        limit={5}
        creatorContext={creatorContextFilter}
        dataOverride={batchData?.engagement_rate_on_reach ?? null}
        {...sharedProps}
      />
      <TopCreatorsWidget
        title="Mais Curtidas"
        metric="likes"
        timePeriod={validatedTimePeriod}
        limit={5}
        creatorContext={creatorContextFilter}
        dataOverride={batchData?.likes ?? null}
        {...sharedProps}
      />
      <TopCreatorsWidget
        title="Mais Compartilhamentos"
        metric="shares"
        timePeriod={validatedTimePeriod}
        limit={5}
        creatorContext={creatorContextFilter}
        dataOverride={batchData?.shares ?? null}
        {...sharedProps}
      />
    </div>
  );
};

export default CreatorHighlightsTables;
