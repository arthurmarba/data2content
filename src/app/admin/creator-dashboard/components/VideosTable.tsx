'use client';

import React from 'react';
import Image from 'next/image';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';

// A interface já está pronta para receber a URL da thumbnail.
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
    video_duration_seconds?: number;
    total_interactions?: number;
  };
  retention_rate?: number | null;
}

interface SortConfig {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface VideosTableProps {
  videos: VideoListItem[];
  sortConfig: SortConfig;
  onSort: (column: string) => void;
  primaryMetric: string;
  onRowClick?: (postId: string) => void;
}

export const metricLabels: Record<string, string> = {
  postDate: 'Data',
  caption: 'Legenda',
  proposal: 'Proposta',
  context: 'Contexto',
  format: 'Formato',
  'stats.views': 'Views',
  'stats.likes': 'Likes',
  'stats.comments': 'Comentários',
  'stats.shares': 'Compartilhamentos',
  'stats.total_interactions': 'Interações',
  retention_rate: 'Retenção',
};

const VideosTable: React.FC<VideosTableProps> = ({ videos, sortConfig, onSort, onRowClick }) => {
  const renderSortIcon = (key: string) => {
    if (sortConfig.sortBy !== key) {
      return <ChevronDownIcon className="w-3 h-3 inline text-gray-400 opacity-50 ml-1" />;
    }
    return sortConfig.sortOrder === 'asc' ? (
      <ChevronUpIcon className="w-4 h-4 inline text-indigo-600 ml-1" />
    ) : (
      <ChevronDownIcon className="w-4 h-4 inline text-indigo-600 ml-1" />
    );
  };

  const formatDate = (d?: string | Date) => {
    if (!d) return 'N/A';
    try {
      return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return 'Data Inválida';
    }
  };

  const formatNumber = (n?: number) => {
    if (n === null || n === undefined) return '-';
    return n.toLocaleString('pt-BR');
  };
  
  // MUDANÇA: Adicionada a coluna 'thumbnail' no início.
  const columns = [
    { key: 'thumbnail', label: '', sortable: false, align: 'center' }, // Coluna para a imagem
    { key: 'caption', label: 'Legenda', sortable: true, align: 'left' },
    { key: 'postDate', label: 'Data', sortable: true, align: 'center' },
    { key: 'proposal', label: 'Proposta', sortable: true, align: 'left' },
    { key: 'context', label: 'Contexto', sortable: true, align: 'left' },
    { key: 'format', label: 'Formato', sortable: true, align: 'left' },
    { key: 'stats.views', label: 'Views', sortable: true, align: 'center' },
    { key: 'stats.likes', label: 'Likes', sortable: true, align: 'center' },
  ];

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-${col.align} ${
                  col.sortable ? 'cursor-pointer hover:bg-gray-200 transition-colors' : ''
                }`}
                onClick={() => col.sortable && onSort(col.key)}
              >
                <div className={`flex items-center ${col.align === 'center' ? 'justify-center' : ''}`}>
                  {col.label}
                  {col.sortable && renderSortIcon(col.key)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {videos.map((video) => (
            <tr
              key={video._id}
              className="hover:bg-indigo-50 transition-colors"
              onClick={() => onRowClick && onRowClick(video._id)}
              tabIndex={0}
              role="button"
            >
              {/* MUDANÇA: Adicionada célula para renderizar a thumbnail */}
              <td className="px-4 py-2">
                {video.thumbnailUrl ? (
                  <Image
                    src={video.thumbnailUrl}
                    alt={`Thumbnail para ${video.caption || 'post'}`}
                    width={80}
                    height={45}
                    className="rounded object-cover"
                    // Fallback para caso a imagem quebre
                    onError={(e) => { e.currentTarget.src = 'https://placehold.co/80x45/e2e8f0/a0aec0?text=Img'; }}
                  />
                ) : (
                  <div className="w-20 h-[45px] bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">Sem Imagem</div>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap max-w-xs">
                <a
                  href={video.permalink ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={video.caption ?? ''}
                  className="block truncate font-medium text-indigo-700 hover:text-indigo-900"
                  onClick={(e) => e.stopPropagation()}
                >
                  {video.caption || 'Sem legenda'}
                </a>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-center text-gray-600">{formatDate(video.postDate)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-600">{video.proposal || '-'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-600">{video.context || '-'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-600">{video.format || '-'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-center text-gray-800 font-medium">{formatNumber(video.stats?.views)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-center text-gray-600">{formatNumber(video.stats?.likes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default VideosTable;
