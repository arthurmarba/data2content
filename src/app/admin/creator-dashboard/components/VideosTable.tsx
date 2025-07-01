'use client';

import React from 'react';
import { 
    FireIcon, 
    EyeIcon, 
    HeartIcon, 
    ChatBubbleOvalLeftEllipsisIcon, 
    ShareIcon, 
    ChartBarIcon, 
    BookmarkIcon 
} from '@heroicons/react/24/solid';

// --- Tipos e Interfaces ---

// Interface alinhada com a estrutura de dados mais recente (v5.2)
// Os campos de classificação são arrays de strings.
interface VideoListItem {
  _id: string;
  postLink?: string;
  permalink?: string;
  description: string;
  thumbnailUrl?: string;
  format?: string[];
  proposal?: string[];
  context?: string[];
  tone?: string[];
  references?: string[];
  stats: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
  };
  postDate: string;
}

interface VideosTableProps {
  videos: VideoListItem[];
  onRowClick?: (postId: string) => void;
  readOnly?: boolean;
}

// --- Componentes de Apoio ---

// Ícone do Instagram como um componente SVG inline para evitar dependências externas.
const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919A118.663 118.663 0 0112 2.163zm0 1.441c-3.141 0-3.503.012-4.72.068-2.759.127-3.945 1.313-4.073 4.073-.056 1.217-.067 1.575-.067 4.72s.011 3.503.067 4.72c.127 2.759 1.313 3.945 4.073 4.073 1.217.056 1.575.067 4.72.067s3.503-.011 4.72-.067c2.759-.127 3.945-1.313 4.073-4.073.056-1.217.067-1.575.067-4.72s-.011-3.503-.067-4.72c-.128-2.76-1.314-3.945-4.073-4.073-.91-.042-1.28-.055-3.626-.055zm0 2.882a4.512 4.512 0 100 9.024 4.512 4.512 0 000-9.024zM12 15a3 3 0 110-6 3 3 0 010 6zm6.406-7.875a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25z" />
    </svg>
);

// --- Sub-componente para cada Card de Vídeo ---
const VideoCard: React.FC<{ video: VideoListItem; index: number; readOnly?: boolean; onRowClick?: (postId: string) => void; }> = ({ video, index, readOnly, onRowClick }) => {
  
  const formatDate = (d?: string | Date) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatNumber = (n?: number) => {
    if (n === null || n === undefined) return '-';
    return n.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  };

  const calculateEngagementRate = (stats: VideoListItem['stats']) => {
    const views = stats?.views ?? 0;
    const likes = stats?.likes ?? 0;
    const comments = stats?.comments ?? 0;
    if (views === 0) return '0.00%';
    const rate = ((likes + comments) / views) * 100;
    return `${rate.toFixed(2)}%`;
  };

  return (
    <div className={`p-4 bg-white rounded-lg shadow-sm border border-gray-100 transition-colors ${readOnly && index === 0 ? 'bg-pink-50 border-pink-200' : ''}`}>
      <div className="grid grid-cols-12 gap-x-4 gap-y-2 items-start">
        
        {/* Coluna 1: Conteúdo */}
        <div className="col-span-12 md:col-span-5 flex items-start gap-4">
          <img src={video.thumbnailUrl || 'https://placehold.co/96x54/e2e8f0/a0aec0?text=Img'} alt={`Thumbnail para ${video.description || 'post'}`} width={96} height={54} className="rounded-md object-cover flex-shrink-0" />
          <div className="flex-grow">
            <p className="font-semibold text-sm text-gray-800 line-clamp-3" title={video.description}>
              {readOnly && index === 0 && <FireIcon className="w-4 h-4 text-orange-400 inline-block mr-1.5 align-text-bottom" title="Top Performance"/>}
              {video.description || 'Sem legenda'}
            </p>
            <p className="text-xs text-gray-500 mt-1">{formatDate(video.postDate)}</p>
          </div>
        </div>

        {/* Coluna 2: Estratégia (ATUALIZADO para renderizar arrays) */}
        <div className="col-span-12 md:col-span-2 flex flex-wrap gap-1.5 items-center">
          {video.format?.map(tag => <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">{tag}</span>)}
          {video.proposal?.map(tag => <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">{tag}</span>)}
          {video.context?.map(tag => <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-800">{tag}</span>)}
        </div>

        {/* Coluna 3: Taxa de Engajamento */}
        <div className="col-span-12 md:col-span-1 text-left md:text-center">
          <div className="font-bold text-base text-pink-600">{calculateEngagementRate(video.stats)}</div>
        </div>

        {/* Coluna 4: Performance */}
        <div className="col-span-12 md:col-span-2">
          <div className="flex flex-col space-y-1.5 text-xs">
            <span className="flex items-center gap-2 text-gray-700"><EyeIcon className="text-gray-400 w-3.5 h-3.5"/> {formatNumber(video.stats?.views)}</span>
            <span className="flex items-center gap-2 text-gray-700"><HeartIcon className="text-gray-400 w-3.5 h-3.5"/> {formatNumber(video.stats?.likes)}</span>
            <span className="flex items-center gap-2 text-gray-700"><ChatBubbleOvalLeftEllipsisIcon className="text-gray-400 w-3.5 h-3.5"/> {formatNumber(video.stats?.comments)}</span>
            <span className="flex items-center gap-2 text-gray-700"><ShareIcon className="text-gray-400 w-3.5 h-3.5"/> {formatNumber(video.stats?.shares)}</span>
            <span className="flex items-center gap-2 text-gray-700"><BookmarkIcon className="text-gray-400 w-3.5 h-3.5"/> {formatNumber(video.stats?.saves)}</span>
          </div>
        </div>

        {/* Coluna 5: Ações */}
        <div className="col-span-12 md:col-span-2 flex flex-row sm:flex-col items-center justify-start sm:justify-center gap-2">
          {onRowClick && (
            <button onClick={() => onRowClick(video._id)} title="Analisar Detalhes" className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-colors">
              <ChartBarIcon className="w-3.5 h-3.5" />
              <span>Analisar</span>
            </button>
          )}
          <a href={video.permalink ?? '#'} target="_blank" rel="noopener noreferrer" title="Ver na Rede Social" className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-white bg-gray-800 rounded-md shadow-sm hover:bg-gray-700 transition-colors">
            <InstagramIcon className="w-3.5 h-3.5" />
            <span>Ver Post</span>
          </a>
        </div>
      </div>
    </div>
  );
};


// --- Componente Principal ---
const VideosTable: React.FC<VideosTableProps> = ({ videos, ...props }) => {
  return (
    <div className="space-y-3">
      {/* Cabeçalho da Tabela */}
      <div className="hidden md:grid md:grid-cols-12 md:gap-x-4 px-4 py-2 border-b border-gray-200">
        <h4 className="md:col-span-5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Conteúdo</h4>
        <h4 className="md:col-span-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Estratégia</h4>
        <h4 className="md:col-span-1 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Engaj.</h4>
        <h4 className="md:col-span-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Performance</h4>
        <h4 className="md:col-span-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Ações</h4>
      </div>
      
      {/* Lista de Cards de Vídeo */}
      {videos.map((video, index) => (
        <VideoCard key={video._id} video={video} index={index} {...props} />
      ))}
    </div>
  );
};

export default VideosTable;
