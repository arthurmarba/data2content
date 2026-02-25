"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ContentPlannerCalendar,
} from '@/app/mediakit/components/ContentPlannerCalendar';
import type { PlannerSlotData as PlannerSlotDataModal } from '@/app/mediakit/components/PlannerSlotModal';
import { usePlannerData, PlannerUISlot } from '@/hooks/usePlannerData';
import { useBillingStatus } from '@/app/hooks/useBillingStatus';
import { track } from '@/lib/track';
import { openPaywallModal } from '@/utils/paywallModal';

const CreatorQuickSearch = dynamic(
  () => import('@/app/admin/creator-dashboard/components/CreatorQuickSearch'),
  { ssr: false, loading: () => null }
);

const PlannerSlotModal = dynamic(() => import('@/app/mediakit/components/PlannerSlotModal'), {
  ssr: false,
  loading: () => null,
});

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

type ViewerInfo = {
  id?: string | null;
  role?: string | null;
  name?: string | null;
};

type AdminTargetUser = {
  id: string;
  name: string;
  profilePictureUrl?: string | null;
};

const ADMIN_PLANNER_TARGET_STORAGE_KEY = 'planner_admin_target_user';

export default function PlannerClientPage({ viewer }: { viewer?: ViewerInfo }) {
  const { data: session, status } = useSession();
  const sessionUser = (session?.user as any) ?? null;
  const viewerRoleFromProp = typeof viewer?.role === 'string' ? viewer.role.trim().toLowerCase() : null;
  const sessionRole = typeof sessionUser?.role === 'string' ? sessionUser.role.trim().toLowerCase() : null;
  const sessionUserId =
    typeof viewer?.id === 'string' && viewer.id.trim().length > 0
      ? viewer.id.trim()
      : typeof sessionUser?.id === 'string' && sessionUser.id.trim().length > 0
        ? sessionUser.id.trim()
        : '';
  const isAdminViewer = (viewerRoleFromProp ?? sessionRole) === 'admin';
  const [adminTargetUser, setAdminTargetUser] = useState<AdminTargetUser | null>(null);
  const targetUserId = isAdminViewer && adminTargetUser?.id ? adminTargetUser.id : null;
  const isActingOnBehalf = Boolean(
    isAdminViewer &&
    targetUserId &&
    sessionUserId &&
    targetUserId !== sessionUserId
  );
  const activeUserId = targetUserId ?? sessionUserId;

  const router = useRouter();
  const searchParams = useSearchParams();
  const billing = useBillingStatus({ auto: !isAdminViewer });
  const isBillingLoading = isAdminViewer ? false : billing.isLoading;

  const {
    slots,
    heatmap,
    loading,
    error,
    saveSlots,
    locked,
    lockedReason,
  } = usePlannerData({
    userId: activeUserId,
    targetUserId: isActingOnBehalf ? targetUserId : null,
    targetSlotsPerWeek: 7,
  });

  const [selectedSlot, setSelectedSlot] = useState<PlannerUISlot | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  const hasHydratedAdminTargetRef = useRef(false);
  const previousActiveUserIdRef = useRef<string | null>(null);
  const weekStartISO = useMemo(() => getWeekStartISO(), []);

  // Check access
  // Note: canAccessPlanner and getPlanStatus might need to be imported or implemented if not available
  // Assuming they are available as per previous code, but if not, we use billing flags
  const hasAccess =
    isAdminViewer || billing.hasPremiumAccess || billing.isTrialActive || billing.normalizedStatus === 'active';
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

  useEffect(() => {
    if (!isAdminViewer || hasHydratedAdminTargetRef.current || typeof window === 'undefined') return;
    hasHydratedAdminTargetRef.current = true;
    try {
      const raw = window.sessionStorage.getItem(ADMIN_PLANNER_TARGET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<AdminTargetUser>;
      if (typeof parsed?.id !== 'string' || typeof parsed?.name !== 'string') return;
      const normalizedId = parsed.id.trim();
      const normalizedName = parsed.name.trim();
      if (!normalizedId || !normalizedName) return;
      setAdminTargetUser({
        id: normalizedId,
        name: normalizedName,
        profilePictureUrl: parsed.profilePictureUrl ?? null,
      });
    } catch {
      // noop
    }
  }, [isAdminViewer]);

  useEffect(() => {
    if (!isAdminViewer || typeof window === 'undefined') return;
    try {
      if (!adminTargetUser?.id) {
        window.sessionStorage.removeItem(ADMIN_PLANNER_TARGET_STORAGE_KEY);
        return;
      }
      window.sessionStorage.setItem(ADMIN_PLANNER_TARGET_STORAGE_KEY, JSON.stringify(adminTargetUser));
    } catch {
      // noop
    }
  }, [adminTargetUser, isAdminViewer]);

  useEffect(() => {
    const previous = previousActiveUserIdRef.current;
    previousActiveUserIdRef.current = activeUserId;
    if (!previous || previous === activeUserId) return;

    setSelectedSlot(null);
    setIsModalOpen(false);
    setSavingError(null);

    const params = new URLSearchParams(searchParams.toString());
    if (!params.has('slotId')) return;
    params.delete('slotId');
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [activeUserId, router, searchParams]);

  const handleAdminSelect = useCallback((creator: AdminTargetUser) => {
    setAdminTargetUser({
      id: creator.id,
      name: creator.name,
      profilePictureUrl: creator.profilePictureUrl,
    });
  }, []);

  const handleAdminClear = useCallback(() => {
    setAdminTargetUser(null);
  }, []);

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
    if (!params.has('slotId')) return;
    params.delete('slotId');
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

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
      } catch (err: any) {
        const message = err?.message || 'Não foi possível salvar o planejamento.';
        setSavingError(message);
        throw err;
      }
    },
    [canEdit, slots, saveSlots, handleCloseSlot]
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
      } catch (err: any) {
        const message = err?.message || 'Não foi possível excluir a pauta.';
        setSavingError(message);
        throw err;
      }
    },
    [canEdit, slots, saveSlots, handleCloseSlot]
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
      } catch (err: any) {
        const message = err?.message || 'Não foi possível duplicar a pauta.';
        setSavingError(message);
        throw err;
      }
    },
    [canEdit, slots, saveSlots]
  );

  const handleRequestSubscribe = useCallback(() => {
    openPaywallModal();
    track('planner_subscribe_clicked');
  }, []);

  const handleDeleteFromCalendar = useCallback((slot: PlannerUISlot) => {
    const data = toPlannerSlotData(slot);
    if (data) void handleDelete(data);
  }, [handleDelete]);

  if (status === 'loading' && !viewer) return null;

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="dashboard-page-shell py-8">
        {isAdminViewer ? (
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-md">
              <CreatorQuickSearch
                onSelect={handleAdminSelect}
                selectedCreatorName={adminTargetUser?.name || null}
                selectedCreatorPhotoUrl={adminTargetUser?.profilePictureUrl || null}
                onClear={handleAdminClear}
                apiPrefix="/api/admin"
              />
            </div>
            <p className="text-xs text-slate-500">
              {isActingOnBehalf
                ? `Visualizando calendário de ${adminTargetUser?.name}.`
                : 'Visualizando seu próprio calendário.'}
            </p>
          </div>
        ) : null}

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
              userId={activeUserId}
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
              onDeleteSlot={handleDeleteFromCalendar}
            />
          </div>
        </div>
      </div>

      {isModalOpen ? (
        <PlannerSlotModal
          open={isModalOpen}
          onClose={handleCloseSlot}
          userId={activeUserId}
          targetUserId={isActingOnBehalf ? targetUserId : null}
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
      ) : null}
    </div>
  );
}
