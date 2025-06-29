'use client';

import React from 'react';
import Image from 'next/image';
import { FireIcon } from '@heroicons/react/24/solid';
import { FaEye, FaHeart, FaComment, FaShare, FaInstagram, FaChartBar } from 'react-icons/fa';

export interface VideoListItem {
  _id: string;
  thumbnailUrl?: string | null;
  caption?: string;
  permalink?: string | null;
  postDate?: string | Date;
  proposal?: string;
  context?: string;
  format?: string;
  stats?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
}

// Props simplificadas para o novo componente
interface VideosTableProps {
  videos: VideoListItem[];
  onRowClick?: (postId: string) => void;
  readOnly?: boolean;
}

export const metricLabels: Record<string, string> = { /* ... (inalterado) ... */ };

// --- Sub-componente para cada Card de Vídeo (Refatorado) ---
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
      {/* CORREÇÃO: Usando um grid de 12 colunas para alinhamento perfeito */}
      <div className="grid grid-cols-12 gap-x-4 gap-y-2 items-start">
        
        {/* Coluna 1: Conteúdo (Ocupa 5 de 12 colunas em desktop) */}
        <div className="col-span-12 md:col-span-5 flex items-start gap-4">
          <Image src={video.thumbnailUrl || 'https://placehold.co/96x54/e2e8f0/a0aec0?text=Img'} alt={`Thumbnail para ${video.caption || 'post'}`} width={96} height={54} className="rounded-md object-cover flex-shrink-0" />
          <div className="flex-grow">
            <p className="font-semibold text-sm text-gray-800 line-clamp-3">
              {readOnly && index === 0 && <FireIcon className="w-4 h-4 text-orange-400 inline-block mr-1.5 align-text-bottom" title="Top Performance"/>}
              {video.caption || 'Sem legenda'}
            </p>
            <p className="text-xs text-gray-500 mt-1">{formatDate(video.postDate)}</p>
          </div>
        </div>

        {/* Coluna 2: Estratégia (Ocupa 2 de 12 colunas em desktop) */}
        <div className="col-span-12 md:col-span-2 flex flex-wrap gap-1.5 items-center">
          {video.proposal && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">{video.proposal}</span>}
          {video.context && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-800">{video.context}</span>}
          {video.format && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">{video.format}</span>}
        </div>

        {/* Coluna 3: Taxa de Engajamento (Ocupa 1 de 12 colunas em desktop) */}
        <div className="col-span-12 md:col-span-1 text-left md:text-center">
          <div className="font-bold text-base text-pink-600">{calculateEngagementRate(video.stats)}</div>
        </div>

        {/* Coluna 4: Performance (Ocupa 2 de 12 colunas em desktop) */}
        <div className="col-span-12 md:col-span-2">
          <div className="flex flex-col space-y-1.5 text-xs">
            <span className="flex items-center gap-2 text-gray-700"><FaEye className="text-gray-400 w-3.5"/> {formatNumber(video.stats?.views)}</span>
            <span className="flex items-center gap-2 text-gray-700"><FaHeart className="text-gray-400 w-3.5"/> {formatNumber(video.stats?.likes)}</span>
            <span className="flex items-center gap-2 text-gray-700"><FaComment className="text-gray-400 w-3.5"/> {formatNumber(video.stats?.comments)}</span>
            <span className="flex items-center gap-2 text-gray-700"><FaShare className="text-gray-400 w-3.5"/> {formatNumber(video.stats?.shares)}</span>
          </div>
        </div>

        {/* Coluna 5: Ações (Ocupa 2 de 12 colunas em desktop) */}
        <div className="col-span-12 md:col-span-2 flex flex-row sm:flex-col items-center justify-start sm:justify-center gap-2">
          {onRowClick && (
            <button onClick={() => onRowClick(video._id)} title="Analisar Detalhes" className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-colors">
              <FaChartBar className="w-3.5 h-3.5" />
              <span>Analisar</span>
            </button>
          )}
          <a href={video.permalink ?? '#'} target="_blank" rel="noopener noreferrer" title="Ver na Rede Social" className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-white bg-gray-800 rounded-md shadow-sm hover:bg-gray-700 transition-colors">
            <FaInstagram className="w-3.5 h-3.5" />
            <span>Ver Post</span>
          </a>
        </div>
      </div>
    </div>
  );
};


// Componente Principal que renderiza o cabeçalho e a lista de cards
const VideosTable: React.FC<VideosTableProps> = ({ videos, ...props }) => {
  return (
    <div className="space-y-3">
      {/* Cabeçalho que usa o mesmo grid de 12 colunas e só aparece em desktop */}
      <div className="hidden md:grid md:grid-cols-12 md:gap-x-4 px-4 py-2 border-b border-gray-200">
        <h4 className="md:col-span-5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Conteúdo</h4>
        <h4 className="md:col-span-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Estratégia</h4>
        <h4 className="md:col-span-1 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Engaj.</h4>
        <h4 className="md:col-span-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Performance</h4>
        <h4 className="md:col-span-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Ações</h4>
      </div>
      
      {/* Lista de Cards */}
      {videos.map((video, index) => (
        <VideoCard key={video._id} video={video} index={index} {...props} />
      ))}
    </div>
  );
};

export default VideosTable;