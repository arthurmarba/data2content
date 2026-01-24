"use client";

import React, { useCallback, useMemo } from "react";
import useSWR from "swr";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import CreatorRankingCard from "../../CreatorRankingCard";
import TopCreatorsWidget from "../../TopCreatorsWidget";
import { useGlobalTimePeriod } from "../filters/GlobalTimePeriodContext";
import { TimePeriod } from "@/app/lib/constants/timePeriods"; // Importa o tipo específico
import type { ICreatorMetricRankItem } from "@/app/lib/dataService/marketAnalysisService";

interface Props {
  rankingDateRange: { startDate: string; endDate: string };
  rankingDateLabel: string;
  apiPrefix?: string;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
}

const CreatorRankingSection: React.FC<Props> = ({
  rankingDateRange,
  rankingDateLabel,
  apiPrefix = '/api/admin',
  onlyActiveSubscribers = false,
  contextFilter,
  creatorContextFilter,
}) => {
  const { timePeriod: globalTimePeriod } = useGlobalTimePeriod();

  // A correção é aplicar uma asserção de tipo para garantir ao TypeScript
  // que a string 'globalTimePeriod' é um dos valores permitidos.
  const validatedTimePeriod = globalTimePeriod as TimePeriod;
  const rankingLimit = 5;
  const dateRangeParams = useMemo(() => {
    const localStartDate = new Date(rankingDateRange.startDate);
    const localEndDate = new Date(rankingDateRange.endDate);
    const utcStartDate = new Date(Date.UTC(localStartDate.getFullYear(), localStartDate.getMonth(), localStartDate.getDate(), 0, 0, 0, 0));
    const utcEndDate = new Date(Date.UTC(localEndDate.getFullYear(), localEndDate.getMonth(), localEndDate.getDate(), 23, 59, 59, 999));
    return {
      startDate: utcStartDate.toISOString(),
      endDate: utcEndDate.toISOString(),
    };
  }, [rankingDateRange.startDate, rankingDateRange.endDate]);

  const batchUrl = useMemo(() => {
    const params = new URLSearchParams({
      startDate: dateRangeParams.startDate,
      endDate: dateRangeParams.endDate,
      limit: String(rankingLimit),
    });
    if (onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');
    if (contextFilter) params.append('context', contextFilter);
    if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);
    return `${apiPrefix}/dashboard/rankings/creators/batch?${params.toString()}`;
  }, [apiPrefix, dateRangeParams.startDate, dateRangeParams.endDate, rankingLimit, onlyActiveSubscribers, contextFilter, creatorContextFilter]);

  const fetcher = useCallback(async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch creator rankings');
    }
    return response.json() as Promise<CreatorRankingsBatch>;
  }, []);

  interface CreatorRankingsBatch {
    topEngaging: ICreatorMetricRankItem[];
    topInteractions: ICreatorMetricRankItem[];
    avgEngagementPerPost: ICreatorMetricRankItem[];
    engagementGrowth: ICreatorMetricRankItem[];
    performanceConsistency: ICreatorMetricRankItem[];
    mostProlific: ICreatorMetricRankItem[];
    topSharing: ICreatorMetricRankItem[];
    avgReachPerPost: ICreatorMetricRankItem[];
    reachPerFollower: ICreatorMetricRankItem[];
  }

  const { data, error, isLoading } = useSWR<CreatorRankingsBatch>(
    batchUrl,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 1000 },
  );
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;

  return (
    <section id="creator-rankings" className="mb-10">
      <div className="mb-6 flex flex-col gap-1">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <GlobalPeriodIndicator />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">
          Rankings de Criadores
        </h2>
      </div>
      <div className="overflow-x-auto">
        <div className="flex md:grid md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="col-span-full">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Engajamento</h3>
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Maior Engajamento"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/top-engaging`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              metricLabel="%"
              tooltip="Taxa de engajamento média: interações divididas pelo alcance total do período."
              limit={rankingLimit}
              onlyActiveSubscribers={onlyActiveSubscribers}
              contextFilter={contextFilter}
              creatorContextFilter={creatorContextFilter}
              dataOverride={data?.topEngaging ?? null}
              loadingOverride={isLoading}
              errorOverride={errorMessage}
              disableFetch={true}
            />
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Mais Interações"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/top-interactions`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              tooltip="Soma de todas as interações (curtidas, comentários, etc.) no período."
              limit={rankingLimit}
              onlyActiveSubscribers={onlyActiveSubscribers}
              contextFilter={contextFilter}
              creatorContextFilter={creatorContextFilter}
              dataOverride={data?.topInteractions ?? null}
              loadingOverride={isLoading}
              errorOverride={errorMessage}
              disableFetch={true}
            />
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Engajamento Médio/Post"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/avg-engagement-per-post`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              tooltip="Média de interações por post; considera apenas criadores com 3 ou mais posts."
              limit={rankingLimit}
              onlyActiveSubscribers={onlyActiveSubscribers}
              contextFilter={contextFilter}
              creatorContextFilter={creatorContextFilter}
              dataOverride={data?.avgEngagementPerPost ?? null}
              loadingOverride={isLoading}
              errorOverride={errorMessage}
              disableFetch={true}
            />
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Variação de Engajamento"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/engagement-growth`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              metricLabel="%"
              tooltip="Diferença percentual do engajamento total em relação ao período anterior equivalente."
              limit={rankingLimit}
              onlyActiveSubscribers={onlyActiveSubscribers}
              contextFilter={contextFilter}
              creatorContextFilter={creatorContextFilter}
              dataOverride={data?.engagementGrowth ?? null}
              loadingOverride={isLoading}
              errorOverride={errorMessage}
              disableFetch={true}
            />
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Consistência de Performance"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/performance-consistency`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              tooltip="Avalia a regularidade do engajamento por post; exige ao menos 5 posts relevantes."
              limit={rankingLimit}
              onlyActiveSubscribers={onlyActiveSubscribers}
              contextFilter={contextFilter}
              creatorContextFilter={creatorContextFilter}
              dataOverride={data?.performanceConsistency ?? null}
              loadingOverride={isLoading}
              errorOverride={errorMessage}
              disableFetch={true}
            />
          </div>
          <div className="col-span-full mt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Alcance</h3>
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Mais Posts"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/most-prolific`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              tooltip="Quantidade total de conteúdos publicados no período selecionado."
              limit={rankingLimit}
              onlyActiveSubscribers={onlyActiveSubscribers}
              contextFilter={contextFilter}
              creatorContextFilter={creatorContextFilter}
              dataOverride={data?.mostProlific ?? null}
              loadingOverride={isLoading}
              errorOverride={errorMessage}
              disableFetch={true}
            />
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Mais Compartilhamentos"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/top-sharing`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              tooltip="Total de compartilhamentos obtidos pelos posts no período."
              limit={rankingLimit}
              onlyActiveSubscribers={onlyActiveSubscribers}
              contextFilter={contextFilter}
              creatorContextFilter={creatorContextFilter}
              dataOverride={data?.topSharing ?? null}
              loadingOverride={isLoading}
              errorOverride={errorMessage}
              disableFetch={true}
            />
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Alcance Médio/Post"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/avg-reach-per-post`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              tooltip="Média de alcance por post; inclui criadores com pelo menos 3 posts."
              limit={rankingLimit}
              onlyActiveSubscribers={onlyActiveSubscribers}
              contextFilter={contextFilter}
              creatorContextFilter={creatorContextFilter}
              dataOverride={data?.avgReachPerPost ?? null}
              loadingOverride={isLoading}
              errorOverride={errorMessage}
              disableFetch={true}
            />
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Alcance por Seguidor"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/reach-per-follower`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              tooltip="Relação entre alcance total e seguidores; mede eficiência de distribuição."
              limit={rankingLimit}
              onlyActiveSubscribers={onlyActiveSubscribers}
              contextFilter={contextFilter}
              creatorContextFilter={creatorContextFilter}
              dataOverride={data?.reachPerFollower ?? null}
              loadingOverride={isLoading}
              errorOverride={errorMessage}
              disableFetch={true}
            />
          </div>
          <div className="inline-flex md:block">
            <TopCreatorsWidget
              title="Top Criadores"
              apiPrefix={apiPrefix}
              timePeriod={validatedTimePeriod}
              limit={5}
              compositeRanking={true}
              onlyActiveSubscribers={onlyActiveSubscribers}
              context={contextFilter}
              creatorContext={creatorContextFilter}
              tooltip="Score composto: 40% engajamento médio, 30% interações/post, 20% alcance/seguidor e 10% crescimento de seguidores"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CreatorRankingSection;
