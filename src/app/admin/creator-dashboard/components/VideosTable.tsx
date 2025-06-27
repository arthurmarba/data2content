'use client';

import React from 'react';
import Image from 'next/image';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';

export interface VideoListItem {
  _id: string;
  thumbnailUrl?: string;
  caption?: string;
  postDate?: string | Date;
  stats?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
}

interface SortConfig {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface VideosTableProps {
  videos: VideoListItem[];
  sortConfig: SortConfig;
  onSort: (column: string) => void;
}

const VideosTable: React.FC<VideosTableProps> = ({ videos, sortConfig, onSort }) => {
  const renderSortIcon = (key: string) => {
    if (sortConfig.sortBy !== key) {
      return <ChevronDownIcon className="w-3 h-3 inline text-gray-400 ml-1" />;
    }
    return sortConfig.sortOrder === 'asc' ? (
      <ChevronUpIcon className="w-3 h-3 inline text-indigo-500 ml-1" />
    ) : (
      <ChevronDownIcon className="w-3 h-3 inline text-indigo-500 ml-1" />
    );
  };

  const formatDate = (d?: string | Date) => {
    if (!d) return 'N/A';
    try {
      return new Date(d).toLocaleDateString('pt-BR');
    } catch {
      return 'N/A';
    }
  };

  const formatNumber = (n?: number) => {
    if (n === null || n === undefined) return '0';
    return n.toLocaleString('pt-BR');
  };

  const columns = [
    { key: 'thumbnail', label: 'Thumb', sortable: false },
    { key: 'caption', label: 'Legenda', sortable: true },
    { key: 'postDate', label: 'Data', sortable: true },
    { key: 'views', label: 'Views', sortable: true },
    { key: 'likes', label: 'Likes', sortable: true },
    { key: 'comments', label: 'Coments', sortable: true },
    { key: 'shares', label: 'Shares', sortable: true },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-100">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                  col.sortable ? 'cursor-pointer hover:bg-gray-200' : ''
                } ${['views', 'likes', 'comments', 'shares', 'postDate'].includes(col.key) ? 'text-center' : 'text-left'}`}
                onClick={() => col.sortable && onSort(col.key)}
              >
                {col.label}
                {col.sortable && renderSortIcon(col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {videos.map((video) => (
            <tr key={video._id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-2 whitespace-nowrap">
                {video.thumbnailUrl ? (
                  <Image src={video.thumbnailUrl} alt="" width={60} height={34} className="rounded-md object-cover" />
                ) : (
                  <div className="w-15 h-9 bg-gray-200 rounded-md" />
                )}
              </td>
              <td className="px-4 py-2 whitespace-nowrap max-w-xs">
                <span title={video.caption} className="block truncate">
                  {video.caption || 'N/A'}
                </span>
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-center">{formatDate(video.postDate)}</td>
              <td className="px-4 py-2 whitespace-nowrap text-center">{formatNumber(video.stats?.views)}</td>
              <td className="px-4 py-2 whitespace-nowrap text-center">{formatNumber(video.stats?.likes)}</td>
              <td className="px-4 py-2 whitespace-nowrap text-center">{formatNumber(video.stats?.comments)}</td>
              <td className="px-4 py-2 whitespace-nowrap text-center">{formatNumber(video.stats?.shares)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default VideosTable;
