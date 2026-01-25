// src/app/discover/components/DiscoverCard.tsx
'use client';

import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { track } from '@/lib/track';
import DiscoverVideoModal from './DiscoverVideoModal';

type PostCard = {
  id: string;
  coverUrl?: string | null;
  videoUrl?: string;
  mediaType?: string;
  isVideo?: boolean;
  caption?: string;
  postDate?: string;
  creatorName?: string;
  postLink?: string;
  stats?: {
    total_interactions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  };
  categories?: {
    format?: string[];
    proposal?: string[];
    context?: string[];
    tone?: string[];
    references?: string[];
  };
};

type NextItem = {
  id: string;
  coverUrl?: string | null;
  videoUrl?: string;
  mediaType?: string;
  isVideo?: boolean;
  postLink?: string;
  caption?: string;
  creatorName?: string;
};

function formatCompact(n?: number) {
  if (typeof n !== 'number' || !isFinite(n)) return '';
  try {
    return n.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  } catch {
    return String(n);
  }
}


export default function DiscoverCard({
  item,
  nextItem,
  trackContext,
  variant = 'rail',
  onUnavailable,
}: {
  item: PostCard;
  nextItem?: NextItem | null;
  trackContext?: Record<string, any>;
  variant?: 'rail' | 'grid';
  onUnavailable?: (postId: string) => void;
}) {
  const views = item?.stats?.views ?? item?.stats?.total_interactions;
  const isViews = item?.stats?.views !== undefined;
  const metrics = views ? `${formatCompact(views)} ${isViews ? 'views' : 'interações'}` : '';
  const caption = (item?.caption || '').trim();
  const short = caption.length > 110 ? caption.slice(0, 107) + '…' : caption;
  const [imgFailed, setImgFailed] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  const isGrid = variant === 'grid';
  const formats = item.categories?.format?.map(f => f.toLowerCase()) || [];
  const isReel = formats.some(f => f.includes('reel'));
  const aspectClass = isReel ? 'aspect-[9/16]' : 'aspect-[4/5]';
  const canPlayInline = Boolean(item.videoUrl || item.isVideo);
  const imageSizes = isGrid
    ? "(min-width: 1280px) 240px, (min-width: 768px) 200px, 160px"
    : "(min-width: 1280px) 220px, (min-width: 768px) 200px, 160px";

  const openVideo = () => {
    setVideoOpen(true);
    try { track('discover_card_click', { id: item.id, action: 'play_video', ...(trackContext || {}) }); } catch { }
  };

  const handleOpenVideo = (event: React.MouseEvent) => {
    if (!canPlayInline) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    openVideo();
  };

  useEffect(() => {
    if (imgFailed && onUnavailable) {
      onUnavailable(item.id);
    }
  }, [imgFailed, item.id, onUnavailable]);

  if (imgFailed && onUnavailable) {
    return null;
  }

  return (
    <article
      className={`${isGrid ? 'w-full' : 'flex-shrink-0 h-[250px] w-auto snap-start'} relative select-none transition-all duration-300 ease-out hover:z-20 hover:scale-110 hover:ring-4 hover:ring-white rounded-lg`}
      aria-label={short || 'Post'}
    >
      {item.postLink && !canPlayInline ? (
        <a
          href={item.postLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={canPlayInline ? handleOpenVideo : () => {
            try { track('discover_card_click', { id: item.id, action: 'open_instagram', ...(trackContext || {}) }); } catch { }
          }}
          className={`relative block h-full ${aspectClass} overflow-hidden rounded-lg bg-gray-100 shadow-sm`}
          aria-label={canPlayInline ? "Assistir vídeo" : "Abrir no Instagram"}
        >
          {item.coverUrl ? (
            <Image
              src={item.coverUrl}
              alt={short || 'Capa do post'}
              fill
              className="w-full h-full object-cover"
              loading="lazy"
              sizes={imageSizes}
              referrerPolicy="no-referrer"
              draggable={false}
              onError={() => setImgFailed(true)}
            />
          ) : null}

          {/* Overlay: Gradiente mais suave e informações internas */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />

          <div className="absolute top-2 right-2">
            {metrics && (
              <div className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                {metrics}
              </div>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
            <p className="text-[10px] font-medium opacity-90 mb-0.5">{item.creatorName}</p>
            {short && (
              <p className="text-[11px] leading-tight line-clamp-2 font-semibold text-shadow-sm">
                {short}
              </p>
            )}
          </div>
        </a>
      ) : (
        <div
          className={`relative h-full ${aspectClass} overflow-hidden rounded-lg bg-gray-100 shadow-sm`}
          onClick={canPlayInline ? handleOpenVideo : undefined}
          onKeyDown={
            canPlayInline
              ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openVideo();
                }
              }
              : undefined
          }
          role={canPlayInline ? "button" : undefined}
          tabIndex={canPlayInline ? 0 : undefined}
          aria-label={canPlayInline ? "Assistir vídeo" : "Post"}
        >
          {item.coverUrl ? (
            <Image
              src={item.coverUrl}
              alt={short || 'Capa do post'}
              fill
              className="w-full h-full object-cover"
              loading="lazy"
              sizes={imageSizes}
              referrerPolicy="no-referrer"
              draggable={false}
              onError={() => setImgFailed(true)}
            />
          ) : null}
          {/* Overlay: Gradiente mais suave e informações internas */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />

          <div className="absolute top-2 right-2">
            {metrics && (
              <div className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                {metrics}
              </div>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
            <p className="text-[10px] font-medium opacity-90 mb-0.5">{item.creatorName}</p>
            {short && (
              <p className="text-[11px] leading-tight line-clamp-2 font-semibold text-shadow-sm">
                {short}
              </p>
            )}
          </div>
        </div>
      )}

      <DiscoverVideoModal
        open={videoOpen}
        onClose={() => setVideoOpen(false)}
        postLink={item.postLink || undefined}
        videoUrl={item.videoUrl}
        posterUrl={item.coverUrl || undefined}
        nextItem={
          nextItem
            ? {
                id: nextItem.id,
                videoUrl: nextItem.videoUrl,
                postLink: nextItem.postLink,
                posterUrl: nextItem.coverUrl || undefined,
                caption: nextItem.caption,
                creatorName: nextItem.creatorName,
              }
            : undefined
        }
      />

    </article>
  );
}
