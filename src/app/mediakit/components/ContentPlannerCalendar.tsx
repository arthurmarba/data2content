"use client";

import React, { useMemo, useState } from 'react';
import { usePlannerData, PlannerUISlot } from '@/hooks/usePlannerData';
import PlannerSlotCard from './PlannerSlotCard';
import PlannerSlotModal from './PlannerSlotModal';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import BillingSubscribeModal from '@/app/dashboard/billing/BillingSubscribeModal';
import PlannerUpgradePanel from './PlannerUpgradePanel';

// Blocos operacionais (9h às 21h)
const BLOCKS = [9, 12, 15, 18] as const;

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']; // dayOfWeek 1..7

function dayLabel(dayOfWeek: number) {
  if (dayOfWeek === 7) return DAYS_PT[0];
  return DAYS_PT[dayOfWeek];
}
function blockLabel(start: number) {
  const end = (start + 3) % 24;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(start)}–${pad(end)}`;
}
function keyFor(d: number, h: number) {
  return `${d}-${h}`;
}

export interface ContentPlannerCalendarProps {
  userId: string;
  publicMode?: boolean;
  weekStart?: Date;
  showHeader?: boolean;
}

export const ContentPlannerCalendar: React.FC<ContentPlannerCalendarProps> = ({
  userId,
  publicMode = true,
  weekStart,
  showHeader = true
}) => {
  const {
    weekStart: normalizedWeekStart,
    slots,
    heatmap,
    loading,
    error,
    saveSlots,
    locked,
    lockedReason,
  } = usePlannerData({ userId, publicMode, weekStart, targetSlotsPerWeek: 7 });
  const [showBest, setShowBest] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<PlannerUISlot | null>(null);
  const [showBilling, setShowBilling] = useState(false);
  const billing = useBillingStatus({ auto: !publicMode });
  const isBillingLoading = Boolean(billing?.isLoading);
  const hasPremiumAccess = Boolean(billing?.hasPremiumAccess);
  const canEdit = !publicMode && !locked && hasPremiumAccess;

  const slotsMap = useMemo(() => {
    const m = new Map<string, PlannerUISlot[]>();
    (slots || []).forEach((s) => {
      const k = keyFor(s.dayOfWeek, s.blockStartHour);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    });
    return m;
  }, [slots]);

  const heatMapMap = useMemo(() => {
    const m = new Map<string, number>();
    (heatmap || []).forEach((h) => {
      m.set(keyFor(h.dayOfWeek, h.blockStartHour), h.score);
    });
    return m;
  }, [heatmap]);

  const cellBg = (day: number, block: number) => {
    if (!showBest || !heatMapMap.size) return 'bg-white';
    const s = heatMapMap.get(keyFor(day, block)) ?? 0;
    const intensity = Math.round(50 + s * 40); // 50..90
    return `bg-[hsl(150,60%,${intensity}%)]`;
  };

  if (!publicMode && locked && !isBillingLoading) {
    return (
      <>
        <PlannerUpgradePanel
          status={billing?.normalizedStatus ?? billing?.planStatus}
          lockedReason={lockedReason}
          onSubscribe={() => setShowBilling(true)}
          billingHref="/dashboard/billing"
        />
        <BillingSubscribeModal open={showBilling} onClose={() => setShowBilling(false)} />
      </>
    );
  }

  if (!publicMode && locked && isBillingLoading) {
    return (
      <div className="bg-white p-6 rounded-lg border border-pink-100 text-center text-sm text-gray-500">
        Carregando status da sua assinatura…
      </div>
    );
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded-none lg:rounded-none shadow-lg border-t border-b border-gray-200">
      <div className="flex items-center justify-between mb-4">
        {showHeader ? (
          <h2 className="text-xl font-bold text-gray-800">Planejamento de Conteúdo (Instagram)</h2>
        ) : (
          <span />
        )}
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="accent-pink-500"
            checked={showBest}
            onChange={(e) => setShowBest(e.target.checked)}
          />
          Ver melhores horários
        </label>
      </div>

      <div className="mb-4 text-xs text-gray-600 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-block bg-green-500 text-white rounded-full px-2 py-0.5 text-[10px]">
            12,3k
          </span>
          <span>Indicador verde: <b>views esperadas (P50)</b>. O tooltip mostra o P90.</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 bg-yellow-400 text-white rounded-full text-[10px] font-bold">
            TESTE
          </span>
          <span>Indicador amarelo: slot de <b>teste</b> (exploração de ideias/categorias neste bloco).</span>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Carregando recomendações…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="overflow-x-auto">
        <div className="min-w-[1400px]">
          <div
            className="grid"
            style={{ gridTemplateColumns: `120px repeat(${7}, minmax(180px, 1fr))` }}
          >
            <div />
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <div
                key={`dhead-${day}`}
                className="px-2 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200 text-center"
              >
                {dayLabel(day)}
              </div>
            ))}
          </div>

          {BLOCKS.map((block) => (
            <div
              key={`row-block-${block}`}
              className="grid"
              style={{ gridTemplateColumns: `120px repeat(${7}, minmax(180px, 1fr))` }}
            >
              <div className="px-2 py-3 text-sm font-semibold text-gray-700 border-b border-gray-200 sticky left-0 bg-white z-10 flex items-center">
                {blockLabel(block)}
              </div>

              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const k = keyFor(day, block);
                const items = slotsMap.get(k) || [];

                const openCell = () => {
                  if (items.length > 0) {
                    setSelected(items[0]!);
                  } else {
                    setSelected({
                      dayOfWeek: day,
                      blockStartHour: block,
                      format: 'reel',
                      categories: {},
                      status: 'test',
                      isExperiment: true,
                      expectedMetrics: {},
                      title: ''
                    } as any);
                  }
                  setModalOpen(true);
                };

                const cellClasses = [
                  'p-2 border-b border-gray-200',
                  'relative isolate overflow-hidden',
                  cellBg(day, block),
                  !publicMode && canEdit ? 'cursor-pointer' : ''
                ].join(' ');

                return (
                  <div
                    key={`cell-${k}`}
                    className={cellClasses}
                    onClick={!publicMode && canEdit ? openCell : undefined}
                  >
                    {items.length === 0 ? (
                      // MUDANÇA: Altura aumentada para h-56 (224px)
                      <div
                        className="h-56 rounded-lg border border-dashed border-gray-300 bg-white/40 pointer-events-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <div className="grid gap-2">
                        {items.map((s, idx) => (
                           // MUDANÇA: Altura aumentada para h-56 (224px)
                          <div key={`card-${k}-${idx}`} className="h-56">
                            <PlannerSlotCard
                              title={s.title}
                              themeKeyword={(s as any).themeKeyword}
                              categories={s.categories}
                              expectedMetrics={s.expectedMetrics}
                              isExperiment={s.status === 'test' || s.isExperiment}
                              status={s.status as any}
                              formatId={s.format as any}
                              dayOfWeek={day}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelected(s);
                                setModalOpen(true);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <PlannerSlotModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={userId}
        weekStartISO={normalizedWeekStart.toISOString()}
        slot={
          selected
            ? {
                dayOfWeek: selected.dayOfWeek,
                blockStartHour: selected.blockStartHour,
                format: selected.format,
                categories: selected.categories,
                status: selected.status,
                isExperiment: selected.isExperiment,
                expectedMetrics: selected.expectedMetrics,
                title: selected.title,
                scriptShort: (selected as any).scriptShort,
                themes: (selected as any).themes,
                themeKeyword: (selected as any).themeKeyword,
                // @ts-ignore — rationale pode vir do recomendador
                rationale: (selected as any).rationale,
              }
            : null
        }
        readOnly={publicMode || !canEdit}
        altStrongBlocks={(() => {
          if (!selected || !heatmap) return [];
          const sameDay = heatmap.filter(h => h.dayOfWeek === selected.dayOfWeek);
          const sorted = sameDay.slice().sort((a,b) => b.score - a.score);
          const alts = sorted.filter(h => h.blockStartHour !== selected.blockStartHour).slice(0, 2);
          return alts.map(h => ({ blockStartHour: h.blockStartHour, score: h.score }));
        })()}
        onSave={async (updated) => {
          const list: PlannerUISlot[] = Array.isArray(slots) ? ([...slots] as PlannerUISlot[]) : [];
          const idx = list.findIndex(
            (s) => s.dayOfWeek === updated.dayOfWeek && s.blockStartHour === updated.blockStartHour
          );
          if (idx >= 0) {
            const base = list[idx]!;
            const merged = {
              ...base,
              ...updated,
              categories: updated.categories ?? base.categories ?? {}
            } as PlannerUISlot;
            list[idx] = merged;
          } else {
            list.push({ ...(updated as PlannerUISlot), categories: updated.categories ?? {} } as PlannerUISlot);
          }
          await saveSlots(list);
        }}
      />

      {!publicMode && !canEdit && (
        <div className="mt-4 p-3 rounded-lg border bg-yellow-50 border-yellow-200 text-yellow-800 flex items-center justify-between">
          <div>
            <div className="font-semibold">Assine para editar e gerar roteiros com IA</div>
            <div className="text-sm">
              Seu plano atual não permite edição. Você ainda pode visualizar horários ideais e recomendações.
            </div>
          </div>
          <button
            onClick={() => setShowBilling(true)}
            className="ml-3 bg-pink-600 hover:bg-pink-700 text-white text-sm px-4 py-2 rounded-md"
          >
            Assinar
          </button>
        </div>
      )}

      {!publicMode && (
        <BillingSubscribeModal open={showBilling} onClose={() => setShowBilling(false)} />
      )}
    </div>
  );
};

export default ContentPlannerCalendar;
