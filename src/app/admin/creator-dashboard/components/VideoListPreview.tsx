"use client";

import React, { useEffect, useState } from "react";
import {
  EyeIcon,
  HeartIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ShareIcon,
  BookmarkIcon,
} from "@heroicons/react/24/outline"; // Usando a versão 'outline' para um look mais leve
import { VideoListItem } from "@/types/mediakit";
import { idsToLabels } from "@/app/lib/classification";

type LabelType = "format" | "proposal" | "context" | "tone" | "reference";

interface VideoListPreviewProps {
  userId: string;
  timePeriod: string;
  limit?: number;
  onExpand?: () => void;
  onRowClick?: (postId: string) => void;
}

const formatDate = (d?: string | Date) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "N/A";

const formatNumber = (n?: number) =>
  n?.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 }) ?? "-";

const getLabels = (tags: string | string[] | undefined, type: LabelType): string[] => {
  if (!tags) return [];
  const initialArray = Array.isArray(tags) ? tags : [String(tags)];
  const allIds = initialArray.flatMap((tag) =>
    String(tag).split(",").map((id) => id.trim()).filter(Boolean)
  );
  return idsToLabels(allIds, type as any);
};

// Configuração de estilo das tags atualizada para o novo design
const labelConfig: {
  type: LabelType;
  property: string;
  className: string;
}[] = [
  { type: "format", property: "format", className: "bg-gray-100 text-gray-800" },
  { type: "proposal", property: "proposal", className: "bg-blue-100 text-blue-800" },
  { type: "context", property: "context", className: "bg-indigo-100 text-indigo-800" },
  { type: "tone", property: "tone", className: "bg-amber-100 text-amber-800" },
  { type: "reference", property: "references", className: "bg-emerald-100 text-emerald-800" },
];

const VideoListPreview: React.FC<VideoListPreviewProps> = ({ userId, timePeriod, limit = 5, onExpand, onRowClick }) => {
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
          page: "1", limit: String(limit), sortBy: "views", sortOrder: "desc", timePeriod,
        });
        const response = await fetch(`/api/v1/users/${userId}/videos/list?${params.toString()}`);
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || response.statusText);
        }
        const data = await response.json();
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
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Vídeos Recentes</h4>
      {loading && <p className="text-sm text-gray-500">Carregando vídeos...</p>}
      {error && <p className="text-sm text-red-500">Erro: {error}</p>}
      {!loading && !error && videos.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Nenhum vídeo encontrado para este período.</p>
        </div>
      )}
      {!loading && !error && videos.length > 0 && (
        <div className="space-y-4">
          {videos.map((video) => (
            <div
              key={video._id}
              onClick={() => onRowClick && onRowClick(video._id)}
              className="bg-white border border-gray-200/80 rounded-lg shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-1 md:flex md:items-start md:gap-4 p-4"
            >
              <img
                src={video.thumbnailUrl || "https://placehold.co/320x180/e2e8f0/a0aec0?text=Img"}
                alt={video.caption || "thumbnail"}
                className="w-full aspect-video object-cover rounded-md md:w-36 md:h-auto md:flex-shrink-0"
                width={320}
                height={180}
              />
              <div className="flex flex-col flex-1 mt-3 md:mt-0 h-full">
                <div className="flex-grow">
                  <p className="text-base font-semibold text-gray-800 line-clamp-2" title={video.caption}>
                    {video.caption || "Sem legenda"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{formatDate(video.postDate)}</p>

                  <div className="flex flex-wrap gap-2 text-xs font-medium mt-3">
                    {labelConfig.map(config =>
                      getLabels((video as any)[config.property] as string[], config.type).map(tag => (
                        <span
                          key={`${config.type}-${tag}`}
                          className={`${config.className} px-2.5 py-1 rounded-full`}
                        >
                          {tag}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-4 pt-3 border-t border-gray-200/80">
                  <span className="flex items-center gap-1.5" title="Visualizações">
                    <EyeIcon className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{formatNumber(video.stats?.views)}</span>
                  </span>
                  <span className="flex items-center gap-1.5" title="Curtidas">
                    <HeartIcon className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{formatNumber(video.stats?.likes)}</span>
                  </span>
                  <span className="flex items-center gap-1.5" title="Comentários">
                    <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{formatNumber(video.stats?.comments)}</span>
                  </span>
                  <span className="flex items-center gap-1.5" title="Compartilhamentos">
                    <ShareIcon className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{formatNumber(video.stats?.shares)}</span>
                  </span>
                  <span className="flex items-center gap-1.5" title="Salvos">
                    <BookmarkIcon className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{formatNumber((video.stats as any)?.saves)}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
          {onExpand && (
            <button
              onClick={onExpand}
              className="w-full mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-semibold py-2 rounded-lg hover:bg-indigo-50 transition-colors"
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