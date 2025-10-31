"use client";

import React, { useMemo } from 'react';
import { PlannerUISlot } from '@/hooks/usePlannerData';
import { idsToLabels } from '@/app/lib/classification';

const BLOCKS = [9, 12, 15, 18] as const;
const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']; // 1..7
const DAYS_FULL_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
type StatusCategory = 'champion' | 'test' | 'watch' | 'planned';
type PerformanceLegendKey = 'champion' | 'test' | 'watch';

const STATUS_CATEGORY_TO_LEGEND: Record<StatusCategory, PerformanceLegendKey> = {
  champion: 'champion',
  test: 'test',
  watch: 'watch',
  planned: 'watch',
};

const PERFORMANCE_CATEGORY_STYLES: Record<
  PerformanceLegendKey,
  { barClass: string; metaClass: string; emoji: string; label: string }
> = {
  champion: {
    barClass: 'bg-[#1D8E5D]',
    metaClass: 'text-[#1D8E5D]',
    emoji: '🟩',
    label: 'Campeão',
  },
  test: {
    barClass: 'bg-[#4C5BD4]',
    metaClass: 'text-[#4C5BD4]',
    emoji: '🟦',
    label: 'Em teste',
  },
  watch: {
    barClass: 'bg-[#B9730F]',
    metaClass: 'text-[#B9730F]',
    emoji: '🟨',
    label: 'Em observação',
  },
};

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
  showBillingModal?: React.ReactNode;
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
  showBillingModal,
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
  const hasRelevantDays = relevantDaySummaries.length > 0;
  const defaultCreateTarget = useMemo(() => {
    const first = relevantDaySummaries[0];
    if (first) {
      const blockStart = first.bestHeatBlock.blockStartHour ?? BLOCKS[1] ?? BLOCKS[0];
      return { day: first.day, blockStartHour: blockStart };
    }
    return { day: 1, blockStartHour: BLOCKS[1] ?? BLOCKS[0] };
  }, [relevantDaySummaries]);

  const performanceRows = useMemo(() => {
    type PerformanceEntry = {
      slot: PlannerUISlot;
      views: number;
      blockStartHour: number;
      heatScore?: number;
    };

    const rows = daySummaries
      .map((summary) => {
        const entries = summary.blocks.flatMap((block) =>
          block.items
            .map((slot) => {
              const views = slot.expectedMetrics?.viewsP50;
              if (typeof views !== 'number' || !isFinite(views) || views <= 0) return null;
              return {
                slot,
                views,
                blockStartHour: block.blockStartHour,
                heatScore: block.heatScore,
              } as PerformanceEntry;
            })
            .filter((entry): entry is PerformanceEntry => Boolean(entry))
        );

        if (!entries.length) return null;

        const totalViews = entries.reduce((sum, entry) => sum + entry.views, 0);
        const averageViews = totalViews / entries.length;
        const bestEntry = entries.reduce((prev, current) => (current.views > prev.views ? current : prev));
        const statusInfo = getStatusInfo(bestEntry.heatScore, bestEntry.slot);
        const legendKey = STATUS_CATEGORY_TO_LEGEND[statusInfo.category];
        const style = PERFORMANCE_CATEGORY_STYLES[legendKey];
        const bestViewsLabel = formatViews(bestEntry.views) ?? '—';
        const averageViewsLabel = formatViews(averageViews) ?? '—';

        return {
          day: summary.day,
          dayLabel: dayLabel(summary.day),
          averageViews,
          averageViewsLabel,
          statusInfo,
          legendKey,
          legendEmoji: style.emoji,
          statusLabel: style.label,
          metaText: `${blockLabel(bestEntry.blockStartHour)} • ${bestViewsLabel} views • ${statusInfo.label}`,
          tooltip: `🔥 ${blockLabel(bestEntry.blockStartHour)} • ${bestViewsLabel} views`,
          barClass: style.barClass,
          metaClass: style.metaClass,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (!rows.length) return [];
    const maxValue = Math.max(...rows.map((row) => row.averageViews), 1);

    return rows.map((row) => ({
      ...row,
      barWidth: Math.max(12, (row.averageViews / maxValue) * 100),
    }));
  }, [daySummaries]);

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
        {showBillingModal}
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
    <div className="rounded-3xl border border-[#E6E6EB] bg-[#FAFAFB] p-4 sm:p-6 space-y-6">
      <div className="space-y-5 rounded-2xl border border-[#E6E6EB] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#F1F1F5] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[16px] font-semibold text-[#222222]">
              <span aria-hidden>📅</span>
              Resumo semanal
            </p>
            <p className="mt-1 mb-3 text-[13px] text-[#666666]">
              Panorama das recomendações desta semana
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-[#FFF2F6] px-4 py-2 text-sm font-medium text-[#D62E5E] shadow-inner">
            📅 Semana atual — {overview.total} {overview.total === 1 ? 'publicação sugerida' : 'publicações sugeridas'}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            variant="theme"
            icon="💡"
            title="Tema mais recorrente"
            value={overview.topTheme ?? 'Em descoberta'}
            helper={!overview.topTheme ? 'A IA está equilibrando temas para variar sua semana.' : undefined}
          />
          <SummaryCard
            variant="engagement"
            icon="🔥"
            title="Melhor faixa"
            value={
              overview.bestBlock
                ? `${dayFullLabel(overview.bestBlock.dayOfWeek)} • ${blockLabel(overview.bestBlock.blockStartHour)}`
                : 'Aprimorando previsão'
            }
            helper={!overview.bestBlock ? 'Estamos analisando seus horários mais fortes.' : undefined}
          />
          <SummaryCard
            variant="activity"
            icon="🗂️"
            title="Dias ativos"
            value={`${overview.activeDays} ${overview.activeDays === 1 ? 'dia' : 'dias'}`}
            helper="Distribua os posts para manter consistência."
          />
        </div>
        {performanceRows.length > 0 && (
          <div className="rounded-xl border border-[#EFEFF4] bg-[#FDFBFF] p-4">
            <p className="text-sm font-semibold text-[#1C1C1E]">📊 Desempenho por dia</p>
            <p className="mb-4 mt-1 text-xs text-[#5A5A67]">
              Comparativo do alcance médio previsto por dia da semana. Use para reajustar formatos e horários.
            </p>
            <div className="space-y-3">
              {performanceRows.map((row) => (
                <div key={`performance-row-${row.day}`} className="space-y-1.5" title={row.tooltip}>
                  <div className="flex items-center justify-between text-sm text-[#3F3F46]">
                    <span className="flex items-center gap-2 font-semibold text-[#1C1C1E]">
                      {row.dayLabel}
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F4FB] px-2 py-0.5 text-[11px] font-semibold text-[#4B4B55]">
                        <span aria-hidden>{row.legendEmoji}</span>
                        {row.statusLabel}
                      </span>
                    </span>
                    <span className="font-semibold text-[#1C1C1E]">{row.averageViewsLabel} views</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#EEEDF5]">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-full ${row.barClass}`}
                      style={{ width: `${row.barWidth}%` }}
                    />
                  </div>
                  <p className={`text-xs ${row.metaClass}`}>{row.metaText}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#5A5A67]">
              {(['champion', 'test', 'watch'] as PerformanceLegendKey[]).map((key) => {
                const legend = PERFORMANCE_CATEGORY_STYLES[key];
                return (
                  <span key={`performance-legend-${key}`} className="flex items-center gap-1">
                    <span aria-hidden>{legend.emoji}</span>
                    {legend.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {loading && <div className="text-sm text-gray-500">Carregando recomendações…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="rounded-2xl border border-[#E8E3FF] bg-[#F6F2FF] p-4 text-sm text-[#43316E]">
        🤖 <span className="font-semibold text-[#2C1960]">Mobi:</span> selecionei os melhores horários da semana
        com base nos resultados mais recentes. Clique em uma pauta para abrir e ajustar se quiser.
      </div>

      <div className="space-y-4">
        {hasRelevantDays ? (
          relevantDaySummaries.map((summary) => (
            <PlannerDaySection
              key={`planner-day-${summary.day}`}
              summary={summary}
              canEdit={canEdit}
              onOpenSlot={onOpenSlot}
              onRequestSubscribe={onRequestSubscribe}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-[#E4E4EA] bg-white p-6 text-sm text-[#4B4B55]">
            Nenhuma sugestão disponível por enquanto. Peça novas pautas para o Mobi ou gere ideias no planner.
          </div>
        )}
      </div>

      {canEdit && (
        <div className="fixed bottom-6 right-5 z-40 md:hidden">
          <button
            type="button"
            onClick={() => {
              const target = defaultCreateTarget;
              onCreateSlot(target.day, target.blockStartHour);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#D62E5E] to-[#6E1F93] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-[#c42853] hover:to-[#5a1877]"
          >
            🤖 Gerar sugestões
          </button>
        </div>
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

      {showBillingModal}
    </div>
  );
};

type SummaryVariant = 'theme' | 'engagement' | 'activity';

const SUMMARY_VARIANT_STYLES: Record<SummaryVariant, { iconBg: string; iconText: string; titleColor: string }> = {
  theme: { iconBg: 'bg-[#F2E8FF]', iconText: 'text-[#6E1F93]', titleColor: 'text-[#6E1F93]' },
  engagement: { iconBg: 'bg-[#FFF3E8]', iconText: 'text-[#F97316]', titleColor: 'text-[#F97316]' },
  activity: { iconBg: 'bg-[#EAF1FF]', iconText: 'text-[#2563EB]', titleColor: 'text-[#2563EB]' },
};

const SummaryCard = ({
  variant,
  icon,
  title,
  value,
  helper,
}: {
  variant: SummaryVariant;
  icon: string;
  title: string;
  value: string;
  helper?: string;
}) => {
  const styles = SUMMARY_VARIANT_STYLES[variant];
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#FFF8FA] p-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${styles.iconBg} ${styles.iconText}`}>
        {icon}
      </div>
      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${styles.titleColor}`}>{title}</p>
        <p className="text-sm font-semibold text-[#1C1C1E]">{value}</p>
        {helper && <p className="text-xs text-gray-500">{helper}</p>}
      </div>
    </div>
  );
};

interface PlannerDaySectionProps {
  summary: PlannerDaySummary;
  canEdit: boolean;
  onOpenSlot: (slot: PlannerUISlot) => void;
  onRequestSubscribe?: () => void;
}

const PlannerDaySection = React.memo<PlannerDaySectionProps>(
  ({ summary, canEdit, onOpenSlot, onRequestSubscribe }) => {
    const { day, blocks } = summary;
    const dayTitle = useMemo<string>(() => dayFullLabel(day), [day]);

    const primarySuggestion = useMemo(() => {
      const items = blocks.flatMap((block) => {
        if (!block.items.length) return [];
        return block.items.map((slot) => ({
          slot,
          heatScore: block.heatScore,
          blockStartHour: block.blockStartHour,
        }));
      });

      if (!items.length) return null;
      return items.sort((a, b) => {
        const aViews = a.slot.expectedMetrics?.viewsP50 ?? 0;
        const bViews = b.slot.expectedMetrics?.viewsP50 ?? 0;
        return bViews - aViews;
      })[0]!;
    }, [blocks]);

    if (!primarySuggestion) return null;

    const { slot: primarySlot, heatScore, blockStartHour } = primarySuggestion;
    const blockTime = blockLabel(primarySlot.blockStartHour ?? blockStartHour);
    const viewsLabel = formatViews(primarySlot.expectedMetrics?.viewsP50);
    const headline =
      primarySlot.title?.trim() ||
      primarySlot.themeKeyword ||
      primarySlot.themes?.[0] ||
      'Sugestão pronta do Mobi';

    const formatName = formatSlotFormat(primarySlot.format);
    const contextLabels = idsToLabels(primarySlot.categories?.context, 'context');
    const contextName = contextLabels[0] || primarySlot.themeKeyword || primarySlot.themes?.[1] || 'Contexto livre';

    const statusInfo = getStatusInfo(heatScore, primarySlot);
    const metaParts = [blockTime, viewsLabel ? `${viewsLabel} views` : null, statusInfo.label].filter(Boolean);

    const handleClick = () => {
      if (canEdit) {
        onOpenSlot(primarySlot);
      } else if (onRequestSubscribe) {
        onRequestSubscribe();
      }
    };

    return (
      <section id={`planner-day-${day}`}>
        <div
          role={canEdit ? 'button' : undefined}
          tabIndex={canEdit ? 0 : -1}
          onClick={handleClick}
          onKeyDown={(event) => {
            if (!canEdit) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpenSlot(primarySlot);
            }
          }}
          className={[
            'rounded-2xl border border-[#E6E6EB] bg-white p-5 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#6E1F93]/30 focus:ring-offset-2',
            canEdit ? 'cursor-pointer hover:border-[#C9B8FF] hover:shadow-md' : 'cursor-default',
          ].join(' ')}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1C1C1E]">
              <span className="inline-flex h-2 w-2 rounded-full bg-[#6E1F93]" aria-hidden />
              {dayTitle}
            </div>

            <p className="text-base font-semibold text-[#1C1C1E]">{headline}</p>

            <p className={`text-sm font-medium ${statusInfo.metaClass}`}>
              <span aria-hidden>🔥 </span>
              {metaParts.join(' • ')}
            </p>

            <p className="text-sm text-[#5A5A67]">
              🎬 {formatName}
              {contextName ? ` • 💬 ${contextName}` : ''}
            </p>

            {primarySlot.themes && primarySlot.themes.length > 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {primarySlot.themes.slice(1).map((theme) => (
                  <span
                    key={theme}
                    className="inline-flex items-center rounded-full bg-[#F3F0FF] px-3 py-1 text-xs font-medium text-[#6E1F93]"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            )}

            {canEdit ? (
              <span className="text-xs font-semibold text-[#6E1F93]">Toque para abrir detalhes da pauta</span>
            ) : (
              <button
                type="button"
                onClick={onRequestSubscribe}
                disabled={!onRequestSubscribe}
                className="text-xs font-semibold text-[#D62E5E] underline underline-offset-2"
              >
                Assine para editar esta pauta
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }
);
PlannerDaySection.displayName = 'PlannerDaySection';

export default ContentPlannerCalendar;
