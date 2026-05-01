// src/app/discover/components/DiscoverCard.tsx
'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import React, { useEffect, useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { track } from '@/lib/track';
import { getDiscoverCoverImageSrc } from './discoverCoverImage';

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

function formatCreatorHandle(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed === 'Criador') return trimmed || 'Criador';
  if (trimmed.startsWith('@')) return trimmed;
  return /\s/.test(trimmed) ? trimmed : `@${trimmed}`;
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
  const creatorLabel = formatCreatorHandle(creatorName);
  const creatorInitial = creatorName.charAt(0).toUpperCase();
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const coverImageSrc = getDiscoverCoverImageSrc(item.coverUrl);

  const isGrid = variant === 'grid';
  const formats = item.categories?.format?.map(f => f.toLowerCase()) || [];
  const isReel = formats.some(f => f.includes('reel'));
  const aspectClass = isReel ? 'aspect-[9/16]' : 'aspect-[4/5]';
  const railWidthClassName = isReel
    ? compactView ? "w-[112px]" : "w-[141px]"
    : compactView ? "w-[158px]" : "w-[200px]";
  const canPlayInline = Boolean(item.videoUrl || item.isVideo);
  const mediaFrameClassName = `relative block overflow-hidden rounded-[1.25rem] bg-zinc-200 ring-1 ring-black/5 ${
    isGrid
      ? `w-full ${aspectClass}`
      : compactView
        ? `h-[198px] ${railWidthClassName}`
        : `h-[250px] ${railWidthClassName}`
  }`;
  const articleClassName = `${
    isGrid ? 'w-full' : `flex-shrink-0 ${railWidthClassName} snap-start`
  } group/card relative select-none transition-all duration-300 ease-out ${
    compactView ? 'hover:z-10 hover:-translate-y-0.5' : 'hover:z-20 hover:-translate-y-1'
  }`;
  const footerClassName = compactView ? "h-[38px] pt-1.5" : "h-[46px] pt-2";
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
  }, [coverImageSrc]);

  if (!coverImageSrc || imgFailed) {
    return null;
  }

  const coverImage = (
    <Image
      src={coverImageSrc}
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
  );

  const mediaContent = (
    <>
      {!imgLoaded ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(145deg,#f4f4f5,#e4e4e7)] text-zinc-400">
          <span className="text-xl font-semibold">{creatorInitial}</span>
        </div>
      ) : null}
      {coverImage}
      {canPlayInline ? (
        <span
          className={`absolute right-2 top-2 inline-flex items-center justify-center rounded-full border border-white/30 bg-black/48 text-white shadow-[0_6px_16px_rgba(0,0,0,0.16)] backdrop-blur-md ${
            compactView ? "h-6 w-6" : "h-7 w-7"
          }`}
          aria-hidden="true"
        >
          <PlayCircle className={compactView ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </span>
      ) : null}
    </>
  );

  return (
    <article
      className={articleClassName}
      aria-label={[creatorLabel, metrics, short].filter(Boolean).join(' · ') || 'Post'}
    >
      {item.postLink && !canPlayInline ? (
        <a
          href={item.postLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={canPlayInline ? handleOpenVideo : () => {
            try { track('discover_card_click', { id: item.id, action: 'open_instagram', ...(trackContext || {}) }); } catch { }
          }}
          className={mediaFrameClassName}
          aria-label={canPlayInline ? "Assistir vídeo" : "Abrir no Instagram"}
        >
          {mediaContent}
        </a>
      ) : (
        <div
          className={mediaFrameClassName}
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
          {mediaContent}
        </div>
      )}

      <div className={`${footerClassName} min-w-0 px-0.5`}>
        <p className={`truncate font-semibold text-zinc-900 ${compactView ? "text-[10.5px] leading-4" : "text-xs leading-4"}`}>
          {creatorLabel}
        </p>
        <p className={`mt-0.5 truncate font-medium ${compactView ? "text-[10px] leading-3" : "text-[11px] leading-4"} ${metrics ? "text-zinc-500" : "text-transparent"}`}>
          {metrics || "Sem métricas"}
        </p>
      </div>

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
