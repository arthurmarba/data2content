'use client';

import Image from 'next/image';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { idsToLabels, formatCategories, proposalCategories, contextCategories, toneCategories, referenceCategories, Category } from '@/app/lib/classification';
import {
  XMarkIcon,
  FireIcon,
  EyeIcon,
  HeartIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ShareIcon,
  ChartBarIcon,
  BookmarkIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/solid';
import PostReviewModal from './PostReviewModal';
import DiscoverVideoModal from '@/app/discover/components/DiscoverVideoModal';




// Categorias importadas do classification.ts


// --- Componentes de Apoio e Tipos ---

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919A118.663 118.663 0 0112 2.163zm0 1.441c-3.141 0-3.503.012-4.72.068-2.759.127-3.945 1.313-4.073 4.073-.056 1.217-.067 1.575-.067 4.72s.011 3.503.067 4.72c.127 2.759 1.313 3.945 4.073 4.073 1.217.056 1.575.067 4.72.067s3.503-.011 4.72-.067c2.759-.127 3.945-1.313 4.073-4.073.056-1.217.067-1.575.067-4.72s-.011-3.503-.067-4.72c-.128-2.76-1.314-3.945-4.073-4.073-.91-.042-1.28-.055-3.626-.055zm0 2.882a4.512 4.512 0 100 9.024 4.512 4.512 0 000-9.024zM12 15a3 3 0 110-6 3 3 0 010 6zm6.406-7.875a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25z" />
  </svg>
);

const ClassificationTags: React.FC<{
  title: string;
  tags?: string[] | string; // Prop 'tags' pode ser string ou array
  colorClasses: string;
  type: 'format' | 'proposal' | 'context' | 'tone' | 'reference';
}> = ({ title, tags, colorClasses, type }) => {
  // ✅ CORREÇÃO: Garante que 'tags' seja sempre um array de IDs antes de traduzir.
  const sanitizedIds = !tags
    ? []
    : Array.isArray(tags)
      ? tags
      : String(tags).split(',').map(id => id.trim()).filter(Boolean);

  const labels = idsToLabels(sanitizedIds, type);

  if (labels.length === 0) return null;

  return (
    <div>
      <h5 className="text-sm font-semibold text-gray-500 mb-1">{title}</h5>
      <div className="flex flex-wrap gap-1 text-sm">
        {labels.map(tag => (
          <span key={tag} className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium ${colorClasses}`}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
};


interface VideoListItem {
  _id: string;
  postLink?: string;
  permalink?: string;
  description: string;
  thumbnailUrl?: string;
  format?: string[] | string;
  proposal?: string[] | string;
  context?: string[] | string;
  tone?: string[] | string;
  references?: string[] | string;
  stats: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
  };
  postDate: string;
  mediaUrl?: string;
  media_url?: string;
}


interface VideosTableProps {
  videos: VideoListItem[];
  onRowClick?: (postId: string) => void;
  onReviewClick?: (video: VideoListItem) => void;
  onPlayClick?: (video: VideoListItem) => void;
  onDetailClick?: (postId: string) => void;
  readOnly?: boolean;
}



const PostDetailModal: React.FC<{ isOpen: boolean; onClose: () => void; postId: string | null; publicMode?: boolean; }> = ({ isOpen, onClose, postId }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl relative flex flex-col max-h-[80vh]">
        <header className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Detalhes do Post</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-6 overflow-y-auto">
          <h3 className="font-bold text-gray-700">Análise do Post ID:</h3>
          <p className="text-sm text-gray-600 mb-4">{postId}</p>
          <p className="text-sm text-gray-500">Este é um componente placeholder. A lógica para buscar e exibir os detalhes completos da performance e classificação do post seria implementada aqui.</p>
        </div>
      </div>
    </div>
  );
};


const VideoCard: React.FC<{
  video: VideoListItem;
  index: number;
  readOnly?: boolean;
  onRowClick?: (postId: string) => void;
  onReviewClick?: (video: VideoListItem) => void;
  onPlayClick?: (video: VideoListItem) => void;
  onDetailClick?: (postId: string) => void;
}> = ({ video, index, readOnly, onRowClick, onReviewClick, onPlayClick, onDetailClick }) => {



  const formatDate = (d?: string | Date) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';
  const formatNumber = (n?: number) => n?.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }) ?? '-';
  const calculateEngagementRate = (stats: VideoListItem['stats']) => {
    const views = stats?.views ?? 0;
    const likes = stats?.likes ?? 0;
    const comments = stats?.comments ?? 0;
    if (views === 0) return '0.00%';
    return `${(((likes + comments) / views) * 100).toFixed(2)}%`;
  };

  return (
    <div
      onClick={() => onPlayClick ? onPlayClick(video) : (onRowClick && onRowClick(video._id))}
      className={`p-4 bg-white rounded-lg shadow-sm border border-gray-100 transition-all cursor-pointer hover:shadow-md hover:ring-2 hover:ring-indigo-500/20 group ${readOnly && index === 0 ? 'bg-pink-50 border-pink-200' : ''}`}
    >

      <div className="grid grid-cols-12 gap-x-4 gap-y-3 items-start">
        <div className="col-span-12 md:col-span-4 flex items-start gap-4">
          <Image src={video.thumbnailUrl || 'https://placehold.co/72x128/e2e8f0/a0aec0?text=Img'} alt={`Thumbnail para ${video.description || 'post'}`} width={72} height={128} className="rounded-md object-cover flex-shrink-0 mt-1 group-hover:scale-105 transition-transform aspect-[9/16]" />
          <div className="flex-grow">

            <p className="font-semibold text-base text-gray-800 line-clamp-3" title={video.description}>
              {readOnly && index === 0 && <FireIcon className="w-4 h-4 text-orange-400 inline-block mr-1.5 align-text-bottom" title="Top Performance" />}
              {video.description || 'Sem legenda'}
            </p>
            <p className="text-sm text-gray-500 mt-1">{formatDate(video.postDate)}</p>
          </div>
        </div>

        <div className="col-span-12 md:col-span-3 space-y-2">
          <ClassificationTags title="Formato" tags={video.format} type="format" colorClasses="bg-gray-100 text-gray-800" />
          <ClassificationTags title="Proposta" tags={video.proposal} type="proposal" colorClasses="bg-blue-100 text-blue-800" />
          <ClassificationTags title="Contexto" tags={video.context} type="context" colorClasses="bg-purple-100 text-purple-800" />
          <ClassificationTags title="Tom" tags={video.tone} type="tone" colorClasses="bg-yellow-100 text-yellow-800" />
          <ClassificationTags title="Referências" tags={video.references} type="reference" colorClasses="bg-green-100 text-green-800" />
        </div>

        <div className="col-span-6 md:col-span-1 text-left md:text-center">
          <h5 className="text-sm font-semibold text-gray-500 mb-1 md:hidden">Engaj.</h5>
          <div className="font-bold text-base text-pink-600">{calculateEngagementRate(video.stats)}</div>
        </div>

        <div className="col-span-6 md:col-span-2">
          <h5 className="text-sm font-semibold text-gray-500 mb-1 md:hidden">Performance</h5>
          <div className="flex flex-col space-y-1.5 text-sm font-semibold">
            <span className="flex items-center gap-2 text-gray-700"><EyeIcon className="text-gray-400 w-4 h-4" /> {formatNumber(video.stats?.views)}</span>
            <span className="flex items-center gap-2 text-gray-700"><HeartIcon className="text-gray-400 w-4 h-4" /> {formatNumber(video.stats?.likes)}</span>
            <span className="flex items-center gap-2 text-gray-700"><ChatBubbleOvalLeftEllipsisIcon className="text-gray-400 w-4 h-4" /> {formatNumber(video.stats?.comments)}</span>
            <span className="flex items-center gap-2 text-gray-700"><ShareIcon className="text-gray-400 w-4 h-4" /> {formatNumber(video.stats?.shares)}</span>
            <span className="flex items-center gap-2 text-gray-700"><BookmarkIcon className="text-gray-400 w-4 h-4" /> {formatNumber(video.stats?.saves)}</span>
          </div>
        </div>

        <div className="col-span-12 md:col-span-2 flex flex-row sm:flex-col items-center justify-start sm:justify-center gap-2 pt-2 md:pt-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDetailClick ? onDetailClick(video._id) : (onRowClick && onRowClick(video._id));
            }}
            title="Analisar Detalhes"
            className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-colors"
          >
            <ChartBarIcon className="w-3.5 h-3.5" />
            <span>Analisar</span>
          </button>

          {onReviewClick && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReviewClick(video);
              }}
              title="Fazer Review"
              className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md shadow-sm hover:bg-indigo-100 transition-colors"
            >

              <PencilSquareIcon className="w-3.5 h-3.5" />
              <span>Review</span>
            </button>
          )}

          <a href={video.permalink ?? '#'} target="_blank" rel="noopener noreferrer" title="Ver na Rede Social" className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-sm font-semibold text-white bg-gray-800 rounded-md shadow-sm hover:bg-gray-700 transition-colors">
            <InstagramIcon className="w-3.5 h-3.5" />
            <span>Ver Post</span>
          </a>
        </div>
      </div>
    </div>
  );
};


const VideosTable: React.FC<VideosTableProps> = ({ videos, ...props }) => {
  return (
    <div className="space-y-3">
      <div className="hidden md:grid md:grid-cols-12 md:gap-x-4 px-4 py-2 border-b border-gray-200">
        <h4 className="md:col-span-4 text-left text-sm font-semibold text-gray-400 uppercase tracking-wider">Conteúdo</h4>
        <h4 className="md:col-span-3 text-left text-sm font-semibold text-gray-400 uppercase tracking-wider">Classificação</h4>
        <h4 className="md:col-span-1 text-center text-sm font-semibold text-gray-400 uppercase tracking-wider">Engaj.</h4>
        <h4 className="md:col-span-2 text-left text-sm font-semibold text-gray-400 uppercase tracking-wider">Performance</h4>
        <h4 className="md:col-span-2 text-center text-sm font-semibold text-gray-400 uppercase tracking-wider">Ações</h4>
      </div>

      {videos.map((video, index) => (
        <VideoCard
          key={video._id}
          video={video}
          index={index}
          onReviewClick={props.onReviewClick}
          onPlayClick={props.onPlayClick}
          onDetailClick={props.onDetailClick}
          {...props}
        />
      ))}


    </div>
  );
};

// --- Componente Principal do Modal ---

interface FilterState {
  proposal: string;
  context: string;
  format: string;
  tone: string;
  references: string;
  linkSearch: string;
  minViews: string;
  types: string;
}


const SORT_OPTIONS = [
  { value: 'postDate-desc', label: 'Mais Recentes' },
  { value: 'stats.views-desc', label: 'Mais Vistos' },
  { value: 'stats.likes-desc', label: 'Mais Curtidos' },
  { value: 'stats.comments-desc', label: 'Mais Comentados' },
  { value: 'stats.shares-desc', label: 'Mais Compartilhados' },
];

interface VideoDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  timePeriod: string;
  drillDownMetric: string | null;
  startDate?: string;
  endDate?: string;
  initialFilters?: Partial<FilterState>;
  initialTypes?: string;
}


const VideoDrillDownModal: React.FC<VideoDrillDownModalProps> = ({
  isOpen,
  onClose,
  userId,
  timePeriod,
  drillDownMetric,
  startDate,
  endDate,
  initialFilters,
  initialTypes,
}) => {

  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [totalVideos, setTotalVideos] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);
  const [sortConfig, setSortConfig] = useState({
    sortBy: drillDownMetric || 'postDate',
    sortOrder: 'desc',
  });
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedVideoForReview, setSelectedVideoForReview] = useState<VideoListItem | null>(null);
  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<VideoListItem | null>(null);


  const [filters, setFilters] = useState<FilterState>({

    proposal: '', context: '', format: '', tone: '', references: '', linkSearch: '', minViews: '',
    types: initialTypes || '',
    ...initialFilters
  });

  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  const createOptionsFromCategories = (categories: Category[]) => {
    const options: { value: string; label: string }[] = [];
    const traverse = (cats: Category[], prefix = '') => {
      cats.forEach(cat => {
        const label = prefix ? `${prefix} > ${cat.label}` : cat.label;
        options.push({ value: cat.id, label });
        if (cat.subcategories && cat.subcategories.length > 0) {
          traverse(cat.subcategories, label);
        }
      });
    };
    traverse(categories);
    return options;
  };

  const formatOptions = createOptionsFromCategories(formatCategories);
  const proposalOptions = createOptionsFromCategories(proposalCategories);
  const contextOptions = createOptionsFromCategories(contextCategories);
  const toneOptions = createOptionsFromCategories(toneCategories);
  const referenceOptions = createOptionsFromCategories(referenceCategories);

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
      types: debouncedFilters.types,
    });


    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

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
      setVideos(data.posts || data.videos || []); // Handle both field names
      setTotalVideos(data.pagination?.totalPosts || data.pagination?.totalVideos || 0); // Handle both field names
    } catch (e: any) {

      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, userId, currentPage, limit, sortConfig, timePeriod, debouncedFilters, startDate, endDate]);

  useEffect(() => {
    if (drillDownMetric) {
      setSortConfig({ sortBy: drillDownMetric, sortOrder: 'desc' });
      setCurrentPage(1);
    }
  }, [drillDownMetric]);

  useEffect(() => {
    if (isOpen && userId) {
      // Reset filters when opening, applying initialFilters
      setFilters({
        proposal: '', context: '', format: '', tone: '', references: '', linkSearch: '', minViews: '',
        types: initialTypes || '',
        ...initialFilters
      });

    } else if (!isOpen) {
      setVideos([]);
      setError(null);
      setIsLoading(false);
      // We don't necessarily need to reset filters on close if we reset on open
    }
  }, [isOpen, userId, initialFilters]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchVideos();
    }
  }, [isOpen, userId, fetchVideos]);

  if (!isOpen) return null;

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [sortBy, sortOrder] = e.target.value.split('-') as [string, 'asc' | 'desc'];
    setSortConfig({ sortBy, sortOrder });
    setCurrentPage(1);
  };

  const handleRowClick = (postId: string) => {
    setSelectedPostId(postId);
  };

  const handleOpenReviewModal = (video: VideoListItem) => {
    setSelectedVideoForReview(video);
    setIsReviewModalOpen(true);
  };

  const handlePlayVideo = (video: VideoListItem) => {
    setSelectedVideoForPlayer(video);
    setIsVideoPlayerOpen(true);
  };

  const handleOpenDetail = (postId: string) => {
    setSelectedPostId(postId);
  };



  const totalPages = Math.ceil(totalVideos / limit);
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

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

        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <select name="format" value={filters.format} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-white"><option value="">Todos Formatos</option>{formatOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <select name="proposal" value={filters.proposal} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-white"><option value="">Todas Propostas</option>{proposalOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <select name="context" value={filters.context} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-white"><option value="">Todos Contextos</option>{contextOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <select name="tone" value={filters.tone} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-white"><option value="">Todos Tons</option>{toneOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <select name="references" value={filters.references} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-white"><option value="">Todas Referências</option>{referenceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <input name="minViews" type="number" placeholder="Mínimo de views" value={filters.minViews} onChange={handleFilterChange} className="p-2 border rounded-md text-sm" />
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
            <VideosTable
              videos={videos}
              onPlayClick={handlePlayVideo}
              onDetailClick={handleOpenDetail}
              onReviewClick={handleOpenReviewModal}
            />
          )}

        </div>

        {totalVideos > 0 && (
          <div className="p-4 border-t border-gray-200 flex justify-between items-center text-sm bg-gray-50 rounded-b-xl">
            <span className="font-medium text-gray-600">Total: {totalVideos} resultados</span>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold shadow-sm"
              >
                Anterior
              </button>
              <span className="font-semibold text-gray-700">Página {currentPage} de {totalPages}</span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold shadow-sm"
              >
                Próxima
              </button>
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
      <PostReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        apiPrefix="/api/admin"
        post={selectedVideoForReview ? {
          _id: selectedVideoForReview._id,
          coverUrl: selectedVideoForReview.thumbnailUrl,
          description: selectedVideoForReview.description,
          creatorName: "Criador", // Info not readily available here, but describing as Criador
        } : null}
      />
      <DiscoverVideoModal
        open={isVideoPlayerOpen}
        onClose={() => setIsVideoPlayerOpen(false)}
        videoUrl={selectedVideoForPlayer?.mediaUrl || selectedVideoForPlayer?.media_url || undefined}
        posterUrl={selectedVideoForPlayer?.thumbnailUrl || undefined}
        postLink={selectedVideoForPlayer?.permalink || undefined}
      />
    </div>

  );
};

export default VideoDrillDownModal;
