"use client";

import React, { useMemo } from 'react';
import { PlannerUISlot } from '@/hooks/usePlannerData';
import { idsToLabels } from '@/app/lib/classification';

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

export interface ContentPlannerCalendarProps {
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

export const ContentPlannerCalendar: React.FC<ContentPlannerCalendarProps> = ({
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
  const slotsMap = useMemo(() => {
    const map = new Map<string, PlannerUISlot[]>();
    (slots || []).forEach((slot) => {
      const key = keyFor(slot.dayOfWeek, slot.blockStartHour);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
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
      <div className="space-y-4 border-b border-slate-100 pb-5">
        <header className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plano semanal</p>
              <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">O que postar por dia nesta semana</h2>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Atualizado pela IA
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Bloqueie slots, ajuste formatos e acompanhe a meta de {TARGET_SLOTS_PER_WEEK} pautas por semana.
          </p>
        </header>
        {summaryTiles.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {summaryTiles.map((tile) => (
              <SummaryTile key={tile.key} label={tile.label} value={tile.value} helper={tile.helper} />
            ))}
          </div>
        )}
      </div>
      {showLoadingBanner && <PlannerLoadingBanner />}

      {loading && <PlannerLoadingSkeleton />}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {slotCards.length ? (
        <PlannerSlotCardGrid
          cards={slotCards}
          canEdit={canEdit}
          onOpenSlot={onOpenSlot}
          onRequestSubscribe={onRequestSubscribe}
        />
      ) : (
        <PlannerEmptyState onRequestSubscribe={onRequestSubscribe} loading={loading} />
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

interface PlannerSlotCard {
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
