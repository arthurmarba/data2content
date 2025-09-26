// src/app/discover/components/DiscoverCard.tsx
'use client';

import React, { useState } from 'react';
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


export default function DiscoverCard({ item, trackContext }: { item: PostCard; trackContext?: Record<string, any> }) {
  const views = item?.stats?.views ?? item?.stats?.total_interactions;
  const isViews = item?.stats?.views !== undefined;
  const metrics = views ? `${formatCompact(views)} ${isViews ? 'views' : 'interações'}` : '';
  const caption = (item?.caption || '').trim();
  const short = caption.length > 110 ? caption.slice(0, 107) + '…' : caption;
  const [imgFailed, setImgFailed] = useState(false);
  // Modal removido: abrimos direto no Instagram

  const fallbackCover = '/images/Colorido-Simbolo.png';

  return (
    <article className="flex-shrink-0 w-[240px] select-none snap-start" aria-label={short || 'Post'}>
      {item.postLink ? (
        <a
          href={item.postLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            try { track('discover_card_click', { id: item.id, action: 'open_instagram', ...(trackContext || {}) }); } catch {}
          }}
          className="relative rounded-xl overflow-hidden bg-gray-100 aspect-[4/5] shadow block"
          aria-label="Abrir no Instagram"
        >
          {item.coverUrl && !imgFailed ? (
            <img
              src={item.coverUrl}
              alt={short || 'Capa do post'}
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              draggable={false}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <img
              src={fallbackCover}
              alt="Sem capa"
              className="w-full h-full object-cover opacity-70"
              draggable={false}
            />
          )}
          {/* Overlay de gradiente + linhas breves */}
          {(short || metrics) && (
            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
              {metrics && (
                <div
                  className="inline-block rounded-md bg-black/70 px-1.5 py-0.5 text-[13px] font-bold text-white"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,0.9)' }}
                >
                  {metrics}
                </div>
              )}
              {short && (
                <div
                  className="mt-1 text-[12px] leading-snug text-white/95 line-clamp-2"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,0.9)' }}
                >
                  {short}
                </div>
              )}
            </div>
          )}
        </a>
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-gray-100 aspect-[4/5] shadow">
          {item.coverUrl && !imgFailed ? (
            // Usamos <img> para evitar restrição de domínios do next/image
            <img
              src={item.coverUrl}
              alt={short || 'Capa do post'}
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              draggable={false}
              onError={() => setImgFailed(true)}
            />)
            : (
            <img
              src={fallbackCover}
              alt="Sem capa"
              className="w-full h-full object-cover opacity-70"
              draggable={false}
            />
          )}
          {(short || metrics) && (
            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
              {metrics && (
                <div
                  className="inline-block rounded-md bg-black/70 px-1.5 py-0.5 text-[13px] font-bold text-white"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,0.9)' }}
                >
                  {metrics}
                </div>
              )}
              {short && (
                <div
                  className="mt-1 text-[12px] leading-snug text-white/95 line-clamp-2"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,0.9)' }}
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
