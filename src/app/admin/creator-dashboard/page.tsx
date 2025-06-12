'use client';

import React, { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic'; // Import dynamic
import CreatorTable from './CreatorTable';
import ContentStatsWidgets from './ContentStatsWidgets';
// import StandaloneChatInterface from './StandaloneChatInterface'; // Remove direct import
import GlobalPostsExplorer from './GlobalPostsExplorer';
import { XMarkIcon } from '@heroicons/react/24/solid';

// Lazy load StandaloneChatInterface
const DynamicAIChatInterface = dynamic(() => import('./StandaloneChatInterface'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><p className="text-gray-500 dark:text-gray-400">Carregando Chat IA...</p></div>,
});

// Lazy load ContentSegmentComparison
const DynamicContentSegmentComparison = dynamic(
  () => import('./ContentSegmentComparison'),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 min-h-[300px] flex items-center justify-center mt-8">
        <p className="text-gray-500 dark:text-gray-400">Carregando Comparador de Segmentos...</p>
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
      <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 min-h-[400px] flex items-center justify-center mt-8">
        <p className="text-gray-500 dark:text-gray-400">Carregando Widget Top Movers...</p>
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



  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen relative"> {/* Added relative for modal positioning context */}
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Creator & Content Dashboard
          </h1>
          <p className="text-md text-gray-600 dark:text-gray-400 mt-2">
            Monitorize, analise e obtenha insights sobre criadores e conteúdo da plataforma.
          </p>
        </header>

        {/* Global Filters Section */}
        <section className="mb-8 p-6 bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
            Filtros Globais
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Início</label>
              <input
                type="date"
                name="startDate"
                id="startDate"
                value={filters.dateRange.startDate}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Fim</label>
              <input
                type="date"
                name="endDate"
                id="endDate"
                value={filters.dateRange.endDate}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            {/* Plan Status Checkboxes */}
            <div className="lg:col-span-2"> {/* Allow more space for checkboxes */}
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status do Plano</label>
              <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700/30 max-h-32 overflow-y-auto">
                {PLAN_STATUS_OPTIONS.map(option => (
                  <div key={option} className="flex items-center">
                    <input
                      id={`planStatus-${option}`}
                      name="planStatus"
                      type="checkbox"
                      value={option}
                      checked={filters.planStatus.includes(option)}
                      onChange={handleFilterChange}
                      className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-500 rounded focus:ring-indigo-500 dark:bg-gray-600 dark:checked:bg-indigo-500"
                    />
                    <label htmlFor={`planStatus-${option}`} className="ml-2 text-xs text-gray-700 dark:text-gray-200">
                      {option}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Expertise Level Checkboxes */}
            <div className="lg:col-span-2"> {/* Allow more space for checkboxes */}
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nível de Expertise</label>
              <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700/30 max-h-32 overflow-y-auto">
                {EXPERTISE_LEVEL_OPTIONS.map(option => (
                  <div key={option} className="flex items-center">
                    <input
                      id={`expertiseLevel-${option}`}
                      name="expertiseLevel"
                      type="checkbox"
                      value={option}
                      checked={filters.expertiseLevel.includes(option)}
                      onChange={handleFilterChange}
                      className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-500 rounded focus:ring-indigo-500 dark:bg-gray-600 dark:checked:bg-indigo-500"
                    />
                    <label htmlFor={`expertiseLevel-${option}`} className="ml-2 text-xs text-gray-700 dark:text-gray-200">
                      {option}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleApplyFilters}
              className="w-full lg:self-end px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 h-[42px]"
            >
              Aplicar Filtros
            </button>
          </div>
        </section>

        {/* Main Content Area - Dashboard Widgets */}
        <main className="space-y-8">
          {/* Row 1 of Widgets */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Creator List Widget */}
            <div className="lg:col-span-2">
              <CreatorTable
                key={`creatorTable-${refreshKey}`}
                planStatusFilter={planStatusFilterString}
                expertiseLevelFilter={expertiseLevelFilterString}
                dateRangeFilter={dateRangeFilterProp}
              />
            </div>

            {/* Content Stats Widget */}
            <div className="lg:col-span-1">
              <ContentStatsWidgets
                key={`contentStats-${refreshKey}`}
                dateRangeFilter={dateRangeFilterProp}
              />
            </div>
          </div>

          {/* Row 2 of Widgets (Example: Posts Feed) */}
          <div className="grid grid-cols-1 gap-8">
            <GlobalPostsExplorer dateRangeFilter={dateRangeFilterProp} />
          </div>

          {/* Content Segment Comparison Widget */}
          <div className="mt-8">
            <DynamicContentSegmentComparison dateRangeFilter={dateRangeFilterProp} />
          </div>

          {/* Top Movers Widget */}
          <div className="mt-8">
            <DynamicTopMoversWidget />
          </div>
        </main>

        {/* AI Chat Integration Section - Floating Button Example */}
        <div className="fixed bottom-8 right-8 z-50"> {/* Ensure button is above modal backdrop if any part overlaps */}
          <button
            type="button"
            onClick={() => setIsAiChatVisible(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-full text-lg font-semibold shadow-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 transition-colors"
            title="Abrir Chat IA"
          >
            Chat IA
          </button>
        </div>

        {/* AI Chat Modal */}
        {isAiChatVisible && (
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
            {/* Modal Content */}
            <div className="bg-gray-100 dark:bg-gray-800 w-full max-w-2xl h-[80vh] max-h-[700px] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-300 dark:border-gray-700">
              <header className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Assistente IA
                </h2>
                <button
                  onClick={() => setIsAiChatVisible(false)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
        <footer className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>&copy; {new Date().getFullYear()} Creator Platform. Todos os direitos reservados.</p>
        </footer>
      </div>
    </div>
  );
}
