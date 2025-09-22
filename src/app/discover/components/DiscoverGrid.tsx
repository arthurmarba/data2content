"use client";

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { track } from '@/lib/track';
import { idsToLabels } from '@/app/lib/classification';
import CardActionsMenu from './CardActionsMenu';
import { UserAvatar } from '@/app/components/UserAvatar';

type PostCard = {
  id: string;
  coverUrl?: string | null;
  caption?: string;
  postDate?: string;
  creatorName?: string;
  creatorAvatarUrl?: string | null;
  postLink?: string;
  stats?: {
    total_interactions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
    video_duration_seconds?: number;
  };
  categories?: { format?: string[]; proposal?: string[]; context?: string[]; tone?: string[]; references?: string[] };
};

function formatCompact(n?: number) {
  if (typeof n !== 'number' || !isFinite(n)) return '';
  try { return n.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }); } catch { return String(n); }
}

// Removido botão de salvar conforme requisição do usuário
// const SaveToPlannerButton = dynamic(() => import('./SaveToPlannerButton'), { ssr: false });

function GridCard({ item }: { item: PostCard }) {
  const fallbackCover = '/images/Colorido-Simbolo.png';
  const [imgFailed, setImgFailed] = useState(false);
  const views = item?.stats?.views ?? item?.stats?.total_interactions;
  const metrics = views ? `${formatCompact(views)} ${item?.stats?.views !== undefined ? 'views' : 'interações'}` : '';
  const caption = (item?.caption || '').trim();
  const short = caption.length > 110 ? caption.slice(0, 107) + '…' : caption;

  const secs = Number(item?.stats?.video_duration_seconds || 0);
  const dur = secs > 0 ? new Date(secs * 1000).toISOString().substring(secs >= 3600 ? 11 : 14, 19) : '';
  const Image = (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 shadow">
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
        <img src={fallbackCover} alt="Sem capa" className="w-full h-full object-cover opacity-70" draggable={false} />
      )}
      {/* Menu ⋮ */}
      <div className="absolute top-1 right-1">
        <CardActionsMenu postId={item.id} postLink={item.postLink} creatorName={item.creatorName} />
      </div>
      {/* Duração */}
      {dur && (
        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[11px] bg-black/70 text-white">
          {dur}
        </span>
      )}
    </div>
  );

  return (
    <article>
      {/* Criador acima do post */}
      <div className="flex items-center gap-2 mb-2">
        <UserAvatar name={item.creatorName || 'Criador'} src={item.creatorAvatarUrl || undefined} size={28} />
        <span className="text-xs font-medium text-gray-800 truncate" title={item.creatorName || ''}>{item.creatorName || ''}</span>
      </div>
      {item.postLink ? (
        <a
          href={item.postLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => { try { track('discover_card_click', { id: item.id, action: 'open_instagram' }); } catch {} }}
          aria-label="Abrir no Instagram"
          className="block"
        >
          {Image}
        </a>
      ) : (
        Image
      )}
      {(metrics || short) && (
        <div className="mt-2">
          {metrics && <div className="text-[11px] text-gray-600">{metrics}</div>}
          {short && <div className="text-[13px] leading-snug text-gray-900 line-clamp-2">{short}</div>}
          {/* Category chips */}
          {item.categories && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(() => {
                const fmt = idsToLabels(item.categories?.format, 'format');
                const prop = idsToLabels(item.categories?.proposal, 'proposal');
                const ctx = idsToLabels(item.categories?.context, 'context');
                const tone = idsToLabels(item.categories?.tone, 'tone');
                const chips: Array<{ text: string; cls: string }> = [];
                if (fmt[0]) chips.push({ text: fmt[0], cls: 'bg-blue-50 text-blue-700 border-blue-200' });
                if (prop[0]) chips.push({ text: prop[0], cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' });
                if (ctx[0]) chips.push({ text: ctx[0], cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' });
                if (tone[0]) chips.push({ text: tone[0], cls: 'bg-amber-50 text-amber-700 border-amber-200' });
                return chips.slice(0, 3).map((c, i) => (
                  <span key={`${c.text}-${i}`} className={`px-2 py-0.5 rounded-full border text-[11px] ${c.cls}`}>
                    {c.text}
                  </span>
                ));
              })()}
            </div>
          )}
        </div>
      )}
      {/* Botão de salvar removido */}
    </article>
  );
}

export default function DiscoverGrid({ items }: { items: PostCard[] }) {
  const sp = useSearchParams();
  const view = sp.get('view') || '';
  const list = Array.isArray(items) ? items.slice() : [];

  const toHour = (iso?: string) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.getHours();
  };

  const isReel = (it: PostCard) => (it.categories?.format || []).map(s => String(s).toLowerCase()).includes('reel');
  const secsOf = (it: PostCard) => Number(it?.stats?.video_duration_seconds || 0);
  const interactionsOf = (it: PostCard) => Number(it?.stats?.total_interactions || 0);
  const commentsOf = (it: PostCard) => Number(it?.stats?.comments || 0);
  const sharesOf = (it: PostCard) => Number(it?.stats?.shares || 0);
  const savesOf = (it: PostCard) => Number((it as any)?.stats?.saved ?? (it as any)?.stats?.saves ?? 0);

  let filtered = list;
  switch (view) {
    case 'reels_lt_15':
      filtered = list.filter(it => isReel(it) && secsOf(it) > 0 && secsOf(it) < 15);
      break;
    case 'reels_15_45':
      filtered = list.filter(it => isReel(it) && secsOf(it) >= 15 && secsOf(it) <= 45);
      break;
    case 'reels_gt_45':
      filtered = list.filter(it => isReel(it) && secsOf(it) > 45);
      break;
    case 'viral_weekend':
      filtered = list.filter(it => {
        const d = it.postDate ? new Date(it.postDate) : null;
        if (!d) return false;
        const dow = d.getDay();
        return (dow === 0 || dow === 6);
      }).sort((a,b) => interactionsOf(b) - interactionsOf(a));
      break;
    case 'viral_morning':
      filtered = list.filter(it => {
        const h = toHour(it.postDate);
        return h != null && h >= 6 && h < 12;
      }).sort((a,b) => interactionsOf(b) - interactionsOf(a));
      break;
    case 'viral_night':
      filtered = list.filter(it => {
        const h = toHour(it.postDate);
        return h != null && (h >= 18 || h < 2);
      }).sort((a,b) => interactionsOf(b) - interactionsOf(a));
      break;
    case 'top_comments':
      filtered = list.filter(it => commentsOf(it) > 0).sort((a,b) => commentsOf(b) - commentsOf(a));
      break;
    case 'top_saves':
      filtered = list.filter(it => savesOf(it) > 0).sort((a,b) => savesOf(b) - savesOf(a));
      break;
    case 'top_shares':
      filtered = list.filter(it => sharesOf(it) > 0).sort((a,b) => sharesOf(b) - sharesOf(a));
      break;
    default:
      filtered = list;
  }

  // Fallbacks para evitar lista vazia
  if (filtered.length === 0) {
    if (view === 'reels_lt_15' || view === 'reels_15_45' || view === 'reels_gt_45') {
      filtered = list.filter(isReel);
    } else if (view === 'top_comments') {
      filtered = list.slice().sort((a,b) => commentsOf(b) - commentsOf(a));
    } else if (view === 'top_saves') {
      filtered = list.slice().sort((a,b) => savesOf(b) - savesOf(a));
    } else if (view === 'top_shares') {
      filtered = list.slice().sort((a,b) => sharesOf(b) - sharesOf(a));
    } else if (view === 'viral_weekend' || view === 'viral_morning' || view === 'viral_night') {
      filtered = list.slice().sort((a,b) => interactionsOf(b) - interactionsOf(a));
    }
  }
  return (
    <div className="grid gap-4 md:gap-5 grid-cols-2 md:[grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
      {filtered.map((it) => <GridCard key={it.id} item={it} />)}
      {filtered.length === 0 && (
        <div className="col-span-full text-center text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg py-8">
          Nada encontrado para esta seção.
        </div>
      )}
    </div>
  );
}
