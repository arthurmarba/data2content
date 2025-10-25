"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Clock, ChevronRight, TestTube2 } from 'lucide-react';
import { commaSeparatedIdsToLabels } from '@/app/lib/classification';
import { usePlannerData, PlannerUISlot } from '@/hooks/usePlannerData';
import PlannerSlotModal, { PlannerSlotData as PlannerSlotDataModal } from './PlannerSlotModal';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import BillingSubscribeModal from '@/app/dashboard/billing/BillingSubscribeModal';
import PlannerUpgradePanel from './PlannerUpgradePanel';
import { normalizePlanStatus } from '@/utils/planStatus';
import { track } from '@/lib/track';

const PLANNER_CATEGORY_KEYS = ['format', 'proposal', 'context', 'tone', 'reference'] as const;
const CATEGORY_STYLES: Record<string, string> = {
  format: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  proposal: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  context: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  tone: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  reference: 'bg-pink-50 text-pink-700 ring-1 ring-pink-200',
};

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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

function getWeekStartISO(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

const PlannerRowCard = ({ slot, onOpen }: { slot: PlannerUISlot; onOpen: (slot: PlannerUISlot) => void }) => {
  const { dayOfWeek, blockStartHour, title, categories, expectedMetrics, status } = slot;

  const norm = ((dayOfWeek % 7) + 7) % 7;
  const dayLabel = DAYS_PT[norm];
  const end = (blockStartHour + 3) % 24;
  const blockLabel = `${String(blockStartHour).padStart(2, '0')}h - ${String(end).padStart(2, '0')}h`;

  const expectedViewsNum =
    typeof expectedMetrics?.viewsP50 === 'number' ? (expectedMetrics.viewsP50 as number) : null;
  const expectedViewsLabel =
    expectedViewsNum && expectedViewsNum > 0 ? `${(expectedViewsNum / 1000).toFixed(1)}k` : null;

  const isTest = status === 'test';

  const themeKeyword = (() => {
    const raw = String((slot as any).themeKeyword || '').trim();
    if (raw) return raw;
    const first = Array.isArray((slot as any).themes) && (slot as any).themes[0]
      ? String((slot as any).themes[0])
      : '';
    const simple = first.split(/[:\-–—|]/)[0]?.trim() || first.trim();
    return simple;
  })();

  const categoryItems: React.ReactNode[] = Object.entries(categories ?? {}).reduce<React.ReactNode[]>(
    (acc, [key, value]) => {
      if (!(PLANNER_CATEGORY_KEYS as readonly string[]).includes(key)) return acc;
      const valueAsString = Array.isArray(value) ? value.join(',') : value ?? '';
      const raw = commaSeparatedIdsToLabels(String(valueAsString), key as any);
      const labels = String(raw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/_/g, ' ').toLowerCase())
        .map((s) =>
          s
            .split(' ')
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
        );
      if (!labels.length) return acc;
      const style = CATEGORY_STYLES[key] ?? 'bg-gray-100 text-gray-700 ring-1 ring-gray-200';
      labels.forEach((label) => {
        acc.push(
          <span
            key={`${key}:${label}`}
            className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full ${style} whitespace-nowrap leading-5`}
            title={`${key}: ${label}`}
          >
            {label}
          </span>
        );
      });
      return acc;
    },
    []
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 w-full hover:shadow-md transition-shadow duration-200">
      <div className="grid grid-cols-12 gap-3 sm:gap-4 items-center">
        <div className="col-span-12 sm:col-span-3 flex sm:block items-center gap-3 min-w-0">
          <div className="shrink-0 text-left">
            <div className="text-lg sm:text-xl font-extrabold tracking-tight text-gray-900">{dayLabel}</div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs sm:text-sm">
              <Clock size={12} /> {blockLabel}
            </div>
            {themeKeyword && (
              <div className="mt-1">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 ring-1 ring-pink-200 text-[11px] sm:text-xs max-w-[160px] truncate"
                  title={`Tema: ${themeKeyword}`}
                >
                  <Sparkles size={12} />
                  <span className="truncate">{themeKeyword}</span>
                </span>
              </div>
            )}
          </div>

          <div
            className="min-w-0 sm:mt-2 text-[11px] sm:text-xs text-pink-600 font-semibold truncate"
            title={String(title ?? '')}
          >
            {String(title ?? '')}
          </div>
        </div>

        <div className="col-span-12 sm:col-span-6 min-w-0">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {categoryItems.length > 0 ? (
              categoryItems
            ) : (
              <span className="text-sm text-gray-400">Sem categorias definidas</span>
            )}
          </div>
        </div>

        <div className="col-span-12 sm:col-span-3 flex items-center justify-between gap-2">
          {isTest ? (
            <div className="flex items-center sm:flex-col sm:items-end text-yellow-600">
              <TestTube2 size={18} className="mr-2 sm:mr-0" />
              <span className="text-xs sm:text-sm font-bold">TESTE</span>
            </div>
          ) : expectedViewsLabel ? (
            <div className="text-left">
              <div className="text-xl sm:text-2xl font-bold text-green-600 leading-none">{expectedViewsLabel}</div>
              <div className="text-[11px] sm:text-xs text-gray-500">views esperadas</div>
            </div>
          ) : (
            <div className="text-[11px] sm:text-xs text-gray-500">Sem estimativa</div>
          )}

          <button
            className="ml-auto sm:ml-0 text-pink-600 hover:text-pink-700 mt-0 sm:mt-2 inline-flex items-center text-sm font-semibold"
            onClick={() => onOpen(slot)}
          >
            Ver mais <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

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
    loading,
    error,
    saveSlots,
    locked,
    lockedReason,
  } = usePlannerData({ userId, publicMode, targetSlotsPerWeek: 7 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<PlannerUISlot | null>(null);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [showBillingModal, setShowBillingModal] = useState(false);
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
        setShowBillingModal(true);
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

  const sortedSlots = useMemo(() => {
    if (!slots) return [] as PlannerUISlot[];
    return [...slots].sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.blockStartHour - b.blockStartHour;
    });
  }, [slots]);

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
          onSubscribe={() => setShowBillingModal(true)}
          billingHref="/dashboard/billing"
        />
        <BillingSubscribeModal open={showBillingModal} onClose={() => setShowBillingModal(false)} />
      </>
    );
  }

  if (loading) {
    return (
      <div className="text-center p-8">
        <span className="text-gray-500">Carregando planejamento...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <span className="text-red-500">{error}</span>
      </div>
    );
  }

  if (!slots || slots.length === 0) {
    return (
      <div className="text-center p-8">
        <span className="text-gray-500">Nenhuma sugestão de conteúdo encontrada.</span>
      </div>
    );
  }

  return (
    <>
      {savingError && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {savingError}
        </div>
      )}

      <div className="space-y-3">
        {sortedSlots.map((slot, index) => (
          <PlannerRowCard key={`${slot.dayOfWeek}-${slot.blockStartHour}-${index}`} slot={slot} onOpen={openModal} />
        ))}
      </div>

      <PlannerSlotModal
        open={isModalOpen}
        onClose={closeModal}
        userId={userId}
        weekStartISO={weekStartISO}
        slot={toPlannerSlotData(selectedSlot)}
        onSave={handleSave}
        readOnly={publicMode || locked}
        canGenerate={canGenerate}
        showGenerateCta={false}
        onUpgradeRequest={() => setShowBillingModal(true)}
        upgradeMessage="Finalize a configuração necessária para gerar roteiros com IA."
      />

      {!publicMode && (
        <BillingSubscribeModal open={showBillingModal} onClose={() => setShowBillingModal(false)} />
      )}
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
  const [showBillingModal, setShowBillingModal] = useState(false);

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
      <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
      {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
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
            onSubscribe={() => setShowBillingModal(true)}
            billingHref="/dashboard/billing"
          />
          <BillingSubscribeModal
            open={showBillingModal}
            onClose={() => setShowBillingModal(false)}
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
