'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { IDashboardCreator, IFetchDashboardCreatorsListParams } from '@/app/lib/dataService/marketAnalysisService'; // Assuming this path is correct
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid'; // Example icons

const DEBOUNCE_DELAY = 500; // ms for search input debounce

interface CreatorTableProps {
  planStatusFilter?: string;
  expertiseLevelFilter?: string;
  // key prop (refreshKey from parent) will implicitly handle refresh
}

interface SortConfig {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export default function CreatorTable({ planStatusFilter, expertiseLevelFilter }: CreatorTableProps) {
  const [creators, setCreators] = useState<IDashboardCreator[]>([]);
  const [totalCreators, setTotalCreators] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10); // Or make this configurable
  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'totalPosts', sortOrder: 'desc' });

  // For name search (optional, can be expanded for more filters)
  const [nameSearch, setNameSearch] = useState('');
  const [debouncedNameSearch, setDebouncedNameSearch] = useState('');

  // Debounce for name search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNameSearch(nameSearch);
    }, DEBOUNCE_DELAY);

    return () => {
      clearTimeout(handler);
    };
  }, [nameSearch]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params: IFetchDashboardCreatorsListParams = {
      page: currentPage,
      limit,
      sortBy: sortConfig.sortBy,
      sortOrder: sortConfig.sortOrder,
      filters: {},
    };

    if (debouncedNameSearch) params.filters!.nameSearch = debouncedNameSearch;
    if (planStatusFilter) params.filters!.planStatus = [planStatusFilter]; // API expects array
    if (expertiseLevelFilter) params.filters!.expertiseLevel = [expertiseLevelFilter]; // API expects array

    // Build URL query string carefully
    const queryParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
    });

    if (params.filters?.nameSearch) {
        queryParams.append('nameSearch', params.filters.nameSearch);
    }
    if (params.filters?.planStatus && params.filters.planStatus.length > 0) {
        // The API creator route expects planStatus to be a comma-separated string if multiple,
        // or a single string. Our current filter is single.
        queryParams.append('planStatus', params.filters.planStatus.join(','));
    }
    if (params.filters?.expertiseLevel && params.filters.expertiseLevel.length > 0) {
        queryParams.append('expertiseLevel', params.filters.expertiseLevel.join(','));
    }

    const url = `/api/admin/dashboard/creators?${queryParams.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch creators: ${response.statusText}`);
      }
      const data = await response.json();
      setCreators(data.creators);
      setTotalCreators(data.totalCreators);
    } catch (e: any) {
      setError(e.message);
      setCreators([]);
      setTotalCreators(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, limit, sortConfig, debouncedNameSearch, planStatusFilter, expertiseLevelFilter]); // Added filters to dependency array

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (columnKey: string) => {
    let newSortOrder: 'asc' | 'desc' = 'asc';
    if (sortConfig.sortBy === columnKey && sortConfig.sortOrder === 'asc') {
      newSortOrder = 'desc';
    }
    setSortConfig({ sortBy: columnKey, sortOrder: newSortOrder });
    setCurrentPage(1); // Reset to first page on sort
  };

  const renderSortIcon = (columnKey: string) => {
    if (sortConfig.sortBy !== columnKey) {
      return <ChevronDownIcon className="w-4 h-4 inline text-gray-400" />; // Default icon or no icon
    }
    return sortConfig.sortOrder === 'asc' ? (
      <ChevronUpIcon className="w-4 h-4 inline text-indigo-600" />
    ) : (
      <ChevronDownIcon className="w-4 h-4 inline text-indigo-600" />
    );
  };

  const totalPages = Math.ceil(totalCreators / limit);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const getSafeString = (value: any): string => {
    if (value === null || typeof value === 'undefined') return 'N/A';
    return String(value);
  };

  const formatDate = (dateString?: Date | string): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (e) {
      return 'Data Inválida';
    }
  };

  const formatEngagement = (rate?: number): string => {
    if (rate === null || typeof rate === 'undefined') return 'N/A';
    return `${(rate * 100).toFixed(2)}%`;
  };


  // Table columns definition
  const columns = [
    { key: 'name', label: 'Creator', sortable: true },
    { key: 'totalPosts', label: 'Total Posts', sortable: true },
    { key: 'avgEngagementRate', label: 'Avg. Engagement', sortable: true },
    { key: 'lastActivityDate', label: 'Last Activity', sortable: true },
    { key: 'planStatus', label: 'Plan Status', sortable: true },
    // Add more columns as needed: e.g. email, inferredExpertiseLevel
  ];

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          Lista de Criadores
        </h3>
        <input
            type="text"
            placeholder="Buscar por nome..."
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <p className="text-gray-500 dark:text-gray-400">Carregando criadores...</p>
          {/* TODO: Add a spinner component */}
        </div>
      )}

      {error && (
        <div className="text-center py-4">
          <p className="text-red-500 dark:text-red-400">Erro ao carregar dados: {error}</p>
        </div>
      )}

      {!isLoading && !error && creators.length === 0 && (
        <div className="text-center py-10">
          <p className="text-gray-500 dark:text-gray-400">Nenhum criador encontrado com os filtros atuais.</p>
        </div>
      )}

      {!isLoading && !error && creators.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      {col.label} {col.sortable && renderSortIcon(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {creators.map((creator) => (
                  <tr key={creator._id.toString()} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center">
                        {/* Placeholder for profile picture */}
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600 mr-3 flex items-center justify-center text-xs">
                            {creator.name?.substring(0,2).toUpperCase()}
                        </div>
                        {getSafeString(creator.name)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {creator.totalPosts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {formatEngagement(creator.avgEngagementRate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {formatDate(creator.lastActivityDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                       <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                           creator.planStatus === 'Pro' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100'
                           : creator.planStatus === 'Free' ? 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100'
                           : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100'}`}>
                        {getSafeString(creator.planStatus)}
                       </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 mt-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span> ({totalCreators} criadores)
            </p>
            <div className="flex-1 flex justify-end space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading || totalCreators === 0}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
