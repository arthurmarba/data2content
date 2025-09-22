// src/app/discover/components/DiscoverCard.tsx
'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
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

const SaveToPlannerButton = dynamic(() => import('./SaveToPlannerButton'), { ssr: false });

export default function DiscoverCard({ item }: { item: PostCard }) {
  const views = item?.stats?.views ?? item?.stats?.total_interactions;
  const metrics = views ? `${formatCompact(views)} ${item?.stats?.views !== undefined ? 'views' : 'interações'}` : '';
  const caption = (item?.caption || '').trim();
  const short = caption.length > 110 ? caption.slice(0, 107) + '…' : caption;
  const [imgFailed, setImgFailed] = useState(false);
  // Modal removido: abrimos direto no Instagram

  const fallbackCover = '/images/Colorido-Simbolo.png';

  return (
    <article className="flex-shrink-0 w-[240px] select-none" aria-label={short || 'Post'}>
      {item.postLink ? (
        <a
          href={item.postLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => { try { track('discover_card_click', { id: item.id, action: 'open_instagram' }); } catch {} }}
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

          {/* Removido overlay: caption e métricas agora ficam fora da imagem */}
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

          {/* Removido overlay: caption e métricas agora ficam fora da imagem */}
        </div>
      )}

      {/* Bloco de informações abaixo da imagem */}
      {(metrics || short) && (
        <div className="mt-2">
          {metrics && (
            <div className="text-[11px] text-gray-600">{metrics}</div>
          )}
          {short && (
            <div className="text-[12px] leading-snug text-gray-800 line-clamp-2">{short}</div>
          )}
        </div>
      )}

      {/* Rodapé com ações */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-gray-500 truncate max-w-[65%]" title={item.creatorName || ''}>
          {item.creatorName || ''}
        </span>
        <SaveToPlannerButton item={item} />
      </div>

    </article>
  );
}
