// src/app/discover/components/DiscoverCard.tsx
'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import React, { useEffect, useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { track } from '@/lib/track';

const DiscoverVideoModal = dynamic(() => import('./DiscoverVideoModal'), {
  ssr: false,
  loading: () => null,
});

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
    contentIntent?: string[];
    narrativeForm?: string[];
    contentSignals?: string[];
    stance?: string[];
    proofStyle?: string[];
    commercialMode?: string[];
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
  compactView = false,
  onUnavailable,
  priority = false,
}: {
  item: PostCard;
  nextItem?: NextItem | null;
  trackContext?: Record<string, any>;
  variant?: 'rail' | 'grid';
  compactView?: boolean;
  onUnavailable?: (postId: string) => void;
  priority?: boolean;
}) {
  const views = item?.stats?.views ?? item?.stats?.total_interactions;
  const isViews = item?.stats?.views !== undefined;
  const metrics = views ? `${formatCompact(views)} ${isViews ? 'views' : 'interações'}` : '';
  const caption = (item?.caption || '').trim();
  const short = caption.length > 110 ? caption.slice(0, 107) + '…' : caption;
  const creatorName = item.creatorName?.trim() || 'Criador';
  const creatorInitial = creatorName.charAt(0).toUpperCase();
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  const isGrid = variant === 'grid';
  const formats = item.categories?.format?.map(f => f.toLowerCase()) || [];
  const isReel = formats.some(f => f.includes('reel'));
  const aspectClass = isReel ? 'aspect-[9/16]' : 'aspect-[4/5]';
  const canPlayInline = Boolean(item.videoUrl || item.isVideo);
  const imageSizes = isGrid
    ? "(min-width: 1280px) 240px, (min-width: 768px) 200px, 160px"
    : compactView
      ? "(min-width: 1280px) 160px, (min-width: 768px) 150px, 128px"
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

  useEffect(() => {
    setImgFailed(false);
    setImgLoaded(false);
  }, [item.coverUrl]);

  if (imgFailed && onUnavailable) {
    return null;
  }

  return (
    <article
      className={`${isGrid ? 'w-full' : compactView ? 'flex-shrink-0 h-[198px] w-auto snap-start' : 'flex-shrink-0 h-[250px] w-auto snap-start'} group/card relative select-none rounded-[1.35rem] transition-all duration-300 ease-out ${compactView ? 'hover:z-10 hover:-translate-y-0.5' : 'hover:z-20 hover:-translate-y-1 hover:scale-[1.02]'}`}
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
          className={`relative block h-full ${aspectClass} overflow-hidden rounded-[1.35rem] bg-zinc-200 ring-1 ring-black/5`}
          aria-label={canPlayInline ? "Assistir vídeo" : "Abrir no Instagram"}
        >
          {!imgLoaded ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(145deg,#f4f4f5,#e4e4e7)] text-zinc-400">
              <span className="text-xl font-semibold">{creatorInitial}</span>
            </div>
          ) : null}
          {item.coverUrl ? (
            <Image
              src={item.coverUrl}
              alt={short || 'Capa do post'}
              fill
              className={`h-full w-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading={priority ? 'eager' : 'lazy'}
              priority={priority}
              quality={compactView ? 52 : isGrid ? 58 : 60}
              sizes={imageSizes}
              referrerPolicy="no-referrer"
              draggable={false}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
            />
          ) : null}

          <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/8 to-black/4 opacity-95" />

          <div className={compactView ? "absolute right-1.5 top-1.5" : "absolute top-2 right-2"}>
            {metrics && (
              <div className={`inline-flex items-center gap-1 rounded-full border border-white/18 bg-black/58 font-semibold text-white/95 shadow-[0_6px_16px_rgba(0,0,0,0.18)] backdrop-blur-md ${compactView ? "px-2 py-0.5 text-[8.5px]" : "px-2.5 py-1 text-[10px]"}`}>
                {canPlayInline ? <PlayCircle className={compactView ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true" /> : null}
                {metrics}
              </div>
            )}
          </div>

          <div className={`absolute bottom-0 left-0 right-0 text-white ${compactView ? "p-2.5" : "p-3.5"}`}>
            <p className={`truncate font-semibold text-white ${compactView ? "text-[10.5px] leading-tight" : "text-[11px]"}`}>{creatorName}</p>
            {!compactView && short ? (
              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/78">{short}</p>
            ) : null}
          </div>
        </a>
      ) : (
        <div
          className={`relative h-full ${aspectClass} overflow-hidden rounded-[1.35rem] bg-zinc-200 ring-1 ring-black/5`}
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
          {!imgLoaded ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(145deg,#f4f4f5,#e4e4e7)] text-zinc-400">
              <span className="text-xl font-semibold">{creatorInitial}</span>
            </div>
          ) : null}
          {item.coverUrl ? (
            <Image
              src={item.coverUrl}
              alt={short || 'Capa do post'}
              fill
              className={`h-full w-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading={priority ? 'eager' : 'lazy'}
              priority={priority}
              quality={compactView ? 52 : isGrid ? 58 : 60}
              sizes={imageSizes}
              referrerPolicy="no-referrer"
              draggable={false}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/8 to-black/4 opacity-95" />

          <div className={compactView ? "absolute right-1.5 top-1.5" : "absolute top-2 right-2"}>
            {metrics && (
              <div className={`inline-flex items-center gap-1 rounded-full border border-white/18 bg-black/58 font-semibold text-white/95 shadow-[0_6px_16px_rgba(0,0,0,0.18)] backdrop-blur-md ${compactView ? "px-2 py-0.5 text-[8.5px]" : "px-2.5 py-1 text-[10px]"}`}>
                {canPlayInline ? <PlayCircle className={compactView ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true" /> : null}
                {metrics}
              </div>
            )}
          </div>

          <div className={`absolute bottom-0 left-0 right-0 text-white ${compactView ? "p-2.5" : "p-3.5"}`}>
            <p className={`truncate font-semibold text-white ${compactView ? "text-[10.5px] leading-tight" : "text-[11px]"}`}>{creatorName}</p>
            {!compactView && short ? (
              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/78">{short}</p>
            ) : null}
          </div>
        </div>
      )}

      {videoOpen ? (
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
      ) : null}

    </article>
  );
}
