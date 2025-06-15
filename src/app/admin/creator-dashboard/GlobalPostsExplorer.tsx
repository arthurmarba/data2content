'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import { IGlobalPostResult } from '@/app/lib/dataService/marketAnalysisService';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { MagnifyingGlassIcon, DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline';
import SkeletonBlock from './SkeletonBlock'; // Assuming this path is correct or it's defined/imported below
import EmptyState from './EmptyState'; // Assuming this path is correct
import PostDetailModal from './PostDetailModal'; // Import the new modal


interface GlobalPostsExplorerProps {
  dateRangeFilter?: { // From parent page (CreatorDashboardPage)
    startDate: string;
    endDate: string;
  };
  // key prop (refreshKey from parent) will implicitly handle refresh if needed for dateRangeFilter
}

interface SortConfig {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface ActiveFilters {
  context?: string;
  proposal?: string;
  format?: string;
  minInteractions?: number;
}

/**
 * @component GlobalPostsExplorer
 * @description Widget for exploring global posts with filters and pagination.
 * This component will allow administrators to search, filter, and view posts
 * from across the platform based on various criteria.
 *
 * @version 1.1.0 - Data fetching, display, sort, pagination
 */
const GlobalPostsExplorer = memo(function GlobalPostsExplorer({ dateRangeFilter }: GlobalPostsExplorerProps) {
  // States for local filters UI
  const [selectedContext, setSelectedContext] = useState<string>('all');
  const [selectedProposal, setSelectedProposal] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [minInteractionsValue, setMinInteractionsValue] = useState<string>('');

  // States for data, loading, error, pagination, sorting
  const [posts, setPosts] = useState<IGlobalPostResult[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10); // Or make this configurable
  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'postDate', sortOrder: 'desc' });

  // State to hold the filters that are actively applied to the data fetching
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});

  // State for PostDetailModal
  const [isPostDetailModalOpen, setIsPostDetailModalOpen] = useState(false);
  const [selectedPostIdForModal, setSelectedPostIdForModal] = useState<string | null>(null);

  // Predefined options for dropdowns
  const contextOptions = ["all", "Finanças", "Tecnologia", "Moda", "Saúde", "Educação", "Entretenimento"];
  const proposalOptions = ["all", "Educativo", "Humor", "Notícia", "Review", "Tutorial"];
  const formatOptions = ["all", "Reel", "Post Estático", "Carrossel", "Story"];

  // Modal Handlers
  const handleOpenPostDetailModal = useCallback((postId: string) => {
    setSelectedPostIdForModal(postId);
    setIsPostDetailModalOpen(true);
  }, []);

  const handleClosePostDetailModal = useCallback(() => {
    setIsPostDetailModalOpen(false);
    setSelectedPostIdForModal(null);
  }, []);


  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(limit),
      sortBy: sortConfig.sortBy,
      sortOrder: sortConfig.sortOrder,
    });

    if (activeFilters.context && activeFilters.context !== 'all') params.append('context', activeFilters.context);
    if (activeFilters.proposal && activeFilters.proposal !== 'all') params.append('proposal', activeFilters.proposal);
    if (activeFilters.format && activeFilters.format !== 'all') params.append('format', activeFilters.format);
    if (activeFilters.minInteractions) params.append('minInteractions', String(activeFilters.minInteractions));

    if (dateRangeFilter?.startDate) {
      // Ensure we are treating the date as local and converting to UTC start of day
      const localStartDate = new Date(dateRangeFilter.startDate);
      const utcStartDate = new Date(Date.UTC(localStartDate.getFullYear(), localStartDate.getMonth(), localStartDate.getDate(), 0, 0, 0, 0));
      params.append('startDate', utcStartDate.toISOString());
    }

    if (dateRangeFilter?.endDate) {
      // Ensure we are treating the date as local and converting to UTC end of day
      const localEndDate = new Date(dateRangeFilter.endDate);
      const utcEndDate = new Date(Date.UTC(localEndDate.getFullYear(), localEndDate.getMonth(), localEndDate.getDate(), 23, 59, 59, 999));
      params.append('endDate', utcEndDate.toISOString());
    }

    try {
      const response = await fetch(`/api/admin/dashboard/posts?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch posts: ${response.statusText}`);
      }
      const data = await response.json();
      setPosts(data.posts || []);
      setTotalPosts(data.totalPosts || 0);
    } catch (e: any) {
      setError(e.message);
      setPosts([]);
      setTotalPosts(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, limit, sortConfig, activeFilters, dateRangeFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]); // fetchPosts is memoized and includes all its dependencies

  const handleApplyLocalFilters = useCallback(() => {
    setCurrentPage(1); // Reset to first page when filters change
    setActiveFilters({
      context: selectedContext === 'all' ? undefined : selectedContext,
      proposal: selectedProposal === 'all' ? undefined : selectedProposal,
      format: selectedFormat === 'all' ? undefined : selectedFormat,
      minInteractions: minInteractionsValue ? parseInt(minInteractionsValue) : undefined,
    });
    // fetchPosts will be called by useEffect due to activeFilters changing
  }, [selectedContext, selectedProposal, selectedFormat, minInteractionsValue]); // Dependencies are the local filter states

  const handleSort = useCallback((columnKey: string) => {
    let newSortOrder: 'asc' | 'desc' = 'asc';
    if (sortConfig.sortBy === columnKey && sortConfig.sortOrder === 'asc') {
      newSortOrder = 'desc';
    }
    setSortConfig({ sortBy: columnKey, sortOrder: newSortOrder });
    setCurrentPage(1); // Reset to first page on sort
  }, [sortConfig]); // Depends on sortConfig

  const renderSortIcon = useCallback((columnKey: string) => {
    if (sortConfig.sortBy !== columnKey) {
      return <ChevronDownIcon className="w-3 h-3 inline text-gray-400 ml-1" />;
    }
    return sortConfig.sortOrder === 'asc' ? (
      <ChevronUpIcon className="w-3 h-3 inline text-indigo-500 ml-1" />
    ) : (
      <ChevronDownIcon className="w-3 h-3 inline text-indigo-500 ml-1" />
    );
  }, [sortConfig]); // Depends on sortConfig

  const totalPages = Math.ceil(totalPosts / limit);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) { // Avoid re-fetch if page hasn't changed
      setCurrentPage(newPage);
    }
  }, [totalPages, currentPage]); // Depends on totalPages and currentPage

  const formatDate = (dateString?: Date | string): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return 'Data Inválida'; }
  };

  const columns = [
    { key: 'text_content', label: 'Conteúdo', sortable: false, getVal: (post: IGlobalPostResult) => post.text_content || post.description || 'N/A' },
    { key: 'creatorName', label: 'Criador', sortable: true, getVal: (post: IGlobalPostResult) => post.creatorName || 'N/A' },
    { key: 'postDate', label: 'Data', sortable: true, getVal: (post: IGlobalPostResult) => formatDate(post.postDate) },
    { key: 'format', label: 'Formato', sortable: true, getVal: (post: IGlobalPostResult) => post.format || 'N/A' },
    { key: 'proposal', label: 'Proposta', sortable: true, getVal: (post: IGlobalPostResult) => post.proposal || 'N/A' },
    { key: 'context', label: 'Contexto', sortable: true, getVal: (post: IGlobalPostResult) => post.context || 'N/A' },
    { key: 'stats.total_interactions', label: 'Interações', sortable: true, getVal: (post: IGlobalPostResult) => getNestedValue(post, 'stats.total_interactions', 0) },
    { key: 'stats.likes', label: 'Likes', sortable: true, getVal: (post: IGlobalPostResult) => getNestedValue(post, 'stats.likes', 0) },
    { key: 'stats.shares', label: 'Shares', sortable: true, getVal: (post: IGlobalPostResult) => getNestedValue(post, 'stats.shares', 0) },
    { key: 'actions', label: 'Ações', sortable: false, headerClassName: 'text-center', getVal: () => null }, // getVal is a placeholder
  ];

  // Helper to get nested stats safely
  const getNestedValue = (obj: any, path: string, defaultValue: any = 'N/A'): string | number => {
    const value = path.split('.').reduce((acc, part) => acc && acc[part], obj);
    return value === undefined || value === null ? defaultValue : value;
  };

  const formatNumberStd = (val: any) => {
    const num = parseFloat(String(val));
    if (isNaN(num)) return 'N/A';
    return num.toLocaleString('pt-BR');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800"> {/* Changed from h2 to h3 for consistency if used under page's h2 */}
        Explorador de Posts Globais
      </h3>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Filtre e explore todos os posts da plataforma com base em diversos critérios.
      </p>
      <div className="space-y-4">
        {/* Filters Section */}
        <div className="p-4 border border-gray-200 rounded-md bg-gray-50"> {/* Slightly adjusted dark bg for filter panel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
            {/* Context Dropdown */}
            <div>
              <label htmlFor="gpe-context" className="block text-xs font-medium text-gray-600 mb-1">Contexto</label>
              <select
                id="gpe-context"
                name="context"
                value={selectedContext}
                onChange={(e) => setSelectedContext(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-gray-900 h-[38px]"
              >
                {contextOptions.map(opt => <option key={opt} value={opt}>{opt === 'all' ? 'Todos os Contextos' : opt}</option>)}
              </select>
            </div>

            {/* Proposal Dropdown */}
            <div>
              <label htmlFor="gpe-proposal" className="block text-xs font-medium text-gray-600 mb-1">Proposta</label>
              <select
                id="gpe-proposal"
                name="proposal"
                value={selectedProposal}
                onChange={(e) => setSelectedProposal(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-gray-900 h-[38px]"
              >
                {proposalOptions.map(opt => <option key={opt} value={opt}>{opt === 'all' ? 'Todas as Propostas' : opt}</option>)}
              </select>
            </div>

            {/* Format Dropdown */}
            <div>
              <label htmlFor="gpe-format" className="block text-xs font-medium text-gray-600 mb-1">Formato</label>
              <select
                id="gpe-format"
                name="format"
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-gray-900 h-[38px]"
              >
                {formatOptions.map(opt => <option key={opt} value={opt}>{opt === 'all' ? 'Todos os Formatos' : opt}</option>)}
              </select>
            </div>

            {/* Min Interactions Input */}
            <div>
              <label htmlFor="gpe-minInteractions" className="block text-xs font-medium text-gray-600 mb-1">Min. Interações</label>
              <input
                type="number"
                id="gpe-minInteractions"
                name="minInteractions"
                value={minInteractionsValue}
                onChange={(e) => setMinInteractionsValue(e.target.value)}
                placeholder="Ex: 100"
                min="0"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-gray-900 h-[38px]"
              />
            </div>

            {/* Apply Filters Button */}
            <button
              onClick={handleApplyLocalFilters}
              className="w-full lg:w-auto h-[38px] flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-sm disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              <MagnifyingGlassIcon className="w-5 h-5 mr-2" aria-hidden="true" />
              {isLoading ? 'Buscando...' : 'Filtrar Posts'}
            </button>
          </div>
        </div>

        {/* Posts Display Area */}
        {isLoading && (
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {columns.map((col) => (
                    <th key={`skel-header-${col.key}`} scope="col" className={`px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap ${col.headerClassName || (col.key.startsWith('stats.') || ['postDate'].includes(col.key) ? 'text-center' : 'text-left')}`}>
                      <SkeletonBlock width="w-24" height="h-3" className={col.headerClassName === 'text-center' || col.key.startsWith('stats.') || ['postDate'].includes(col.key) ? 'mx-auto' : ''} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Array.from({ length: limit }).map((_, index) => (
                  <tr key={`skel-row-${index}`}>
                    {columns.map(col => (
                      <td key={`skel-cell-${index}-${col.key}`} className={`px-4 py-3 whitespace-nowrap ${col.headerClassName || (col.key.startsWith('stats.') || ['postDate'].includes(col.key) ? 'text-center' : 'text-left')}`}>
                        <SkeletonBlock width={col.key === 'text_content' ? "w-full" : (col.key === 'actions' ? "w-24" : "w-20")} height="h-4" className={col.headerClassName === 'text-center' ||col.key.startsWith('stats.') || ['postDate'].includes(col.key) ? 'mx-auto' : ''}/>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error && (
            <div className="text-center py-10"><p className="text-red-500">Erro ao carregar posts: {error}</p></div>
        )}
        {!isLoading && !error && posts.length === 0 && (
          <div className="py-10">
            <EmptyState
                icon={<DocumentMagnifyingGlassIcon className="w-12 h-12"/>}
                title="Nenhum Post Encontrado"
                message="Experimente alterar os filtros de data, formato, proposta, contexto ou o mínimo de interações."
            />
          </div>
        )}
        {!isLoading && !error && posts.length > 0 && (
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={`px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap ${col.key.startsWith('stats.') || ['postDate'].includes(col.key) ? 'text-center' : 'text-left'} ${col.sortable ? 'cursor-pointer hover:bg-gray-200' : ''}`}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      {col.label} {col.sortable && renderSortIcon(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {posts.map((post) => (
                  <tr key={post._id?.toString()} className="hover:bg-gray-50 transition-colors">
                    {columns.map(col => {
                        const rawValue = col.getVal(post);
                        let displayValue = rawValue;
                        if (col.key.startsWith('stats.')) {
                            displayValue = formatNumberStd(rawValue);
                        }
                        if (col.key === 'actions') {
                          return (
                            <td key={col.key} className={`px-4 py-3 whitespace-nowrap text-gray-600 ${col.headerClassName || 'text-center'}`}>
                              <button
                                onClick={() => handleOpenPostDetailModal(post._id!.toString())}
                                className="flex items-center justify-center text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 py-1 px-2.5 rounded-md text-xs border border-indigo-300 transition-colors duration-150"
                                title="Ver detalhes do post"
                              >
                                <DocumentMagnifyingGlassIcon className="w-4 h-4 sm:mr-1.5" />
                                <span className="hidden sm:inline">Detalhes</span>
                              </button>
                            </td>
                          );
                        }
                        return (
                            <td key={col.key} className={`px-4 py-3 whitespace-nowrap text-gray-600 ${col.key.startsWith('stats.') || ['postDate'].includes(col.key) ? 'text-center' : 'text-left'}`}>
                                {col.key === 'text_content' ? (
                                    <span title={String(rawValue)} className="block max-w-[200px] lg:max-w-[300px] truncate">
                                        {displayValue}
                                    </span>
                                ) : (
                                    displayValue
                                )}
                            </td>
                        );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && !error && totalPosts > 0 && (
           <div className="py-3 flex items-center justify-between border-t border-gray-200 mt-4 text-sm">
                <p className="text-gray-700">
                Página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span> ({totalPosts} posts)
                </p>
                <div className="flex-1 flex justify-end space-x-2">
                <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isLoading}
                    className="relative inline-flex items-center px-3 py-1.5 border border-gray-300 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 text-xs"
                >
                    Anterior
                </button>
                <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || isLoading || totalPosts === 0}
                    className="ml-2 relative inline-flex items-center px-3 py-1.5 border border-gray-300 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 text-xs"
                >
                    Próxima
                </button>
                </div>
            </div>
        )}
      </div>
      <PostDetailModal
        isOpen={isPostDetailModalOpen}
        onClose={handleClosePostDetailModal}
        postId={selectedPostIdForModal}
      />
    </div>
  );
});

export default GlobalPostsExplorer;
