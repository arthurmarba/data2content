"use client";

import React, { useState } from 'react';
import CreatorSelector from './components/CreatorSelector';

// Filtro Global
import GlobalTimePeriodFilter from './components/filters/GlobalTimePeriodFilter';

// Componentes da Plataforma - Módulo 1 (Visão Geral)
import PlatformFollowerTrendChart from './components/PlatformFollowerTrendChart';
import PlatformReachEngagementTrendChart from './components/PlatformReachEngagementTrendChart';
import PlatformMovingAverageEngagementChart from './components/PlatformMovingAverageEngagementChart';
import TotalActiveCreatorsKpi from './components/kpis/TotalActiveCreatorsKpi';
import PlatformComparativeKpi from './components/kpis/PlatformComparativeKpi';
import PlatformSummaryKpis from './components/kpis/PlatformSummaryKpis';

// Componentes da Plataforma - Módulo 2 (Análise de Conteúdo)
import PlatformAverageEngagementChart from './components/PlatformAverageEngagementChart';
import PlatformPostDistributionChart from './components/PlatformPostDistributionChart'; // Contagem de Posts por Formato
import PlatformEngagementDistributionByFormatChart from './components/PlatformEngagementDistributionByFormatChart'; // Engajamento por Formato
import PlatformVideoPerformanceMetrics from './components/PlatformVideoPerformanceMetrics';
import PlatformMonthlyEngagementStackedChart from './components/PlatformMonthlyEngagementStackedChart';
import PlatformPerformanceHighlights from './components/PlatformPerformanceHighlights';
import ProposalRankingCard from './ProposalRankingCard';
import CreatorRankingCard from './CreatorRankingCard';
import TopCreatorsWidget from './TopCreatorsWidget';
import TopMoversWidget from './TopMoversWidget';
import { getStartDateFromTimePeriod, formatDateYYYYMMDD } from '@/utils/dateHelpers';
import CohortComparisonChart from './components/CohortComparisonChart';

// View de Detalhe do Criador (Módulo 3 e partes do Módulo 2 para usuário)
import UserDetailView from './components/views/UserDetailView';


const AdminCreatorDashboardPage: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [globalTimePeriod, setGlobalTimePeriod] = useState<string>("last_90_days"); // Default para 90 dias

  const selectedComparisonPeriodForPlatformKPIs = "month_vs_previous";
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const today = new Date();
  const startDate = formatDateYYYYMMDD(getStartDateFromTimePeriod(today, globalTimePeriod));
  const endDate = formatDateYYYYMMDD(today);
  const rankingDateRange = { startDate, endDate };


  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    const userDetailSection = document.getElementById("user-detail-view-container");
    if (userDetailSection) {
        userDetailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-100 min-h-screen">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Dashboard Administrativo de Criadores</h1>

        <div className="mt-4 p-4 bg-white rounded-md shadow">
          <GlobalTimePeriodFilter
            selectedTimePeriod={globalTimePeriod}
            onTimePeriodChange={setGlobalTimePeriod}
            // Opções de período para o filtro global podem ser diferentes das opções dos componentes individuais
            options={[
                { value: "last_7_days", label: "Últimos 7 dias" },
                { value: "last_30_days", label: "Últimos 30 dias" },
                { value: "last_90_days", label: "Últimos 90 dias" },
                { value: "last_6_months", label: "Últimos 6 meses" },
                { value: "last_12_months", label: "Últimos 12 meses" },
                { value: "all_time", label: "Todo o período" },
            ]}
          />
        </div>
      </header>

      <section id="platform-summary" className="mb-8">
        <PlatformSummaryKpis />
      </section>

      <section id="creator-selection-simulation" className="mb-8 p-4 bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Simular Seleção de Criador Detalhado:</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setIsSelectorOpen(true)}
            className="p-2 rounded-md text-sm bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
          >
            Buscar Criador
          </button>
          {selectedUserId && (
            <button
              onClick={() => setSelectedUserId(null)}
              className="p-2 rounded-md text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              Limpar Seleção (Ver Visão Geral da Plataforma)
            </button>
          )}
        </div>
      </section>

      {!selectedUserId && (
        <>
          <section id="platform-overview" className="mb-10">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
              Visão Geral da Plataforma
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
              <TotalActiveCreatorsKpi />
              <PlatformComparativeKpi
                kpiName="platformFollowerGrowth"
                title="Crescimento de Seguidores"
                comparisonPeriod={selectedComparisonPeriodForPlatformKPIs}
                tooltip="Crescimento total de seguidores na plataforma comparado ao período anterior selecionado."
              />
              <PlatformComparativeKpi
                kpiName="platformTotalEngagement"
                title="Engajamento Total"
                comparisonPeriod={selectedComparisonPeriodForPlatformKPIs}
                tooltip="Soma total de interações em todos os posts da plataforma comparado ao período anterior selecionado."
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
              <PlatformFollowerTrendChart timePeriod={globalTimePeriod} />
              <PlatformReachEngagementTrendChart timePeriod={globalTimePeriod} />
            </div>
            <div className="grid grid-cols-1 gap-6">
              <PlatformMovingAverageEngagementChart timePeriod={globalTimePeriod} />
            </div>
          </section>

          <section id="platform-content-analysis" className="mb-10">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
              Análise de Conteúdo da Plataforma
            </h2>
            <div className="mb-6 md:mb-8">
                <PlatformPerformanceHighlights timePeriod={globalTimePeriod}/>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
              <PlatformAverageEngagementChart
                initialGroupBy="format"
                chartTitle="Engajamento Médio por Formato (Plataforma)"
                timePeriod={globalTimePeriod}
              />
              <PlatformAverageEngagementChart
                initialGroupBy="context"
                chartTitle="Engajamento Médio por Contexto (Plataforma)"
                timePeriod={globalTimePeriod}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 md:mb-8">
              <PlatformPostDistributionChart timePeriod={globalTimePeriod} chartTitle="Distribuição de Posts por Formato (Plataforma)" />
              <PlatformVideoPerformanceMetrics timePeriod={globalTimePeriod} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> {/* Nova linha ou ajuste no grid */}
                <PlatformMonthlyEngagementStackedChart timePeriod={globalTimePeriod} />
                <PlatformEngagementDistributionByFormatChart timePeriod={globalTimePeriod} /> {/* Adicionado aqui */}
            </div>
          </section>

          <section id="proposal-ranking" className="mb-10">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
              Ranking por Proposta
            </h2>
            <ProposalRankingCard
              title="Propostas com Mais Interações"
              apiEndpoint="/api/admin/dashboard/rankings/proposals?metric=total_interactions"
              dateRangeFilter={rankingDateRange}
              limit={5}
            />
        </section>

        <section id="creator-rankings" className="mb-10">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
            Rankings de Criadores
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <CreatorRankingCard
              title="Maior Engajamento"
              apiEndpoint="/api/admin/dashboard/rankings/creators/top-engaging"
              dateRangeFilter={rankingDateRange}
              metricLabel="%"
              limit={5}
            />
            <CreatorRankingCard
              title="Mais Interações"
              apiEndpoint="/api/admin/dashboard/rankings/creators/top-interactions"
              dateRangeFilter={rankingDateRange}
              limit={5}
            />
            <CreatorRankingCard
              title="Mais Posts"
              apiEndpoint="/api/admin/dashboard/rankings/creators/most-prolific"
              dateRangeFilter={rankingDateRange}
              limit={5}
            />
              <CreatorRankingCard
                title="Mais Compartilhamentos"
                apiEndpoint="/api/admin/dashboard/rankings/creators/top-sharing"
                dateRangeFilter={rankingDateRange}
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

        <section id="top-movers" className="mb-10">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
            Top Movers
          </h2>
          <TopMoversWidget />
        </section>

        <section id="cohort-comparison" className="mb-10">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
            Comparação de Coortes
          </h2>
          <CohortComparisonChart
            metric="engagement_rate_on_reach"
            startDate={startDate}
            endDate={endDate}
            cohorts={[
              { filterBy: 'planStatus', value: 'Pro', name: 'Plano Pro' },
              { filterBy: 'planStatus', value: 'Free', name: 'Plano Free' }
            ]}
          />
        </section>

          <section id="creator-highlights-and-scatter-plot" className="mb-10">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
              Destaques e Análise Comparativa de Criadores
            </h2>
            <p className="text-sm text-gray-500 mb-4 italic">
              (Em breve: Tabelas de Criadores com melhor performance)
            </p>
            <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
                 {/* CreatorsScatterPlot was removed here */}
            </div>
          </section>
        </>
      )}

      <div id="user-detail-view-container">
        {selectedUserId && (
          <UserDetailView
            userId={selectedUserId}
            initialChartsTimePeriod={globalTimePeriod} // Passar o período global
          />
        )}
      </div>

      <CreatorSelector
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        onSelect={(creator) => handleUserSelect(creator.id)}
      />
    </div>
  );
};

export default AdminCreatorDashboardPage;

