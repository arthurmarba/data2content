"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Target, LayoutTemplate, Compass, Link as LinkIcon, TrendingUp, Bookmark, X, CalendarClock, CheckCircle2, Sparkles, ArrowUpRight } from 'lucide-react';
import { PlannerUISlot } from '@/hooks/usePlannerData';
import { idsToLabels } from '@/app/lib/classification';
import { fetchSlotInspirations, getCachedInspirations } from '../utils/inspirationCache';
import { getPlannerSlotPresentation, type PlannerSlotMetaChip } from './plannerSlotPresentation';

const DAYS_FULL_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
type StatusCategory = 'champion' | 'test' | 'watch' | 'planned';
const CARD_BATCH_SIZE_DESKTOP = 12;
const CARD_BATCH_SIZE_COMPACT = 4;
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
  intentLabel: string;
  narrativeLabel: string;
  contextLabel: string;
  focusDetailLabel: string;
  focusDetailValue: string;
  metaChips: PlannerSlotMetaChip[];
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

const CARD_TITLE_FALLBACK = 'Sugestão pronta do Mobi';

function normalizeSlotTitle(value?: string): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveSlotTitle(slot: PlannerUISlot): string {
  const title = normalizeSlotTitle(slot.title);
  const keyword = normalizeSlotTitle(slot.themeKeyword);
  const firstTheme = normalizeSlotTitle(slot.themes?.[0]);
  const fallbackLower = CARD_TITLE_FALLBACK.toLowerCase();

  if (title && title.toLowerCase() !== fallbackLower) {
    return title;
  }
  if (keyword) return keyword;
  if (firstTheme) return firstTheme;
  if (title) return title;
  return CARD_TITLE_FALLBACK;
}

function getSlotCardId(slot: PlannerUISlot): string {
  if (slot.slotId) return slot.slotId;
  const fallbackTitle = resolveSlotTitle(slot);
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

function joinPlannerCardLabels(labels: readonly string[], limit = 2): string {
  const values = labels.filter(Boolean).slice(0, limit);
  return values.length ? values.join(' • ') : '—';
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

function getRoteiroBadge(slot: PlannerUISlot): { label: string; className: string; compactClassName: string } | null {
  if (!slot.isSaved) return null;
  const hasBaseContent = Boolean(slot.title?.trim() || slot.themeKeyword || slot.themes?.[0]);
  const hasScriptDraft = Boolean(slot.scriptShort?.trim());
  if (!hasBaseContent && !hasScriptDraft) return null;
  if (hasScriptDraft) {
    return {
      label: 'Já em roteiro',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      compactClassName: 'border-emerald-200/90 bg-emerald-50/88 text-emerald-700',
    };
  }
  return {
    label: 'Em roteiro',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
    compactClassName: 'border-sky-200/90 bg-sky-50/88 text-sky-700',
  };
}

function getCompactStatusLabel(label: string): string {
  if (label === 'Bom desempenho') return 'Bom';
  if (label === 'Em observação') return 'Observação';
  if (label === 'Planejado') return 'Planej.';
  return label;
}

export interface ContentPlannerCalendarProps {
  userId?: string;
  slots: PlannerUISlot[] | null;
  heatmap: CalendarHeatPoint[] | null;
  loading: boolean;
  error: string | null;
  compactView?: boolean;
  publicMode?: boolean;
  canEdit: boolean;
  locked: boolean;
  lockedReason?: string | null;
  isBillingLoading?: boolean;
  onRequestSubscribe?: () => void;
  onOpenSlot: (slot: PlannerUISlot) => void;
  onCreateSlot?: (dayOfWeek: number, blockStartHour: number) => void;
  onDeleteSlot?: (slot: PlannerUISlot) => void;
  onGenerateThemes?: (slot: PlannerUISlot) => Promise<{ themes: string[]; keyword?: string }>;
  onSelectTheme?: (slot: PlannerUISlot, theme: string, themes: string[], keyword?: string) => Promise<PlannerUISlot>;
  onOpenSavedScript?: () => void;
}


export const ContentPlannerCalendar: React.FC<ContentPlannerCalendarProps> = ({
  userId,
  slots,
  heatmap,
  loading,
  error,
  compactView = false,
  publicMode = false,
  canEdit,
  locked,
  lockedReason,
  isBillingLoading,
  onRequestSubscribe,
  onOpenSlot,
  onDeleteSlot,
  onGenerateThemes,
  onSelectTheme,
  onOpenSavedScript,
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
        const title = resolveSlotTitle(slot);
        const formatLabel = formatSlotFormat(slot.format);
        const expectedMetrics = slot.expectedMetrics ?? {};
        const viewsP50 = formatViews(expectedMetrics.viewsP50) ?? '—';
        const contextLabels = getCachedLabels(labelsCache, slot.categories?.context, 'context');

        if (compactView) {
          baseFields = {
            cardId,
            title,
            formatLabel,
            viewsP50,
            intentLabel: '—',
            narrativeLabel: '—',
            contextLabel: joinPlannerCardLabels(contextLabels),
            focusDetailLabel: 'Camada extra',
            focusDetailValue: '—',
            metaChips: [],
          };

          baseCache.set(slot, baseFields);
        } else {
          void getCachedLabels(labelsCache, slot.categories?.proposal, 'proposal');
          void getCachedLabels(labelsCache, slot.categories?.tone ? [slot.categories.tone] : undefined, 'tone');
          void getCachedLabels(labelsCache, slot.categories?.reference, 'reference');
          const presentation = getPlannerSlotPresentation(slot);

          baseFields = {
            cardId,
            title,
            formatLabel: presentation.formatLabel !== '—' ? presentation.formatLabel : formatLabel,
            viewsP50,
            intentLabel: presentation.intentLabel,
            narrativeLabel: presentation.narrativeLabel,
            contextLabel: presentation.contextLabel,
            focusDetailLabel: presentation.focusDetailLabel,
            focusDetailValue: presentation.focusDetailValue,
            metaChips: presentation.metaChips,
          };

          baseCache.set(slot, baseFields);
        }
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
        intentLabel: baseFields.intentLabel,
        narrativeLabel: baseFields.narrativeLabel,
        contextLabel: baseFields.contextLabel,
        focusDetailLabel: baseFields.focusDetailLabel,
        focusDetailValue: baseFields.focusDetailValue,
        metaChips: baseFields.metaChips,
      } as PlannerSlotCard;

      nextCache.set(baseFields.cardId, { slotRef: slot, heatScore, card });
      return card;
    });

    slotCardCacheRef.current = nextCache;
    return cards;
  }, [compactView, sortedSlots, heatMapMap]);
  const hasSlotCards = slotCards.length > 0;

  if (!publicMode && locked && !isBillingLoading) {
    return (
      <div className="rounded-[1.4rem] border border-zinc-100/90 bg-white p-6 text-center">
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
          className="mt-4 inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
        >
          Conferir planos
        </button>
      </div>
    );
  }

  if (!publicMode && locked && isBillingLoading) {
    return (
      <div className="rounded-[1.4rem] border border-zinc-100/90 bg-white p-6 text-center text-sm text-gray-500">
        Carregando status da sua assinatura…
      </div>
    );
  }

  return (
    <section className="space-y-3.5 sm:space-y-5">
      {!compactView ? (
        <div className="border-t border-zinc-100/80 pt-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] bg-sky-50 text-sky-500 ring-1 ring-sky-100/90">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="dashboard-type-section-title text-zinc-950">Calendário da semana</p>
              <p className="dashboard-type-meta mt-1 text-zinc-500">
                Escolha um horário e transforme a ideia em roteiro.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {loading && !hasSlotCards ? <PlannerLoadingState /> : null}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {hasSlotCards ? (
        <PlannerSlotCardGrid
          cards={slotCards}
          compactView={compactView}
          canEdit={canEdit}
          onOpenSlot={handleOpenSlot}
          onRequestSubscribe={canRequestSubscribe ? handleRequestSubscribe : undefined}
          userId={userId}
          publicMode={publicMode}
          locked={locked}
          onDeleteSlot={canDeleteSlot ? handleDeleteSlot : undefined}
          onGenerateThemes={onGenerateThemes}
          onSelectTheme={onSelectTheme}
          onOpenSavedScript={onOpenSavedScript}
        />
      ) : !loading ? (
        <PlannerEmptyState
          onRequestSubscribe={canRequestSubscribe ? handleRequestSubscribe : undefined}
          loading={loading}
        />
      ) : null}

      {!publicMode && !canEdit && (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">Assine para editar e gerar roteiros com IA</div>
            <div className="text-sm">
              Seu plano atual não permite edição. Você ainda pode visualizar horários ideais e recomendações.
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestSubscribe}
            className="w-full rounded-md bg-pink-600 px-4 py-2 text-sm text-white transition hover:bg-pink-700 sm:ml-3 sm:w-auto"
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
  intentLabel: string;
  narrativeLabel: string;
  contextLabel: string;
  focusDetailLabel: string;
  focusDetailValue: string;
  metaChips: PlannerSlotMetaChip[];
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
  compactView?: boolean;
  canEdit: boolean;
  onOpenSlot: (slot: PlannerUISlot) => void;
  onRequestSubscribe?: () => void;
  userId?: string;
  publicMode?: boolean;
  locked?: boolean;
  onDeleteSlot?: (slot: PlannerUISlot) => void;
  onGenerateThemes?: (slot: PlannerUISlot) => Promise<{ themes: string[]; keyword?: string }>;
  onSelectTheme?: (slot: PlannerUISlot, theme: string, themes: string[], keyword?: string) => Promise<PlannerUISlot>;
  onOpenSavedScript?: () => void;
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
  compactView?: boolean;
  embedded?: boolean;
};

const SlotInspirationsContentBase = ({ slot, userId, compactView = false, embedded = false }: SlotInspirationsContentProps) => {
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
    <div className={embedded ? "space-y-1.5" : "mt-2 space-y-3 border-t border-slate-100 pt-4"}>
      {!embedded ? (
        <div className="flex items-center justify-between">
          <p className="dashboard-muted-label text-zinc-400">
            Inspirações
          </p>
        </div>
      ) : null}

      {inspError && <p className="text-[11px] text-red-600">{inspError}</p>}

      <div className={`grid gap-1.5 ${compactView ? "grid-cols-1" : "sm:grid-cols-2"}`}>
        {inspLoading && !selfInspiration && !communityInspiration && (
          <div className="col-span-2 grid gap-3 sm:grid-cols-2">
            {[0, 1].map((idx) => (
              <div
                key={`insp-skeleton-${idx}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-100/90 bg-zinc-50/76 px-3 py-2.5"
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
            className={`rounded-[1.05rem] border text-left text-[11px] text-zinc-600 transition hover:border-zinc-200 ${embedded ? "border-zinc-100/80 bg-zinc-50/58 hover:bg-white/82" : "border-zinc-100/90 bg-white hover:bg-zinc-50/50"} ${compactView ? "px-2.5 py-2.5" : "px-3 py-3"}`}
          >
            <div className="flex items-start gap-3.5">
              <div className={`relative shrink-0 overflow-hidden rounded-[0.95rem] border border-zinc-100/90 bg-white ${compactView ? "h-[78px] w-[60px]" : "h-16 w-16"}`}>
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
                  <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-zinc-400">Sem capa</div>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-3">
                  <p className={`dashboard-type-item-title leading-snug text-zinc-900 ${compactView ? "line-clamp-2" : "line-clamp-2 text-[11px]"}`}>
                    {formatInspirationCaption(selfInspiration.caption)}
                  </p>
                  <span className="dashboard-type-control inline-flex shrink-0 items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-zinc-600 ring-1 ring-zinc-100/90">
                    Ver
                    <ArrowUpRight className="h-3 w-3" />
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="dashboard-type-control inline-flex items-center rounded-full bg-rose-50/60 px-2 py-0.5 text-rose-500">
                    Acervo
                  </span>
                  {selfInspiration.views ? (
                    <span className="dashboard-type-meta text-zinc-500">{selfInspiration.views.toLocaleString('pt-BR')} views</span>
                  ) : null}
                </div>
              </div>
            </div>
          </button>
        )}

        {communityInspiration && (
          <button
            type="button"
            onClick={handleCommunityInspirationClick}
            className={`rounded-[1.05rem] border text-left text-[11px] text-zinc-600 transition hover:border-zinc-200 ${embedded ? "border-zinc-100/80 bg-zinc-50/58 hover:bg-white/82" : "border-zinc-100/90 bg-white hover:bg-zinc-50/50"} ${compactView ? "px-2.5 py-2.5" : "px-3 py-3"}`}
          >
            <div className="flex items-start gap-3.5">
              <div className={`relative shrink-0 overflow-hidden rounded-[0.95rem] border border-zinc-100/90 bg-white ${compactView ? "h-[78px] w-[60px]" : "h-16 w-16"}`}>
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
                  <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-zinc-400">Sem capa</div>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-3">
                  <p className={`dashboard-type-item-title leading-snug text-zinc-900 ${compactView ? "line-clamp-2" : "line-clamp-2 text-[11px]"}`}>
                    {formatInspirationCaption(communityInspiration.caption)}
                  </p>
                  <span className="dashboard-type-control inline-flex shrink-0 items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-zinc-600 ring-1 ring-zinc-100/90">
                    Ver
                    <ArrowUpRight className="h-3 w-3" />
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="dashboard-type-control inline-flex items-center rounded-full bg-indigo-50/60 px-2 py-0.5 text-indigo-500">
                    Comunidade
                  </span>
                  {communityInspiration.views ? (
                    <span className="dashboard-type-meta text-zinc-500">{communityInspiration.views.toLocaleString('pt-BR')} views</span>
                  ) : null}
                </div>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

const SlotInspirationsContent = React.memo(
  SlotInspirationsContentBase,
  (prev, next) => prev.slot === next.slot && prev.userId === next.userId && prev.embedded === next.embedded
);

type SlotInspirationsPanelProps = {
  canShowInspirations: boolean;
  showInspirations: boolean;
  slot: PlannerUISlot;
  userId?: string;
  compactView?: boolean;
  onToggleInspirations: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

const SlotInspirationsPanelBase = ({
  canShowInspirations,
  showInspirations,
  slot,
  userId,
  compactView = false,
  onToggleInspirations,
}: SlotInspirationsPanelProps) => {
  if (!canShowInspirations) return null;

  return (
    <>
      <div className="mt-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onToggleInspirations}
          className="inline-flex min-h-[42px] w-full items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50/82 px-3 py-2 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-white sm:w-auto"
        >
          {showInspirations ? 'Ocultar inspirações' : 'Ver inspirações'}
        </button>
      </div>

      {showInspirations ? <SlotInspirationsContent slot={slot} userId={userId} compactView={compactView} /> : null}
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
  compactView?: boolean;
  onToggleInspirations: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

const SlotCardDetailsPanelBase = ({
  card,
  userId,
  canShowInspirations,
  showInspirations,
  compactView = false,
  onToggleInspirations,
}: SlotCardDetailsPanelProps) => (
  <>
    {compactView ? (
      <div className="space-y-0 overflow-hidden rounded-[1.15rem] border border-zinc-100/90 bg-white">
        {[
          { key: 'format', icon: <LayoutTemplate className="h-3.5 w-3.5" />, label: 'Formato', value: card.formatLabel },
          { key: 'intent', icon: <Target className="h-3.5 w-3.5" />, label: 'Intenção', value: card.intentLabel },
          { key: 'context', icon: <Compass className="h-3.5 w-3.5" />, label: 'Contexto', value: card.contextLabel },
          { key: 'narrative', icon: <CalendarClock className="h-3.5 w-3.5" />, label: 'Narrativa', value: card.narrativeLabel },
          { key: 'focus', icon: <LinkIcon className="h-3.5 w-3.5" />, label: card.focusDetailLabel, value: card.focusDetailValue },
          { key: 'projection', icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Projeção', value: card.viewsP50, valueClassName: 'text-zinc-900' },
        ].map((item, index) => (
          <div key={`${card.id}-${item.key}`} className={`flex items-start justify-between gap-3 px-3 py-2.5 ${index > 0 ? 'border-t border-zinc-100/90' : ''}`}>
            <div className="flex min-w-0 items-center gap-2 text-slate-600">
              {item.icon}
              <span className="text-[9px] font-bold uppercase tracking-[0.08em]">{item.label}</span>
            </div>
            <span className={`min-w-0 text-right text-[11px] font-semibold leading-snug text-slate-800 ${item.valueClassName ?? ''}`} title={item.value}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div className="min-h-[68px] rounded-lg border border-zinc-100/90 bg-zinc-50/76 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-slate-600">
            <LayoutTemplate className="h-3.5 w-3.5" />
            <span className="text-[9px] font-bold uppercase tracking-[0.08em] sm:text-[10px]">Formato</span>
          </div>
          <span className="block truncate text-[12px] font-semibold leading-snug text-slate-800 sm:text-[13px]" title={card.formatLabel}>{card.formatLabel}</span>
        </div>
        <div className="min-h-[68px] rounded-lg border border-zinc-100/90 bg-zinc-50/76 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-slate-600">
            <Target className="h-3.5 w-3.5" />
            <span className="text-[9px] font-bold uppercase tracking-[0.08em] sm:text-[10px]">Intenção</span>
          </div>
          <span className="line-clamp-2 text-[12px] font-semibold leading-snug text-slate-800 sm:text-[13px]" title={card.intentLabel}>{card.intentLabel}</span>
        </div>
        <div className="min-h-[68px] rounded-lg border border-zinc-100/90 bg-zinc-50/76 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-slate-600">
            <Compass className="h-3.5 w-3.5" />
            <span className="text-[9px] font-bold uppercase tracking-[0.08em] sm:text-[10px]">Contexto</span>
          </div>
          <span className="line-clamp-2 text-[12px] font-semibold leading-snug text-slate-800 sm:text-[13px]" title={card.contextLabel}>{card.contextLabel}</span>
        </div>
        <div className="min-h-[68px] rounded-lg border border-zinc-100/90 bg-zinc-50/76 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-slate-600">
            <CalendarClock className="h-3.5 w-3.5" />
            <span className="text-[9px] font-bold uppercase tracking-[0.08em] sm:text-[10px]">Narrativa</span>
          </div>
          <span className="line-clamp-2 text-[12px] font-semibold leading-snug text-slate-800 sm:text-[13px]" title={card.narrativeLabel}>{card.narrativeLabel}</span>
        </div>
        <div className="min-h-[68px] rounded-lg border border-zinc-100/90 bg-zinc-50/76 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-slate-600">
            <LinkIcon className="h-3.5 w-3.5" />
            <span className="text-[9px] font-bold uppercase tracking-[0.08em] sm:text-[10px]">{card.focusDetailLabel}</span>
          </div>
          <span className="line-clamp-2 text-[12px] font-semibold leading-snug text-slate-800 sm:text-[13px]" title={card.focusDetailValue}>{card.focusDetailValue}</span>
        </div>
        <div className="min-h-[68px] rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-emerald-700">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[9px] font-bold uppercase tracking-[0.08em] sm:text-[10px]">Projeção</span>
          </div>
          <span className="text-[17px] font-bold leading-none text-emerald-700 sm:text-[19px]">{card.viewsP50}</span>
        </div>
      </div>
    )}

    {card.metaChips.length ? (
      <div className="mt-3 flex flex-wrap gap-2">
        {card.metaChips.map((chip) => (
          <span
            key={`${card.id}-${chip.key}`}
            className={`inline-flex max-w-full items-center rounded-full border border-zinc-200 bg-white/88 text-zinc-600 ${compactView ? "px-2 py-1 text-[10px]" : "px-2.5 py-1 text-[11px] font-medium"}`}
          >
            <span className="mr-1 shrink-0 text-slate-400">{chip.label}</span>
            <span className="truncate text-slate-800">{chip.value}</span>
          </span>
        ))}
      </div>
    ) : null}

    <SlotInspirationsPanel
      canShowInspirations={canShowInspirations}
      showInspirations={showInspirations}
      slot={card.slot}
      userId={userId}
      compactView={compactView}
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
  compactView = false,
  canEdit,
  onOpenSlot,
  onRequestSubscribe,
  userId,
  publicMode,
  locked,
  onDeleteSlot,
  onGenerateThemes,
  onSelectTheme,
  onOpenSavedScript,
}: ListModeSlotCardProps) => {
  const canShowInspirations = !publicMode && !locked;
  const [showInspirations, setShowInspirations] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [generatedSlotOverride, setGeneratedSlotOverride] = useState<PlannerUISlot | null>(null);
  const [themesOverride, setThemesOverride] = useState<string[] | null>(null);
  const [themeKeywordOverride, setThemeKeywordOverride] = useState<string | null>(null);
  const [isGeneratingThemes, setIsGeneratingThemes] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showSavedState, setShowSavedState] = useState(false);
  const effectiveSlot = generatedSlotOverride ?? card.slot;
  const effectiveThemes = useMemo(
    () => themesOverride ?? effectiveSlot.themes ?? [],
    [themesOverride, effectiveSlot.themes]
  );
  const effectiveKeyword = themeKeywordOverride ?? effectiveSlot.themeKeyword;
  const effectiveTitle = resolveSlotTitle(effectiveSlot);
  const scriptPreview = typeof effectiveSlot.scriptShort === 'string' && effectiveSlot.scriptShort.trim().length > 0
    ? effectiveSlot.scriptShort.trim()
    : typeof effectiveSlot.rationale === 'string' && effectiveSlot.rationale.trim().length > 0
      ? effectiveSlot.rationale.trim()
      : '';
  const hasSavedScript = Boolean(effectiveSlot.isSaved && scriptPreview);
  const shouldShowThemeBase = hasSavedScript && effectiveTitle.trim() !== scriptPreview.trim();
  const roteiroBadge = getRoteiroBadge(effectiveSlot);
  const hasSecondaryBadges = Boolean(roteiroBadge || effectiveSlot.isSaved);
  const compactStatusLabel = getCompactStatusLabel(card.statusLabel);
  const alternativeThemes = effectiveThemes
    .map((theme) => theme?.trim())
    .filter((theme): theme is string => Boolean(theme) && theme !== effectiveTitle)
    .slice(0, 4);
  const compactPrimaryLabel = effectiveSlot.isSaved
    ? 'Editar roteiro'
    : isGeneratingThemes
      ? 'Gerando...'
      : 'Gerar pautas';
  const compactExpandLabel = isExpanded
    ? 'Ocultar'
    : hasSavedScript
      ? 'Ver detalhes'
      : scriptPreview
      ? 'Ver pauta'
      : alternativeThemes.length
        ? 'Ver ideias'
        : 'Ver slot';

  const handleCardActivate = React.useCallback(() => {
    if (compactView) {
      if (canEdit) {
        setIsExpanded((prev) => !prev);
        return;
      }
      onRequestSubscribe?.();
      return;
    }
    if (canEdit) {
      onOpenSlot(effectiveSlot);
      return;
    }
    onRequestSubscribe?.();
  }, [canEdit, compactView, onOpenSlot, onRequestSubscribe, effectiveSlot]);

  const handleCardKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (!canEdit) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (compactView) {
          setIsExpanded((prev) => !prev);
          return;
        }
        onOpenSlot(effectiveSlot);
      }
    },
    [canEdit, compactView, onOpenSlot, effectiveSlot]
  );

  const handleToggleInspirations = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setShowInspirations((prev) => !prev);
  }, []);

  const handleDeleteSaved = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!onDeleteSlot) return;
      onDeleteSlot(effectiveSlot);
    },
    [onDeleteSlot, effectiveSlot]
  );

  const handleRequestSubscribeClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onRequestSubscribe?.();
    },
    [onRequestSubscribe]
  );

  useEffect(() => {
    if (!canShowInspirations) {
      setShowInspirations(false);
    }
  }, [canShowInspirations]);

  const handlePrimaryAction = React.useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!canEdit) {
        onRequestSubscribe?.();
        return;
      }
      if (!effectiveSlot.isSaved && onGenerateThemes) {
        setGenerateError(null);
        setIsGeneratingThemes(true);
        try {
          const generated = await onGenerateThemes(effectiveSlot);
          setThemesOverride(generated.themes);
          setThemeKeywordOverride(generated.keyword ?? null);
          setIsExpanded(true);
        } catch (error: any) {
          setGenerateError(error?.message || 'Não foi possível gerar pautas para este horário.');
        } finally {
          setIsGeneratingThemes(false);
        }
        return;
      }

      if (compactView && effectiveSlot.isSaved && onOpenSavedScript) {
        onOpenSavedScript();
        return;
      }
      onOpenSlot(effectiveSlot);
    },
    [canEdit, compactView, effectiveSlot, onGenerateThemes, onOpenSavedScript, onOpenSlot, onRequestSubscribe]
  );

  const handleToggleExpanded = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setIsExpanded((prev) => !prev);
    },
    []
  );

  useEffect(() => {
    setGeneratedSlotOverride(null);
    setThemesOverride(null);
    setThemeKeywordOverride(null);
    setGenerateError(null);
    setIsGeneratingThemes(false);
    setIsSavingTheme(null);
  }, [card.slot]);

  useEffect(() => {
    if (!showSavedState) return;
    const timeout = window.setTimeout(() => setShowSavedState(false), 3200);
    return () => window.clearTimeout(timeout);
  }, [showSavedState]);

  const handleSelectAlternativeTheme = React.useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>, theme: string) => {
      event.stopPropagation();
      if (!canEdit) {
        onRequestSubscribe?.();
        return;
      }
      if (!onSelectTheme) return;

      setGenerateError(null);
      setIsSavingTheme(theme);
      try {
        const saved = await onSelectTheme(effectiveSlot, theme, effectiveThemes, effectiveKeyword ?? undefined);
        setGeneratedSlotOverride(saved);
        setShowSavedState(true);
      } catch (error: any) {
        setGenerateError(error?.message || 'Não foi possível salvar esta pauta.');
      } finally {
        setIsSavingTheme(null);
      }
    },
    [canEdit, onRequestSubscribe, onSelectTheme, effectiveSlot, effectiveThemes, effectiveKeyword]
  );

  return (
    <article
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : -1}
      onClick={handleCardActivate}
      onKeyDown={handleCardKeyDown}
      className={[
        compactView
          ? 'group relative flex flex-col gap-0 border-t border-zinc-100/80 bg-transparent px-3.5 py-5 transition-all duration-200 first:border-0 hover:bg-zinc-50/40'
          : 'group relative flex flex-col gap-3 rounded-[26px] border border-zinc-100/80 bg-white/74 p-3.5 backdrop-blur-xl transition-all duration-200 hover:bg-white/84 sm:gap-3.5 sm:p-5',
        canEdit ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '365px' }}
    >
      {/* Unified Header for Compact View or regular top for non-compact */}
      {compactView ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] bg-zinc-50 text-zinc-400 ring-1 ring-zinc-100/80 transition-colors group-hover:bg-white group-hover:text-zinc-500">
              <CalendarClock className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold tracking-tight text-zinc-900">{card.dayTitle}</span>
                <span className="text-[10px] text-zinc-300" aria-hidden>•</span>
                <span className="text-[12px] font-medium text-zinc-500">{card.blockLabel}</span>
              </div>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] shadow-sm ${card.statusClass}`}>
            <span aria-hidden>{STATUS_EMOJI[card.statusCategory]}</span>
            <span>{card.statusLabel}</span>
          </span>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2 max-[360px]:gap-1.5 sm:gap-2.5 sm:pb-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-x-2 gap-y-1">
              <CalendarClock className="h-3.5 w-3.5 text-zinc-300" />
              <span className="text-[17px] font-semibold leading-tight tracking-[-0.03em] text-zinc-900 max-[360px]:text-[16px] sm:text-[20px]">
                {card.dayTitle}
              </span>
              <span className="text-zinc-300" aria-hidden>•</span>
              <span className="text-[17px] font-medium leading-tight tracking-[-0.02em] text-zinc-500 max-[360px]:text-[16px] sm:text-[20px]">
                {card.blockLabel}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8.5px] font-medium uppercase tracking-[0.08em] max-[360px]:gap-0.5 max-[360px]:px-1.5 max-[360px]:text-[8px] max-[360px]:tracking-normal sm:px-2.5 sm:text-[10px] sm:tracking-wide border-current ${card.statusClass}`}>
              <span aria-hidden className="max-[360px]:hidden">{STATUS_EMOJI[card.statusCategory]}</span>
              <span className="max-[360px]:hidden">{card.statusLabel}</span>
              <span className="hidden max-[360px]:inline">{compactStatusLabel}</span>
            </span>
          </div>
        </div>
      )}

      {hasSecondaryBadges ? (
        <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 ${compactView ? "mb-3" : "pb-1"}`}>
          {roteiroBadge ? (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${compactView ? roteiroBadge.compactClassName : roteiroBadge.className}`}
            >
              {roteiroBadge.label}
            </span>
          ) : null}
          {effectiveSlot.isSaved && !roteiroBadge && (
            <span className={`inline-flex items-center gap-1 rounded-full pl-2 pr-1 py-0.5 text-[10px] font-bold uppercase tracking-wide ${compactView ? "border border-emerald-200/90 bg-emerald-50/88 text-emerald-700" : "border border-emerald-200 bg-emerald-50/90 text-emerald-700"}`}>
              <Bookmark className="h-3 w-3" />
              Salvo em roteiro
              {onDeleteSlot && (
                <button
                  type="button"
                  onClick={handleDeleteSaved}
                  className="ml-1 rounded-full p-0.5 text-emerald-700 hover:bg-emerald-100"
                  title="Remover salvo"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          )}
        </div>
      ) : null}

      {/* Theme Section */}
      <div className={`${hasSavedScript ? "space-y-1 pb-2" : compactView ? "mb-4" : "space-y-1 pb-2 sm:space-y-1.5 sm:pb-2.5"}`}>
        {showSavedState ? (
          <div className="flex items-center justify-end gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Salva em Meus Roteiros
            </span>
          </div>
        ) : null}
        
        {compactView ? (
          <div className="flex items-start gap-3">
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-500 ring-1 ring-sky-100/80 transition-transform duration-300 group-hover:scale-110`}>
              <Target className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className={`line-clamp-2 break-words text-[16px] font-bold leading-tight tracking-tight text-zinc-900 transition-colors group-hover:text-zinc-950`}
              >
                {hasSavedScript ? scriptPreview : effectiveTitle}
              </h3>
              {shouldShowThemeBase && !hasSavedScript ? (
                <p className="dashboard-type-meta mt-0.5 line-clamp-1 text-zinc-500">
                  Tema-base: {effectiveTitle}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <h3 className="line-clamp-2 text-[17px] font-bold leading-snug text-zinc-900 transition-colors group-hover:text-zinc-950 sm:text-[18px]">
            {effectiveTitle}
          </h3>
        )}
      </div>

      {compactView ? (
        <div className="space-y-4">
          {generateError ? (
            <div className="rounded-[0.95rem] border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700">
              {generateError}
            </div>
          ) : null}
          {effectiveSlot.isSaved && scriptPreview ? (
            <div className="rounded-[0.95rem] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
              Esta pauta ficou fixa neste dia e hora e j&aacute; entrou em Meus Roteiros.
            </div>
          ) : null}

          {hasSavedScript ? (
            <div className="space-y-3">
              <p className="dashboard-type-body whitespace-pre-wrap leading-relaxed text-[13px] text-zinc-700">
                {scriptPreview}
              </p>
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="inline-flex min-h-[38px] w-full items-center justify-center rounded-[0.95rem] bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-black"
              >
                {compactPrimaryLabel}
              </button>
            </div>
          ) : alternativeThemes.length > 0 ? (
            <div className="space-y-4">
              <div className="-mx-3.5 -mt-1 flex flex-col pt-1">
                {alternativeThemes.map((theme, index) => {
                  const numberLabel = String(index + 1).padStart(2, "0");
                  return (
                    <button
                      type="button"
                      key={`${card.id}-${theme}`}
                      onClick={(event) => void handleSelectAlternativeTheme(event, theme)}
                      disabled={Boolean(isSavingTheme)}
                      className={`group/item relative flex w-full items-start gap-3.5 border-t border-zinc-100/50 px-3.5 py-3 text-left transition first:border-0 hover:bg-zinc-50/80 ${
                        isSavingTheme === theme ? "bg-emerald-50/50" : ""
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[0.55rem] text-[9.5px] font-bold tracking-wide transition-colors ${
                          isSavingTheme === theme
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-sky-50 text-sky-600 group-hover/item:bg-sky-100/80"
                        }`}
                      >
                        {numberLabel}
                      </span>
                      <div className="min-w-0 flex-1 pr-2">
                        <span
                          className={`line-clamp-2 text-[13px] leading-[1.4] transition-colors ${
                            isSavingTheme === theme
                              ? "font-semibold text-emerald-800"
                              : "font-medium text-zinc-700 group-hover/item:text-zinc-950"
                          }`}
                        >
                          {theme}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
                          isSavingTheme === theme
                            ? "text-emerald-600"
                            : "text-zinc-400 group-hover/item:text-sky-600"
                        }`}
                      >
                        {isSavingTheme === theme ? "Salvando..." : "USAR"}
                      </span>
                    </button>
                  );
                })}
              </div>
              
              <div className="flex justify-center p-1">
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  disabled={isGeneratingThemes}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-5 text-[12px] font-bold text-zinc-500 transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-70"
                >
                  <Sparkles className={`h-3.5 w-3.5 text-sky-400 ${isGeneratingThemes ? 'animate-spin' : ''}`} />
                  {isGeneratingThemes ? 'Gerando...' : 'Novas Ideias'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 rounded-[1.25rem] border border-dashed border-zinc-200/80 bg-zinc-50/20 p-6 text-center transition-colors group-hover:bg-white/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-[13px] leading-relaxed text-zinc-500">
                Sem ideias para este horário? <br/>Gere pautas alinhadas ao seu objetivo.
              </p>
              <button
                type="button"
                onClick={handlePrimaryAction}
                disabled={isGeneratingThemes}
                className="inline-flex min-h-[38px] w-full items-center justify-center rounded-[0.95rem] bg-zinc-950 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-70"
              >
                {isGeneratingThemes ? 'Gerando...' : 'Gerar Pautas'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <SlotCardDetailsPanel
          card={card}
          userId={userId}
          canShowInspirations={canShowInspirations}
          showInspirations={showInspirations}
          compactView={compactView}
          onToggleInspirations={handleToggleInspirations}
        />
      )}

      {!canEdit && onRequestSubscribe && (
        <button
          type="button"
          onClick={handleRequestSubscribeClick}
          className="mt-2 text-xs font-semibold text-zinc-600 underline underline-offset-2"
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
    prev.onGenerateThemes === next.onGenerateThemes &&
    prev.onSelectTheme === next.onSelectTheme &&
    prev.onOpenSavedScript === next.onOpenSavedScript
);

type PlannerSlotCardGridProps = {
  cards: PlannerSlotCard[];
  compactView?: boolean;
  canEdit: boolean;
  onOpenSlot: (slot: PlannerUISlot) => void;
  onRequestSubscribe?: () => void;
  userId?: string;
  publicMode?: boolean;
  locked?: boolean;
  onDeleteSlot?: (slot: PlannerUISlot) => void;
  onGenerateThemes?: (slot: PlannerUISlot) => Promise<{ themes: string[]; keyword?: string }>;
  onSelectTheme?: (slot: PlannerUISlot, theme: string, themes: string[], keyword?: string) => Promise<PlannerUISlot>;
  onOpenSavedScript?: () => void;
};

const PlannerSlotCardGridBase = ({
  cards,
  compactView = false,
  canEdit,
  onOpenSlot,
  onRequestSubscribe,
  userId,
  publicMode,
  locked,
  onDeleteSlot,
  onGenerateThemes,
  onSelectTheme,
  onOpenSavedScript,
}: PlannerSlotCardGridProps) => {
  const batchSize = compactView ? CARD_BATCH_SIZE_COMPACT : CARD_BATCH_SIZE_DESKTOP;
  const rootMargin = compactView ? '320px 0px' : '800px 0px';
  const [visibleCount, setVisibleCount] = useState(() => Math.min(cards.length, batchSize));
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount((previousVisible) => {
      if (!cards.length) return 0;
      const minimumVisible = Math.min(cards.length, batchSize);
      const clampedVisible = Math.min(previousVisible, cards.length);
      return Math.max(clampedVisible, minimumVisible);
    });
  }, [batchSize, cards.length]);

  const hasMoreCards = visibleCount < cards.length;

  useEffect(() => {
    if (!hasMoreCards) return;
    const node = loadMoreRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisibleCount((previousVisible) => Math.min(cards.length, previousVisible + batchSize));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const reachedViewport = entries.some((entry) => entry.isIntersecting);
        if (!reachedViewport) return;
        observer.disconnect();
        setVisibleCount((previousVisible) => Math.min(cards.length, previousVisible + batchSize));
      },
      { rootMargin, threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [batchSize, cards.length, hasMoreCards, rootMargin, visibleCount]);

  const visibleCards = useMemo(
    () => cards.slice(0, visibleCount),
    [cards, visibleCount]
  );

  if (!visibleCards.length) return null;
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:gap-4">
      {visibleCards.map((card) => (
        <ListModeSlotCard
          key={card.id}
          card={card}
          compactView={compactView}
          canEdit={canEdit}
          onOpenSlot={onOpenSlot}
          onRequestSubscribe={onRequestSubscribe}
          userId={userId}
          publicMode={publicMode}
          locked={locked}
          onDeleteSlot={onDeleteSlot}
          onGenerateThemes={onGenerateThemes}
          onSelectTheme={onSelectTheme}
          onOpenSavedScript={onOpenSavedScript}
        />
      ))}
      {hasMoreCards ? (
        <div
          ref={loadMoreRef}
          className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-500 xl:col-span-2"
        >
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
    prev.onDeleteSlot === next.onDeleteSlot &&
    prev.onGenerateThemes === next.onGenerateThemes &&
    prev.onSelectTheme === next.onSelectTheme &&
    prev.onOpenSavedScript === next.onOpenSavedScript
);

const PlannerLoadingState = () => (
  <div className="dashboard-section-panel rounded-2xl p-3.5 sm:p-5">
    <div className="mb-4 flex items-center gap-2">
      <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" aria-hidden />
      <p className="text-sm font-semibold text-slate-700">Carregando seu calendário...</p>
    </div>
    <div className="grid grid-cols-1 gap-3.5 sm:gap-4">
      {[1, 2, 3, 4].map((row) => (
        <div
          key={`planner-loading-${row}`}
          className={[
            'animate-pulse dashboard-section-panel rounded-2xl p-3.5 sm:p-5',
            row > 2 ? 'hidden xl:block' : '',
          ].join(' ')}
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="h-12 w-52 rounded-xl bg-slate-100" />
            <div className="h-5 w-24 rounded-full bg-slate-100" />
          </div>
          <div className="mb-3 space-y-2 border-b border-slate-100 pb-3">
            <div className="h-3 w-10 rounded-full bg-slate-200" />
            <div className="h-9 w-full rounded-xl bg-slate-100" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`planner-loading-meta-${row}-${index}`} className="rounded-lg border border-zinc-100/90 bg-zinc-50/76 px-3 py-2">
                <div className="mb-2 h-2.5 w-16 rounded-full bg-slate-200" />
                <div className="h-3 w-full rounded-full bg-slate-200/90" />
              </div>
            ))}
          </div>
        </div>
      ))}
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
  <div className="dashboard-section-panel rounded-2xl border-dashed px-4 py-5 sm:px-6 sm:py-6">
    <p className="text-base font-semibold leading-tight text-slate-900 sm:text-lg">Prepare o terreno para novas pautas</p>
    <ol className="mt-2.5 space-y-2 text-[13px] leading-5 text-slate-600 sm:mt-3 sm:space-y-2.5 sm:text-sm sm:leading-6">
      {[
        'Confirme se o Instagram está conectado e liberado para IA',
        'Escolha um tema ou objetivo semanal na tela de edição',
        'Peça novas pautas e ajuste horários favoritos',
      ].map((step, index) => (
        <li key={step} className="flex gap-2.5 sm:gap-3">
          <span className="text-xs font-semibold text-slate-400">0{index + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
    {onRequestSubscribe && !loading && (
      <button
        type="button"
        onClick={onRequestSubscribe}
        className="dashboard-secondary-button mt-4 inline-flex w-full items-center justify-center gap-2 px-3.5 py-2 text-sm font-semibold text-zinc-700 sm:w-auto"
      >
        Liberar planner completo
      </button>
    )}
  </div>
);

export default ContentPlannerCalendar;
