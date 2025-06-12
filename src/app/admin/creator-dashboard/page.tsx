'use client';

import React, { useState, useCallback } from 'react';
import CreatorTable from './CreatorTable';
import ContentStatsWidgets from './ContentStatsWidgets';
import StandaloneChatInterface from './StandaloneChatInterface'; // Import the new chat interface
import { XMarkIcon } from '@heroicons/react/24/solid'; // For modal close button

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
  planStatus: string; // 'all', 'Free', 'Pro', 'Premium' etc.
  expertiseLevel: string; // 'all', 'Iniciante', 'Intermediário', 'Avançado' etc.
}

export default function CreatorDashboardPage() {
  const [filters, setFilters] = useState<GlobalFiltersState>({
    dateRange: { startDate: '', endDate: '' },
    planStatus: 'all',
    expertiseLevel: 'all',
  });

  // This key will be changed to trigger re-fetch in child components
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAiChatVisible, setIsAiChatVisible] = useState(false);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'startDate' || name === 'endDate') {
      setFilters(prev => ({
        ...prev,
        dateRange: { ...prev.dateRange, [name]: value },
      }));
    } else {
      setFilters(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleApplyFilters = () => {
    // Validate dates if needed (e.g., startDate <= endDate)
    if (filters.dateRange.startDate && filters.dateRange.endDate && filters.dateRange.startDate > filters.dateRange.endDate) {
        alert("A data de início não pode ser posterior à data de término.");
        return;
    }
    setRefreshKey(prev => prev + 1); // Increment key to trigger useEffect in children
  };

  // Define available options for select dropdowns
  // In a real app, these might come from an API or be more dynamic
  const planStatusOptions = [
    { value: 'all', label: 'Todos os Planos' },
    { value: 'Free', label: 'Free' },
    { value: 'Pro', label: 'Pro' },
    { value: 'Premium', label: 'Premium' }, // Example
  ];

  const expertiseLevelOptions = [
    { value: 'all', label: 'Todos os Níveis' },
    { value: 'Iniciante', label: 'Iniciante' },
    { value: 'Intermediário', label: 'Intermediário' },
    { value: 'Avançado', label: 'Avançado' },
  ];


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
            <div>
              <label htmlFor="planStatus" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status do Plano</label>
              <select
                name="planStatus"
                id="planStatus"
                value={filters.planStatus}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {planStatusOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expertiseLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nível de Expertise</label>
              <select
                name="expertiseLevel"
                id="expertiseLevel"
                value={filters.expertiseLevel}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {expertiseLevelOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleApplyFilters}
              className="w-full lg:w-auto px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 h-[42px]"
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
                planStatusFilter={filters.planStatus === 'all' ? undefined : filters.planStatus}
                expertiseLevelFilter={filters.expertiseLevel === 'all' ? undefined : filters.expertiseLevel}
              />
            </div>

            {/* Content Stats Widget */}
            <div className="lg:col-span-1">
              <ContentStatsWidgets
                key={`contentStats-${refreshKey}`}
                dateRangeFilter={filters.dateRange.startDate && filters.dateRange.endDate ? filters.dateRange : undefined}
              />
            </div>
          </div>

          {/* Row 2 of Widgets (Example: Posts Feed) */}
          <div className="grid grid-cols-1 gap-8">
            <div className="p-6 bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[300px]">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Explorador de Posts Globais (Widget)
              </h3>
              <p className="text-center text-gray-500 dark:text-gray-400 mt-16">
                (Placeholder para feed de posts com filtros)
              </p>
            </div>
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
              <div className="flex-grow overflow-y-auto"> {/* This div will handle the internal scrolling of the chat */}
                <StandaloneChatInterface />
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
