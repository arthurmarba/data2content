"use client";

import React, { useState } from "react";
import CreatorSelector from "./components/CreatorSelector";

// Filtro Global
import GlobalTimePeriodFilter from "./components/filters/GlobalTimePeriodFilter";
import {
  GlobalTimePeriodProvider,
  useGlobalTimePeriod,
} from "./components/filters/GlobalTimePeriodContext";

// Componentes da Plataforma - Módulo 1 (Visão Geral)
import PlatformSummaryKpis from "./components/kpis/PlatformSummaryKpis";
import PlatformOverviewSection from "./components/views/PlatformOverviewSection";
import PlatformContentAnalysisSection from "./components/views/PlatformContentAnalysisSection";
import ProposalRankingSection from "./components/views/ProposalRankingSection";
import CreatorRankingSection from "./components/views/CreatorRankingSection";
import TopMoversSection from "./components/views/TopMoversSection";
import CohortComparisonSection from "./components/views/CohortComparisonSection";
import MarketPerformanceSection from "./components/views/MarketPerformanceSection";
import AdvancedAnalysisSection from "./components/views/AdvancedAnalysisSection";
import CreatorHighlightsSection from "./components/views/CreatorHighlightsSection";

// Componentes da Plataforma - Módulo 2 (Análise de Conteúdo)
import { getStartDateFromTimePeriod } from "@/utils/dateHelpers";
import ScrollToTopButton from "@/app/components/ScrollToTopButton";

// View de Detalhe do Criador (Módulo 3 e partes do Módulo 2 para usuário)
import UserDetailView from "./components/views/UserDetailView";

const AdminCreatorDashboardContent: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const { timePeriod: globalTimePeriod, setTimePeriod: setGlobalTimePeriod } =
    useGlobalTimePeriod();

  const selectedComparisonPeriodForPlatformKPIs = "month_vs_previous";
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const formatOptions = ["Reel", "Post Estático", "Carrossel", "Story"];
  const proposalOptions = [
    "Educativo",
    "Humor",
    "Notícia",
    "Review",
    "Tutorial",
  ];
  const [marketFormat, setMarketFormat] = useState<string>(formatOptions[0]!);
  const [marketProposal, setMarketProposal] = useState<string>(
    proposalOptions[0]!,
  );

  const today = new Date();
  const startDateObj = getStartDateFromTimePeriod(today, globalTimePeriod);
  const startDate = startDateObj.toISOString();
  const endDate = today.toISOString();
  const rankingDateRange = { startDate, endDate };
  const startDateLabel = startDateObj.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const endDateLabel = today.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const rankingDateLabel = `${startDateLabel} - ${endDateLabel}`;

  const handleUserSelect = (userId: string, userName: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    const userDetailSection = document.getElementById(
      "user-detail-view-container",
    );
    if (userDetailSection) {
      userDetailSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-100 min-h-screen">
      <header className="mb-8 sticky top-0 z-20 bg-gray-100 pb-4 border-b border-gray-200">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          Dashboard Administrativo de Criadores
        </h1>

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
        <PlatformSummaryKpis startDate={startDate} endDate={endDate} />
      </section>

      <section
        id="creator-selection"
        className="mb-8 p-4 bg-white rounded-lg shadow"
      >
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          Selecionar Criador para Detalhar
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => setIsSelectorOpen(true)}
            className="p-2 rounded-md text-sm bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
          >
            Buscar Criador
          </button>
          {selectedUserName && (
            <span className="px-2 py-1 text-sm bg-indigo-50 text-indigo-700 rounded">
              {selectedUserName}
            </span>
          )}
          {selectedUserId && (
            <button
              onClick={() => {
                setSelectedUserId(null);
                setSelectedUserName(null);
              }}
              className="p-2 rounded-md text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              Limpar seleção e voltar à visão geral
            </button>
          )}
        </div>
      </section>

      {!selectedUserId && (
        <>
          <PlatformOverviewSection
            comparisonPeriod={selectedComparisonPeriodForPlatformKPIs}
          />
          <PlatformContentAnalysisSection
            startDate={startDate}
            endDate={endDate}
          />
          <ProposalRankingSection
            rankingDateRange={rankingDateRange}
            rankingDateLabel={rankingDateLabel}
          />
          <CreatorRankingSection
            rankingDateRange={rankingDateRange}
            rankingDateLabel={rankingDateLabel}
          />
          <TopMoversSection />
          <CohortComparisonSection startDate={startDate} endDate={endDate} />
          <MarketPerformanceSection
            formatOptions={formatOptions}
            proposalOptions={proposalOptions}
            marketFormat={marketFormat}
            marketProposal={marketProposal}
            setMarketFormat={setMarketFormat}
            setMarketProposal={setMarketProposal}
          />
          <AdvancedAnalysisSection />
          <CreatorHighlightsSection />
        </>
      )}

      <div id="user-detail-view-container">
        {selectedUserId && (
          <UserDetailView
            userId={selectedUserId}
            userName={selectedUserName ?? undefined}
          />
        )}
      </div>

      <CreatorSelector
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        onSelect={(creator) => handleUserSelect(creator.id, creator.name)}
      />
      <ScrollToTopButton />
    </div>
  );
};

const AdminCreatorDashboardPage: React.FC = () => (
  <GlobalTimePeriodProvider>
    <AdminCreatorDashboardContent />
  </GlobalTimePeriodProvider>
);

export default AdminCreatorDashboardPage;
