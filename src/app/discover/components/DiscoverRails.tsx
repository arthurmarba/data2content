"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DiscoverCard from './DiscoverCard';
import { track } from '@/lib/track';
import { getExperienceShelfOrder } from '@/app/lib/discover/experiences';
import { useSearchParams } from 'next/navigation';

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

const CTA_LABEL_OVERRIDES: Record<string, string> = {
  trending: "Explorar virais agora",
  top_saved: "Ver ideias muito salvas",
  top_comments: "Ver ideias com muitos comentários",
  top_shares: "Ver ideias muito compartilhadas",
};

export default function DiscoverRails({ sections, exp, primaryKey }: { sections: Section[]; exp?: string; primaryKey?: string | null }) {
  const searchParams = useSearchParams();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<PostCard[] | null>(null);
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const expandedCacheRef = useRef<Map<string, PostCard[]>>(new Map());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const TITLE_OVERRIDES: Record<string, string> = {
    user_suggested: 'Ideias do seu nicho',
    trending: 'Conteúdos Virais',
    top_saved: 'Muito salvos (vale guardar)',
    top_comments: 'Gera conversas (comentários)',
    top_shares: 'Muito compartilhados',
    reels_lt_15: 'Reels relâmpago (até 15s)',
    reels_15_45: 'Reels certeiros (15–45s)',
    reels_gt_45: 'Reels aprofundados (45s+)',
  };
  const DESCRIPTIONS: Record<string, string> = {
    user_suggested: 'Baseado em categorias de mais engajamento no seu perfil.',
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

  const { sectionsWithCover, missingThumbs } = useMemo(() => {
    let removed = 0;
    const cleaned = ordered.map((section) => {
      const items = (section.items || []);
      const filtered = items.filter((item) => {
        const hasCover = Boolean(item?.coverUrl);
        if (!hasCover) {
          removed += 1;
          return false;
        }
        if (hiddenIds.has(item.id)) return false;
        return true;
      });
      return { ...section, items: filtered };
    });
    return { sectionsWithCover: cleaned, missingThumbs: removed };
  }, [ordered, hiddenIds]);

  useEffect(() => {
    if (missingThumbs <= 0) return;
    try {
      track('discover_missing_cover_filtered', { count: missingThumbs, exp });
    } catch {}
  }, [missingThumbs, exp]);

  const handleCardUnavailable = useCallback((postId: string) => {
    setHiddenIds((prev) => {
      if (prev.has(postId)) return prev;
      const next = new Set(prev);
      next.add(postId);
      return next;
    });
  }, []);

  const handleExpand = useCallback(
    async (sectionKey: string) => {
      const base = sectionsWithCover.find((s) => s.key === sectionKey);
      if (!base) return;

      setExpandedKey(sectionKey);
      setExpandedError(null);

      const cached = expandedCacheRef.current.get(sectionKey);
      if (cached) {
        const filteredCached = cached.filter((item) => !hiddenIds.has(item.id));
        setExpandedItems(filteredCached);
        return;
      }

      setExpandedItems(base.items || []);
      setExpandedLoading(true);

      const qs = searchParams?.toString() || '';
      const queryPrefix = qs ? `?${qs}` : '';
      const connector = qs ? '&' : '?';
      try {
        const response = await fetch(`/api/discover/feed${queryPrefix}${connector}limitPerRow=120`, {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok || !payload?.ok) {
          throw new Error('Resposta inválida do servidor');
        }
        const allSections: Section[] = Array.isArray(payload.sections) ? payload.sections : [];
        const match = allSections.find((sec) => sec.key === sectionKey);
        if (match) {
          const sanitizedItems = (match.items || []).filter(
            (item) => Boolean(item?.coverUrl) && !hiddenIds.has(item.id)
          );
          expandedCacheRef.current.set(sectionKey, sanitizedItems);
          setExpandedItems(sanitizedItems);
          try {
            track('discover_shelf_expand', {
              shelf_key: sectionKey,
              total_items: match.items?.length ?? 0,
              exp,
            });
          } catch {}
        } else {
          setExpandedError('Não encontramos mais conteúdos para esta lista.');
        }
      } catch (err) {
        setExpandedError('Não foi possível carregar mais conteúdos agora. Tente novamente.');
      } finally {
        setExpandedLoading(false);
      }
    },
    [sectionsWithCover, searchParams, exp, hiddenIds]
  );

  const handleCollapse = useCallback(() => {
    setExpandedKey(null);
    setExpandedItems(null);
    setExpandedError(null);
    setExpandedLoading(false);
  }, []);

  const expandedSectionMeta = expandedKey
    ? sectionsWithCover.find((s) => s.key === expandedKey) || null
    : null;

  if (expandedKey && expandedSectionMeta && expandedItems) {
    const title = TITLE_OVERRIDES[expandedSectionMeta.key] || expandedSectionMeta.title;
    const description = DESCRIPTIONS[expandedSectionMeta.key];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleCollapse}
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
          >
            ← Voltar para as listas
          </button>
          <span className="text-sm text-gray-500">
            {expandedItems.length} {expandedItems.length === 1 ? 'conteúdo' : 'conteúdos'}
          </span>
        </div>
        <section aria-label={title} className="w-full">
          <div className="mb-3">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
          </div>
          {expandedError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {expandedError}
            </div>
          )}
          {expandedLoading && (
            <div className="mb-4 rounded-xl border border-brand-magenta/30 bg-brand-magenta/5 px-4 py-3 text-sm text-brand-magenta">
              Carregando mais conteúdos…
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {expandedItems.map((item, idx) => (
              <DiscoverCard
                key={`${item.id}-${idx}`}
                item={item as any}
                trackContext={{ shelf_key: expandedSectionMeta.key, rank: idx + 1, exp, view: 'expanded' }}
                variant="grid"
                onUnavailable={handleCardUnavailable}
              />
            ))}
            {expandedItems.length === 0 && !expandedLoading && !expandedError && (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
                Nenhum conteúdo encontrado para exibir aqui.
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(missingThumbs > 0 || hiddenIds.size > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 shadow-sm">
          <p className="font-medium">
            Removemos {missingThumbs} conteúdo(s) sem capa recente
            {hiddenIds.size ? ` e ocultamos ${hiddenIds.size} indisponível(eis)` : ""}.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Reconecte o Instagram em <a className="underline" href="/dashboard/settings">Configurações → Instagram</a> para carregar tudo novamente.
          </p>
        </div>
      )}
      {sectionsWithCover.map((s, index) => {
        const title = TITLE_OVERRIDES[s.key] || s.title;
        const description = DESCRIPTIONS[s.key];
        const isPrimary = s.key === primaryKey;
        const useAltBackground = index % 2 === 1;
        const containerClass = isPrimary
          ? "border border-transparent bg-transparent"
          : useAltBackground
          ? "border border-slate-200 bg-slate-50/80 shadow-sm"
          : "border border-slate-200 bg-white shadow-sm";
        const gradientClass = useAltBackground ? "from-slate-50/80" : "from-white";
        const ctaLabel = CTA_LABEL_OVERRIDES[s.key] || "Ver coleção completa";
        return (
          <section key={s.key} aria-label={title} className="w-full">
            <div
              className={`rounded-3xl px-4 py-5 sm:px-6 sm:py-6 ${containerClass}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                <button
                  type="button"
                  onClick={() => handleExpand(s.key)}
                  className="inline-flex items-center gap-2 self-start rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-magenta/40 hover:text-brand-magenta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
                >
                  {ctaLabel}
                  <span aria-hidden>→</span>
                </button>
              </div>
              {description && <p className="mt-1 text-xs text-gray-500 sm:text-sm">{description}</p>}
              <div className="group relative mt-4 -mx-1 overflow-x-auto hide-scrollbar">
                <div className={`pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r ${gradientClass} to-transparent`} />
                <div className={`pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l ${gradientClass} to-transparent`} />
                <div className="rail-scroll px-1 flex flex-nowrap gap-3 snap-x snap-mandatory scroll-px-2">
                  {(s.items || []).map((it, idx) => (
                    <DiscoverCard
                      key={it.id}
                      item={it as any}
                      trackContext={{ shelf_key: s.key, rank: idx + 1, exp }}
                      variant="rail"
                      onUnavailable={handleCardUnavailable}
                    />
                  ))}
                  {(s.items || []).length === 0 && (
                    <div className="px-2 py-6 text-sm text-gray-500">
                      Nenhum resultado para esta seção. Dica: remova 1 filtro ou experimente outra guia.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })}
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
