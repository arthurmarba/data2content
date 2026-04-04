"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import {
  ContentPlannerCalendar,
} from '@/app/mediakit/components/ContentPlannerCalendar';
import type { PlannerSlotData as PlannerSlotDataModal } from '@/app/mediakit/components/PlannerSlotModal';
import { usePlannerData, PlannerUISlot } from '@/hooks/usePlannerData';
import { useBillingStatus } from '@/app/hooks/useBillingStatus';
import { useToast } from '@/app/components/ui/ToastA11yProvider';
import { track } from '@/lib/track';
import { redirectToGoogleConsentLogin } from '@/lib/auth/googleLogin';
import { openPaywallModal } from '@/utils/paywallModal';
import { PREVIEW_PLANNER_HEATMAP, PREVIEW_PLANNER_SLOTS } from './mockPlannerData';

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

export default function PlannerClientPage({
  viewer,
  compactView = false,
  onNavigateToScripts,
}: {
  viewer?: ViewerInfo;
  compactView?: boolean;
  onNavigateToScripts?: () => void;
}) {
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
  const isAuthenticated = activeUserId.length > 0;
  const isPreviewMode = !isAdminViewer && !isAuthenticated && status === 'unauthenticated';

  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const billing = useBillingStatus({ auto: !isAdminViewer });
  const isBillingLoading = isAdminViewer ? false : billing.isLoading;

  const {
    slots,
    heatmap,
    loading,
    error,
    saveSlots,
    reload,
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
  const hasAccess = isAdminViewer || billing.hasPremiumAccess;
  const effectiveLocked = locked || !hasAccess;
  const effectiveLockedReason = effectiveLocked
    ? lockedReason ?? 'Atualize seu plano para acessar o planejador completo.'
    : undefined;
  const canEdit = hasAccess;
  const visibleSlots = isPreviewMode ? PREVIEW_PLANNER_SLOTS : slots;
  const visibleHeatmap = isPreviewMode ? PREVIEW_PLANNER_HEATMAP : heatmap;
  const visibleLoading = isPreviewMode ? false : loading;
  const visibleError = isPreviewMode ? null : savingError ?? error;
  const visibleLocked = isPreviewMode ? false : effectiveLocked;
  const visibleLockedReason = isPreviewMode ? null : effectiveLockedReason;

  const requestGoogleLogin = useCallback(() => {
    const callbackUrl =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : '/calendar';
    redirectToGoogleConsentLogin(callbackUrl);
  }, []);

  const ensurePlannerAccess = useCallback(
    async (source: string) => {
      if (!isAuthenticated) {
        openPaywallModal({
          context: 'planning',
          source,
          returnTo:
            typeof window !== 'undefined'
              ? `${window.location.pathname}${window.location.search}${window.location.hash}`
              : '/calendar',
        });
        return false;
      }

      if (!hasAccess) {
        openPaywallModal({
          context: 'planning',
          source,
          returnTo:
            typeof window !== 'undefined'
              ? `${window.location.pathname}${window.location.search}${window.location.hash}`
              : '/calendar',
        });
        return false;
      }

      return true;
    },
    [hasAccess, isAuthenticated]
  );

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
    if (isPreviewMode) {
      void requestGoogleLogin();
      return;
    }
    setSelectedSlot(slot);
    setIsModalOpen(true);
    setSavingError(null);
    track('planner_slot_opened', { slotId: slot.slotId });
  }, [isPreviewMode, requestGoogleLogin]);

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
      if (!(await ensurePlannerAccess('planner_save_blocked'))) {
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
        const persistedSlots = await saveSlots(list);
        setSavingError(null);
        const persisted = Array.isArray(persistedSlots)
          ? persistedSlots.find((slot) => {
              if (updated.slotId && slot.slotId) return slot.slotId === updated.slotId;
              return slot.dayOfWeek === updated.dayOfWeek && slot.blockStartHour === updated.blockStartHour;
            })
          : null;
        const pautaLabel = (
          persisted?.title ||
          updated.title ||
          updated.themeKeyword ||
          (Array.isArray(updated.themes) ? updated.themes[0] : '')
        )?.trim();
        toast({
          variant: 'success',
          title: 'Pauta salva e enviada para Roteiro.',
          description: pautaLabel ? `Pauta: ${pautaLabel}` : undefined,
          action: {
            label: 'Ver roteiro',
            closeOnAction: true,
            onClick: () => router.push("/calendar"),
          },
        });
        handleCloseSlot();
      } catch (err: any) {
        const message = err?.message || 'Não foi possível salvar o planejamento.';
        setSavingError(message);
        throw err;
      }
    },
    [ensurePlannerAccess, slots, saveSlots, toast, router, handleCloseSlot]
  );

  const handleDelete = useCallback(
    async (target: PlannerSlotDataModal) => {
      if (!(await ensurePlannerAccess('planner_delete_blocked'))) {
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
    [ensurePlannerAccess, slots, saveSlots, handleCloseSlot]
  );

  const handleDuplicate = useCallback(
    async (target: PlannerSlotDataModal) => {
      if (!(await ensurePlannerAccess('planner_duplicate_blocked'))) {
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
    [ensurePlannerAccess, slots, saveSlots]
  );

  const handleRequestSubscribe = useCallback(() => {
    openPaywallModal({
      context: 'planning',
      source: 'planner_subscribe_cta',
      returnTo:
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}${window.location.hash}`
          : '/calendar',
    });
    track('planner_subscribe_clicked');
  }, []);

  const handleDeleteFromCalendar = useCallback((slot: PlannerUISlot) => {
    const data = toPlannerSlotData(slot);
    if (data) void handleDelete(data);
  }, [handleDelete]);

  const handleGenerateThemes = useCallback(
    async (slot: PlannerUISlot) => {
      const response = await fetch('/api/planner/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek: slot.dayOfWeek,
          blockStartHour: slot.blockStartHour,
          categories: slot.categories || {},
          themeKeyword: slot.themeKeyword || undefined,
          title: slot.title || undefined,
          includeCaptions: true,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Não foi possível gerar pautas para este horário.');
      }

      return {
        keyword: typeof payload?.keyword === 'string' ? payload.keyword : undefined,
        themes: Array.isArray(payload?.themes) ? (payload.themes as string[]) : [],
      };
    },
    []
  );

  const handleSelectTheme = useCallback(
    async (slot: PlannerUISlot, theme: string, themes: string[], keyword?: string) => {
      if (!(await ensurePlannerAccess('planner_theme_select_blocked'))) {
        throw new Error('Salvamento bloqueado.');
      }

      const list: PlannerUISlot[] = Array.isArray(slots) ? [...slots] : [];
      const idx = list.findIndex((item) => {
        if (slot.slotId && item.slotId) return item.slotId === slot.slotId;
        return item.dayOfWeek === slot.dayOfWeek && item.blockStartHour === slot.blockStartHour;
      });

      const base = idx >= 0 ? list[idx]! : slot;
      const merged: PlannerUISlot = {
        ...base,
        ...slot,
        title: theme,
        scriptShort: theme,
        themes,
        themeKeyword: keyword ?? slot.themeKeyword ?? base.themeKeyword,
        isSaved: true,
      };

      if (idx >= 0) {
        list[idx] = merged;
      } else {
        list.push(merged);
      }

      const persistedSlots = await saveSlots(list);
      await reload();

      const persisted = Array.isArray(persistedSlots)
        ? persistedSlots.find((item) => {
            if (merged.slotId && item.slotId) return item.slotId === merged.slotId;
            return item.dayOfWeek === merged.dayOfWeek && item.blockStartHour === merged.blockStartHour;
          })
        : null;

      toast({
        variant: 'success',
        title: 'Pauta salva no calendário e em Meus Roteiros.',
        description: theme,
        action: {
          label: 'Ver roteiro',
          closeOnAction: true,
          onClick: () => router.push('/calendar'),
        },
      });

      return {
        ...(persisted ?? merged),
        isSaved: true,
      } as PlannerUISlot;
    },
    [ensurePlannerAccess, slots, saveSlots, reload, toast, router]
  );

  if (status === 'loading' && !isAuthenticated) {
    return (
      <div className="min-h-0 bg-transparent">
        <div className="py-3 sm:py-4">
          <div className="mb-3 sm:mb-5">
            <p className="dashboard-muted-label mb-2">Planejamento</p>
            <h1 className="text-2xl font-semibold leading-tight tracking-[-0.03em] text-zinc-950 sm:text-[30px]">Planejador de Conteúdo</h1>
            <p className="mt-1.5 text-[15px] leading-6 text-zinc-500">Carregando calendário...</p>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {[1, 2, 3, 4].map((row) => (
              <div
                key={`planner-shell-loading-${row}`}
                className={[
                  'animate-pulse rounded-[24px] border border-zinc-100/80 bg-zinc-50/80 p-4 shadow-[0_12px_28px_rgba(24,24,27,0.03)] backdrop-blur-xl',
                  row > 2 ? 'hidden xl:block' : '',
                ].join(' ')}
              >
                <div className="mb-3 h-11 w-56 rounded-xl bg-slate-100" />
                <div className="mb-3 h-9 w-full rounded-xl bg-slate-100" />
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <span key={`planner-shell-loading-${row}-${index}`} className="h-8 rounded-lg bg-slate-100" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 bg-transparent">
      <div className={compactView ? "py-1.5" : "py-2"}>
        {isAdminViewer ? (
          <div
            className={`mb-4 border ${compactView ? "rounded-[1.05rem] border-zinc-100/80 bg-zinc-50/52 px-2.5 py-2.5" : "rounded-[24px] border-zinc-100/80 bg-zinc-50/76 p-3 shadow-[0_10px_24px_rgba(24,24,27,0.03)] backdrop-blur-xl"}`}
          >
            {compactView ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] bg-sky-50 text-sky-500 ring-1 ring-sky-100/90">
                    <CalendarClock className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="dashboard-type-section-title text-zinc-950">Pautas da semana</p>
                    <p className="dashboard-type-meta mt-1 text-zinc-500">
                      {isActingOnBehalf
                        ? `Visualizando o calendário de ${adminTargetUser?.name}.`
                        : 'Visualizando seu próprio calendário.'}
                    </p>
                  </div>
                </div>
                <div className="w-full">
                  <CreatorQuickSearch
                    onSelect={handleAdminSelect}
                    selectedCreatorName={adminTargetUser?.name || null}
                    selectedCreatorPhotoUrl={adminTargetUser?.profilePictureUrl || null}
                    onClear={handleAdminClear}
                    apiPrefix="/api/admin"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full sm:max-w-md">
                  <CreatorQuickSearch
                    onSelect={handleAdminSelect}
                    selectedCreatorName={adminTargetUser?.name || null}
                    selectedCreatorPhotoUrl={adminTargetUser?.profilePictureUrl || null}
                    onClear={handleAdminClear}
                    apiPrefix="/api/admin"
                  />
                </div>
                <p className="text-xs font-medium text-zinc-500">
                  {isActingOnBehalf
                    ? `Visualizando calendário de ${adminTargetUser?.name}.`
                    : 'Visualizando seu próprio calendário.'}
                </p>
              </div>
            )}
          </div>
        ) : null}


        <div className="space-y-4">
            {/* Insights Simplificados */}


            {/* Calendário */}
            <ContentPlannerCalendar
              userId={activeUserId}
              slots={visibleSlots}
              heatmap={visibleHeatmap}
              loading={visibleLoading}
              error={visibleError}
              compactView={compactView}
              canEdit={canEdit}
              publicMode={isPreviewMode}
              locked={visibleLocked}
              lockedReason={visibleLockedReason}
              isBillingLoading={isBillingLoading}
              onRequestSubscribe={handleRequestSubscribe}
              onOpenSlot={handleOpenSlot}
              onDeleteSlot={handleDeleteFromCalendar}
              onGenerateThemes={handleGenerateThemes}
              onSelectTheme={handleSelectTheme}
              onOpenSavedScript={onNavigateToScripts}
            />
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
