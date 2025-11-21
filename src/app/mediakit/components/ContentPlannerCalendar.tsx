"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Clock, Layers, Lock, Sparkles, Target, Wand2 } from 'lucide-react';
import { PlannerUISlot } from '@/hooks/usePlannerData';
import { idsToLabels } from '@/app/lib/classification';
import { prefillInspirationCache } from '../utils/inspirationCache';

const BLOCKS = [9, 12, 15, 18] as const;
const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']; // 1..7
const DAYS_FULL_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
type StatusCategory = 'champion' | 'test' | 'watch' | 'planned';
const TARGET_SLOTS_PER_WEEK = 7;

type SummaryTileProps = {
  label: string;
  value: string;
  helper?: string;
};

function SummaryTile({ label, value, helper }: SummaryTileProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {helper && <p className="mt-0.5 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

export interface CalendarHeatPoint {
  dayOfWeek: number;
  blockStartHour: number;
  score: number;
}

function dayLabel(dayOfWeek: number) {
  if (dayOfWeek === 7) return DAYS_PT[0];
  return DAYS_PT[dayOfWeek];
}

function dayFullLabel(dayOfWeek: number): string {
  const fallbackLabel = DAYS_FULL_PT[0] ?? 'Domingo';
  if (dayOfWeek === 7) return fallbackLabel;
  const label = DAYS_FULL_PT[dayOfWeek];
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

function formatCompactNumber(value?: number) {
  if (typeof value !== 'number' || !isFinite(value) || value < 0) return null;
  try {
    return value.toLocaleString('pt-BR', {
      notation: 'compact',
      maximumFractionDigits: 1,
    });
  } catch {
    return String(value);
  }
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

interface PlannerBlockSummary {
  blockStartHour: number;
  items: PlannerUISlot[];
  heatScore?: number;
}

interface PlannerDaySummary {
  day: number;
  blocks: PlannerBlockSummary[];
  totalSlots: number;
  bestHeatBlock: { score: number; blockStartHour: number | null };
  bestViewsSlot: { value: number; slot: PlannerUISlot | null };
}

type BestViewsOverview = {
  dayOfWeek: number;
  blockStartHour: number;
  value: number;
};

type InspirationPost = {
  id: string;
  caption: string;
  views: number;
  date: string;
  thumbnailUrl?: string | null;
  postLink?: string | null;
};

type CommunityInspirationPost = {
  id: string;
  caption: string;
  views: number;
  date: string;
  coverUrl?: string | null;
  postLink?: string | null;
  reason?: string[];
};

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
  onCreateSlot: (dayOfWeek: number, blockStartHour: number) => void;
}

import PlannerDayPicker from './PlannerDayPicker';
import PlannerDailySchedule from './PlannerDailySchedule';

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
  onCreateSlot,
}) => {
  const [viewMode, setViewMode] = React.useState<'list' | 'calendar'>('calendar');
  const [selectedDay, setSelectedDay] = React.useState<number>(() => {
    const today = new Date().getDay() + 1; // 1=Sun, 7=Sat
    return today;
  });
  const [inspirationPosts, setInspirationPosts] = useState<InspirationPost[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityInspirationPost[]>([]);
  const [inspirationLoading, setInspirationLoading] = useState(false);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [inspirationError, setInspirationError] = useState<string | null>(null);
  const [communityError, setCommunityError] = useState<string | null>(null);

  const slotsMap = useMemo(() => {
    const map = new Map<string, PlannerUISlot[]>();
    (slots || []).forEach((slot) => {
      const key = keyFor(slot.dayOfWeek, slot.blockStartHour);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    });
    return map;
  }, [slots]);

  const slotsByDay = useMemo(() => {
    const map = new Map<number, PlannerUISlot[]>();
    (slots || []).forEach((slot) => {
      const list = map.get(slot.dayOfWeek) || [];
      list.push(slot);
      map.set(slot.dayOfWeek, list);
    });
    return map;
  }, [slots]);

  const heatMapMap = useMemo(() => {
    const map = new Map<string, number>();
    (heatmap || []).forEach((point) => {
      map.set(keyFor(point.dayOfWeek, point.blockStartHour), point.score);
    });
    return map;
  }, [heatmap]);

  const daySummaries = useMemo<PlannerDaySummary[]>(() => {
    return DAYS.map((day) => {
      const blocks: PlannerBlockSummary[] = BLOCKS.map((blockStartHour) => {
        const key = keyFor(day, blockStartHour);
        const items = slotsMap.get(key) || [];
        const heatScore = heatMapMap.get(key);
        return { blockStartHour, items, heatScore };
      });

      const totalSlots = blocks.reduce((sum, block) => sum + block.items.length, 0);
      const allSlots = blocks.flatMap((block) => block.items);
      const bestHeatBlock = blocks.reduce(
        (acc, block) => {
          if (typeof block.heatScore === 'number' && block.heatScore > acc.score) {
            return { score: block.heatScore, blockStartHour: block.blockStartHour };
          }
          return acc;
        },
        { score: -1, blockStartHour: null as number | null }
      );
      const bestViewsSlot = allSlots.reduce(
        (acc, slot) => {
          const value = slot.expectedMetrics?.viewsP50 ?? -1;
          if (value > acc.value) return { value, slot };
          return acc;
        },
        { value: -1, slot: null as PlannerUISlot | null }
      );
      return { day, blocks, totalSlots, bestHeatBlock, bestViewsSlot };
    });
  }, [slotsMap, heatMapMap]);

  const overview = useMemo(() => {
    const counts = new Map<number, number>();
    const themeCounter = new Map<string, number>();
    let bestViewsSlot: BestViewsOverview | null = null;

    (slots || []).forEach((slot) => {
      counts.set(slot.dayOfWeek, (counts.get(slot.dayOfWeek) ?? 0) + 1);
      const themeKey =
        (slot.themeKeyword && slot.themeKeyword.trim().length > 0
          ? slot.themeKeyword.trim()
          : (slot.themes && slot.themes[0]) || ''
        ) || '';
      if (themeKey) {
        const normalized = themeKey.replace(/\s+/g, ' ').trim();
        if (normalized) {
          themeCounter.set(normalized, (themeCounter.get(normalized) ?? 0) + 1);
        }
      }

      const p50 = slot.expectedMetrics?.viewsP50;
      if (typeof p50 === 'number' && p50 > 0) {
        if (!bestViewsSlot || p50 > bestViewsSlot.value) {
          bestViewsSlot = {
            dayOfWeek: slot.dayOfWeek,
            blockStartHour: slot.blockStartHour,
            value: p50,
          };
        }
      }
    });

    const countsArray = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
      day,
      count: counts.get(day) ?? 0,
    }));

    let bestBlockEntry: { dayOfWeek: number; blockStartHour: number } | null = null;
    if (heatmap && heatmap.length > 0) {
      const bestHeat = heatmap.reduce((top, current) => {
        if (!top || current.score > top.score) return current;
        return top;
      }, heatmap[0]!);
      bestBlockEntry = { dayOfWeek: bestHeat.dayOfWeek, blockStartHour: bestHeat.blockStartHour };
    } else if (bestViewsSlot !== null) {
      const { dayOfWeek, blockStartHour } = bestViewsSlot;
      bestBlockEntry = {
        dayOfWeek,
        blockStartHour,
      };
    }

    let topTheme: string | null = null;
    if (themeCounter.size) {
      topTheme = Array.from(themeCounter.entries())
        .sort((a, b) => {
          if (b[1] === a[1]) return a[0].localeCompare(b[0]);
          return b[1] - a[1];
        })[0]?.[0] ?? null;
    }

    const activeDays = countsArray.reduce((sum, { count }) => (count > 0 ? sum + 1 : sum), 0);

    return {
      counts: countsArray,
      total: slots?.length ?? 0,
      topTheme,
      bestBlock: bestBlockEntry,
      activeDays,
    };
  }, [slots, heatmap]);

  const relevantDaySummaries = useMemo(
    () => daySummaries.filter((summary) => summary.totalSlots > 0),
    [daySummaries]
  );
  const defaultCreateTarget = useMemo(() => {
    const first = relevantDaySummaries[0];
    if (first) {
      const blockStart = first.bestHeatBlock.blockStartHour ?? BLOCKS[1] ?? BLOCKS[0];
      return { day: first.day, blockStartHour: blockStart };
    }
    return { day: 1, blockStartHour: BLOCKS[1] ?? BLOCKS[0] };
  }, [relevantDaySummaries]);

  const slotCards = useMemo(() => {
    if (!slots || !slots.length) return [] as PlannerSlotCard[];
    const list = [...slots].sort((a, b) => {
      if (a.dayOfWeek === b.dayOfWeek) {
        return a.blockStartHour - b.blockStartHour;
      }
      return a.dayOfWeek - b.dayOfWeek;
    });

    return list.map((slot) => {
      const key = keyFor(slot.dayOfWeek, slot.blockStartHour);
      const heatScore = heatMapMap.get(key);
      const statusInfo = getStatusInfo(heatScore, slot);
      const title =
        slot.title?.trim() || slot.themeKeyword || slot.themes?.[0] || 'Sugestão pronta do Mobi';
      const formatLabel = formatSlotFormat(slot.format);
      const contextLabels = idsToLabels(slot.categories?.context, 'context');
      const objectiveLabel = contextLabels[0] || slot.themeKeyword || slot.themes?.[1] || 'Contexto livre';
      const channelLabel = slot.categories?.reference?.[0] || null;
      const expectedMetrics = slot.expectedMetrics ?? {};

      const viewsP50 = formatViews(expectedMetrics.viewsP50) ?? '—';
      const viewsP90 = expectedMetrics.viewsP90 ? formatViews(expectedMetrics.viewsP90) : null;
      const metricRange = viewsP90 ? `${viewsP50}–${viewsP90}` : viewsP50;

      return {
        id: slot.slotId ?? `${slot.dayOfWeek}-${slot.blockStartHour}-${title}`,
        dayTitle: dayFullLabel(slot.dayOfWeek),
        blockLabel: blockLabel(slot.blockStartHour),
        title,
        formatLabel,
        objectiveLabel,
        channelLabel,
        viewsP50,
        viewsP90,
        metricRange,
        statusLabel: statusInfo.label,
        statusCategory: statusInfo.category,
        statusClass: statusInfo.metaClass,
        slot,
      } as PlannerSlotCard;
    });
  }, [slots, heatMapMap]);

  const completedSlots = useMemo(() => (slots || []).filter((slot) => slot.status === 'posted').length, [slots]);
  const remainingSlots = Math.max(0, TARGET_SLOTS_PER_WEEK - (overview.total ?? 0));
  const bestBlockLabel = useMemo(() => {
    if (!overview.bestBlock || typeof overview.bestBlock.blockStartHour !== 'number') return null;
    const dayName = dayFullLabel(overview.bestBlock.dayOfWeek).replace('-feira', '');
    const blockRange = blockLabel(overview.bestBlock.blockStartHour);
    return `${dayName} • ${blockRange}`;
  }, [overview]);
  const topThemeLabel = overview.topTheme ?? null;
  const summaryTiles = useMemo(
    () =>
      [
        {
          key: 'total',
          label: 'Pautas sugeridas',
          value: String(overview.total ?? 0),
          helper: `${completedSlots} concluídas`,
        },
        {
          key: 'remaining',
          label: 'Slots restantes',
          value: String(remainingSlots),
          helper: `Meta ${TARGET_SLOTS_PER_WEEK}/semana`,
        },
        {
          key: 'days',
          label: 'Dias com pauta',
          value: String(overview.activeDays ?? 0),
          helper: 'Dos 7 dias da semana',
        },
        topThemeLabel
          ? {
            key: 'theme',
            label: 'Tema em alta',
            value: topThemeLabel,
            helper: 'Repetiu mais vezes nos slots',
          }
          : null,
        bestBlockLabel
          ? {
            key: 'block',
            label: 'Próximo slot quente',
            value: bestBlockLabel,
            helper: 'Janela com maior probabilidade',
          }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string; helper?: string }>,
    [overview, completedSlots, remainingSlots, topThemeLabel, bestBlockLabel]
  );
  const inspirationSeed = useMemo(() => {
    if (!slots || !slots.length) return null;
    const daySlots = slots.filter((slot) => slot.dayOfWeek === selectedDay);
    const pool = daySlots.length ? daySlots : slots;
    const withTheme = pool.find(
      (slot) =>
        (slot.themeKeyword && slot.themeKeyword.trim()) ||
        (slot.themes && slot.themes.length > 0)
    );
    if (withTheme) return withTheme;
    const sorted = [...pool].sort(
      (a, b) => (b.expectedMetrics?.viewsP50 ?? 0) - (a.expectedMetrics?.viewsP50 ?? 0)
    );
    return sorted[0] ?? pool[0] ?? null;
  }, [slots, selectedDay]);
  const inspirationTheme = useMemo(() => {
    const rawTheme =
      (inspirationSeed?.themeKeyword && inspirationSeed.themeKeyword.trim()) ||
      (inspirationSeed?.themes && inspirationSeed.themes[0]) ||
      '';
    if (rawTheme) return rawTheme;
    return overview.topTheme ?? '';
  }, [inspirationSeed, overview.topTheme]);
  const inspirationSummary = useMemo(() => {
    if (!inspirationSeed) return null;
    const dayName = dayFullLabel(inspirationSeed.dayOfWeek).replace('-feira', '');
    const blockRange = blockLabel(inspirationSeed.blockStartHour);
    const formatLabel = formatSlotFormat(inspirationSeed.format);
    return `${dayName} • ${blockRange} • ${formatLabel}`;
  }, [inspirationSeed]);
  const inspirationContextLabels = useMemo(
    () => idsToLabels(inspirationSeed?.categories?.context, 'context'),
    [inspirationSeed?.categories?.context]
  );
  const inspirationProposalLabels = useMemo(
    () => idsToLabels(inspirationSeed?.categories?.proposal, 'proposal'),
    [inspirationSeed?.categories?.proposal]
  );
  const inspirationKey = useMemo(
    () =>
      inspirationSeed
        ? `${inspirationSeed.dayOfWeek}-${inspirationSeed.blockStartHour}-${inspirationTheme}`
        : null,
    [inspirationSeed, inspirationTheme]
  );
  const shouldLoadInspirations =
    Boolean(userId) && Boolean(inspirationSeed) && !publicMode && !locked;

  const loadInspirationPosts = useCallback(async () => {
    if (!inspirationSeed || !userId || publicMode || locked) return;
    setInspirationLoading(true);
    setInspirationError(null);
    try {
      const res = await fetch('/api/planner/inspirations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          dayOfWeek: inspirationSeed.dayOfWeek,
          blockStartHour: inspirationSeed.blockStartHour,
          categories: inspirationSeed.categories || {},
          limit: 8,
        }),
      });
      if (!res.ok) throw new Error('Falha ao buscar inspirações pessoais');
      const data = await res.json();
      const arr = Array.isArray(data?.posts) ? data.posts : [];
      setInspirationPosts(
        arr.map((p: any) => ({
          id: String(p.id),
          caption: String(p.caption || ''),
          views: Number(p.views || 0),
          date: String(p.date || ''),
          thumbnailUrl: p.thumbnailUrl || null,
          postLink: p.postLink || null,
        }))
      );
    } catch (err: any) {
      setInspirationError(err?.message || 'Erro ao carregar conteúdos');
    } finally {
      setInspirationLoading(false);
    }
  }, [inspirationSeed, locked, publicMode, userId]);

  const loadCommunityPosts = useCallback(async () => {
    if (!inspirationSeed || !userId || publicMode || locked) return;
    setCommunityLoading(true);
    setCommunityError(null);
    try {
      const res = await fetch('/api/planner/inspirations/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          categories: inspirationSeed.categories || {},
          script: typeof inspirationSeed.rationale === 'string'
            ? inspirationSeed.rationale
            : inspirationSeed.scriptShort || '',
          themeKeyword: inspirationTheme || undefined,
          limit: 10,
        }),
      });
      if (!res.ok) throw new Error('Falha ao buscar inspirações da comunidade');
      const data = await res.json();
      const arr = Array.isArray(data?.posts) ? data.posts : [];
      setCommunityPosts(
        arr.map((p: any) => ({
          id: String(p.id),
          caption: String(p.caption || ''),
          views: Number(p.views || 0),
          date: String(p.date || ''),
          coverUrl: p.coverUrl || null,
          postLink: p.postLink || null,
          reason: Array.isArray(p.reason) ? p.reason : [],
        }))
      );
    } catch (err: any) {
      setCommunityError(err?.message || 'Erro ao carregar comunidade');
    } finally {
      setCommunityLoading(false);
    }
  }, [inspirationSeed, inspirationTheme, locked, publicMode, userId]);

  useEffect(() => {
    if (!shouldLoadInspirations) {
      setInspirationPosts([]);
      setCommunityPosts([]);
      setInspirationError(null);
      setCommunityError(null);
      setInspirationLoading(false);
      setCommunityLoading(false);
      return;
    }
    void loadInspirationPosts();
    void loadCommunityPosts();
  }, [shouldLoadInspirations, inspirationKey, loadInspirationPosts, loadCommunityPosts]);

  useEffect(() => {
    if (!inspirationSeed || inspirationLoading || communityLoading) return;

    const firstSelf = inspirationPosts[0];
    const firstCommunity = communityPosts[0];

    prefillInspirationCache(inspirationSeed, {
      self: firstSelf ? {
        id: firstSelf.id,
        caption: firstSelf.caption,
        views: firstSelf.views,
        thumbnailUrl: firstSelf.thumbnailUrl,
        postLink: firstSelf.postLink
      } : null,
      community: firstCommunity ? {
        id: firstCommunity.id,
        caption: firstCommunity.caption,
        views: firstCommunity.views,
        coverUrl: firstCommunity.coverUrl,
        postLink: firstCommunity.postLink
      } : null
    });
  }, [inspirationSeed, inspirationPosts, communityPosts, inspirationLoading, communityLoading]);

  const showLoadingBanner = loading;

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
          onClick={onRequestSubscribe}
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
    <section className="rounded-3xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6 space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Planejamento Semanal</h2>
          <p className="text-sm text-slate-500">
            {remainingSlots > 0 ? `${remainingSlots} slots restantes para a meta` : 'Meta semanal atingida!'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              Calendário
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              Lista
            </button>
          </div>
        </div>
      </div>
      {showLoadingBanner && <PlannerLoadingBanner />}

      {loading && <PlannerLoadingSkeleton />}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {viewMode === 'calendar' ? (
        <div className="flex flex-col gap-6">
          <PlannerDayPicker
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            slotsByDay={slotsByDay}
          />
          <PlannerDailySchedule
            dayIndex={selectedDay}
            slots={slotsByDay.get(selectedDay) || []}
            onOpenSlot={onOpenSlot}
            onCreateSlot={onCreateSlot}
            userId={userId}
            publicMode={publicMode}
            locked={locked}
          />
        </div>
      ) : (
        <>
          {slotCards.length ? (
            <>
              <PlannerSlotCardGrid
                cards={slotCards}
                canEdit={canEdit}
                onOpenSlot={onOpenSlot}
                onRequestSubscribe={onRequestSubscribe}
              />
              {!publicMode && !locked && inspirationSeed && (
                <PlannerInspirationsPanel
                  inspirationSummary={inspirationSummary}
                  inspirationTheme={inspirationTheme}
                  contextLabels={inspirationContextLabels}
                  proposalLabels={inspirationProposalLabels}
                  inspirationPosts={inspirationPosts}
                  communityPosts={communityPosts}
                  inspirationLoading={inspirationLoading}
                  communityLoading={communityLoading}
                  inspirationError={inspirationError}
                  communityError={communityError}
                  onRefreshInspiration={loadInspirationPosts}
                  onRefreshCommunity={loadCommunityPosts}
                />
              )}
            </>
          ) : (
            <PlannerEmptyState onRequestSubscribe={onRequestSubscribe} loading={loading} />
          )}
        </>
      )}

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
            onClick={onRequestSubscribe}
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

const PlannerInspirationsPanel = ({
  inspirationSummary,
  inspirationTheme,
  contextLabels,
  proposalLabels,
  inspirationPosts,
  communityPosts,
  inspirationLoading,
  communityLoading,
  inspirationError,
  communityError,
  onRefreshInspiration,
  onRefreshCommunity,
}: {
  inspirationSummary: string | null;
  inspirationTheme: string;
  contextLabels: string[];
  proposalLabels: string[];
  inspirationPosts: InspirationPost[];
  communityPosts: CommunityInspirationPost[];
  inspirationLoading: boolean;
  communityLoading: boolean;
  inspirationError: string | null;
  communityError: string | null;
  onRefreshInspiration: () => void;
  onRefreshCommunity: () => void;
}) => {
  const helperPieces = [
    inspirationTheme ? `Tema: ${inspirationTheme}` : null,
    contextLabels.length ? `Contexto: ${contextLabels.slice(0, 2).join(' • ')}` : null,
    proposalLabels.length ? `Objetivo: ${proposalLabels.slice(0, 2).join(' • ')}` : null,
  ].filter((piece): piece is string => Boolean(piece));

  return (
    <div className="space-y-3 border-t border-slate-200 pt-4">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
          Inspirações alinhadas a estas pautas
        </p>
        {inspirationSummary && (
          <p className="text-sm font-semibold text-slate-900">{inspirationSummary}</p>
        )}
        {helperPieces.length > 0 && (
          <p className="text-[13px] text-slate-600">
            {helperPieces.join(' · ')}
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <CompactInspirationList
          title="Do seu histórico"
          subtitle="Recortes seus com mesmo tema/horário"
          posts={inspirationPosts}
          loading={inspirationLoading}
          error={inspirationError}
          onRefresh={onRefreshInspiration}
          kind="self"
        />
        <CompactInspirationList
          title="Da comunidade"
          subtitle="Posts externos que combinam com a pauta"
          posts={communityPosts}
          loading={communityLoading}
          error={communityError}
          onRefresh={onRefreshCommunity}
          kind="community"
        />
      </div>
    </div>
  );
};

const CompactInspirationList = ({
  title,
  subtitle,
  posts,
  loading,
  error,
  onRefresh,
  kind,
}: {
  title: string;
  subtitle: string;
  posts: InspirationPost[] | CommunityInspirationPost[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  kind: 'self' | 'community';
}) => (
  <div className="space-y-2 rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRefresh();
        }}
        disabled={loading}
        className="text-[11px] font-semibold text-slate-600 underline underline-offset-2 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Atualizando…' : 'Recarregar'}
      </button>
    </div>
    {error && <p className="text-xs text-red-600">{error}</p>}
    {loading && !posts.length && (
      <div className="space-y-2">
        {[1, 2, 3].map((idx) => (
          <div
            key={`insp-skel-${idx}-${kind}`}
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2.5 animate-pulse"
          >
            <div className="h-12 w-12 rounded-lg bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    )}
    {!loading && !posts.length && !error && (
      <p className="text-xs text-slate-500">
        Nenhum conteúdo encontrado para este conjunto de pautas.
      </p>
    )}
    {posts.length > 0 && (
      <div className="space-y-2">
        {posts.slice(0, 4).map((p) => {
          const views = formatCompactNumber((p as any).views) || (p as any).views?.toLocaleString?.('pt-BR');
          const dateLabel = (p as any).date ? new Date((p as any).date).toLocaleDateString('pt-BR') : '';
          const cover = 'thumbnailUrl' in p ? p.thumbnailUrl : (p as any).coverUrl;
          const reasons = 'reason' in p ? (p as any).reason : [];
          return (
            <a
              key={`list-${kind}-${p.id}`}
              href={(p as any).postLink || undefined}
              target={(p as any).postLink ? '_blank' : undefined}
              rel={(p as any).postLink ? 'noreferrer' : undefined}
              className="flex items-center gap-3 rounded-xl border border-slate-100 px-2.5 py-2 transition hover:-translate-y-[1px] hover:shadow-sm"
            >
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={toProxyUrl(cover)} alt="Inspiração" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">Sem imagem</div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <p className="line-clamp-2 text-xs font-semibold text-slate-900">{p.caption || 'Sem legenda'}</p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  {views && <span>{views} views</span>}
                  {dateLabel && <span>{dateLabel}</span>}
                </div>
                {reasons && Array.isArray(reasons) && reasons.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {reasons.slice(0, 2).map((tag, idx) => (
                      <span
                        key={`reason-${p.id}-${idx}`}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {kind === 'self' ? 'Você' : 'Comunidade'}
              </span>
            </a>
          );
        })}
      </div>
    )}
  </div>
);

export interface PlannerSlotCard {
  id: string;
  dayTitle: string;
  blockLabel: string;
  title: string;
  formatLabel: string;
  objectiveLabel: string;
  channelLabel: string | null;
  viewsP50: string;
  viewsP90: string | null;
  metricRange: string;
  statusLabel: string;
  statusCategory: StatusCategory;
  statusClass: string;
  slot: PlannerUISlot;
}

const PlannerSlotCardGrid = ({
  cards,
  canEdit,
  onOpenSlot,
  onRequestSubscribe,
}: {
  cards: PlannerSlotCard[];
  canEdit: boolean;
  onOpenSlot: (slot: PlannerUISlot) => void;
  onRequestSubscribe?: () => void;
}) => {
  if (!cards.length) return null;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {cards.map((card) => (
        <article
          key={card.id}
          role={canEdit ? 'button' : undefined}
          tabIndex={canEdit ? 0 : -1}
          onClick={() => {
            if (canEdit) {
              onOpenSlot(card.slot);
            } else if (onRequestSubscribe) {
              onRequestSubscribe();
            }
          }}
          onKeyDown={(event) => {
            if (!canEdit) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpenSlot(card.slot);
            }
          }}
          className={[
            'rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta',
            canEdit ? 'cursor-pointer hover:border-[#C9B8FF] hover:shadow-md' : 'cursor-default',
          ].join(' ')}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-slate-900">
                {card.dayTitle} · {card.blockLabel}
              </p>
              <span className={`inline-flex items-center gap-1 rounded-full border border-current px-3 py-1 text-xs font-semibold ${card.statusClass}`}>
                <span aria-hidden>{STATUS_EMOJI[card.statusCategory]}</span>
                {card.statusLabel}
              </span>
            </div>

            <p className="text-sm font-semibold text-slate-900">{card.title}</p>

            <div className="flex flex-wrap gap-2">
              <InfoChip value={card.formatLabel} />
              <InfoChip value={card.objectiveLabel} />
              {card.channelLabel && <InfoChip value={card.channelLabel} />}
            </div>

            <p className="text-sm font-semibold text-slate-700">
              📊 {card.metricRange} views
            </p>

            {!canEdit && onRequestSubscribe && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestSubscribe();
                }}
                className="text-xs font-semibold text-[#D62E5E] underline underline-offset-2"
              >
                Assine para editar esta pauta
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
};

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

const InfoChip = ({ value }: { value: string }) => (
  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
    {value}
  </span>
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
