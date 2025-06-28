'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import VideosTable, { VideoListItem, metricLabels } from './VideosTable';
import PostDetailModal from '../PostDetailModal';

interface VideoDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  timePeriod: string;
  drillDownMetric: string | null;
}

interface SortConfig {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// MUDANÇA: Tipo para o estado dos filtros
interface FilterState {
  proposal: string;
  context: string;
  format: string;
  linkSearch: string;
  minViews: string;
}

const VideoDrillDownModal: React.FC<VideoDrillDownModalProps> = ({
  isOpen,
  onClose,
  userId,
  timePeriod,
  drillDownMetric,
}) => {
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [totalVideos, setTotalVideos] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    sortBy: drillDownMetric || 'postDate',
    sortOrder: 'desc',
  });
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // ==================== INÍCIO DAS MUDANÇAS ====================

  // 1. Estado para os novos filtros
  const [filters, setFilters] = useState<FilterState>({
    proposal: '',
    context: '',
    format: '',
    linkSearch: '',
    minViews: '',
  });

  // 2. Estado para os filtros com "debounce" para otimização
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  // Efeito de Debounce: atualiza os filtros para a busca apenas 500ms após o usuário parar de digitar
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilters(filters);
      setCurrentPage(1); // Reseta para a primeira página ao aplicar novos filtros
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [filters]);

  const fetchVideos = useCallback(async () => {
    if (!isOpen || !userId) return;
    setIsLoading(true);
    setError(null);

    // 3. Constrói os parâmetros da URL, incluindo os novos filtros
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(limit),
      sortBy: sortConfig.sortBy,
      sortOrder: sortConfig.sortOrder,
      timePeriod,
    });

    // Adiciona os filtros do estado "debounced" à query
    Object.entries(debouncedFilters).forEach(([key, value]) => {
      if (value) {
        params.append(key, value);
      }
    });

    try {
      const response = await fetch(`/api/v1/users/${userId}/videos/list?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || response.statusText);
      }
      const data = await response.json();
      setVideos(data.videos || []);
      setTotalVideos(data.pagination?.totalVideos || 0);
    } catch (e: any) {
      setError(e.message);
      setVideos([]);
      setTotalVideos(0);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, userId, currentPage, limit, sortConfig, timePeriod, debouncedFilters]); // Adicionado debouncedFilters às dependências

  // ==================== FIM DAS MUDANÇAS ====================

  useEffect(() => {
    if (drillDownMetric) {
      setSortConfig({ sortBy: drillDownMetric, sortOrder: 'desc' });
      setCurrentPage(1);
    }
  }, [drillDownMetric]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchVideos();
    } else if (!isOpen) {
      // Limpa o estado ao fechar
      setVideos([]);
      setError(null);
      setIsLoading(false);
      setFilters({ proposal: '', context: '', format: '', linkSearch: '', minViews: '' });
    }
  }, [isOpen, userId, fetchVideos]);

  if (!isOpen) return null;

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSort = (column: string) => {
    const order: 'asc' | 'desc' = (sortConfig.sortBy === column && sortConfig.sortOrder === 'desc') ? 'asc' : 'desc';
    setSortConfig({ sortBy: column, sortOrder: order });
    setCurrentPage(1);
  };

  const handleRowClick = (postId: string) => {
    setSelectedPostId(postId);
  };

  const handlePageChange = (newPage: number) => {
    const totalPages = Math.ceil(totalVideos / limit);
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  };

  const totalPages = Math.ceil(totalVideos / limit);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-drilldown-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 id="video-drilldown-title" className="text-lg font-semibold text-gray-800">
            Análise de Vídeos do Criador
            {drillDownMetric && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                – ordenado por {metricLabels[drillDownMetric] || drillDownMetric}
              </span>
            )}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        {/* MUDANÇA: Seção de Filtros Adicionada */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <input name="proposal" type="text" placeholder="Proposta" value={filters.proposal} onChange={handleFilterChange} className="p-2 border rounded-md text-sm" />
            <input name="context" type="text" placeholder="Contexto" value={filters.context} onChange={handleFilterChange} className="p-2 border rounded-md text-sm" />
            <input name="format" type="text" placeholder="Formato" value={filters.format} onChange={handleFilterChange} className="p-2 border rounded-md text-sm" />
            <input name="linkSearch" type="text" placeholder="Buscar no link" value={filters.linkSearch} onChange={handleFilterChange} className="p-2 border rounded-md text-sm" />
            <input name="minViews" type="number" placeholder="Mínimo de views" value={filters.minViews} onChange={handleFilterChange} className="p-2 border rounded-md text-sm" />
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-grow">
          {isLoading && <p className="text-center text-gray-500">Carregando vídeos...</p>}
          {error && <p className="text-center text-red-500">Erro: {error}</p>}
          {!isLoading && !error && videos.length === 0 && (
            <p className="text-center text-gray-500">Nenhum vídeo encontrado com os filtros aplicados.</p>
          )}
          {!isLoading && !error && videos.length > 0 && (
            <VideosTable
              videos={videos}
              sortConfig={sortConfig}
              onSort={handleSort}
              primaryMetric={sortConfig.sortBy}
              onRowClick={handleRowClick}
            />
          )}
        </div>
        {!isLoading && !error && totalVideos > 0 && (
          <div className="py-3 flex items-center justify-between border-t border-gray-200 text-sm px-4">
            <p className="text-gray-700">
              Página <span className="font-medium">{currentPage}</span> de{' '}
              <span className="font-medium">{totalPages}</span> ({totalVideos} vídeos)
            </p>
            <div className="flex-1 flex justify-end space-x-2">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || isLoading} className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 text-xs">Anterior</button>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || isLoading} className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 text-xs">Próxima</button>
            </div>
          </div>
        )}
      </div>
      {selectedPostId && (
        <PostDetailModal
          isOpen={selectedPostId !== null}
          onClose={() => setSelectedPostId(null)}
          postId={selectedPostId}
        />
      )}
    </div>
  );
};

export default VideoDrillDownModal;