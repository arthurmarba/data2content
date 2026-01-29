// src/app/admin/creator-dashboard/components/VideosTable.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { idsToLabels } from '@/app/lib/classification';
import {
  FireIcon,
  EyeIcon,
  HeartIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ShareIcon,
  ChartBarIcon,
  BookmarkIcon,
  PencilSquareIcon,
  XMarkIcon, // Added XMarkIcon
} from '@heroicons/react/24/solid';

import { VideoListItem } from '@/types/mediakit';

export interface VideosTableProps {
  videos: any[]; // Changed type to any[]
  onRowClick?: (postId: string) => void;
  onReviewClick?: (post: any) => void; // Changed type to any
  onPlayClick?: (video: any) => void; // Added onPlayClick
  onDetailClick?: (postId: string) => void; // Added onDetailClick
  readOnly?: boolean;

  followersCount?: number; // usado para calcular engajamento por post
  showStrategyTags?: boolean;
  strategyMode?: 'lock' | 'hide';
}

/* ============================
   Helpers para thumbnails
============================ */

// tenta vários nomes comuns vindos do backend
function pickThumbUrl(v: any): string | undefined {
  const candidates = [
    v.thumbnailUrl,
    v.thumbnail_url,
    v.coverUrl,
    v.cover_url,
    v.mediaUrl,
    v.media_url,
    v.displayUrl,
    v.display_url,
    v.previewImageUrl,
    v.preview_image_url,
  ].filter(Boolean) as string[];

  const decode = (s: string) => s.replace(/&amp;/g, '&').trim();

  for (const c of candidates) {
    const url = decode(String(c));
    if (/^https?:\/\//i.test(url)) return url;
  }
  return undefined;
}

const SmartThumb: React.FC<{
  src?: string | null;
  alt?: string;
  size?: number;
  className?: string;
}> = ({ src, alt = 'thumbnail', size = 96, className = '' }) => {
  const [errored, setErrored] = React.useState(false);

  // Fallback visual
  if (!src || errored) {
    return (
      <div
        className={`shrink-0 flex items-center justify-center rounded-md bg-gray-200 text-gray-500 ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(12, Math.floor(size / 3)) }}
        aria-label="thumbnail indisponível"
        title="thumbnail indisponível"
      >
        Img
      </div>
    );
  }

  // Sempre via proxy para contornar bloqueios/expiração de CDN
  const proxiedSrc = `/api/proxy/thumbnail/${encodeURIComponent(src)}`;

  return (
    <Image
      src={proxiedSrc}
      alt={alt}
      width={size}
      height={size}
      className={`shrink-0 rounded-md object-cover ${className}`}
      unoptimized // evita pipeline do Next/Image sobre a rota de proxy
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => setErrored(true)}
    />
  );
};

/* ============================
   Tradução de rótulos
============================ */

const getTranslatedLabels = (
  tags: string | string[] | undefined,
  type: 'format' | 'proposal' | 'context' | 'tone' | 'reference'
): string[] => {
  if (!tags) return [];
  const initialArray = Array.isArray(tags) ? tags : [String(tags)];
  const allIds = initialArray
    .flatMap((tag) => String(tag).split(',').map((id) => id.trim()))
    .filter(Boolean);
  return idsToLabels(allIds, type as any);
};

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919A118.663 118.663 0 0112 2.163zm0 1.441c-3.141 0-3.503.012-4.72.068-2.759.127-3.945 1.313-4.073 4.073-.056 1.217-.067 1.575-.067 4.72s.011 3.503.067 4.72c.127 2.759 1.313 3.945 4.073 4.073 1.217.056 1.575.067 4.72.067s3.503-.011 4.72-.067c2.759-.127 3.945-1.313 4.073-4.073.056-1.217.67 1.575.67 4.72s-.011 3.503-.067 4.72c-.128-2.76-1.314-3.945-4.073-4.073-.91-.042-1.28-.055-3.626-.055zm0 2.882a4.512 4.512 0 100 9.024 4.512 4.512 0 000-9.024zM12 15a3 3 0 110-6 3 3 0 010 6zm6.406-7.875a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25z" />
  </svg>
);

const VideoCard: React.FC<{
  video: VideoListItem;
  index: number;
  readOnly?: boolean;
  onRowClick?: (postId: string) => void;
  onReviewClick?: (video: VideoListItem) => void;
  onPlayClick?: (video: VideoListItem) => void; // Added
  onDetailClick?: (postId: string) => void; // Added
  followersCount?: number;
  showStrategyTags?: boolean;
  strategyMode?: 'lock' | 'hide';
}> = ({ video, index, readOnly, onRowClick, onReviewClick, onPlayClick, onDetailClick, followersCount, showStrategyTags = true, strategyMode = 'lock' }) => {

  const formatDate = (d?: string | Date) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatNumber = (n?: number) => {
    if (n === null || n === undefined) return '-';
    return n.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  };

  const calculateEngagementRate = (stats: VideoListItem['stats']) => {
    const likes = stats?.likes ?? 0;
    const comments = stats?.comments ?? 0;
    const shares = (stats as any)?.shares ?? 0;
    const saves = (stats as any)?.saves ?? (stats as any)?.saved ?? 0;
    const totalInteractions = (stats as any)?.total_interactions ?? (likes + comments + shares + saves);
    const denom = typeof followersCount === 'number' ? followersCount : 0;
    if (!denom || denom <= 0) return '0.00%';
    const rate = (totalInteractions / denom) * 100;
    return `${rate.toFixed(2)}%`;
  };
  const engagementExplainer = 'Cálculo: interações totais ÷ seguidores.';

  const tagBaseClasses =
    'inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-medium text-center break-all max-w-[160px]';

  return (
    <div
      onClick={() => onPlayClick ? onPlayClick(video) : (onRowClick && onRowClick(video._id))}
      className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:ring-2 hover:ring-indigo-500/20 transition-all cursor-pointer group"
    >
      <div className="grid grid-cols-12 gap-x-4 gap-y-2 items-start">
        {/* Conteúdo (thumb + caption) */}
        <div className="col-span-12 md:col-span-5 flex items-start gap-4">
          <SmartThumb
            src={pickThumbUrl(video)}
            alt={`Thumbnail para ${video.caption || 'post'}`}
            size={96}
            className="flex-shrink-0"
          />
          <div className="flex-grow">
            <p
              className="font-semibold text-sm text-gray-800 line-clamp-4" // MUDANÇA AQUI
              title={video.caption || ''}
            >
              {readOnly && index === 0 && (
                <FireIcon
                  className="w-4 h-4 text-orange-400 inline-block mr-1.5 align-text-bottom"
                  title="Top Performance"
                />
              )}
              {video.caption || 'Sem legenda'}
            </p>
            <p className="text-xs text-gray-500 mt-2">{formatDate(video.postDate)}</p>
          </div>
        </div>

        {/* Estratégia (chips) */}
        <div className={`col-span-12 ${readOnly ? 'md:col-span-3' : 'md:col-span-2'} flex flex-col gap-1.5 content-start`}>
          {showStrategyTags ? (
            <>
              <div className="w-full flex flex-wrap gap-1.5">
                {getTranslatedLabels((video as any).format, 'format').map((tag) => (
                  <span key={tag} className={`${tagBaseClasses} bg-gray-100 text-gray-700`}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className="w-full flex flex-wrap gap-1.5">
                {getTranslatedLabels((video as any).proposal, 'proposal').map((tag) => (
                  <span key={tag} className={`${tagBaseClasses} bg-blue-100 text-blue-800`}>
                    {tag}
                  </span>
                ))}
                {getTranslatedLabels((video as any).context, 'context').map((tag) => (
                  <span key={tag} className={`${tagBaseClasses} bg-purple-100 text-purple-800`}>
                    {tag}
                  </span>
                ))}
                {getTranslatedLabels((video as any).tone, 'tone').map((tag) => (
                  <span key={tag} className={`${tagBaseClasses} bg-yellow-100 text-yellow-800`}>
                    {tag}
                  </span>
                ))}
                {getTranslatedLabels((video as any).references, 'reference').map((tag) => (
                  <span key={tag} className={`${tagBaseClasses} bg-green-100 text-green-800`}>
                    {tag}
                  </span>
                ))}
              </div>
            </>
          ) : (
            strategyMode === 'lock' ? (
              <div className="w-full space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {['Formato', 'Proposta', 'Contexto'].map((label) => (
                    <span
                      key={label}
                      className={`${tagBaseClasses} bg-gray-100 text-gray-700/70 blur-[1px] select-none`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400">Categorias disponíveis no Modo Agência.</p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400">Categorias detalhadas não estão inclusas no plano atual deste criador.</p>
            )
          )}
        </div>

        {/* Engajamento (coluna dedicada somente quando NÃO readOnly) */}
        {!readOnly && (
          <div className="col-span-12 md:col-span-1 text-left md:text-center">
            <div className="font-bold text-base text-pink-600" title={engagementExplainer}>
              {calculateEngagementRate(video.stats)}
            </div>
          </div>
        )}

        {/* Métricas (em readOnly, mostra apenas % do engajamento acima) */}
        <div className="col-span-12 md:col-span-2">
          <div className="flex flex-col space-y-1.5 text-xs">
            {readOnly && (
              <div className="mb-1">
                <div className="inline-flex items-center px-2 py-1 rounded-md bg-pink-50 text-pink-700 ring-1 ring-pink-200 text-xs font-bold">
                  {calculateEngagementRate(video.stats)}
                </div>
              </div>
            )}
            <span className="flex items-center gap-2 text-gray-700">
              <EyeIcon className="text-gray-400 w-3.5 h-3.5" /> {formatNumber(video.stats?.views)}
            </span>
            <span className="flex items-center gap-2 text-gray-700">
              <HeartIcon className="text-gray-400 w-3.5 h-3.5" /> {formatNumber(video.stats?.likes)}
            </span>
            <span className="flex items-center gap-2 text-gray-700">
              <ChatBubbleOvalLeftEllipsisIcon className="text-gray-400 w-3.5 h-3.5" /> {formatNumber(video.stats?.comments)}
            </span>
            <span className="flex items-center gap-2 text-gray-700">
              <ShareIcon className="text-gray-400 w-3.5 h-3.5" /> {formatNumber(video.stats?.shares)}
            </span>
            <span className="flex items-center gap-2 text-gray-700">
              <BookmarkIcon className="text-gray-400 w-3.5 h-3.5" /> {formatNumber((video.stats as any)?.saves)}
            </span>
          </div>
        </div>

        {/* Ações */}
        <div className="col-span-12 md:col-span-2 flex flex-col items-center justify-start gap-2">
          <div className="mt-3 flex flex-wrap gap-2 justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDetailClick ? onDetailClick(video._id) : (onRowClick && onRowClick(video._id));
              }}
              className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <ChartBarIcon className="h-3.5 w-3.5 text-gray-400" />
              Analisar
            </button>

            {onReviewClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReviewClick(video);
                }}
                className="flex items-center gap-1.5 rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10 hover:bg-indigo-100 transition-colors shadow-sm"
              >
                <PencilSquareIcon className="h-3.5 w-3.5" />
                Review
              </button>
            )}
          </div>
          <a
            href={video.permalink ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver na Rede Social"
            className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-white bg-gray-800 rounded-md shadow-sm hover:bg-gray-700 transition-colors"
          >
            <InstagramIcon className="w-3.5 h-3.5" />
            <span>Ver Post</span>
          </a>
        </div>
      </div>
      {/* Rodapé com explicação do cálculo de engajamento */}
      <div className="mt-3 pt-2 border-t border-gray-100">
        <div className="text-[11px] text-gray-500">{engagementExplainer}</div>
      </div>
    </div>
  );
};

const VideosTable: React.FC<VideosTableProps> = ({ videos, showStrategyTags = true, strategyMode = 'lock', ...props }) => {
  return (
    <div className="space-y-3">
      <div className="hidden md:grid md:grid-cols-12 md:gap-x-4 px-4 py-2 border-b border-gray-200">
        <h4 className="md:col-span-5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Conteúdo
        </h4>
        <h4 className={`${props.readOnly ? 'md:col-span-3' : 'md:col-span-2'} text-left text-xs font-semibold text-gray-400 uppercase tracking-wider`}>
          {showStrategyTags ? 'Estratégia' : strategyMode === 'lock' ? 'Categorias (Modo Agência)' : 'Categorias'}
        </h4>
        {!props.readOnly && (
          <h4 className="md:col-span-1 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Engaj.
          </h4>
        )}
        <h4 className="md:col-span-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Performance
        </h4>
        <h4 className="md:col-span-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Ações
        </h4>
      </div>

      {videos.map((video, index) => (
        <VideoCard
          key={video._id}
          video={video}
          index={index}
          followersCount={props.followersCount}
          showStrategyTags={showStrategyTags}
          strategyMode={strategyMode}
          onReviewClick={props.onReviewClick}
          onPlayClick={props.onPlayClick} // Passed down
          onDetailClick={props.onDetailClick} // Passed down
          {...props}
        />
      ))}

    </div>
  );
};

export default VideosTable;
