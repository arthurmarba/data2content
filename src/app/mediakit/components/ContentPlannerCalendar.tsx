"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Target, LayoutTemplate, Compass, MessageCircle, Link as LinkIcon, TrendingUp, Bookmark, X } from 'lucide-react';
import { PlannerUISlot } from '@/hooks/usePlannerData';
import { idsToLabels } from '@/app/lib/classification';
import { fetchSlotInspirations, getCachedInspirations } from '../utils/inspirationCache';

const DAYS_FULL_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
type StatusCategory = 'champion' | 'test' | 'watch' | 'planned';
const CARD_BATCH_SIZE = 12;
const LABELS_CACHE_LIMIT = 320;
type LabelCategory = 'proposal' | 'context' | 'tone' | 'reference';
type SlotCardCacheEntry = {
  slotRef: PlannerUISlot;
  heatScore: number | undefined;
  card: PlannerSlotCard;
};
type SlotCardBaseFields = {
  cardId: string;
  title: string;
  formatLabel: string;
  viewsP50: string;
  proposalLabel: string;
  contextLabel: string;
  toneLabel: string;
  referenceLabel: string;
};

export interface CalendarHeatPoint {
  dayOfWeek: number;
  blockStartHour: number;
  score: number;
}

function dayFullLabel(dayOfWeek: number): string {
  const idx = ((dayOfWeek - 1) % 7 + 7) % 7;
  const fallbackLabel = DAYS_FULL_PT[0] ?? 'Domingo';
  const label = DAYS_FULL_PT[idx];
  return label ?? fallbackLabel;
}

function blockLabel(start: number) {
  const end = (start + 3) % 24;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(start)}–${pad(end)}`;
}

function keyFor(day: number, block: number) {
  return `${day}-${block}`;
}

const DETAIL_OBSERVER_ROOT_MARGIN = '420px 0px';
const detailObserverCallbacks = new Map<Element, () => void>();
let detailObserver: IntersectionObserver | null = null;

function getDetailObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  if (detailObserver) return detailObserver;

  detailObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const callback = detailObserverCallbacks.get(entry.target);
        if (!callback) continue;
        detailObserverCallbacks.delete(entry.target);
        detailObserver?.unobserve(entry.target);
        callback();
      }
    },
    { rootMargin: DETAIL_OBSERVER_ROOT_MARGIN, threshold: 0 }
  );

  return detailObserver;
}

function observeCardDetails(node: Element, onVisible: () => void): () => void {
  const observer = getDetailObserver();
  if (!observer) {
    onVisible();
    return () => {};
  }

  detailObserverCallbacks.set(node, onVisible);
  observer.observe(node);

  return () => {
    detailObserverCallbacks.delete(node);
    observer.unobserve(node);
    if (detailObserverCallbacks.size === 0) {
      observer.disconnect();
      detailObserver = null;
    }
  };
}

function getSlotCardId(slot: PlannerUISlot): string {
  if (slot.slotId) return slot.slotId;
  const fallbackTitle = slot.title?.trim() || slot.themeKeyword || slot.themes?.[0] || 'Sugestão pronta do Mobi';
  return `${slot.dayOfWeek}-${slot.blockStartHour}-${fallbackTitle}`;
}

function getCachedLabels(
  cache: Map<string, readonly string[]>,
  ids: string[] | undefined,
  category: LabelCategory
): readonly string[] {
  if (!ids || ids.length === 0) return [];

  const cacheKey = `${category}:${ids.join(',')}`;
  const cachedLabels = cache.get(cacheKey);
  if (cachedLabels) {
    // Refresh order to behave like a tiny LRU cache.
    cache.delete(cacheKey);
    cache.set(cacheKey, cachedLabels);
    return cachedLabels;
  }

  const computedLabels = idsToLabels(ids, category);
  cache.set(cacheKey, computedLabels);

  if (cache.size > LABELS_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey === 'string') {
      cache.delete(oldestKey);
    }
  }

  return computedLabels;
}

function isSlotsChronologicallySorted(slotList: PlannerUISlot[]): boolean {
  for (let i = 1; i < slotList.length; i += 1) {
    const prev = slotList[i - 1]!;
    const current = slotList[i]!;
    if (prev.dayOfWeek > current.dayOfWeek) return false;
    if (prev.dayOfWeek === current.dayOfWeek && prev.blockStartHour > current.blockStartHour) return false;
  }
  return true;
}

function formatViews(value?: number) {
  if (typeof value !== 'number' || !isFinite(value) || value <= 0) return null;
  try {
    return value.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  } catch {
    return String(value);
  }
}

const FORMAT_LABELS: Record<string, string> = {
  reel: 'Reel',
  photo: 'Foto',
  carousel: 'Carrossel',
  story: 'Story',
  live: 'Live',
  long_video: 'Vídeo Longo',
};

function formatSlotFormat(formatId?: string): string {
  if (!formatId) return 'Formato livre';
  return FORMAT_LABELS[formatId] ?? formatId;
}

const toProxyUrl = (raw?: string | null) => {
  if (!raw) return '';
  if (raw.startsWith('/api/proxy/thumbnail/')) return raw;
  if (/^https?:\/\//i.test(raw)) return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
  return raw;
};

function getStatusInfo(
  heatScore: number | undefined,
  slot: PlannerUISlot
): { label: string; metaClass: string; barClass: string; category: StatusCategory } {
  if (typeof heatScore === 'number' && heatScore >= 0.75) {
    return {
      label: 'Campeão',
      metaClass: 'text-[#1D8E5D]',
      barClass: 'bg-gradient-to-r from-[#3CCB7F] to-[#1D8E5D]',
      category: 'champion',
    };
  }
  if (slot.status === 'test' || slot.isExperiment) {
    return {
      label: 'Em teste',
      metaClass: 'text-[#4C5BD4]',
      barClass: 'bg-gradient-to-r from-[#A4B1FF] to-[#4C5BD4]',
      category: 'test',
    };
  }
  if (typeof heatScore === 'number' && heatScore >= 0.5) {
    return {
      label: 'Bom desempenho',
      metaClass: 'text-[#4C5BD4]',
      barClass: 'bg-gradient-to-r from-[#C9D3FF] to-[#4C5BD4]',
      category: 'test',
    };
  }
  if (typeof heatScore === 'number') {
    return {
      label: 'Em observação',
      metaClass: 'text-[#B9730F]',
      barClass: 'bg-gradient-to-r from-[#FFE6B0] to-[#B9730F]',
      category: 'watch',
    };
  }
  if (slot.status === 'posted') {
    return {
      label: 'Publicado',
      metaClass: 'text-[#1D8E5D]',
      barClass: 'bg-gradient-to-r from-[#3CCB7F] to-[#1D8E5D]',
      category: 'champion',
    };
  }
  return {
    label: 'Planejado',
    metaClass: 'text-[#6E1F93]',
    barClass: 'bg-gradient-to-r from-[#D6C9FF] to-[#6E1F93]',
    category: 'planned',
  };
}

export interface ContentPlannerCalendarProps {
  userId?: string;
  slots: PlannerUISlot[] | null;
  heatmap: CalendarHeatPoint[] | null;
  loading: boolean;
  error: string | null;
  publicMode?: boolean;
  canEdit: boolean;
  locked: boolean;
  lockedReason?: string | null;
  isBillingLoading?: boolean;
  onRequestSubscribe?: () => void;
  onOpenSlot: (slot: PlannerUISlot) => void;
  onCreateSlot?: (dayOfWeek: number, blockStartHour: number) => void;
  onDeleteSlot?: (slot: PlannerUISlot) => void;
}


export const ContentPlannerCalendar: React.FC<ContentPlannerCalendarProps> = ({
  userId,
  slots,
  heatmap,
  loading,
  error,
  publicMode = false,
  canEdit,
  locked,
  lockedReason,
  isBillingLoading,
  onRequestSubscribe,
  onOpenSlot,
  onDeleteSlot,
}) => {
  const stableSortedSlotsRef = useRef<PlannerUISlot[]>([]);
  const stableHeatMapRef = useRef<Map<string, number>>(new Map());
  const slotCardCacheRef = useRef<Map<string, SlotCardCacheEntry>>(new Map());
  const slotCardBaseRef = useRef<WeakMap<PlannerUISlot, SlotCardBaseFields>>(new WeakMap());
  const labelsCacheRef = useRef<Map<string, readonly string[]>>(new Map());
  const onOpenSlotRef = useRef(onOpenSlot);
  const onRequestSubscribeRef = useRef(onRequestSubscribe);
  const onDeleteSlotRef = useRef(onDeleteSlot);

  useEffect(() => {
    onOpenSlotRef.current = onOpenSlot;
  }, [onOpenSlot]);

  useEffect(() => {
    onRequestSubscribeRef.current = onRequestSubscribe;
  }, [onRequestSubscribe]);

  useEffect(() => {
    onDeleteSlotRef.current = onDeleteSlot;
  }, [onDeleteSlot]);

  const handleOpenSlot = React.useCallback((slot: PlannerUISlot) => {
    onOpenSlotRef.current(slot);
  }, []);

  const handleRequestSubscribe = React.useCallback(() => {
    onRequestSubscribeRef.current?.();
  }, []);

  const handleDeleteSlot = React.useCallback((slot: PlannerUISlot) => {
    onDeleteSlotRef.current?.(slot);
  }, []);

  const canRequestSubscribe = Boolean(onRequestSubscribe);
  const canDeleteSlot = Boolean(onDeleteSlot);

  const sortedSlots = useMemo(() => {
    if (!slots?.length) {
      if (stableSortedSlotsRef.current.length === 0) return stableSortedSlotsRef.current;
      stableSortedSlotsRef.current = [];
      return stableSortedSlotsRef.current;
    }

    const nextSorted =
      slots.length < 2 || isSlotsChronologicallySorted(slots)
        ? slots
        : [...slots].sort((a, b) => {
            if (a.dayOfWeek === b.dayOfWeek) {
              return a.blockStartHour - b.blockStartHour;
            }
            return a.dayOfWeek - b.dayOfWeek;
          });

    const previousSorted = stableSortedSlotsRef.current;
    const hasSameReferences =
      previousSorted.length === nextSorted.length &&
      previousSorted.every((slot, index) => slot === nextSorted[index]);

    if (hasSameReferences) {
      return previousSorted;
    }

    stableSortedSlotsRef.current = nextSorted;
    return nextSorted;
  }, [slots]);

  const heatMapMap = useMemo(() => {
    const map = new Map<string, number>();
    (heatmap || []).forEach((point) => {
      map.set(keyFor(point.dayOfWeek, point.blockStartHour), point.score);
    });

    const previousMap = stableHeatMapRef.current;
    if (previousMap.size === map.size) {
      let hasChanges = false;
      for (const [slotKey, value] of map.entries()) {
        if (previousMap.get(slotKey) !== value) {
          hasChanges = true;
          break;
        }
      }
      if (!hasChanges) {
        return previousMap;
      }
    }

    stableHeatMapRef.current = map;
    return map;
  }, [heatmap]);

  const slotCards = useMemo(() => {
    if (!sortedSlots.length) {
      if (slotCardCacheRef.current.size > 0) {
        slotCardCacheRef.current.clear();
      }
      labelsCacheRef.current.clear();
      slotCardBaseRef.current = new WeakMap();
      return [] as PlannerSlotCard[];
    }

    const previousCache = slotCardCacheRef.current;
    const nextCache = new Map<string, SlotCardCacheEntry>();
    const baseCache = slotCardBaseRef.current;
    const labelsCache = labelsCacheRef.current;

    const cards = sortedSlots.map((slot) => {
      const key = keyFor(slot.dayOfWeek, slot.blockStartHour);
      const heatScore = heatMapMap.get(key);
      const cardId = getSlotCardId(slot);

      const cached = previousCache.get(cardId);
      if (cached && cached.slotRef === slot && Object.is(cached.heatScore, heatScore)) {
        nextCache.set(cardId, cached);
        return cached.card;
      }

      let baseFields = baseCache.get(slot);
      if (!baseFields) {
        const title =
          slot.title?.trim() || slot.themeKeyword || slot.themes?.[0] || 'Sugestão pronta do Mobi';
        const formatLabel = formatSlotFormat(slot.format);
        const expectedMetrics = slot.expectedMetrics ?? {};
        const viewsP50 = formatViews(expectedMetrics.viewsP50) ?? '—';
        const proposalLabels = getCachedLabels(labelsCache, slot.categories?.proposal, 'proposal');
        const contextLabels = getCachedLabels(labelsCache, slot.categories?.context, 'context');
        const toneLabels = getCachedLabels(
          labelsCache,
          slot.categories?.tone ? [slot.categories.tone] : undefined,
          'tone'
        );
        const referenceLabels = getCachedLabels(labelsCache, slot.categories?.reference, 'reference');

        baseFields = {
          cardId,
          title,
          formatLabel,
          viewsP50,
          proposalLabel: proposalLabels.length ? proposalLabels.join(', ') : '-',
          contextLabel: contextLabels.length ? contextLabels.join(', ') : '-',
          toneLabel: toneLabels[0] ?? '-',
          referenceLabel: referenceLabels.length ? referenceLabels.join(', ') : '-',
        };

        baseCache.set(slot, baseFields);
      }

      const statusInfo = getStatusInfo(heatScore, slot);

      const card = {
        id: baseFields.cardId,
        dayTitle: dayFullLabel(slot.dayOfWeek),
        blockLabel: blockLabel(slot.blockStartHour),
        title: baseFields.title,
        formatLabel: baseFields.formatLabel,
        viewsP50: baseFields.viewsP50,
        statusLabel: statusInfo.label,
        statusCategory: statusInfo.category,
        statusClass: statusInfo.metaClass,
        slot,
        // New fields
        proposalLabel: baseFields.proposalLabel,
        contextLabel: baseFields.contextLabel,
        toneLabel: baseFields.toneLabel,
        referenceLabel: baseFields.referenceLabel,
      } as PlannerSlotCard;

      nextCache.set(baseFields.cardId, { slotRef: slot, heatScore, card });
      return card;
    });

    slotCardCacheRef.current = nextCache;
    return cards;
  }, [sortedSlots, heatMapMap]);
  const hasSlotCards = slotCards.length > 0;

  if (!publicMode && locked && !isBillingLoading) {
    return (
      <div className="rounded-3xl border border-[#E6E6EB] bg-white p-6 text-center shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">
          Libere o Planejamento de Conteúdo
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {lockedReason ??
            'Ative ou renove a assinatura para visualizar as recomendações de horários inteligentes.'}
        </p>
        <button
          type="button"
          onClick={handleRequestSubscribe}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#6E1F93] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5a1877]"
        >
          Conferir planos
        </button>
      </div>
    );
  }

  if (!publicMode && locked && isBillingLoading) {
    return (
      <div className="rounded-3xl border border-[#E6E6EB] bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
        Carregando status da sua assinatura…
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-end">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Lista
        </div>
      </div>

      {loading && !hasSlotCards && <PlannerLoadingBanner />}

      {loading && !hasSlotCards && <PlannerLoadingSkeleton />}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {hasSlotCards ? (
        <PlannerSlotCardGrid
          cards={slotCards}
          canEdit={canEdit}
          onOpenSlot={handleOpenSlot}
          onRequestSubscribe={canRequestSubscribe ? handleRequestSubscribe : undefined}
          userId={userId}
          publicMode={publicMode}
          locked={locked}
          onDeleteSlot={canDeleteSlot ? handleDeleteSlot : undefined}
        />
      ) : !loading ? (
        <PlannerEmptyState
          onRequestSubscribe={canRequestSubscribe ? handleRequestSubscribe : undefined}
          loading={loading}
        />
      ) : null}

      {!publicMode && !canEdit && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-800">
          <div>
            <div className="font-semibold">Assine para editar e gerar roteiros com IA</div>
            <div className="text-sm">
              Seu plano atual não permite edição. Você ainda pode visualizar horários ideais e recomendações.
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestSubscribe}
            className="ml-3 rounded-md bg-pink-600 px-4 py-2 text-sm text-white transition hover:bg-pink-700"
          >
            Assinar
          </button>
        </div>
      )}

    </section>
  );
};

const STATUS_EMOJI: Record<StatusCategory, string> = {
  champion: '🔥',
  test: '🧪',
  watch: '👀',
  planned: '⏳',
};

export interface PlannerSlotCard {
  id: string;
  dayTitle: string;
  blockLabel: string;
  title: string;
  formatLabel: string;
  viewsP50: string;
  statusLabel: string;
  statusCategory: StatusCategory;
  statusClass: string;
  slot: PlannerUISlot;
  // New fields for rich grid
  proposalLabel: string;
  contextLabel: string;
  toneLabel: string;
  referenceLabel: string;
}

type SelfInspirationCard = {
  id: string;
  caption: string;
  views?: number;
  thumbnailUrl?: string | null;
  postLink?: string | null;
};

type CommunityInspirationCard = {
  id: string;
  caption: string;
  views?: number;
  coverUrl?: string | null;
  postLink?: string | null;
};

type ListModeSlotCardProps = {
  card: PlannerSlotCard;
  canEdit: boolean;
  onOpenSlot: (slot: PlannerUISlot) => void;
  onRequestSubscribe?: () => void;
  userId?: string;
  publicMode?: boolean;
  locked?: boolean;
  onDeleteSlot?: (slot: PlannerUISlot) => void;
  priorityRender?: boolean;
};

function formatInspirationCaption(caption?: string): string {
  if (!caption) return '';
  return caption.length > 70 ? `${caption.slice(0, 67)}…` : caption;
}

function openExternalLink(event: React.MouseEvent, link?: string | null): void {
  event.stopPropagation();
  if (!link) return;
  try {
    window.open(link, '_blank', 'noopener,noreferrer');
  } catch {
    // silent fail
  }
}

type SlotInspirationsContentProps = {
  slot: PlannerUISlot;
  userId?: string;
};

const SlotInspirationsContentBase = ({ slot, userId }: SlotInspirationsContentProps) => {
  const [selfInspiration, setSelfInspiration] = useState<SelfInspirationCard | null>(null);
  const [communityInspiration, setCommunityInspiration] = useState<CommunityInspirationCard | null>(null);
  const [inspLoading, setInspLoading] = useState(false);
  const [inspError, setInspError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setSelfInspiration(null);
      setCommunityInspiration(null);
      setInspLoading(false);
      setInspError(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const cached = getCachedInspirations(slot);

      if (cached) {
        setSelfInspiration(cached.self);
        setCommunityInspiration(cached.community);
        setInspLoading(false);
        setInspError(null);
        return;
      }

      setSelfInspiration(null);
      setCommunityInspiration(null);
      setInspLoading(true);
      setInspError(null);
      try {
        const result = await fetchSlotInspirations(userId, slot);
        if (!cancelled) {
          setSelfInspiration(result.self);
          setCommunityInspiration(result.community);
        }
      } catch (err: any) {
        if (!cancelled) {
          setInspError(err?.message || 'Erro ao carregar inspirações');
        }
      } finally {
        if (!cancelled) setInspLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [slot, userId]);

  const handleSelfInspirationClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => openExternalLink(event, selfInspiration?.postLink),
    [selfInspiration?.postLink]
  );

  const handleCommunityInspirationClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => openExternalLink(event, communityInspiration?.postLink),
    [communityInspiration?.postLink]
  );

  return (
    <div className="mt-2 space-y-3 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Inspirações
        </p>
      </div>

      {inspError && <p className="text-[11px] text-red-600">{inspError}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {inspLoading && !selfInspiration && !communityInspiration && (
          <div className="col-span-2 grid gap-3 sm:grid-cols-2">
            {[0, 1].map((idx) => (
              <div
                key={`insp-skeleton-${idx}`}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
              >
                <div className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-gradient-to-br from-slate-200 to-slate-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-3 w-full animate-pulse rounded-full bg-slate-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!inspLoading && !selfInspiration && !communityInspiration && (
          <div className="col-span-2 py-2 text-center text-[11px] text-slate-400 italic">
            Nenhuma inspiração encontrada para este contexto.
          </div>
        )}

        {selfInspiration && (
          <button
            type="button"
            onClick={handleSelfInspirationClick}
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left text-[11px] text-slate-600 transition hover:-translate-y-[1px] hover:shadow-md hover:border-brand-primary/20"
          >
            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-200">
              {selfInspiration.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toProxyUrl(selfInspiration.thumbnailUrl)}
                  alt="Inspiracao"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Sem imagem</div>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-brand-primary">Seu Acervo</span>
              </div>
              <p className="line-clamp-2 text-[11px] font-medium text-slate-700 leading-snug">
                {formatInspirationCaption(selfInspiration.caption)}
              </p>
              {selfInspiration.views ? (
                <span className="text-[10px] text-slate-500">{selfInspiration.views.toLocaleString('pt-BR')} views</span>
              ) : null}
            </div>
          </button>
        )}

        {communityInspiration && (
          <button
            type="button"
            onClick={handleCommunityInspirationClick}
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left text-[11px] text-slate-600 transition hover:-translate-y-[1px] hover:shadow-md hover:border-brand-primary/20"
          >
            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-200">
              {communityInspiration.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toProxyUrl(communityInspiration.coverUrl)}
                  alt="Inspiracao comunidade"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Sem imagem</div>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">Comunidade</span>
              </div>
              <p className="line-clamp-2 text-[11px] font-medium text-slate-700 leading-snug">
                {formatInspirationCaption(communityInspiration.caption)}
              </p>
              {communityInspiration.views ? (
                <span className="text-[10px] text-slate-500">{communityInspiration.views.toLocaleString('pt-BR')} views</span>
              ) : null}
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

const SlotInspirationsContent = React.memo(
  SlotInspirationsContentBase,
  (prev, next) => prev.slot === next.slot && prev.userId === next.userId
);

type SlotInspirationsPanelProps = {
  canShowInspirations: boolean;
  showInspirations: boolean;
  slot: PlannerUISlot;
  userId?: string;
  onToggleInspirations: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

const SlotInspirationsPanelBase = ({
  canShowInspirations,
  showInspirations,
  slot,
  userId,
  onToggleInspirations,
}: SlotInspirationsPanelProps) => {
  if (!canShowInspirations) return null;

  return (
    <>
      <div className="mt-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onToggleInspirations}
          className="text-[11px] font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900"
        >
          {showInspirations ? 'Ocultar inspirações' : 'Ver inspirações'}
        </button>
      </div>

      {showInspirations ? <SlotInspirationsContent slot={slot} userId={userId} /> : null}
    </>
  );
};

const SlotInspirationsPanel = React.memo(
  SlotInspirationsPanelBase,
  (prev, next) =>
    prev.canShowInspirations === next.canShowInspirations &&
    prev.showInspirations === next.showInspirations &&
    prev.slot === next.slot &&
    prev.userId === next.userId &&
    prev.onToggleInspirations === next.onToggleInspirations
);

type SlotCardDetailsPanelProps = {
  card: PlannerSlotCard;
  userId?: string;
  canShowInspirations: boolean;
  showInspirations: boolean;
  onToggleInspirations: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

const SlotCardDetailsPanelBase = ({
  card,
  userId,
  canShowInspirations,
  showInspirations,
  onToggleInspirations,
}: SlotCardDetailsPanelProps) => (
  <>
    {/* Mobile-Optimized Layout (Big Numbers) */}
    <div className="flex flex-col gap-4 sm:hidden">
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Projeção</span>
          <span className="text-2xl font-bold text-emerald-700">{card.viewsP50}</span>
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div className="flex flex-col gap-1 text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Formato</span>
          <div className="flex items-center justify-end gap-1.5 text-slate-700">
            <LayoutTemplate className="h-4 w-4" />
            <span className="text-sm font-semibold">{card.formatLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {card.contextLabel && card.contextLabel !== '-' && (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {card.contextLabel}
          </span>
        )}
        {card.toneLabel && card.toneLabel !== '-' && (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {card.toneLabel}
          </span>
        )}
      </div>
    </div>

    {/* Desktop Grid Layout */}
    <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-y-4 gap-x-3 lg:gap-x-4 lg:divide-x lg:divide-slate-100">
      <div className="flex flex-col gap-1.5 px-1 lg:px-3 lg:first:pl-0">
        <div className="flex items-center gap-1.5 text-slate-500">
          <LayoutTemplate className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Formato</span>
        </div>
        <span className="truncate text-xs font-semibold text-slate-800" title={card.formatLabel}>{card.formatLabel}</span>
      </div>
      <div className="flex flex-col gap-1.5 px-1 lg:px-3">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Target className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Proposta</span>
        </div>
        <span className="line-clamp-2 text-xs font-semibold text-slate-800" title={card.proposalLabel}>{card.proposalLabel}</span>
      </div>
      <div className="flex flex-col gap-1.5 px-1 lg:px-3">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Compass className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Contexto</span>
        </div>
        <span className="line-clamp-2 text-xs font-semibold text-slate-800" title={card.contextLabel}>{card.contextLabel}</span>
      </div>
      <div className="flex flex-col gap-1.5 px-1 lg:px-3">
        <div className="flex items-center gap-1.5 text-slate-500">
          <MessageCircle className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Tom</span>
        </div>
        <span className="truncate text-xs font-semibold text-slate-800" title={card.toneLabel}>{card.toneLabel}</span>
      </div>
      <div className="flex flex-col gap-1.5 px-1 lg:px-3">
        <div className="flex items-center gap-1.5 text-slate-500">
          <LinkIcon className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Referência</span>
        </div>
        <span className="line-clamp-2 text-xs font-semibold text-slate-800" title={card.referenceLabel}>{card.referenceLabel}</span>
      </div>
      <div className="flex flex-col gap-1.5 px-1 lg:px-3">
        <div className="flex items-center gap-1.5 text-slate-500">
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Projeção</span>
        </div>
        <span className="text-xs font-bold text-emerald-700">{card.viewsP50}</span>
      </div>
    </div>

    <SlotInspirationsPanel
      canShowInspirations={canShowInspirations}
      showInspirations={showInspirations}
      slot={card.slot}
      userId={userId}
      onToggleInspirations={onToggleInspirations}
    />
  </>
);

const SlotCardDetailsPanel = React.memo(
  SlotCardDetailsPanelBase,
  (prev, next) =>
    prev.card === next.card &&
    prev.userId === next.userId &&
    prev.canShowInspirations === next.canShowInspirations &&
    prev.showInspirations === next.showInspirations &&
    prev.onToggleInspirations === next.onToggleInspirations
);

const ListModeSlotCardBase = ({
  card,
  canEdit,
  onOpenSlot,
  onRequestSubscribe,
  userId,
  publicMode,
  locked,
  onDeleteSlot,
  priorityRender = false,
}: ListModeSlotCardProps) => {
  const cardRef = useRef<HTMLElement | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(priorityRender);
  const canShowInspirations = !publicMode && !locked;
  const [showInspirations, setShowInspirations] = useState(false);
  const shouldRenderRichDetails = isNearViewport || showInspirations;

  const handleCardActivate = React.useCallback(() => {
    if (canEdit) {
      onOpenSlot(card.slot);
      return;
    }
    onRequestSubscribe?.();
  }, [canEdit, onOpenSlot, onRequestSubscribe, card.slot]);

  const handleCardKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (!canEdit) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpenSlot(card.slot);
      }
    },
    [canEdit, onOpenSlot, card.slot]
  );

  const handleToggleInspirations = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setShowInspirations((prev) => !prev);
  }, []);

  const handleDeleteSaved = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!onDeleteSlot) return;
      onDeleteSlot(card.slot);
    },
    [onDeleteSlot, card.slot]
  );

  const handleRequestSubscribeClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onRequestSubscribe?.();
    },
    [onRequestSubscribe]
  );

  useEffect(() => {
    if (priorityRender && !isNearViewport) {
      setIsNearViewport(true);
    }
  }, [priorityRender, isNearViewport]);

  useEffect(() => {
    if (priorityRender || isNearViewport) return;
    const node = cardRef.current;
    if (!node) return;

    return observeCardDetails(node, () => setIsNearViewport(true));
  }, [priorityRender, isNearViewport]);

  useEffect(() => {
    if (!canShowInspirations) {
      setShowInspirations(false);
    }
  }, [canShowInspirations]);

  return (
    <article
      ref={cardRef}
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : -1}
      onClick={handleCardActivate}
      onKeyDown={handleCardKeyDown}
      className={[
        'group relative flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
        canEdit ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '380px' }}
    >
      {/* Header with Day/Time and Status */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-slate-900 sm:text-sm">{card.dayTitle}</span>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-sm font-medium text-slate-600">{card.blockLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {card.slot.isSaved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 pl-2 pr-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-primary">
              <Bookmark className="h-3 w-3" />
              Salvo
              {onDeleteSlot && (
                <button
                  type="button"
                  onClick={handleDeleteSaved}
                  className="ml-1 rounded-full p-0.5 hover:bg-brand-primary/20 text-brand-primary"
                  title="Remover salvo"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full border border-current px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${card.statusClass}`}>
            <span aria-hidden>{STATUS_EMOJI[card.statusCategory]}</span>
            {card.statusLabel}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2 border-b border-slate-100 pb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tema</span>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900 group-hover:text-brand-magenta transition-colors">
            {card.title}
          </h3>
        </div>
      </div>

      {shouldRenderRichDetails ? (
        <SlotCardDetailsPanel
          card={card}
          userId={userId}
          canShowInspirations={canShowInspirations}
          showInspirations={showInspirations}
          onToggleInspirations={handleToggleInspirations}
        />
      ) : (
        <div className="space-y-3">
          <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
        </div>
      )}

      {!canEdit && onRequestSubscribe && (
        <button
          type="button"
          onClick={handleRequestSubscribeClick}
          className="mt-2 text-xs font-semibold text-[#D62E5E] underline underline-offset-2"
        >
          Assine para editar esta pauta
        </button>
      )}
    </article>
  );
};

const ListModeSlotCard = React.memo(
  ListModeSlotCardBase,
  (prev, next) =>
    prev.card === next.card &&
    prev.canEdit === next.canEdit &&
    prev.onOpenSlot === next.onOpenSlot &&
    prev.onRequestSubscribe === next.onRequestSubscribe &&
    prev.userId === next.userId &&
    prev.publicMode === next.publicMode &&
    prev.locked === next.locked &&
    prev.onDeleteSlot === next.onDeleteSlot &&
    prev.priorityRender === next.priorityRender
);

type PlannerSlotCardGridProps = {
  cards: PlannerSlotCard[];
  canEdit: boolean;
  onOpenSlot: (slot: PlannerUISlot) => void;
  onRequestSubscribe?: () => void;
  userId?: string;
  publicMode?: boolean;
  locked?: boolean;
  onDeleteSlot?: (slot: PlannerUISlot) => void;
};

const PlannerSlotCardGridBase = ({
  cards,
  canEdit,
  onOpenSlot,
  onRequestSubscribe,
  userId,
  publicMode,
  locked,
  onDeleteSlot,
}: PlannerSlotCardGridProps) => {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(cards.length, CARD_BATCH_SIZE));
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount((previousVisible) => {
      if (!cards.length) return 0;
      const minimumVisible = Math.min(cards.length, CARD_BATCH_SIZE);
      const clampedVisible = Math.min(previousVisible, cards.length);
      return Math.max(clampedVisible, minimumVisible);
    });
  }, [cards.length]);

  const hasMoreCards = visibleCount < cards.length;

  useEffect(() => {
    if (!hasMoreCards) return;
    const node = loadMoreRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisibleCount((previousVisible) => Math.min(cards.length, previousVisible + CARD_BATCH_SIZE));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const reachedViewport = entries.some((entry) => entry.isIntersecting);
        if (!reachedViewport) return;
        observer.disconnect();
        setVisibleCount((previousVisible) => Math.min(cards.length, previousVisible + CARD_BATCH_SIZE));
      },
      { rootMargin: '800px 0px', threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreCards, visibleCount, cards.length]);

  const visibleCards = useMemo(
    () => cards.slice(0, visibleCount),
    [cards, visibleCount]
  );

  if (!visibleCards.length) return null;
  return (
    <div className="grid grid-cols-1 gap-4">
      {visibleCards.map((card, index) => (
        <ListModeSlotCard
          key={card.id}
          card={card}
          canEdit={canEdit}
          onOpenSlot={onOpenSlot}
          onRequestSubscribe={onRequestSubscribe}
          userId={userId}
          publicMode={publicMode}
          locked={locked}
          onDeleteSlot={onDeleteSlot}
          priorityRender={index < 4}
        />
      ))}
      {hasMoreCards ? (
        <div ref={loadMoreRef} className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
          Carregando mais pautas…
        </div>
      ) : null}
    </div>
  );
};

const PlannerSlotCardGrid = React.memo(
  PlannerSlotCardGridBase,
  (prev, next) =>
    prev.cards === next.cards &&
    prev.canEdit === next.canEdit &&
    prev.onOpenSlot === next.onOpenSlot &&
    prev.onRequestSubscribe === next.onRequestSubscribe &&
    prev.userId === next.userId &&
    prev.publicMode === next.publicMode &&
    prev.locked === next.locked &&
    prev.onDeleteSlot === next.onDeleteSlot
);

const PlannerLoadingSkeleton = () => (
  <div className="space-y-3 rounded-2xl border border-dashed border-[#E4E4EA] bg-white p-5">
    {[1, 2, 3].map((row) => (
      <div key={`planner-loading-${row}`} className="animate-pulse space-y-2">
        <div className="h-3 w-32 rounded-full bg-[#F1F1F5]" />
        <div className="h-5 w-3/4 rounded-full bg-[#ECEAFD]" />
        <div className="flex gap-2">
          <span className="h-6 w-20 rounded-full bg-[#F1F1F5]" />
          <span className="h-6 w-20 rounded-full bg-[#F1F1F5]" />
        </div>
      </div>
    ))}
  </div>
);

const PlannerLoadingBanner = () => (
  <div className="rounded-xl border border-[#E0E7FF] bg-[#F5F7FF] px-4 py-3 text-sm text-[#1C1C1E]">
    <div className="flex items-start gap-3">
      <span className="text-lg" aria-hidden>
        ⚙️
      </span>
      <div>
        <p className="font-semibold">Calculando o melhor plano para a semana</p>
        <p className="text-xs text-[#4B4B55]">
          O Mobi está analisando horários quentes, formatos e KPIs recentes para atualizar seu calendário.
        </p>
      </div>
    </div>
  </div>
);

const PlannerEmptyState = ({
  onRequestSubscribe,
  loading,
}: {
  onRequestSubscribe?: () => void;
  loading: boolean;
}) => (
  <div className="rounded-2xl border border-dashed border-[#E4E4EA] bg-white p-6">
    <p className="text-base font-semibold text-[#1C1C1E]">Prepare o terreno para novas pautas</p>
    <ol className="mt-3 space-y-2 text-sm text-[#4B4B55]">
      {[
        'Confirme se o Instagram está conectado e liberado para IA',
        'Escolha um tema ou objetivo semanal na tela de edição',
        'Peça novas pautas e ajuste horários favoritos',
      ].map((step, index) => (
        <li key={step} className="flex gap-3">
          <span className="text-xs font-semibold text-[#8E8EA0]">0{index + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
    {onRequestSubscribe && !loading && (
      <button
        type="button"
        onClick={onRequestSubscribe}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#E4E4EA] px-3 py-2 text-sm font-semibold text-[#6E1F93]"
      >
        Liberar planner completo
      </button>
    )}
  </div>
);

export default ContentPlannerCalendar;
