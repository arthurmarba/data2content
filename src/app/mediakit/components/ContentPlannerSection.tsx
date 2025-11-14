"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlannerData, PlannerUISlot } from '@/hooks/usePlannerData';
import PlannerSlotModal, { PlannerSlotData as PlannerSlotDataModal } from './PlannerSlotModal';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import PlannerUpgradePanel from './PlannerUpgradePanel';
import { normalizePlanStatus } from '@/utils/planStatus';
import { track } from '@/lib/track';
import ContentPlannerCalendar from './ContentPlannerCalendar';
import { openPaywallModal } from '@/utils/paywallModal';

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

export const ContentPlannerList = ({
  userId,
  publicMode,
  onLockChange,
  billingStatus,
  hasPremiumAccess: hasPremiumAccessProp,
  initialSlotId,
  onInitialSlotConsumed,
}: {
  userId: string;
  publicMode?: boolean;
  onLockChange?: (info: {
    locked: boolean;
    lockedReason: string | null;
    planStatus: string | null | undefined;
    billingLoading: boolean;
  }) => void;
  billingStatus?: ReturnType<typeof useBillingStatus>;
  hasPremiumAccess?: boolean;
  initialSlotId?: string | null;
  onInitialSlotConsumed?: () => void;
}) => {
  const {
    slots,
    heatmap,
    loading,
    error,
    saveSlots,
    locked,
    lockedReason,
  } = usePlannerData({ userId, publicMode, targetSlotsPerWeek: 7 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<PlannerUISlot | null>(null);
  const [savingError, setSavingError] = useState<string | null>(null);
  const weekStartISO = useMemo(() => getWeekStartISO(), []);
  const initialSlotHandledRef = useRef(false);
  const lockTrackedRef = useRef(false);

  const fallbackBilling = useBillingStatus({ auto: !publicMode && !billingStatus });
  const billing = billingStatus ?? fallbackBilling;
  const normalizedPlanStatus =
    billing?.normalizedStatus ??
    (billing?.planStatus ? normalizePlanStatus(billing.planStatus) : null);
  const hasPremiumAccess = hasPremiumAccessProp ?? Boolean(billing?.hasPremiumAccess);
  const isBillingLoading = Boolean(billing?.isLoading);
  const showLockedState = !publicMode && (locked || !hasPremiumAccess);
  const canEdit = !publicMode && !locked && hasPremiumAccess;
  const canGenerate = canEdit;
  const effectiveLockedReason = !hasPremiumAccess
    ? lockedReason ?? 'Ative ou renove a assinatura para liberar o Planner IA.'
    : lockedReason;

  useEffect(() => {
    if (showLockedState && !isBillingLoading) {
      if (!lockTrackedRef.current) {
        track('pro_feature_locked_viewed', {
          feature: 'planner',
          reason: effectiveLockedReason ?? null,
        });
        lockTrackedRef.current = true;
      }
    } else {
      lockTrackedRef.current = false;
    }
  }, [showLockedState, isBillingLoading, effectiveLockedReason]);

  useEffect(() => {
    const effectiveLocked = locked || !hasPremiumAccess;
    onLockChange?.({
      locked: effectiveLocked,
      lockedReason: effectiveLockedReason,
      planStatus: normalizedPlanStatus,
      billingLoading: isBillingLoading,
    });
  }, [
    locked,
    hasPremiumAccess,
    effectiveLockedReason,
    normalizedPlanStatus,
    isBillingLoading,
    onLockChange,
  ]);

  const openModal = useCallback((slot: PlannerUISlot) => {
    setSelectedSlot(slot);
    setIsModalOpen(true);
    setSavingError(null);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedSlot(null);
    setSavingError(null);
  }, []);

  const handleSave = useCallback(
    async (updated: PlannerSlotDataModal) => {
      if (!canEdit) {
        openPaywallModal({ context: 'planning', source: 'planner_save_blocked' });
        const message =
          effectiveLockedReason || 'Este planejamento está temporariamente bloqueado.';
        setSavingError(message);
        throw new Error(message);
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

      if (idx >= 0) {
        list[idx] = merged;
      } else {
        list.push(merged);
      }

      try {
        await saveSlots(list);
        setSavingError(null);
        closeModal();
      } catch (err: any) {
        const message = err?.message || 'Não foi possível salvar o planejamento.';
        setSavingError(message);
        throw err;
      }
    },
    [canEdit, slots, saveSlots, closeModal, effectiveLockedReason]
  );

  const handleDuplicate = useCallback(
    async (target: PlannerSlotDataModal) => {
      if (!canEdit) {
        openPaywallModal({ context: 'planning', source: 'planner_duplicate_blocked' });
        const message =
          effectiveLockedReason || 'Este planejamento está temporariamente bloqueado.';
        setSavingError(message);
        return;
      }
      const list: PlannerUISlot[] = Array.isArray(slots) ? [...slots] : [];
      const duplicated = fromPlannerSlotData(target);
      duplicated.slotId = undefined;
      duplicated.status = 'drafted';
      if (duplicated.title) duplicated.title = `${duplicated.title} (variação)`;
      list.push(duplicated);
      try {
        await saveSlots(list);
        setSavingError(null);
      } catch (err: any) {
        const message = err?.message || 'Não foi possível duplicar a pauta.';
        setSavingError(message);
        throw err;
      }
    },
    [canEdit, slots, saveSlots, effectiveLockedReason]
  );

  const handleDelete = useCallback(
    async (target: PlannerSlotDataModal) => {
      if (!canEdit) {
        openPaywallModal({ context: 'planning', source: 'planner_delete_blocked' });
        const message =
          effectiveLockedReason || 'Este planejamento está temporariamente bloqueado.';
        setSavingError(message);
        return;
      }
      if (!slots || !slots.length) return;
      let removed = false;
      const filtered = slots.filter((slotItem) => {
        if (removed) return true;
        if (target.slotId && slotItem.slotId) {
          if (slotItem.slotId === target.slotId) {
            removed = true;
            return false;
          }
          return true;
        }
        const sameBlock =
          slotItem.dayOfWeek === target.dayOfWeek && slotItem.blockStartHour === target.blockStartHour;
        if (!target.slotId && sameBlock && !slotItem.slotId) {
          removed = true;
          return false;
        }
        return true;
      });
      if (!removed) return;
      try {
        await saveSlots(filtered);
        setSavingError(null);
        closeModal();
      } catch (err: any) {
        const message = err?.message || 'Não foi possível excluir a pauta.';
        setSavingError(message);
        throw err;
      }
    },
    [canEdit, slots, saveSlots, effectiveLockedReason, closeModal]
  );

  useEffect(() => {
    if (initialSlotId) {
      initialSlotHandledRef.current = false;
    }
  }, [initialSlotId]);

  useEffect(() => {
    if (!initialSlotId || initialSlotHandledRef.current) return;
    if (!slots || !slots.length) return;
    const target = slots.find((slot) => slot.slotId && slot.slotId === initialSlotId);
    if (!target) return;
    initialSlotHandledRef.current = true;
    openModal(target);
    onInitialSlotConsumed?.();
  }, [initialSlotId, slots, openModal, onInitialSlotConsumed]);

  const handleCreateSlot = useCallback(
    (dayOfWeek: number, blockStartHour: number) => {
      if (!canEdit) return;
      track("planner_plan_generated", {
        creator_id: userId,
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
      openModal(stub);
    },
    [canEdit, openModal, userId]
  );

  if (!publicMode && isBillingLoading && (locked || !hasPremiumAccess)) {
    return (
      <div className="text-center p-8">
        <span className="text-gray-500">Carregando status da sua assinatura…</span>
      </div>
    );
  }

  if (showLockedState) {
    return (
      <>
        <PlannerUpgradePanel
          status={normalizedPlanStatus}
          lockedReason={effectiveLockedReason}
          onSubscribe={() => openPaywallModal({ context: 'planning', source: 'planner_locked_state' })}
          billingHref="/dashboard/billing"
        />
      </>
    );
  }

  return (
    <>
      <ContentPlannerCalendar
        slots={slots}
        heatmap={heatmap}
        loading={loading}
        error={savingError ?? error}
        publicMode={publicMode}
        canEdit={canEdit}
        locked={locked}
        lockedReason={effectiveLockedReason}
        isBillingLoading={isBillingLoading}
        onRequestSubscribe={() => openPaywallModal({ context: 'planning', source: 'planner_calendar_cta' })}
        onOpenSlot={openModal}
        onCreateSlot={handleCreateSlot}
      />

      <PlannerSlotModal
        open={isModalOpen}
        onClose={closeModal}
        userId={userId}
        weekStartISO={weekStartISO}
        slot={toPlannerSlotData(selectedSlot)}
        onSave={handleSave}
        onDuplicateSlot={handleDuplicate}
        onDeleteSlot={handleDelete}
        readOnly={publicMode || locked}
        canGenerate={canGenerate}
        onUpgradeRequest={() => openPaywallModal({ context: 'planning', source: 'planner_slot_modal' })}
        upgradeMessage="Finalize a configuração necessária para gerar roteiros com IA."
      />
    </>
  );
};

export function ContentPlannerSection({
  userId,
  publicMode,
  title = 'Planejamento de Conteúdo',
  description,
  onLockChange,
  initialSlotId,
  onInitialSlotConsumed,
}: {
  userId: string;
  publicMode?: boolean;
  title?: string;
  description?: string;
  onLockChange?: Parameters<typeof ContentPlannerList>[0]['onLockChange'];
  initialSlotId?: string | null;
  onInitialSlotConsumed?: () => void;
}) {
  const [lockInfo, setLockInfo] = useState<{
    locked: boolean;
    lockedReason: string | null;
    planStatus: string | null | undefined;
    billingLoading: boolean;
  }>({ locked: false, lockedReason: null, planStatus: null, billingLoading: false });

  const billing = useBillingStatus({ auto: !publicMode });
  const hasPremiumAccess = Boolean(billing?.hasPremiumAccess);
  const isBillingLoading = Boolean(billing?.isLoading);
  const normalizedPlanStatus = billing?.normalizedStatus ?? lockInfo.planStatus ?? null;

  const handleLockChange = useCallback<NonNullable<typeof onLockChange>>((info) => {
    setLockInfo(info);
    onLockChange?.(info);
  }, [onLockChange]);

  const showHeader = publicMode || !lockInfo.locked || lockInfo.billingLoading || !hasPremiumAccess;

  const headerNode = showHeader ? (
    <header>
      <h2 className="text-[22px] font-bold text-[#1C1C1E]">{title}</h2>
      {description && <p className="mt-1 text-[13px] text-[#666666]">{description}</p>}
    </header>
  ) : null;

  const upgradeReason =
    lockInfo.lockedReason ?? 'Ative ou renove a assinatura para liberar o Planner IA.';

  if (!publicMode) {
    if (isBillingLoading && !hasPremiumAccess) {
      return (
        <section className="space-y-4">
          {headerNode}
          <div className="text-center p-8">
            <span className="text-gray-500">Carregando status da sua assinatura…</span>
          </div>
        </section>
      );
    }

    if (!hasPremiumAccess) {
      return (
        <section className="space-y-4">
          {headerNode}
          <PlannerUpgradePanel
            status={normalizedPlanStatus}
            lockedReason={upgradeReason}
            onSubscribe={() => openPaywallModal({ context: 'planning', source: 'planner_section_locked' })}
            billingHref="/dashboard/billing"
          />
        </section>
      );
    }
  }

  return (
    <section className="space-y-4">
      {headerNode}
      <ContentPlannerList
        userId={userId}
        publicMode={publicMode}
        onLockChange={handleLockChange}
        billingStatus={billing}
        hasPremiumAccess={hasPremiumAccess}
        initialSlotId={initialSlotId}
        onInitialSlotConsumed={onInitialSlotConsumed}
      />
    </section>
  );
}

export default ContentPlannerSection;
