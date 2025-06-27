'use client';

import React from 'react';
import Image from 'next/image';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';

export interface VideoListItem {
  _id: string;
  thumbnailUrl?: string | null;
  caption?: string;
  permalink?: string | null;
  postDate?: string | Date;
  stats?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    video_duration_seconds?: number;
  };
  average_video_watch_time_seconds?: number | null;
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
}

export const metricLabels: Record<string, string> = {
  retention_rate: 'Retenção',
  average_video_watch_time_seconds: 'Watch Time (s)',
  views: 'Views',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  video_duration_seconds: 'Duração (s)',
};

const VideosTable: React.FC<VideosTableProps> = ({ videos, sortConfig, onSort, primaryMetric }) => {
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

  const renderCell = (video: VideoListItem, key: string) => {
    switch (key) {
      case 'thumbnail':
        return video.thumbnailUrl ? (
          video.permalink ? (
            <a href={video.permalink} target="_blank" rel="noopener noreferrer">
              <Image
                src={video.thumbnailUrl}
                alt=""
                width={60}
                height={34}
                className="rounded-md object-cover"
              />
            </a>
          ) : (
            <Image
              src={video.thumbnailUrl}
              alt=""
              width={60}
              height={34}
              className="rounded-md object-cover"
            />
          )
        ) : (
          <div className="w-15 h-9 bg-gray-200 rounded-md" />
        );
      case 'caption':
        return video.permalink ? (
          <a
            href={video.permalink}
            target="_blank"
            rel="noopener noreferrer"
            title={video.caption ?? ''}
            className="block truncate text-indigo-600 hover:underline"
          >
            {video.caption || 'N/A'}
          </a>
        ) : (
          <span title={video.caption ?? ''} className="block truncate">
            {video.caption || 'N/A'}
          </span>
        );
      case 'postDate':
        return formatDate(video.postDate);
      case 'views':
        return formatNumber(video.stats?.views);
      case 'likes':
        return formatNumber(video.stats?.likes);
      case 'comments':
        return formatNumber(video.stats?.comments);
      case 'shares':
        return formatNumber(video.stats?.shares);
      case 'average_video_watch_time_seconds':
        return formatNumber(video.average_video_watch_time_seconds ?? undefined);
      case 'video_duration_seconds':
        return formatNumber(video.stats?.video_duration_seconds);
      case 'retention_rate':
        return video.retention_rate != null ? `${(video.retention_rate * 100).toFixed(1)}%` : 'N/A';
      default:
        // fallback for unknown keys
        return (video as any)[key] ?? 'N/A';
    }
  };

  const columns = [
    { key: 'thumbnail', label: 'Thumb', sortable: false },
    { key: 'caption', label: 'Legenda', sortable: true },
    { key: 'postDate', label: 'Data', sortable: true },
    { key: primaryMetric, label: metricLabels[primaryMetric] || primaryMetric, sortable: true },
    ...(primaryMetric !== 'views' ? [{ key: 'views', label: 'Views', sortable: true }] : []),
    ...(primaryMetric !== 'average_video_watch_time_seconds'
      ? [{ key: 'average_video_watch_time_seconds', label: metricLabels['average_video_watch_time_seconds'], sortable: true }]
      : []),
    ...(primaryMetric !== 'video_duration_seconds'
      ? [{ key: 'video_duration_seconds', label: metricLabels['video_duration_seconds'], sortable: true }]
      : []),
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
            <tr key={video._id} className="hover:bg-indigo-50 transition-colors">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-2 whitespace-nowrap ${
                    ['views', 'likes', 'comments', 'shares', 'postDate', 'average_video_watch_time_seconds', 'video_duration_seconds', primaryMetric].includes(col.key)
                      ? 'text-center'
                      : ''
                  }`}
                >
                  {renderCell(video, col.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default VideosTable;
