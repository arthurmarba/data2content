'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import VideosTable, { metricLabels } from './VideosTable';
import type { VideoListItem } from '@/types/mediakit';
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

interface FilterState {
  proposal: string;
  context: string;
  format: string;
  linkSearch: string;
  minViews: string;
}

// NOVO: Opções para o novo seletor de ordenação
const SORT_OPTIONS = [
  { value: 'postDate-desc', label: 'Mais Recentes' },
  { value: 'stats.views-desc', label: 'Mais Vistos' },
  { value: 'stats.likes-desc', label: 'Mais Curtidos' },
  { value: 'stats.comments-desc', label: 'Mais Comentados' },
  { value: 'stats.shares-desc', label: 'Mais Compartilhados' },
];

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

  const [filters, setFilters] = useState<FilterState>({
    proposal: '', context: '', format: '', linkSearch: '', minViews: '',
  });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilters(filters);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [filters]);

  const fetchVideos = useCallback(async () => {
    if (!isOpen || !userId) return;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(limit),
      sortBy: sortConfig.sortBy,
      sortOrder: sortConfig.sortOrder,
      timePeriod,
    });

    Object.entries(debouncedFilters).forEach(([key, value]) => {
      if (value) params.append(key, value);
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
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, userId, currentPage, limit, sortConfig, timePeriod, debouncedFilters]);

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

  // NOVO: Handler para o seletor de ordenação
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [sortBy, sortOrder] = e.target.value.split('-') as [string, 'asc' | 'desc'];
    setSortConfig({ sortBy, sortOrder });
    setCurrentPage(1);
  };

  const handleRowClick = (postId: string) => {
    setSelectedPostId(postId);
  };

  const handlePageChange = (newPage: number) => { /* ...código inalterado... */ };
  const totalPages = Math.ceil(totalVideos / limit);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-7xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 id="video-drilldown-title" className="text-lg font-semibold text-gray-800">
            Análise de Vídeos do Criador
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        {/* Seção de Filtros agora inclui o seletor de ordenação */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <input name="proposal" type="text" placeholder="Proposta" value={filters.proposal} onChange={handleFilterChange} className="p-2 border rounded-md text-sm" />
            <input name="context" type="text" placeholder="Contexto" value={filters.context} onChange={handleFilterChange} className="p-2 border rounded-md text-sm" />
            <input name="format" type="text" placeholder="Formato" value={filters.format} onChange={handleFilterChange} className="p-2 border rounded-md text-sm" />
            <input name="linkSearch" type="text" placeholder="Buscar no link" value={filters.linkSearch} onChange={handleFilterChange} className="p-2 border rounded-md text-sm" />
            <input name="minViews" type="number" placeholder="Mínimo de views" value={filters.minViews} onChange={handleFilterChange} className="p-2 border rounded-md text-sm" />
            {/* NOVO: Seletor de ordenação */}
            <select
              aria-label="Ordenar por"
              className="p-2 border rounded-md text-sm w-full bg-white"
              value={`${sortConfig.sortBy}-${sortConfig.sortOrder}`}
              onChange={handleSortChange}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-grow">
          {isLoading && <p className="text-center text-gray-500">Carregando vídeos...</p>}
          {error && <p className="text-center text-red-500">Erro: {error}</p>}
          {!isLoading && !error && videos.length === 0 && (
            <p className="text-center text-gray-500">Nenhum vídeo encontrado com os filtros aplicados.</p>
          )}
          {!isLoading && !error && videos.length > 0 && (
            // CORREÇÃO: Removidas as props 'sortConfig', 'onSort' e 'primaryMetric'
            <VideosTable
              videos={videos}
              onRowClick={handleRowClick}
            />
          )}
        </div>
        
        {/* ... Paginação (inalterada) ... */}

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