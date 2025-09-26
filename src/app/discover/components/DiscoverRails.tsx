"use client";

import React, { useEffect, useMemo } from 'react';
import DiscoverCard from './DiscoverCard';
import { track } from '@/lib/track';
import { getExperienceShelfOrder } from '@/app/lib/discover/experiences';

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
    saved?: number;
  };
  categories?: { format?: string[]; proposal?: string[]; context?: string[]; tone?: string[]; references?: string[] };
};

type Section = { key: string; title: string; items: PostCard[] };

export default function DiscoverRails({ sections, exp }: { sections: Section[]; exp?: string }) {
  const TITLE_OVERRIDES: Record<string, string> = {
    user_suggested: 'Ideias do seu nicho',
    trending: 'Em alta no mercado',
    top_saved: 'Muito salvos (vale guardar)',
    top_comments: 'Gera conversas (comentários)',
    top_shares: 'Muito compartilhados',
    reels_lt_15: 'Reels relâmpago (até 15s)',
    reels_15_45: 'Reels certeiros (15–45s)',
    reels_gt_45: 'Reels aprofundados (45s+)',
  };
  const DESCRIPTIONS: Record<string, string> = {
    user_suggested: 'Baseado nas categorias com mais engajamento no seu perfil.',
    trending: 'O que está performando melhor neste período.',
    top_saved: 'Conteúdos que as pessoas salvam para voltar depois.',
    top_comments: 'Ideias que incentivam resposta do público.',
    top_shares: 'Conteúdos que a audiência gosta de compartilhar.',
    reels_lt_15: 'Ganchos rápidos. Priorize uma ideia forte.',
    reels_15_45: 'Uma ideia + exemplo/benefício. Feche com CTA.',
    reels_gt_45: 'Mini‑tutoriais ou bastidores com narrativa.',
  };
  useEffect(() => {
    try {
      sections.forEach((s, idx) => {
        track('discover_shelf_impression', { shelf_key: s.key, index: idx, items: s.items?.length ?? 0, exp });
      });
    } catch {}
  }, [sections, exp]);

  const ordered = useMemo(() => {
    const order = getExperienceShelfOrder(exp);
    const idxOf = (key: string) => {
      const i = order.indexOf(key);
      return i === -1 ? 999 : i;
    };
    return sections.slice().sort((a, b) => idxOf(a.key) - idxOf(b.key));
  }, [sections, exp]);

  return (
    <div className="space-y-8">
      {ordered.map((s) => (
        <section key={s.key} aria-label={s.title} className="w-full">
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{TITLE_OVERRIDES[s.key] || s.title}</h2>
              {DESCRIPTIONS[s.key] && (
                <p className="text-xs text-gray-500 mt-0.5">{DESCRIPTIONS[s.key]}</p>
              )}
            </div>
            {s.key === 'user_suggested' && (
              <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Personalizado
              </span>
            )}
          </div>
          <div className="group relative -mx-2 overflow-x-auto hide-scrollbar">
            {/* Setas removidas conforme solicitado */}

            {/* Edge fades */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent" />

            <div className="rail-scroll px-2 flex flex-nowrap gap-3 snap-x snap-mandatory scroll-px-2">
              {(s.items || []).map((it, idx) => (
                <DiscoverCard
                  key={it.id}
                  item={it as any}
                  trackContext={{ shelf_key: s.key, rank: idx + 1, exp }}
                  // snap each card
                  // container enforces snap, card just needs snap alignment
                />
              ))}
              {(s.items || []).length === 0 && (
                <div className="px-2 py-6 text-sm text-gray-500">Nenhum resultado para esta seção. Dica: remova 1 filtro ou experimente outra guia.</div>
              )}
            </div>
          </div>
        </section>
      ))}
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
