'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import { IDashboardCreator, IFetchDashboardCreatorsListParams } from '@/app/lib/dataService/marketAnalysisService'; // Assuming this path is correct
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid'; // Example icons
import dynamic from 'next/dynamic';

// Lazy load CreatorDetailModal
const DynamicCreatorDetailModal = dynamic(() => import('./CreatorDetailModal'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center"><p className="text-white text-lg">Carregando detalhes do criador...</p></div>,
});

// Lazy load CreatorComparisonModal
const DynamicCreatorComparisonModal = dynamic(() => import('./CreatorComparisonModal'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center"><p className="text-white text-lg">Carregando comparativo...</p></div>,
});

const DEBOUNCE_DELAY = 500; // ms for search input debounce

interface CreatorTableProps {
  planStatusFilter?: string;
  expertiseLevelFilter?: string;
  dateRangeFilter?: { // Received from CreatorDashboardPage
    startDate?: string;
    endDate?: string;
  };
  // key prop (refreshKey from parent) will implicitly handle refresh
}

interface SortConfig {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

const CreatorTable = memo(function CreatorTable({ planStatusFilter, expertiseLevelFilter, dateRangeFilter }: CreatorTableProps) {
  const [creators, setCreators] = useState<IDashboardCreator[]>([]);
  const [totalCreators, setTotalCreators] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'totalPosts', sortOrder: 'desc' });

  const [nameSearch, setNameSearch] = useState('');
  const [debouncedNameSearch, setDebouncedNameSearch] = useState('');

  // State for Creator Detail Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCreatorForModal, setSelectedCreatorForModal] = useState<{ id: string; name: string; } | null>(null);

  // State for Creator Comparison
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  // comparisonCreatorIds will be taken directly from selectedForComparison when opening modal
  const MAX_CREATORS_TO_COMPARE = 3; // Example limit

  const handleOpenCreatorModal = useCallback((creator: IDashboardCreator) => {
    setSelectedCreatorForModal({ id: creator._id.toString(), name: creator.name });
    setIsDetailModalOpen(true);
  }, []);

  const handleCompareSelectChange = useCallback((creatorId: string) => {
    setSelectedForComparison(prevSelected => {
      if (prevSelected.includes(creatorId)) {
        return prevSelected.filter(id => id !== creatorId);
      } else {
        if (prevSelected.length < MAX_CREATORS_TO_COMPARE) {
          return [...prevSelected, creatorId];
        }
        return prevSelected; // Do not add if limit reached
      }
    });
  }, []);

  const handleInitiateComparison = useCallback(() => {
    if (selectedForComparison.length >= 2 && selectedForComparison.length <= MAX_CREATORS_TO_COMPARE) {
      setIsComparisonModalOpen(true);
    }
  }, [selectedForComparison]);

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

    // Build URL query string carefully
    const queryParams = new URLSearchParams({
        page: String(params.page), // `page` from `params` is used, not `currentPage` directly here
        limit: String(params.limit), // `limit` from `params` is used
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
    });

    if (debouncedNameSearch) { // Directly use debouncedNameSearch for the query
        queryParams.append('nameSearch', debouncedNameSearch);
    }
    // Directly use props planStatusFilter and expertiseLevelFilter for the query
    if (planStatusFilter) {
        queryParams.append('planStatus', planStatusFilter);
    }
    if (expertiseLevelFilter) {
        queryParams.append('expertiseLevel', expertiseLevelFilter);
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

  const handleSort = useCallback((columnKey: string) => {
    let newSortOrder: 'asc' | 'desc' = 'asc';
    if (sortConfig.sortBy === columnKey && sortConfig.sortOrder === 'asc') {
      newSortOrder = 'desc';
    }
    setSortConfig({ sortBy: columnKey, sortOrder: newSortOrder });
    setCurrentPage(1); // Reset to first page on sort
  }, [sortConfig]); // Depends on sortConfig to correctly toggle

  const renderSortIcon = useCallback((columnKey: string) => {
    if (sortConfig.sortBy !== columnKey) {
      return <ChevronDownIcon className="w-4 h-4 inline text-gray-400" />; // Default icon or no icon
    }
    return sortConfig.sortOrder === 'asc' ? (
      <ChevronUpIcon className="w-4 h-4 inline text-indigo-600" />
    ) : (
      <ChevronDownIcon className="w-4 h-4 inline text-indigo-600" />
    );
  }, [sortConfig]); // Depends on sortConfig

  const totalPages = Math.ceil(totalCreators / limit);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) { // Avoid re-fetch if page hasn't changed
      setCurrentPage(newPage);
    }
  }, [totalPages, currentPage]); // Depends on totalPages and currentPage

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


  // Table columns definition - Add checkbox column
  const columns = [
    { key: 'select', label: '', sortable: false, headerClassName: 'w-12 text-center' }, // For Checkbox
    { key: 'name', label: 'Creator', sortable: true },
    { key: 'totalPosts', label: 'Total Posts', sortable: true },
    { key: 'avgEngagementRate', label: 'Avg. Engagement', sortable: true },
    { key: 'lastActivityDate', label: 'Last Activity', sortable: true },
    { key: 'planStatus', label: 'Plan Status', sortable: true },
    { key: 'actions', label: 'Ações', sortable: false}
  ];

  return (
    <> {/* Fragment to wrap table and modal */}
    <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Lista de Criadores
          </h3>
           <p className="text-xs text-gray-500 dark:text-gray-400">
            Selecione até {MAX_CREATORS_TO_COMPARE} criadores para comparar.
          </p>
        </div>
        <input
            type="text"
            placeholder="Buscar por nome..."
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Comparison Button and Info */}
      <div className="mb-4 flex items-center justify-start space-x-4">
        <button
          onClick={handleInitiateComparison}
          disabled={selectedForComparison.length < 2 || selectedForComparison.length > MAX_CREATORS_TO_COMPARE}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Comparar Criadores Selecionados
        </button>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {selectedForComparison.length} / {MAX_CREATORS_TO_COMPARE} selecionados
        </p>
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
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${col.sortable ? 'cursor-pointer' : ''} ${col.headerClassName || ''}`}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      {col.label} {col.sortable && renderSortIcon(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {creators.map((creator) => {
                  const creatorIdStr = creator._id.toString();
                  const isSelected = selectedForComparison.includes(creatorIdStr);
                  const isDisabled = !isSelected && selectedForComparison.length >= MAX_CREATORS_TO_COMPARE;
                  return (
                    <tr key={creatorIdStr} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}>
                       <td className="px-6 py-4 whitespace-nowrap text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleCompareSelectChange(creatorIdStr)}
                          disabled={isDisabled}
                          className={`h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-500 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:checked:bg-indigo-500 ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                          aria-label={`Selecionar ${creator.name} para comparação`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600 mr-3 flex items-center justify-center text-xs">
                              {creator.name?.substring(0,2).toUpperCase()}
                          </div>
                          <span
                              className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-medium"
                              onClick={() => handleOpenCreatorModal(creator)}
                              title={`Ver detalhes de ${creator.name}`}
                          >
                              {getSafeString(creator.name)}
                          </span>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-center">
                          <button
                              onClick={() => handleOpenCreatorModal(creator)}
                              className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 text-xs py-1 px-2 rounded-md hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors"
                              title="Ver gráfico de performance"
                          >
                              Detalhes
                          </button>
                      </td>
                    </tr>
                  );
                })}
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
    {isDetailModalOpen && selectedCreatorForModal && dateRangeFilter && (
        <DynamicCreatorDetailModal
            isOpen={isDetailModalOpen}
            onClose={useCallback(() => setIsDetailModalOpen(false), [])}
            creatorId={selectedCreatorForModal.id}
            creatorName={selectedCreatorForModal.name}
            dateRangeFilter={{
                startDate: dateRangeFilter?.startDate,
                endDate: dateRangeFilter?.endDate,
            }}
        />
    )}
    {isComparisonModalOpen && (
        <DynamicCreatorComparisonModal
            isOpen={isComparisonModalOpen}
            onClose={useCallback(() => {
                setIsComparisonModalOpen(false);
                // Optionally clear selectedForComparison, or leave them selected for user convenience
                // setSelectedForComparison([]);
            }, [])}
            creatorIdsToCompare={selectedForComparison}
        />
    )}
    </>
  );
});

export default CreatorTable;
