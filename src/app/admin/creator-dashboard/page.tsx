'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

import GlobalTimePeriodFilter from './components/filters/GlobalTimePeriodFilter';
import { GlobalTimePeriodProvider, useGlobalTimePeriod } from './components/filters/GlobalTimePeriodContext';
import PlatformSummaryKpis from './components/kpis/PlatformSummaryKpis';
import PlatformOverviewSection from './components/views/PlatformOverviewSection';
import PlatformContentAnalysisSection from './components/views/PlatformContentAnalysisSection';
import CreatorRankingSection from './components/views/CreatorRankingSection';
import TopMoversSection from './components/views/TopMoversSection';
import UserDetailView from './components/views/UserDetailView';
import CreatorQuickSearch from './components/CreatorQuickSearch';
import ContentTrendChart from './ContentTrendChart';
import PostDetailModal from './PostDetailModal';
import ScrollToTopButton from '@/app/components/ScrollToTopButton';
import GlobalPostsExplorer from './GlobalPostsExplorer';
import {
  formatCategories,
  proposalCategories,
  contextCategories,
  toneCategories,
  referenceCategories,
} from '../../lib/classification';


// --- Contexto, Provider e Hook para o Filtro de Tempo Global ---
type TimePeriod =
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'last_6_months'
  | 'last_12_months'
  | 'all_time';

// --- Função auxiliar de data ---
const getStartDateFromTimePeriod = (endDate: Date, timePeriod: TimePeriod): Date => {
    const startDate = new Date(endDate);
    switch (timePeriod) {
        case 'last_7_days':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case 'last_30_days':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        case 'last_90_days':
            startDate.setMonth(startDate.getMonth() - 3);
            break;
        case 'last_6_months':
            startDate.setMonth(startDate.getMonth() - 6);
            break;
        case 'last_12_months':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        case 'all_time':
            return new Date(0); // Início da Época Unix
    }
    return startDate;
};

// --- Componentes de Apoio ---

const SkeletonBlock = ({ width = 'w-full', height = 'h-4', className = '', variant = 'rectangle' }: { width?: string; height?: string; className?: string; variant?: 'rectangle' | 'circle' }) => {
  const baseClasses = "bg-gray-200 animate-pulse";
  const shapeClass = variant === 'circle' ? 'rounded-full' : 'rounded';
  return <div className={`${baseClasses} ${width} ${height} ${shapeClass} ${className}`}></div>;
};

const EmptyState = ({ icon, title, message }: { icon: React.ReactNode; title: string; message: string; }) => (
  <div className="text-center py-8">
    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">{icon}</div>
    <h3 className="mt-2 text-sm font-semibold text-gray-900">{title}</h3>
    <p className="mt-1 text-sm text-gray-500">{message}</p>
  </div>
);

// --- Tipos e Interfaces ---
interface IGlobalPostResult {
  _id?: string;
  text_content?: string;
  description?: string;
  coverUrl?: string;
  creatorName?: string;
  postDate?: Date | string;
  format?: string[];
  proposal?: string[];
  context?: string[];
  tone?: string[];
  references?: string[];
  stats?: {
    total_interactions?: number;
    likes?: number;
    shares?: number;
  };
}
const AdminCreatorDashboardContent: React.FC = () => {

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const { timePeriod: globalTimePeriod, setTimePeriod: setGlobalTimePeriod } = useGlobalTimePeriod();


  const formatOptions = formatCategories.map(c => c.label);
  const proposalOptions = proposalCategories.map(c => c.label);

  const [marketFormat, setMarketFormat] = useState<string>(formatOptions[0]!);
  const [marketProposal, setMarketProposal] = useState<string>(proposalOptions[0]!);

  const today = new Date();
  const startDateObj = getStartDateFromTimePeriod(today, globalTimePeriod as TimePeriod);
  const startDate = startDateObj.toISOString();
  const endDate = today.toISOString();
  const rankingDateRange = { startDate, endDate };
  const startDateLabel = startDateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const endDateLabel = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const rankingDateLabel = `${startDateLabel} - ${endDateLabel}`;


  const handleUserSelect = (userId: string, userName: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    const userDetailSection = document.getElementById("user-detail-view-container");
    if (userDetailSection) {
      userDetailSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      <Head>
        <title>Dashboard Admin - Data2Content</title>
      </Head>
      <div className="min-h-screen bg-brand-light">
        <header className="bg-brand-light sticky top-0 z-40 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 h-16">
              <CreatorQuickSearch
                onSelect={(creator) => handleUserSelect(creator.id, creator.name)}
                selectedCreatorName={selectedUserName}
                onClear={() => {
                  setSelectedUserId(null);
                  setSelectedUserName(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
              <div className="ml-auto">
                <GlobalTimePeriodFilter
                  selectedTimePeriod={globalTimePeriod}
                  onTimePeriodChange={setGlobalTimePeriod}
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
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-brand-dark mb-6">
              Dashboard Administrativo de Criadores
            </h1>

            <section id="platform-summary" className="mb-8">
              <PlatformSummaryKpis startDate={startDate} endDate={endDate} />
            </section>


          
          {/* --- CORREÇÃO FINAL: Bloco de visão geral reorganizado --- */}
          {!selectedUserId && (
            <>
              {/* 1. Ranking de Criadores */}
              <CreatorRankingSection
                rankingDateRange={rankingDateRange}
                rankingDateLabel={rankingDateLabel}
              />

              {/* 2. Destaques e Análise por Horário */}
              <PlatformContentAnalysisSection
                startDate={startDate}
                endDate={endDate}
              />

              {/* 3. Visão Geral da Plataforma */}
              <PlatformOverviewSection />

              {/* 4. Top Movers */}
              <TopMoversSection />

              {/* 5. Explorador de Posts (Final) */}
              <section id="global-posts-explorer" className="mt-8">
                <GlobalPostsExplorer dateRangeFilter={{ startDate, endDate }} />
              </section>
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

          <ScrollToTopButton />
          </div>
        </main>

        <footer className="text-center mt-20 py-10 border-t border-gray-200 text-xs text-gray-500 font-light">
          © {new Date().getFullYear()} Data2Content. Todos os direitos reservados.
        </footer>
      </div>
    </>
  );
};

const AdminCreatorDashboardPage: React.FC = () => (
  <GlobalTimePeriodProvider>
    <AdminCreatorDashboardContent />
  </GlobalTimePeriodProvider>
);

export default AdminCreatorDashboardPage;