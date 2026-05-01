"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Bookmark, Flame, MessageCircleMore, Share2, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";
import DiscoverCard from './DiscoverCard';
import { track } from '@/lib/track';
import { getExperienceShelfOrder } from '@/app/lib/discover/experiences';
import { useSearchParams } from 'next/navigation';

type PostCard = {
  id: string;
  coverUrl?: string | null;
  videoUrl?: string;
  mediaType?: string;
  isVideo?: boolean;
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

type Section = { key: string; title: string; items: PostCard[] };

const CTA_LABEL_OVERRIDES: Record<string, string> = {
  trending: "Explorar virais agora",
  rising_72h: "Ver o que está subindo",
  top_saved: "Ver ideias muito salvas",
  top_comments: "Ver ideias com muitos comentários",
  top_shares: "Ver ideias muito compartilhadas",
};

const TITLE_ICONS: Record<string, LucideIcon> = {
  user_suggested: Sparkles,
  personalized: Sparkles,
  trending: Flame,
  rising_72h: TrendingUp,
  top_saved: Bookmark,
  top_comments: MessageCircleMore,
  top_shares: Share2,
  reels_lt_15: Sparkles,
  reels_15_45: Sparkles,
  reels_gt_45: Sparkles,
};

function findNextPlayable(items: PostCard[], startIndex: number) {
  for (let i = startIndex + 1; i < items.length; i += 1) {
    const item = items[i];
    if (item?.videoUrl || item?.isVideo) return item;
  }
  return null;
}

export default function DiscoverRails({
  sections,
  exp,
  primaryKey,
  compactView = false,
  desktopCompactPreview = false,
}: {
  sections: Section[];
  exp?: string;
  primaryKey?: string | null;
  compactView?: boolean;
  desktopCompactPreview?: boolean;
}) {
  const searchParams = useSearchParams();
  const searchParamsText = searchParams?.toString() || '';
  const EXPANDED_LIMIT = 120;
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<PostCard[] | null>(null);
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const expandedCacheRef = useRef<Map<string, PostCard[]>>(new Map());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const TITLE_OVERRIDES: Record<string, string> = {
    user_suggested: 'Ideias do seu nicho',
    trending: 'Conteúdos Virais',
    rising_72h: 'Em ascensão (últimas 72h)',
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
    rising_72h: 'Conteúdos recentes com alta taxa de engajamento nas últimas 72h.',
    top_saved: 'Conteúdos que as pessoas salvam para voltar depois.',
    top_comments: 'Ideias que incentivam resposta do público.',
    top_shares: 'Conteúdos que a audiência gosta de compartilhar.',
    reels_lt_15: 'Ganchos rápidos. Priorize uma ideia forte.',
    reels_15_45: 'Uma ideia + exemplo/benefício. Feche com CTA.',
    reels_gt_45: 'Mini‑tutoriais ou bastidores com narrativa.',
  };
  const COMPACT_DESCRIPTIONS: Record<string, string> = {
    user_suggested: 'Posts com maior aderência ao seu nicho.',
    rising_72h: 'Conteúdos recentes acelerando agora.',
    trending: 'O que mais performou neste recorte.',
  };
  useEffect(() => {
    try {
      sections.forEach((s, idx) => {
        track('discover_shelf_impression', { shelf_key: s.key, index: idx, items: s.items?.length ?? 0, exp });
      });
    } catch { }
  }, [sections, exp]);

  useEffect(() => {
    setExpandedKey(null);
    setExpandedItems(null);
    setExpandedError(null);
    setExpandedLoading(false);
  }, [searchParamsText]);

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
    } catch { }
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

      const cacheKey = `${sectionKey}:${searchParamsText}`;
      const cached = expandedCacheRef.current.get(cacheKey);
      if (cached) {
        const filteredCached = cached.filter((item) => !hiddenIds.has(item.id));
        setExpandedItems(filteredCached);
        return;
      }

      setExpandedItems(base.items || []);
      setExpandedLoading(true);

      const nextParams = new URLSearchParams(searchParams?.toString() || '');
      nextParams.set('limitPerRow', String(EXPANDED_LIMIT));
      nextParams.set('shelfKey', sectionKey);
      try {
        const response = await fetch(`/api/discover/feed?${nextParams.toString()}`, {
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
          expandedCacheRef.current.set(cacheKey, sanitizedItems);
          setExpandedItems(sanitizedItems);
          try {
            track('discover_shelf_expand', {
              shelf_key: sectionKey,
              total_items: match.items?.length ?? 0,
              exp,
            });
          } catch { }
        } else {
          setExpandedError('Não encontramos mais conteúdos para esta lista.');
        }
      } catch (err) {
        setExpandedError('Não foi possível carregar mais conteúdos agora. Tente novamente.');
      } finally {
        setExpandedLoading(false);
      }
    },
    [sectionsWithCover, searchParams, searchParamsText, exp, hiddenIds]
  );

  const handleCollapse = useCallback(() => {
    setExpandedKey(null);
    setExpandedItems(null);
    setExpandedError(null);
    setExpandedLoading(false);
  }, []);

  const renderTitleWithIcon = useCallback(
    (key: string, title: string, compact = false) => {
      const Icon = TITLE_ICONS[key] || Sparkles;

      return (
        <span className={`inline-flex items-center ${compact ? "gap-2" : "gap-2.5"}`}>
          <span
            className={`inline-flex shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,245,0.96))] text-zinc-700 shadow-[0_2px_8px_rgba(24,24,27,0.05)] ${
              compact ? "h-7 w-7" : "h-8 w-8"
            }`}
          >
            <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </span>
          <span>{title}</span>
        </span>
      );
    },
    []
  );

  const expandedSectionMeta = expandedKey
    ? sectionsWithCover.find((s) => s.key === expandedKey) || null
    : null;

  if (expandedKey && expandedSectionMeta && expandedItems) {
    const title = TITLE_OVERRIDES[expandedSectionMeta.key] || expandedSectionMeta.title;
    const description = DESCRIPTIONS[expandedSectionMeta.key];
    return (
      <div className="space-y-3 sm:space-y-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleCollapse}
            className="dashboard-secondary-button inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-200"
          >
            ← Voltar para as listas
          </button>
          <span className="text-sm text-zinc-500">
            {expandedItems.length} {expandedItems.length === 1 ? 'conteúdo' : 'conteúdos'}
          </span>
        </div>
        <section aria-label={title} className="w-full border-t border-zinc-100/90 px-0 py-1 sm:py-2">
          <div className="mb-3 space-y-1 px-1">
            <p className="dashboard-muted-label">Coleção expandida</p>
            <h2 className="text-xl font-semibold text-zinc-900">
              {renderTitleWithIcon(expandedSectionMeta.key, title)}
            </h2>
            {description ? <p className="text-sm text-zinc-500">{description}</p> : null}
          </div>
          {expandedError && (
            <div className="mb-3 rounded-[1.15rem] border border-red-200/70 bg-red-50/72 px-4 py-3 text-sm text-red-700">
              {expandedError}
            </div>
          )}
          {expandedLoading && (
            <div className="mb-3 rounded-[1.15rem] border border-pink-200/70 bg-pink-50/68 px-4 py-3 text-sm text-pink-600">
              Carregando mais conteúdos…
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {expandedItems.map((item, idx) => (
              <DiscoverCard
                key={`${item.id}-${idx}`}
                item={item as any}
                nextItem={findNextPlayable(expandedItems, idx)}
                trackContext={{ shelf_key: expandedSectionMeta.key, rank: idx + 1, exp, view: 'expanded' }}
                variant="grid"
                onUnavailable={handleCardUnavailable}
              />
            ))}
            {expandedItems.length === 0 && !expandedLoading && !expandedError && (
              <div className="dashboard-empty-state rounded-[1.3rem] border border-dashed border-zinc-200/80 px-4 py-6 text-sm text-zinc-500">
                Nenhum conteúdo encontrado para exibir aqui.
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={compactView ? "space-y-4" : "space-y-6"}>
      {sectionsWithCover.map((s, sectionIndex) => {
        const title = TITLE_OVERRIDES[s.key] || s.title;
        const description = DESCRIPTIONS[s.key];
        const isPrimary = s.key === primaryKey;
        const visibilityStyle = isPrimary
          ? undefined
          : ({ contentVisibility: 'auto', containIntrinsicSize: '360px' } as React.CSSProperties);
        const ctaLabel = compactView
          ? "Ver mais"
          : desktopCompactPreview
            ? "Ver coleção"
            : CTA_LABEL_OVERRIDES[s.key] || "Ver coleção completa";
        return (
          <section
            key={s.key}
            aria-label={title}
            className={`w-full ${sectionIndex > 0 ? "border-t border-zinc-100/90 pt-4 sm:pt-6" : ""}`}
            style={visibilityStyle}
          >
            <div className={compactView ? "py-0.5" : "py-1 sm:py-2"}>
              <div className={`flex flex-row items-start justify-between ${compactView ? "gap-2" : "gap-2 sm:gap-3"}`}>
                <div className="min-w-0">
                  {(description || COMPACT_DESCRIPTIONS[s.key]) && !compactView ? (
                    <p className="dashboard-muted-label mb-1">
                      Curadoria
                    </p>
                  ) : null}
                  <h2 className={compactView ? "text-[1.04rem] font-semibold leading-tight tracking-[-0.02em] text-zinc-950" : "dashboard-type-section-title"}>
                    {renderTitleWithIcon(s.key, title, compactView)}
                  </h2>
                  {compactView && COMPACT_DESCRIPTIONS[s.key] ? (
                    <p className="mt-1 text-[12px] leading-5 text-zinc-500">
                      {COMPACT_DESCRIPTIONS[s.key]}
                    </p>
                  ) : null}
                  {description && !compactView ? (
                    <p className={`dashboard-type-body mt-1 max-w-xl ${compactView ? "text-[12px]" : ""}`}>
                      {description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleExpand(s.key)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/86 text-zinc-700 shadow-[0_6px_18px_rgba(24,24,27,0.035)] transition hover:border-zinc-300 hover:bg-white hover:text-zinc-950 ${compactView ? "px-2.5 py-1.5 text-[11px] font-semibold" : "dashboard-secondary-button dashboard-type-control px-3.5 py-2"}`}
                >
                  <span>{ctaLabel}</span>
                  <ArrowUpRight className={compactView ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
                </button>
              </div>
              {compactView || desktopCompactPreview ? (
                <div
                  className={`group relative overflow-x-auto hide-scrollbar ${
                    desktopCompactPreview
                      ? "mt-2 -mx-5"
                      : "mt-2 -mx-2"
                  }`}
                >
                  <div className={`rail-scroll flex flex-nowrap snap-x snap-mandatory ${
                    desktopCompactPreview
                      ? "gap-2 pl-5 pr-5 py-1.5 scroll-pl-5 scroll-pr-5"
                      : "gap-2 pl-2 pr-3 py-1.5 scroll-pl-2 scroll-pr-3"
                  }`}>
                    {(s.items || []).map((it, idx) => (
                      <DiscoverCard
                        key={it.id}
                        item={it as any}
                        nextItem={findNextPlayable(s.items || [], idx)}
                        trackContext={{ shelf_key: s.key, rank: idx + 1, exp }}
                        variant="rail"
                        compactView={compactView}
                        onUnavailable={handleCardUnavailable}
                        priority={compactView && sectionIndex < 2 && idx < 2}
                      />
                    ))}
                    {(s.items || []).length === 0 && (
                      <div className="dashboard-empty-state px-4 py-5 text-sm text-zinc-500">
                        Nenhum resultado para esta seção. Dica: remova 1 filtro ou experimente outra guia.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(150px,180px))] justify-start gap-4">
                  {(s.items || []).slice(0, 8).map((it, idx) => (
                    <DiscoverCard
                      key={it.id}
                      item={it as any}
                      nextItem={findNextPlayable(s.items || [], idx)}
                      trackContext={{ shelf_key: s.key, rank: idx + 1, exp }}
                      variant="grid"
                      compactView={false}
                      onUnavailable={handleCardUnavailable}
                      priority={sectionIndex === 0 && idx < 4}
                    />
                  ))}
                  {(s.items || []).length === 0 && (
                    <div className="dashboard-empty-state col-span-full px-4 py-5 text-sm text-zinc-500">
                      Nenhum resultado para esta seção. Dica: remova 1 filtro ou experimente outra guia.
                    </div>
                  )}
                </div>
              )}
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
