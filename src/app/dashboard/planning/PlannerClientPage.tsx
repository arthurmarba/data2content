"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ContentPlannerCalendar,
  PlannerSlotCard,
} from '@/app/mediakit/components/ContentPlannerCalendar';
import PlannerSlotModal, { PlannerSlotData as PlannerSlotDataModal } from '@/app/mediakit/components/PlannerSlotModal';
import SimplifiedInsights from '@/app/dashboard/discover/SimplifiedInsights';
import { usePlannerData, PlannerUISlot } from '@/hooks/usePlannerData';
import { useBillingStatus } from '@/app/hooks/useBillingStatus';
import { track } from '@/lib/track';
import { openPaywallModal } from '@/utils/paywallModal';

const MAX_POST_AGE_DAYS = 30;

function toPlannerSlotData(slot: PlannerUISlot | null): PlannerSlotDataModal | null {
  if (!slot) return null;
  return {
    slotId: (slot as any).slotId,
    dayOfWeek: slot.dayOfWeek,
    blockStartHour: slot.blockStartHour,
    format: (slot as any).format || 'reel',
    categories: slot.categories,
    status: slot.status as any,
    isExperiment: (slot as any).isExperiment,
    expectedMetrics: slot.expectedMetrics as any,
    title: (slot as any).title,
    scriptShort: (slot as any).scriptShort,
    themes: (slot as any).themes,
    themeKeyword: (slot as any).themeKeyword,
    rationale: (slot as any).rationale,
    recordingTimeSec: (slot as any).recordingTimeSec,
    aiVersionId: (slot as any).aiVersionId,
  };
}

function fromPlannerSlotData(data: PlannerSlotDataModal): PlannerUISlot {
  return {
    slotId: data.slotId,
    dayOfWeek: data.dayOfWeek,
    blockStartHour: data.blockStartHour,
    format: data.format || 'reel',
    categories: data.categories ?? {},
    status: (data.status as PlannerUISlot['status']) || 'planned',
    isExperiment: data.isExperiment,
    expectedMetrics: data.expectedMetrics ?? {},
    title: data.title,
    scriptShort: data.scriptShort,
    themes: data.themes ?? [],
    themeKeyword: data.themeKeyword,
    rationale: Array.isArray(data.rationale) ? data.rationale.join('\n') : (data.rationale as any),
    recordingTimeSec: data.recordingTimeSec,
    aiVersionId: data.aiVersionId ?? undefined,
  };
}

function getWeekStartISO(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

export default function PlannerClientPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const billing = useBillingStatus();
  const { planStatus } = billing;
  const isBillingLoading = billing.isLoading;

  const {
    slots,
    heatmap,
    loading,
    error,
    reload,
    saveSlots,
    locked,
    lockedReason,
  } = usePlannerData({ userId: session?.user?.id || '', targetSlotsPerWeek: 7 });

  const [selectedSlot, setSelectedSlot] = useState<PlannerUISlot | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  const weekStartISO = useMemo(() => getWeekStartISO(), []);

  // Check access
  // Note: canAccessPlanner and getPlanStatus might need to be imported or implemented if not available
  // Assuming they are available as per previous code, but if not, we use billing flags
  const hasAccess = billing.hasPremiumAccess || billing.isTrialActive || billing.normalizedStatus === 'active';
  const effectiveLocked = locked || !hasAccess;
  const effectiveLockedReason = effectiveLocked
    ? lockedReason ?? 'Atualize seu plano para acessar o planejador completo.'
    : undefined;
  const canEdit = hasAccess;

  // Handle slot selection from URL
  useEffect(() => {
    const slotId = searchParams.get('slotId');
    if (slotId && slots && slots.length > 0 && !selectedSlot && !isModalOpen) {
      const found = slots.find((s) => s.slotId === slotId);
      if (found) {
        setSelectedSlot(found);
        setIsModalOpen(true);
      }
    }
  }, [searchParams, slots, selectedSlot, isModalOpen]);

  const handleOpenSlot = useCallback((slot: PlannerUISlot) => {
    setSelectedSlot(slot);
    setIsModalOpen(true);
    setSavingError(null);
    track('planner_slot_opened', { slotId: slot.slotId });
  }, []);

  const handleCloseSlot = useCallback(() => {
    setSelectedSlot(null);
    setIsModalOpen(false);
    setSavingError(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('slotId');
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const handleCreateSlot = useCallback(
    (dayOfWeek: number, blockStartHour: number) => {
      if (!canEdit) {
        openPaywallModal();
        return;
      }
      track("planner_plan_generated", {
        creator_id: session?.user?.id,
        day_of_week: dayOfWeek,
        block_start_hour: blockStartHour,
        source: "calendar_quick_generate",
      });
      const stub: PlannerUISlot = {
        dayOfWeek,
        blockStartHour,
        format: 'reel',
        categories: {},
        status: 'test',
        isExperiment: true,
        expectedMetrics: {},
        title: '',
      } as PlannerUISlot;
      handleOpenSlot(stub);
    },
    [canEdit, handleOpenSlot, session?.user?.id]
  );

  const handleSave = useCallback(
    async (updated: PlannerSlotDataModal) => {
      if (!canEdit) {
        openPaywallModal({ context: 'planning', source: 'planner_save_blocked' });
        throw new Error('Edição bloqueada.');
      }

      const list: PlannerUISlot[] = Array.isArray(slots) ? [...slots] : [];
      const idx = list.findIndex(
        (slot) => slot.dayOfWeek === updated.dayOfWeek && slot.blockStartHour === updated.blockStartHour
      );

      const base = idx >= 0 ? list[idx]! : ({} as PlannerUISlot);
      const merged: PlannerUISlot = {
        ...base,
        ...updated,
        format: updated.format || base.format || 'reel',
        categories: updated.categories ?? base.categories ?? {},
        expectedMetrics: updated.expectedMetrics ?? base.expectedMetrics,
        scriptShort: updated.scriptShort ?? base.scriptShort,
        themeKeyword: updated.themeKeyword ?? base.themeKeyword,
      } as PlannerUISlot;
      merged.isSaved = true;

      if (idx >= 0) {
        list[idx] = merged;
      } else {
        list.push(merged);
      }

      try {
        await saveSlots(list);
        setSavingError(null);
        handleCloseSlot();
        reload(); // Refresh to get updated IDs etc
      } catch (err: any) {
        const message = err?.message || 'Não foi possível salvar o planejamento.';
        setSavingError(message);
        throw err;
      }
    },
    [canEdit, slots, saveSlots, handleCloseSlot, reload]
  );

  const handleDelete = useCallback(
    async (target: PlannerSlotDataModal) => {
      if (!canEdit) {
        openPaywallModal({ context: 'planning', source: 'planner_delete_blocked' });
        return;
      }
      if (!slots || !slots.length) return;

      const filtered = slots.filter((slotItem) => {
        if (target.slotId && slotItem.slotId) {
          return slotItem.slotId !== target.slotId;
        }
        const sameBlock =
          slotItem.dayOfWeek === target.dayOfWeek && slotItem.blockStartHour === target.blockStartHour;
        if (!target.slotId && sameBlock && !slotItem.slotId) {
          return false;
        }
        return true;
      });

      try {
        await saveSlots(filtered);
        setSavingError(null);
        handleCloseSlot();
        reload();
      } catch (err: any) {
        const message = err?.message || 'Não foi possível excluir a pauta.';
        setSavingError(message);
        throw err;
      }
    },
    [canEdit, slots, saveSlots, handleCloseSlot, reload]
  );

  const handleDuplicate = useCallback(
    async (target: PlannerSlotDataModal) => {
      if (!canEdit) {
        openPaywallModal({ context: 'planning', source: 'planner_duplicate_blocked' });
        return;
      }
      const list: PlannerUISlot[] = Array.isArray(slots) ? [...slots] : [];
      const duplicated = fromPlannerSlotData(target);
      duplicated.slotId = undefined;
      duplicated.status = 'drafted';
      duplicated.isSaved = true;
      if (duplicated.title) duplicated.title = `${duplicated.title} (variação)`;
      list.push(duplicated);
      try {
        await saveSlots(list);
        setSavingError(null);
        reload();
      } catch (err: any) {
        const message = err?.message || 'Não foi possível duplicar a pauta.';
        setSavingError(message);
        throw err;
      }
    },
    [canEdit, slots, saveSlots, reload]
  );

  const handleRequestSubscribe = useCallback(() => {
    openPaywallModal();
    track('planner_subscribe_clicked');
  }, []);

  // Calculate Insights
  const topHourLabel = useMemo(() => {
    if (!heatmap || heatmap.length === 0) return null;
    const best = heatmap.reduce((prev, current) => (prev.score > current.score ? prev : current));
    return `${best.blockStartHour}h`;
  }, [heatmap]);

  const tips: string[] = useMemo(() => {
    const t: string[] = [];
    if (topHourLabel) {
      t.push(`Seus dados históricos mostram um pico de engajamento às ${topHourLabel}. Agende seus conteúdos mais importantes (como lançamentos ou virais) para esta janela de ouro.`);
    }
    // Add generic tips if needed, or derived from slots
    if (slots && slots.length < 3) {
      t.push("O algoritmo prioriza constância. Aumentar sua frequência para 3 posts semanais pode elevar sua entrega em até 2x. Foque em criar hábito.");
    } else if (slots && slots.length >= 3) {
      t.push("Domine a narrativa completa: use Reels para atrair novos olhos (topo de funil) e Carrosséis para educar e converter sua base fiel (fundo de funil).");
    }
    return t;
  }, [topHourLabel, slots]);

  if (status === 'loading') return null;

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Planejador de Conteúdo</h1>
          <p className="mt-1 text-slate-500">
            Organize sua semana e descubra os melhores horários para postar.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-12">
            {/* Insights Simplificados */}


            {/* Calendário */}
            <ContentPlannerCalendar
              userId={session?.user?.id || ''}
              slots={slots}
              heatmap={heatmap}
              loading={loading}
              error={savingError ?? error}
              canEdit={canEdit}
              locked={effectiveLocked}
              lockedReason={effectiveLockedReason}
              isBillingLoading={isBillingLoading}
              onRequestSubscribe={handleRequestSubscribe}
              onOpenSlot={handleOpenSlot}
              onCreateSlot={handleCreateSlot}
              onDeleteSlot={(slot) => {
                const data = toPlannerSlotData(slot);
                if (data) handleDelete(data);
              }}
            />
          </div>
        </div>
      </div>

      {/* Modal de Slot */}
      <PlannerSlotModal
        open={isModalOpen}
        onClose={handleCloseSlot}
        userId={session?.user?.id || ''}
        weekStartISO={weekStartISO}
        slot={toPlannerSlotData(selectedSlot)}
        onSave={handleSave}
        onDuplicateSlot={handleDuplicate}
        onDeleteSlot={handleDelete}
        readOnly={!canEdit}
        canGenerate={canEdit}
        onUpgradeRequest={handleRequestSubscribe}
        upgradeMessage="Finalize a configuração necessária para gerar roteiros com IA."
      />
    </div>
  );
}
