"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface PlannerUISlot {
  slotId?: string;
  dayOfWeek: number; // 1..7
  blockStartHour: number; // 0,3,6,9,12,15,18,21 (UI só exibe 9,12,15,18)
  format: string;
  categories: { context?: string[]; tone?: string; proposal?: string[]; reference?: string[] };
  contentIntent?: string[];
  narrativeForm?: string[];
  contentSignals?: string[];
  stance?: string[];
  proofStyle?: string[];
  commercialMode?: string[];
  status: 'planned' | 'drafted' | 'test' | 'posted';
  isExperiment?: boolean;
  expectedMetrics?: { viewsP50?: number; viewsP90?: number; sharesP50?: number };
  title?: string;
  scriptShort?: string;
  themes?: string[];
  themeKeyword?: string;
  rationale?: string;
  recordingTimeSec?: number;
  aiVersionId?: string;
  isSaved?: boolean;
}

export interface TimeBlockScoreUI {
  dayOfWeek: number;
  blockStartHour: number;
  score: number; // 0..1
}

const TARGET_SUGGESTIONS = 5; // regra: sugerir 3..5; usamos 5 como teto
const PERIOD_DAYS = 90;       // janela histórica
const PLANNER_UI_CACHE_TTL_MS = 30_000;
const PLANNER_UI_CACHE_MAX_ENTRIES = 40;
const PLANNER_UI_BOOT_CACHE_TTL_MS = 5 * 60_000;
const PLANNER_UI_BOOT_CACHE_PREFIX = 'planner-ui-boot:v2:';

type PlannerSnapshot = {
  slots: PlannerUISlot[] | null;
  heatmap: TimeBlockScoreUI[] | null;
  recommendations: PlannerUISlot[];
  locked: boolean;
  lockedReason: string | null;
  createdAt: number;
};

const plannerUiMemoryCache = new Map<string, PlannerSnapshot>();

function getPlannerUiBootCacheKey(key: string): string {
  return `${PLANNER_UI_BOOT_CACHE_PREFIX}${key}`;
}

function buildPlannerUiMemoryKey(params: {
  userId: string;
  targetUserId: string | null;
  publicMode: boolean;
  weekStart: Date;
  targetSlotsPerWeek: number;
}): string {
  return [
    params.publicMode ? 'public' : 'owner',
    params.userId,
    params.targetUserId ?? 'self',
    params.weekStart.toISOString(),
    String(params.targetSlotsPerWeek),
  ].join('|');
}

function readPlannerUiMemory(key: string): PlannerSnapshot | null {
  const value = plannerUiMemoryCache.get(key);
  if (!value) return null;
  if (Date.now() - value.createdAt > PLANNER_UI_CACHE_TTL_MS) {
    plannerUiMemoryCache.delete(key);
    return null;
  }
  return value;
}

function readPlannerUiBootCache(key: string): PlannerSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(getPlannerUiBootCacheKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlannerSnapshot>;
    const createdAt = Number(parsed?.createdAt);
    if (!Number.isFinite(createdAt)) {
      window.sessionStorage.removeItem(getPlannerUiBootCacheKey(key));
      return null;
    }
    if (Date.now() - createdAt > PLANNER_UI_BOOT_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(getPlannerUiBootCacheKey(key));
      return null;
    }
    return {
      slots: Array.isArray(parsed?.slots) ? (parsed.slots as PlannerUISlot[]) : null,
      heatmap: Array.isArray(parsed?.heatmap) ? (parsed.heatmap as TimeBlockScoreUI[]) : null,
      recommendations: Array.isArray(parsed?.recommendations) ? (parsed.recommendations as PlannerUISlot[]) : [],
      locked: Boolean(parsed?.locked),
      lockedReason: typeof parsed?.lockedReason === 'string' ? parsed.lockedReason : null,
      createdAt,
    };
  } catch {
    return null;
  }
}

function writePlannerUiBootCache(key: string, snapshot: PlannerSnapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(getPlannerUiBootCacheKey(key), JSON.stringify(snapshot));
  } catch {
    // noop
  }
}

function writePlannerUiMemory(key: string, snapshot: Omit<PlannerSnapshot, 'createdAt'>) {
  const nextSnapshot: PlannerSnapshot = {
    ...snapshot,
    createdAt: Date.now(),
  };
  plannerUiMemoryCache.set(key, nextSnapshot);
  writePlannerUiBootCache(key, nextSnapshot);
  if (plannerUiMemoryCache.size <= PLANNER_UI_CACHE_MAX_ENTRIES) return;
  const firstKey = plannerUiMemoryCache.keys().next().value;
  if (typeof firstKey === 'string') {
    plannerUiMemoryCache.delete(firstKey);
  }
}

function normalizeToMondayUTC(d: Date): Date {
  const dd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dd.getUTCDay(); // 0=Sun..6=Sat
  const offset = day === 0 ? -6 : 1 - day; // move to Monday
  const monday = new Date(dd);
  monday.setUTCDate(dd.getUTCDate() + offset);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

// compara arrays de slots superficialmente para evitar sets desnecessários
function slotsShallowEqual(a: PlannerUISlot[] | null, b: PlannerUISlot[] | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!, y = b[i]!;
    if (
      x.dayOfWeek !== y.dayOfWeek ||
      x.blockStartHour !== y.blockStartHour ||
      x.format !== y.format ||
      x.status !== y.status ||
      x.isExperiment !== y.isExperiment ||
      (x.title || '') !== (y.title || '') ||
      (x.themeKeyword || '') !== (y.themeKeyword || '') ||
      !!x.isSaved !== !!y.isSaved
    ) return false;
  }
  return true;
}

function heatmapShallowEqual(a: TimeBlockScoreUI[] | null, b: TimeBlockScoreUI[] | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!, y = b[i]!;
    if (x.dayOfWeek !== y.dayOfWeek || x.blockStartHour !== y.blockStartHour || x.score !== y.score) return false;
  }
  return true;
}

function mergePlanAndRecommendations(planSlots: PlannerUISlot[], recSlots: PlannerUISlot[]): PlannerUISlot[] {
  if (!recSlots.length) return planSlots;
  if (!planSlots.length) return recSlots;
  const map = new Map<string, PlannerUISlot>();
  recSlots.forEach((slot) => {
    const key = `${slot.dayOfWeek}-${slot.blockStartHour}`;
    map.set(key, slot);
  });
  planSlots.forEach((slot) => {
    const key = `${slot.dayOfWeek}-${slot.blockStartHour}`;
    map.set(key, slot);
  });
  return Array.from(map.values());
}

function mapApiSlot(raw: any, isSaved: boolean): PlannerUISlot {
  return {
    slotId: typeof raw?.slotId === 'string' ? raw.slotId : undefined,
    dayOfWeek: raw?.dayOfWeek,
    blockStartHour: raw?.blockStartHour,
    format: (typeof raw?.format === 'string' && raw.format) ? raw.format : 'reel',
    categories: raw?.categories || {},
    contentIntent: Array.isArray(raw?.contentIntent) ? raw.contentIntent : [],
    narrativeForm: Array.isArray(raw?.narrativeForm) ? raw.narrativeForm : [],
    contentSignals: Array.isArray(raw?.contentSignals) ? raw.contentSignals : [],
    stance: Array.isArray(raw?.stance) ? raw.stance : [],
    proofStyle: Array.isArray(raw?.proofStyle) ? raw.proofStyle : [],
    commercialMode: Array.isArray(raw?.commercialMode) ? raw.commercialMode : [],
    status: raw?.status,
    isExperiment: !!raw?.isExperiment,
    expectedMetrics: raw?.expectedMetrics || {},
    title: raw?.title,
    scriptShort: raw?.scriptShort,
    themes: raw?.themes || [],
    themeKeyword: raw?.themeKeyword,
    rationale: typeof raw?.rationale === 'string' ? raw.rationale : undefined,
    recordingTimeSec: typeof raw?.recordingTimeSec === 'number' ? raw.recordingTimeSec : undefined,
    aiVersionId: typeof raw?.aiVersionId === 'string' ? raw.aiVersionId : undefined,
    isSaved,
  };
}

function mapApiHeatmap(raw: any): TimeBlockScoreUI {
  return {
    dayOfWeek: raw?.dayOfWeek,
    blockStartHour: raw?.blockStartHour,
    score: typeof raw?.score === 'number' ? raw.score : 0,
  };
}

export function usePlannerData(params: {
  userId: string;
  targetUserId?: string | null;
  publicMode?: boolean;
  weekStart?: Date;
  targetSlotsPerWeek?: number;
}) {
  const {
    userId,
    targetUserId = null,
    publicMode = false,
    weekStart,
    targetSlotsPerWeek = TARGET_SUGGESTIONS,
  } = params;
  const normalizedTargetUserId = typeof targetUserId === 'string' && targetUserId.trim()
    ? targetUserId.trim()
    : null;

  // ✅ Congela o weekStart default no primeiro render (evita drift e re-buscas)
  const defaultWeekStartRef = useRef<Date | null>(null);
  const normalizedWeekStart = useMemo(() => {
    if (weekStart instanceof Date) return normalizeToMondayUTC(weekStart);
    if (!defaultWeekStartRef.current) {
      defaultWeekStartRef.current = normalizeToMondayUTC(new Date());
    }
    return defaultWeekStartRef.current;
  }, [weekStart]);

  const [slots, setSlots] = useState<PlannerUISlot[] | null>(null);
  const [heatmap, setHeatmap] = useState<TimeBlockScoreUI[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<boolean>(false);
  const [lockedReason, setLockedReason] = useState<string | null>(null);

  // controle de concorrência
  const fetchIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const recommendationsRef = useRef<PlannerUISlot[]>([]);

  const safeSetSlots = useCallback((next: PlannerUISlot[] | null) => {
    setSlots(prev => (slotsShallowEqual(prev, next) ? prev : next));
  }, []);
  const safeSetHeatmap = useCallback((next: TimeBlockScoreUI[] | null) => {
    setHeatmap(prev => (heatmapShallowEqual(prev, next) ? prev : next));
  }, []);
  const plannerUiMemoryKey = useMemo(
    () =>
      buildPlannerUiMemoryKey({
        userId,
        targetUserId: normalizedTargetUserId,
        publicMode,
        weekStart: normalizedWeekStart,
        targetSlotsPerWeek: targetSlotsPerWeek ?? TARGET_SUGGESTIONS,
      }),
    [userId, normalizedTargetUserId, publicMode, normalizedWeekStart, targetSlotsPerWeek]
  );
  const applySnapshot = useCallback((snapshot: Omit<PlannerSnapshot, 'createdAt'>) => {
    recommendationsRef.current = snapshot.recommendations;
    setLocked(snapshot.locked);
    setLockedReason(snapshot.lockedReason);
    safeSetSlots(snapshot.slots);
    safeSetHeatmap(snapshot.heatmap);
  }, [safeSetHeatmap, safeSetSlots]);

  const fetchData = useCallback(async () => {
    // cancela requisição anterior (se houver)
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const myId = ++fetchIdRef.current;
    setError(null);

    if (!userId) {
      if (fetchIdRef.current !== myId) return;
      recommendationsRef.current = [];
      safeSetSlots(null);
      safeSetHeatmap(null);
      setLocked(false);
      setLockedReason(null);
      setLoading(false);
      return;
    }

    let cachedSnapshot = readPlannerUiMemory(plannerUiMemoryKey);
    if (!cachedSnapshot) {
      cachedSnapshot = readPlannerUiBootCache(plannerUiMemoryKey);
      if (cachedSnapshot) {
        writePlannerUiMemory(plannerUiMemoryKey, {
          slots: cachedSnapshot.slots,
          heatmap: cachedSnapshot.heatmap,
          recommendations: cachedSnapshot.recommendations,
          locked: cachedSnapshot.locked,
          lockedReason: cachedSnapshot.lockedReason,
        });
      }
    }
    const hasWarmCache = Boolean(cachedSnapshot);
    if (cachedSnapshot) {
      applySnapshot({
        slots: cachedSnapshot.slots,
        heatmap: cachedSnapshot.heatmap,
        recommendations: cachedSnapshot.recommendations,
        locked: cachedSnapshot.locked,
        lockedReason: cachedSnapshot.lockedReason,
      });
      setLoading(false);
    } else {
      setLoading(true);
      setLocked(false);
      setLockedReason(null);
      safeSetSlots(null);
      safeSetHeatmap(null);
    }

    try {
      if (publicMode) {
        const qs = new URLSearchParams({
          userId,
          weekStart: normalizedWeekStart.toISOString(),
          targetSlotsPerWeek: String(targetSlotsPerWeek ?? TARGET_SUGGESTIONS),
          periodDays: String(PERIOD_DAYS),
        });
        const res = await fetch(`/api/planner/public?${qs.toString()}`, { cache: 'no-store', signal: controller.signal });
        if (res.status === 403) {
          let message = 'Plano inativo. Assine para acessar o planner.';
          try {
            const data = await res.json();
            message = data?.error || message;
          } catch (_) {
            // noop
          }
          if (fetchIdRef.current !== myId) return;
          setLocked(true);
          setLockedReason(message);
          recommendationsRef.current = [];
          safeSetSlots(null);
          safeSetHeatmap(null);
          return;
        }
        if (res.status === 401) {
          throw new Error('Você precisa estar autenticado para acessar o planner.');
        }
        if (!res.ok) throw new Error('Falha ao buscar planner público');
        const data = await res.json();

        if (fetchIdRef.current !== myId) return; // resposta obsoleta

        if (data.mode === 'plan' && data.plan) {
          const planSlots: PlannerUISlot[] = (data.plan.slots || []).map((s: any) => mapApiSlot(s, true));
          const snapshot = {
            slots: planSlots,
            heatmap: null,
            recommendations: [] as PlannerUISlot[],
            locked: false,
            lockedReason: null,
          };
          applySnapshot(snapshot);
          writePlannerUiMemory(plannerUiMemoryKey, snapshot);
        } else {
          const recSlots: PlannerUISlot[] = (data.recommendations || []).map((r: any) => mapApiSlot(r, false));
          const hm: TimeBlockScoreUI[] = (data.heatmap || []).map((h: any) => mapApiHeatmap(h));
          const snapshot = {
            slots: recSlots,
            heatmap: hm,
            recommendations: recSlots,
            locked: false,
            lockedReason: null,
          };
          applySnapshot(snapshot);
          writePlannerUiMemory(plannerUiMemoryKey, snapshot);
        }
      } else {
        // Dono (autenticado) — usa endpoint batch para reduzir round-trips
        const qs = new URLSearchParams({
          weekStart: normalizedWeekStart.toISOString(),
          targetSlotsPerWeek: String(targetSlotsPerWeek ?? TARGET_SUGGESTIONS),
          periodDays: String(PERIOD_DAYS),
        });
        if (normalizedTargetUserId) {
          qs.set('targetUserId', normalizedTargetUserId);
        }

        const batchRes = await fetch(`/api/planner/batch?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (batchRes.status === 403) {
          let message = 'Plano inativo. Assine para acessar o planner.';
          try {
            const data = await batchRes.json();
            message = data?.error || message;
          } catch (_) {
            // noop
          }
          if (fetchIdRef.current !== myId) return;
          setLocked(true);
          setLockedReason(message);
          recommendationsRef.current = [];
          safeSetSlots(null);
          safeSetHeatmap(null);
          return;
        }

        if (batchRes.status === 401) {
          throw new Error('Você precisa estar autenticado para acessar o planner.');
        }

        if (!batchRes.ok) throw new Error('Falha ao buscar dados do planner');

        const batchData = await batchRes.json();
        if (fetchIdRef.current !== myId) return; // resposta obsoleta

        const planSlots: PlannerUISlot[] = (batchData?.plan?.slots || []).map((s: any) => mapApiSlot(s, true));
        const recSlots: PlannerUISlot[] = (batchData?.recommendations || []).map((r: any) => mapApiSlot(r, false));
        const mergedSlots = mergePlanAndRecommendations(planSlots, recSlots);
        const hm: TimeBlockScoreUI[] = (batchData?.heatmap || []).map((h: any) => mapApiHeatmap(h));
        const snapshot = {
          slots: mergedSlots,
          heatmap: hm,
          recommendations: recSlots,
          locked: false,
          lockedReason: null,
        };
        applySnapshot(snapshot);
        writePlannerUiMemory(plannerUiMemoryKey, snapshot);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // requisição cancelada, ignora
      if (!hasWarmCache) {
        setError(err?.message || 'Erro inesperado');
      }
    } finally {
      if (fetchIdRef.current === myId && !hasWarmCache) {
        setLoading(false);
      }
    }
  }, [
    applySnapshot,
    plannerUiMemoryKey,
    publicMode,
    safeSetHeatmap,
    safeSetSlots,
    userId,
    normalizedWeekStart,
    targetSlotsPerWeek,
    normalizedTargetUserId,
  ]);

  // 🔧 Sem “de-dupe” manual: no Strict Mode a 1ª execução é abortada, a 2ª completa normalmente
  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  const saveSlots = useCallback(async (updatedSlots: PlannerUISlot[], userTimeZone?: string) => {
    const slotsToPersist = (updatedSlots || []).filter((slot) => slot && slot.isSaved !== false);
    const body = {
      weekStart: normalizedWeekStart.toISOString(),
      userTimeZone,
      targetUserId: normalizedTargetUserId || undefined,
      slots: slotsToPersist,
    };
    const res = await fetch('/api/planner/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 403) {
      let message = 'Plano inativo. Assine para salvar seu planejamento.';
      try {
        const data = await res.json();
        message = data?.error || message;
      } catch (_) {
        // noop
      }
      setLocked(true);
      setLockedReason(message);
      throw new Error(message);
    }
    if (res.status === 401) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    if (!res.ok) throw new Error('Falha ao salvar plano');
    const data = await res.json();
    const planSlots: PlannerUISlot[] = (data?.plan?.slots || []).map((s: any) => mapApiSlot(s, true));
    const mergedSlots = mergePlanAndRecommendations(planSlots, recommendationsRef.current || []);
    safeSetSlots(mergedSlots);
    setLocked(false);
    setLockedReason(null);
    writePlannerUiMemory(plannerUiMemoryKey, {
      slots: mergedSlots,
      heatmap,
      recommendations: recommendationsRef.current || [],
      locked: false,
      lockedReason: null,
    });
    return planSlots;
  }, [normalizedWeekStart, normalizedTargetUserId, safeSetSlots, plannerUiMemoryKey, heatmap]);

  return {
    weekStart: normalizedWeekStart,
    slots,
    heatmap,
    loading,
    error,
    locked,
    lockedReason,
    reload: fetchData,
    saveSlots,
  };
}
