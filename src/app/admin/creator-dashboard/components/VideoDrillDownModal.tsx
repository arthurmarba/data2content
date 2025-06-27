'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import VideosTable, { VideoListItem } from './VideosTable';

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
  }, [isOpen, userId, currentPage, limit, sortConfig, timePeriod]);

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
    }
  }, [isOpen, userId, fetchVideos]);

  if (!isOpen) return null;

  const handleSort = (column: string) => {
    let order: 'asc' | 'desc' = 'asc';
    if (sortConfig.sortBy === column && sortConfig.sortOrder === 'asc') {
      order = 'desc';
    }
    setSortConfig({ sortBy: column, sortOrder: order });
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    const totalPages = Math.ceil(totalVideos / limit);
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  };

  const totalPages = Math.ceil(totalVideos / limit);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Vídeos do Criador</h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-4 overflow-y-auto flex-grow">
          {isLoading && <p className="text-center text-gray-500">Carregando vídeos...</p>}
          {error && <p className="text-center text-red-500">Erro: {error}</p>}
          {!isLoading && !error && videos.length === 0 && (
            <p className="text-center text-gray-500">Nenhum vídeo encontrado.</p>
          )}
          {!isLoading && !error && videos.length > 0 && (
            <VideosTable videos={videos} sortConfig={sortConfig} onSort={handleSort} />
          )}
        </div>
        {!isLoading && !error && totalVideos > 0 && (
          <div className="py-3 flex items-center justify-between border-t border-gray-200 text-sm px-4">
            <p className="text-gray-700">
              Página <span className="font-medium">{currentPage}</span> de{' '}
              <span className="font-medium">{totalPages}</span> ({totalVideos} vídeos)
            </p>
            <div className="flex-1 flex justify-end space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 text-xs"
              >
                Anterior
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading || totalVideos === 0}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 text-xs"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoDrillDownModal;
