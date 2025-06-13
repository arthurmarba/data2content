'use client';

import React, { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import CreatorTable from './CreatorTable';
import ContentStatsWidgets from './ContentStatsWidgets';
import GlobalPostsExplorer from './GlobalPostsExplorer';
import {
  XMarkIcon,
  FunnelIcon,
  ChartBarSquareIcon,
  UserGroupIcon,
  GlobeAltIcon,
  WrenchScrewdriverIcon,
  SparklesIcon, // Alternative for Advanced Tools
  TrophyIcon,
  UsersIcon,
  UserPlusIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'; // Changed to outline for consistency
import CreatorRankingCard from './CreatorRankingCard'; // Adjust path if necessary
import KpiCard from '../components/KpiCard'; // Ajuste se o caminho for diferente
import { AdminDashboardSummaryData } from '@/types/admin/dashboard'; // Ajuste o caminho

// Lazy load StandaloneChatInterface
const DynamicAIChatInterface = dynamic(() => import('./StandaloneChatInterface'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><p className="text-gray-500">Carregando Chat IA...</p></div>,
});

// Lazy load ContentSegmentComparison
const DynamicContentSegmentComparison = dynamic(
  () => import('./ContentSegmentComparison'),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[300px] flex items-center justify-center mt-8">
        <p className="text-gray-500">Carregando Comparador de Segmentos...</p>
      </div>
    ),
  }
);

// Lazy load TopMoversWidget
const DynamicTopMoversWidget = dynamic(
  () => import('./TopMoversWidget'),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[400px] flex items-center justify-center mt-8">
        <p className="text-gray-500">Carregando Widget Top Movers...</p>
      </div>
    ),
  }
);

/**
 * @page CreatorDashboardPage
 * @description Admin dashboard for monitoring creators and content performance.
 * This page provides a central hub for administrators to view key metrics,
 * manage creator data, and analyze content trends.
 *
 * @version 1.0.0
 */

// Define types for filters, could be in a separate types file
export interface GlobalFiltersState {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  planStatus: string[]; // MODIFIED: Now an array of strings
  expertiseLevel: string[]; // MODIFIED: Now an array of strings
}

// Define options for checkboxes
const PLAN_STATUS_OPTIONS = ['Free', 'Pro', 'Premium', 'Trial', 'Active', 'Inactive']; // Adjusted example values
const EXPERTISE_LEVEL_OPTIONS = ['Iniciante', 'Intermediário', 'Avançado', 'Especialista']; // Adjusted example values


export default function CreatorDashboardPage() {
  const [filters, setFilters] = useState<GlobalFiltersState>({
    dateRange: { startDate: '', endDate: '' },
    planStatus: [], // Initialize as empty array
    expertiseLevel: [], // Initialize as empty array
  });

  // This key will be changed to trigger re-fetch in child components
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAiChatVisible, setIsAiChatVisible] = useState(false);

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setFilters(prevFilters => {
        const currentValues = prevFilters[name as keyof Pick<GlobalFiltersState, 'planStatus' | 'expertiseLevel'>] as string[];
        if (checked) {
          return { ...prevFilters, [name]: [...currentValues, value] };
        } else {
          return { ...prevFilters, [name]: currentValues.filter(item => item !== value) };
        }
      });
    } else if (name === 'startDate' || name === 'endDate') {
      setFilters(prev => ({
        ...prev,
        dateRange: { ...prev.dateRange, [name]: value },
      }));
    } else {
      setFilters(prev => ({ ...prev, [name]: value }));
    }
  }, []); // No dependencies needed as it only uses event target and setState

  const handleApplyFilters = useCallback(() => {
    if (filters.dateRange.startDate && filters.dateRange.endDate && filters.dateRange.startDate > filters.dateRange.endDate) {
        alert("A data de início não pode ser posterior à data de término.");
        return;
    }
    setRefreshKey(prev => prev + 1);
  }, [filters.dateRange]); // Depends on dateRange for validation before refreshing

  // Memoize derived filter strings for props
  const planStatusFilterString = useMemo(() => {
    return filters.planStatus.length > 0 ? filters.planStatus.join(',') : undefined;
  }, [filters.planStatus]);

  const expertiseLevelFilterString = useMemo(() => {
    return filters.expertiseLevel.length > 0 ? filters.expertiseLevel.join(',') : undefined;
  }, [filters.expertiseLevel]);

  const dateRangeFilterProp = useMemo(() => {
    return filters.dateRange.startDate && filters.dateRange.endDate ? filters.dateRange : undefined;
  }, [filters.dateRange]);

  // State and useEffect for KPIs
  const [summaryKpis, setSummaryKpis] = useState<AdminDashboardSummaryData | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [kpisError, setKpisError] = useState<string | null>(null);

  useEffect(() => {
    const fetchKpis = async () => {
      setKpisLoading(true);
      setKpisError(null);
      try {
        const response = await fetch('/api/admin/dashboard-summary');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Falha ao buscar KPIs do dashboard');
        }
        const data: AdminDashboardSummaryData = await response.json();
        setSummaryKpis(data);
      } catch (e: any) {
        setKpisError(e.message);
        setSummaryKpis(null);
      } finally {
        setKpisLoading(false);
      }
    };
    fetchKpis();
  }, []); // Executa uma vez ao montar o componente



  return (
    <div className="bg-brand-light min-h-screen relative"> {/* Added relative for modal positioning context */}
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Creator & Content Dashboard
          </h1>
          <p className="text-md text-gray-600 mt-2">
            Monitorize, analise e obtenha insights sobre criadores e conteúdo da plataforma.
          </p>
        </header>

        {/* Section: Resumo da Plataforma (KPIs) */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
            Resumo da Plataforma
          </h2>
          {kpisError && (
            <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
              <ExclamationTriangleIcon className="w-5 h-5 inline mr-2"/>
              <span className="font-medium">Erro ao carregar resumo:</span> {kpisError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <KpiCard
              label={summaryKpis?.totalCreators?.label || 'Total de Criadores'}
              value={kpisLoading ? undefined : summaryKpis?.totalCreators?.value}
              icon={UsersIcon}
              isLoading={kpisLoading}
            />
            <KpiCard
              label={summaryKpis?.pendingCreators?.label || 'Criadores Pendentes'}
              value={kpisLoading ? undefined : summaryKpis?.pendingCreators?.value}
              icon={UserPlusIcon}
              isLoading={kpisLoading}
            />
            {/* Add more KpiCard instances here as needed */}
          </div>
        </section>

        {/* Section: Destaques de Criadores */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
            <TrophyIcon className="w-7 h-7 mr-3 text-gray-500" aria-hidden="true" />
            Destaques de Criadores
            {dateRangeFilterProp?.startDate && dateRangeFilterProp?.endDate && (
              <span className="text-sm font-normal text-gray-400 ml-2">
                (Período: {new Date(dateRangeFilterProp.startDate + 'T00:00:00').toLocaleDateString('pt-BR')} - {new Date(dateRangeFilterProp.endDate + 'T00:00:00').toLocaleDateString('pt-BR')})
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <CreatorRankingCard
              title="Maiores Engajadores"
              apiEndpoint="/api/admin/dashboard/rankings/creators/top-engaging"
              dateRangeFilter={dateRangeFilterProp}
              metricLabel="%"
              limit={5}
            />
            <CreatorRankingCard
              title="Mais Prolíficos"
              apiEndpoint="/api/admin/dashboard/rankings/creators/most-prolific"
              dateRangeFilter={dateRangeFilterProp}
              metricLabel="posts"
              limit={5}
            />
            <CreatorRankingCard
              title="Campeões de Interação"
              apiEndpoint="/api/admin/dashboard/rankings/creators/top-interactions"
              dateRangeFilter={dateRangeFilterProp}
              metricLabel="interações"
              limit={5}
            />
            <CreatorRankingCard
              title="Mestres do Compartilhamento"
              apiEndpoint="/api/admin/dashboard/rankings/creators/top-sharing"
              dateRangeFilter={dateRangeFilterProp}
              metricLabel="compart."
              limit={5}
            />
          </div>
        </section>

        {/* Global Filters Section */}
        <section className="mb-8 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Filtros Globais
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
              <input
                type="date"
                name="startDate"
                id="startDate"
                value={filters.dateRange.startDate}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-gray-900"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
              <input
                type="date"
                name="endDate"
                id="endDate"
                value={filters.dateRange.endDate}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-gray-900"
              />
            </div>
            {/* Plan Status Checkboxes */}
            <div className="lg:col-span-2"> {/* Allow more space for checkboxes */}
              <label className="block text-sm font-medium text-gray-700 mb-1">Status do Plano</label>
              <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 p-2 border border-gray-300 rounded-md bg-white max-h-32 overflow-y-auto">
                {PLAN_STATUS_OPTIONS.map(option => (
                  <div key={option} className="flex items-center">
                    <input
                      id={`planStatus-${option}`}
                      name="planStatus"
                      type="checkbox"
                      value={option}
                      checked={filters.planStatus.includes(option)}
                      onChange={handleFilterChange}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor={`planStatus-${option}`} className="ml-2 text-xs text-gray-700">
                      {option}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Expertise Level Checkboxes */}
            <div className="lg:col-span-2"> {/* Allow more space for checkboxes */}
              <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Expertise</label>
              <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 p-2 border border-gray-300 rounded-md bg-white max-h-32 overflow-y-auto">
                {EXPERTISE_LEVEL_OPTIONS.map(option => (
                  <div key={option} className="flex items-center">
                    <input
                      id={`expertiseLevel-${option}`}
                      name="expertiseLevel"
                      type="checkbox"
                      value={option}
                      checked={filters.expertiseLevel.includes(option)}
                      onChange={handleFilterChange}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor={`expertiseLevel-${option}`} className="ml-2 text-xs text-gray-700">
                      {option}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleApplyFilters}
              className="w-full lg:self-end h-[42px] flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <FunnelIcon className="w-5 h-5 mr-2" aria-hidden="true" />
              Aplicar Filtros
            </button>
          </div>
        </section>

        {/* Main Content Area - Dashboard Widgets */}
        <main className="space-y-12">

          {/* Section: Visão Geral */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
              <ChartBarSquareIcon className="w-7 h-7 mr-3 text-gray-500" aria-hidden="true" />
              Visão Geral
            </h2>
            <ContentStatsWidgets
              key={`contentStats-${refreshKey}`}
              dateRangeFilter={dateRangeFilterProp}
            />
          </section>

          {/* Section: Análise de Criadores */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
              <UserGroupIcon className="w-7 h-7 mr-3 text-gray-500" aria-hidden="true" />
              Análise de Criadores
            </h2>
            <CreatorTable
              key={`creatorTable-${refreshKey}`}
              planStatusFilter={planStatusFilterString}
              expertiseLevelFilter={expertiseLevelFilterString}
              dateRangeFilter={dateRangeFilterProp}
            />
          </section>

          {/* Section: Exploração de Conteúdo Global */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
              <GlobeAltIcon className="w-7 h-7 mr-3 text-gray-500" aria-hidden="true" />
              Exploração de Conteúdo Global
            </h2>
            <GlobalPostsExplorer dateRangeFilter={dateRangeFilterProp} />
          </section>

          {/* Section: Ferramentas de Análise Avançada */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
              <SparklesIcon className="w-7 h-7 mr-3 text-gray-500" aria-hidden="true" /> {/* Using SparklesIcon */}
              Ferramentas de Análise Avançada
            </h2>
            <div className="space-y-8">
              <DynamicContentSegmentComparison dateRangeFilter={dateRangeFilterProp} />
              <DynamicTopMoversWidget />
            </div>
          </section>

        </main>

        {/* AI Chat Integration Section - Floating Button Example */}
        <div className="fixed bottom-8 right-8 z-50">
          <button
            type="button"
            onClick={() => setIsAiChatVisible(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-full text-lg font-semibold shadow-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-4 focus:ring-indigo-500 transition-all ease-in-out duration-150 hover:scale-105 active:scale-95"
            title="Abrir Chat IA"
          >
            Chat IA
          </button>
        </div>

        {/* AI Chat Modal */}
        {isAiChatVisible && (
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if(e.target === e.currentTarget) setIsAiChatVisible(false);}}> {/* Click outside to close */}
            {/* Modal Content */}
            <div className="bg-gray-100 w-full max-w-2xl h-[80vh] max-h-[700px] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-300">
              <header className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-800">
                  Assistente IA
                </h2>
                <button
                  onClick={() => setIsAiChatVisible(false)}
                  className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400" // Icon button style
                  title="Fechar chat"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </header>
              <div className="flex-grow overflow-y-auto">
                <DynamicAIChatInterface />
              </div>
            </div>
          </div>
        )}

        {/* Footer (Optional) */}
        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Creator Platform. Todos os direitos reservados.</p>
        </footer>
      </div>
    </div>
  );
}
