"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import CreatorRankingCard from "../../CreatorRankingCard";
import TopCreatorsWidget from "../../TopCreatorsWidget";
import { useGlobalTimePeriod } from "../filters/GlobalTimePeriodContext";
import { TimePeriod } from "@/app/lib/constants/timePeriods"; // Importa o tipo específico

interface Props {
  rankingDateRange: { startDate: string; endDate: string };
  rankingDateLabel: string;
  apiPrefix?: string;
}

const CreatorRankingSection: React.FC<Props> = ({
  rankingDateRange,
  rankingDateLabel,
  apiPrefix = '/api/admin',
}) => {
  const { timePeriod: globalTimePeriod } = useGlobalTimePeriod();
  
  // A correção é aplicar uma asserção de tipo para garantir ao TypeScript
  // que a string 'globalTimePeriod' é um dos valores permitidos.
  const validatedTimePeriod = globalTimePeriod as TimePeriod;

  return (
    <section id="creator-rankings" className="mb-10">
      <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
        Rankings de Criadores <GlobalPeriodIndicator />
      </h2>
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
              limit={5}
            />
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Mais Interações"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/top-interactions`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              tooltip="Soma de todas as interações (curtidas, comentários, etc.) no período."
              limit={5}
            />
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Engajamento Médio/Post"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/avg-engagement-per-post`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              tooltip="Média de interações por post; considera apenas criadores com 3 ou mais posts."
              limit={5}
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
              limit={5}
            />
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Consistência de Performance"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/performance-consistency`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              tooltip="Avalia a regularidade do engajamento por post; exige ao menos 5 posts relevantes."
              limit={5}
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
              limit={5}
            />
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Mais Compartilhamentos"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/top-sharing`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              tooltip="Total de compartilhamentos obtidos pelos posts no período."
              limit={5}
            />
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Alcance Médio/Post"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/avg-reach-per-post`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              tooltip="Média de alcance por post; inclui criadores com pelo menos 3 posts."
              limit={5}
            />
          </div>
          <div className="inline-flex md:block">
            <CreatorRankingCard
              title="Alcance por Seguidor"
              apiEndpoint={`${apiPrefix}/dashboard/rankings/creators/reach-per-follower`}
              dateRangeFilter={rankingDateRange}
              dateRangeLabel={rankingDateLabel}
              tooltip="Relação entre alcance total e seguidores; mede eficiência de distribuição."
              limit={5}
            />
          </div>
          <div className="inline-flex md:block">
          <TopCreatorsWidget
            title="Top Criadores"
            timePeriod={validatedTimePeriod}
            limit={5}
            compositeRanking={true}
            tooltip="Score composto: 40% engajamento médio, 30% interações/post, 20% alcance/seguidor e 10% crescimento de seguidores"
          />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CreatorRankingSection;
