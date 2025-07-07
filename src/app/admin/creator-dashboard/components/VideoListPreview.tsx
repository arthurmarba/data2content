"use client";

import React, { useEffect, useState } from "react";
import {
  EyeIcon,
  HeartIcon,
  ChatBubbleOvalLeftEllipsisIcon,
} from "@heroicons/react/24/solid";
import { VideoListItem } from "@/types/mediakit";

interface VideoListPreviewProps {
  userId: string;
  timePeriod: string;
  limit?: number;
  onExpand?: () => void;
}

const formatDate = (d?: string | Date) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "N/A";
const formatNumber = (n?: number) =>
  n?.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 }) ?? "-";

const VideoListPreview: React.FC<VideoListPreviewProps> = ({ userId, timePeriod, limit = 5, onExpand }) => {
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const fetchVideos = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: "1",
          limit: String(limit),
          sortBy: "views",
          sortOrder: "desc",
          timePeriod,
        });
        const response = await fetch(`/api/v1/users/${userId}/videos/list?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || response.statusText);
        }
        setVideos(data.videos || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, [userId, timePeriod, limit]);

  return (
    <div className="mt-4" data-testid="video-list-preview">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">Vídeos Recentes</h4>
      {loading && <p className="text-gray-500">Carregando vídeos...</p>}
      {error && <p className="text-red-500">Erro: {error}</p>}
      {!loading && !error && videos.length === 0 && (
        <p className="text-gray-500">Nenhum vídeo encontrado.</p>
      )}
      {!loading && !error && videos.length > 0 && (
        <div className="space-y-2">
          {videos.map((video) => (
            <div
              key={video._id}
              className="flex items-start gap-4 bg-white border border-gray-100 rounded-md p-2"
            >
              <img
                src={video.thumbnailUrl || "https://placehold.co/96x54/e2e8f0/a0aec0?text=Img"}
                alt={video.description || "thumbnail"}
                width={96}
                height={54}
                className="rounded-md object-cover flex-shrink-0 mt-1"
              />
              <div className="flex-grow">
                <p className="text-sm font-medium text-gray-700 line-clamp-2" title={video.description}>
                  {video.description || "Sem legenda"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{formatDate(video.postDate)}</p>
              </div>
              <div className="flex flex-col text-xs text-gray-600 gap-1 pr-2">
                <span className="flex items-center gap-1">
                  <EyeIcon className="w-3.5 h-3.5 text-gray-400" />
                  {formatNumber(video.stats?.views)}
                </span>
                <span className="flex items-center gap-1">
                  <HeartIcon className="w-3.5 h-3.5 text-gray-400" />
                  {formatNumber(video.stats?.likes)}
                </span>
                <span className="flex items-center gap-1">
                  <ChatBubbleOvalLeftEllipsisIcon className="w-3.5 h-3.5 text-gray-400" />
                  {formatNumber(video.stats?.comments)}
                </span>
              </div>
            </div>
          ))}
          {onExpand && (
            <button
              onClick={onExpand}
              className="mt-2 text-sm text-indigo-600 hover:underline"
            >
              Ver tabela completa
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoListPreview;
