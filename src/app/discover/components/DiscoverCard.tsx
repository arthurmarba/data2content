// src/app/discover/components/DiscoverCard.tsx
'use client';

import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { track } from '@/lib/track';
// (Preferimos abrir direto no Instagram; modal não é mais usado)

type PostCard = {
  id: string;
  coverUrl?: string | null;
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
  trackContext,
  variant = 'rail',
  onUnavailable,
}: {
  item: PostCard;
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
  // Modal removido: abrimos direto no Instagram

  const isGrid = variant === 'grid';

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
      className={`${isGrid ? 'w-full' : 'flex-shrink-0 w-[240px] snap-start'} select-none`}
      aria-label={short || 'Post'}
    >
      {item.postLink ? (
        <a
          href={item.postLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            try { track('discover_card_click', { id: item.id, action: 'open_instagram', ...(trackContext || {}) }); } catch {}
          }}
          className="relative block aspect-[4/5] overflow-hidden rounded-xl bg-gray-100 shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
          aria-label="Abrir no Instagram"
        >
          {item.coverUrl ? (
            <Image
              src={item.coverUrl}
              alt={short || 'Capa do post'}
              fill
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              draggable={false}
              onError={() => setImgFailed(true)}
            />
          ) : null}
          {/* Overlay de gradiente + linhas breves */}
          {(short || metrics) && (
            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 via-black/65 to-transparent">
              {metrics && (
                <div
                  className="inline-block rounded-md bg-black/90 px-1.5 py-0.5 text-[13px] font-bold text-white"
                  style={{ textShadow: '0 3px 6px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)' }}
                >
                  {metrics}
                </div>
              )}
              {short && (
                <div
                  className="mt-1 text-[12px] leading-snug text-white/95 line-clamp-2"
                  style={{ textShadow: '0 3px 6px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)' }}
                >
                  {short}
                </div>
              )}
            </div>
          )}
        </a>
      ) : (
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-gray-100 shadow-[0_10px_24px_rgba(15,23,42,0.18)]">
          {item.coverUrl ? (
            <Image
              src={item.coverUrl}
              alt={short || 'Capa do post'}
              fill
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              draggable={false}
              onError={() => setImgFailed(true)}
            />
          ) : null}
          {(short || metrics) && (
            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 via-black/65 to-transparent">
              {metrics && (
                <div
                  className="inline-block rounded-md bg-black/90 px-1.5 py-0.5 text-[13px] font-bold text-white"
                  style={{ textShadow: '0 3px 6px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)' }}
                >
                  {metrics}
                </div>
              )}
              {short && (
                <div
                  className="mt-1 text-[12px] leading-snug text-white/95 line-clamp-2"
                  style={{ textShadow: '0 3px 6px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)' }}
                >
                  {short}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rodapé com autor (sem botão de salvar) */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-gray-500 truncate max-w-full" title={item.creatorName || ''}>
          {item.creatorName || ''}
        </span>
      </div>

    </article>
  );
}
