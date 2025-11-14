"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface PlannerUISlot {
  slotId?: string;
  dayOfWeek: number; // 1..7
  blockStartHour: number; // 0,3,6,9,12,15,18,21 (UI só exibe 9,12,15,18)
  format: string;
  categories: { context?: string[]; tone?: string; proposal?: string[]; reference?: string[] };
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
}

export interface TimeBlockScoreUI {
  dayOfWeek: number;
  blockStartHour: number;
  score: number; // 0..1
}

const TARGET_SUGGESTIONS = 5; // regra: sugerir 3..5; usamos 5 como teto
const PERIOD_DAYS = 90;       // janela histórica

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
      (x.themeKeyword || '') !== (y.themeKeyword || '')
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

export function usePlannerData(params: {
  userId: string;
  publicMode?: boolean;
  weekStart?: Date;
  targetSlotsPerWeek?: number;
}) {
  const { userId, publicMode = false, weekStart, targetSlotsPerWeek = TARGET_SUGGESTIONS } = params;

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

  const safeSetSlots = (next: PlannerUISlot[] | null) => {
    setSlots(prev => (slotsShallowEqual(prev, next) ? prev : next));
  };
  const safeSetHeatmap = (next: TimeBlockScoreUI[] | null) => {
    setHeatmap(prev => (heatmapShallowEqual(prev, next) ? prev : next));
  };

  const fetchData = useCallback(async () => {
    // cancela requisição anterior (se houver)
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const myId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    setLocked(false);
    setLockedReason(null);

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
          const planSlots: PlannerUISlot[] = (data.plan.slots || []).map((s: any) => ({
            slotId: typeof s.slotId === 'string' ? s.slotId : undefined,
            dayOfWeek: s.dayOfWeek,
            blockStartHour: s.blockStartHour,
            format: (typeof s.format === 'string' && s.format) ? s.format : 'reel',
            categories: s.categories || {},
            status: s.status,
            isExperiment: !!s.isExperiment,
            expectedMetrics: s.expectedMetrics || {},
            title: s.title,
            scriptShort: s.scriptShort,
            themes: s.themes || [],
            themeKeyword: s.themeKeyword,
            rationale: typeof s.rationale === 'string' ? s.rationale : undefined,
            recordingTimeSec: typeof s.recordingTimeSec === 'number' ? s.recordingTimeSec : undefined,
            aiVersionId: typeof s.aiVersionId === 'string' ? s.aiVersionId : undefined,
          }));
          safeSetSlots(planSlots);
          safeSetHeatmap(null); // público: quando vem plan, não há heatmap
        } else {
          const recSlots: PlannerUISlot[] = (data.recommendations || []).map((r: any) => ({
            slotId: typeof r.slotId === 'string' ? r.slotId : undefined,
            dayOfWeek: r.dayOfWeek,
            blockStartHour: r.blockStartHour,
            format: (typeof r.format === 'string' && r.format) ? r.format : 'reel',
            categories: r.categories || {},
            status: r.status,
            isExperiment: !!r.isExperiment,
            expectedMetrics: r.expectedMetrics || {},
            title: r.title,
            scriptShort: r.scriptShort,
            themes: r.themes || [],
            themeKeyword: r.themeKeyword,
            rationale: typeof r.rationale === 'string' ? r.rationale : undefined,
            recordingTimeSec: typeof r.recordingTimeSec === 'number' ? r.recordingTimeSec : undefined,
            aiVersionId: typeof r.aiVersionId === 'string' ? r.aiVersionId : undefined,
          }));
          safeSetSlots(recSlots);
          const hm: TimeBlockScoreUI[] = (data.heatmap || []).map((h: any) => ({
            dayOfWeek: h.dayOfWeek,
            blockStartHour: h.blockStartHour,
            score: typeof h.score === 'number' ? h.score : 0,
          }));
          safeSetHeatmap(hm);
        }
      } else {
        // Dono (autenticado) — busca plan e rec em paralelo (rec traz heatmap)
        const qsPlan = new URLSearchParams({ weekStart: normalizedWeekStart.toISOString() });
        const qsRec  = new URLSearchParams({
          weekStart: normalizedWeekStart.toISOString(),
          targetSlotsPerWeek: String(targetSlotsPerWeek ?? TARGET_SUGGESTIONS),
          periodDays: String(PERIOD_DAYS),
        });

        const [planRes, recRes] = await Promise.all([
          fetch(`/api/planner/plan?${qsPlan.toString()}`, { cache: 'no-store', signal: controller.signal }),
          fetch(`/api/planner/recommendations?${qsRec.toString()}`, { cache: 'no-store', signal: controller.signal }),
        ]);

        if (planRes.status === 403 || recRes.status === 403) {
          const blockedRes = planRes.status === 403 ? planRes : recRes;
          let message = 'Plano inativo. Assine para acessar o planner.';
          try {
            const data = await blockedRes.json();
            message = data?.error || message;
          } catch (_) {
            // noop
          }
          if (fetchIdRef.current !== myId) return;
          setLocked(true);
          setLockedReason(message);
          safeSetSlots(null);
          safeSetHeatmap(null);
          return;
        }

        if (planRes.status === 401 || recRes.status === 401) {
          throw new Error('Você precisa estar autenticado para acessar o planner.');
        }

        if (!planRes.ok && !recRes.ok) throw new Error('Falha ao buscar dados do planner');

        const [planData, recData] = await Promise.all([
          planRes.ok ? planRes.json() : Promise.resolve(null),
          recRes.ok ? recRes.json() : Promise.resolve(null),
        ]);

        if (fetchIdRef.current !== myId) return; // resposta obsoleta

        if (planData?.plan?.slots?.length) {
          const planSlots: PlannerUISlot[] = planData.plan.slots.map((s: any) => ({
            slotId: typeof s.slotId === 'string' ? s.slotId : undefined,
            dayOfWeek: s.dayOfWeek,
            blockStartHour: s.blockStartHour,
            format: (typeof s.format === 'string' && s.format) ? s.format : 'reel',
            categories: s.categories || {},
            status: s.status,
            isExperiment: !!s.isExperiment,
            expectedMetrics: s.expectedMetrics || {},
            title: s.title,
            scriptShort: s.scriptShort,
            themes: s.themes || [],
            themeKeyword: s.themeKeyword,
            rationale: typeof s.rationale === 'string' ? s.rationale : undefined,
            recordingTimeSec: typeof s.recordingTimeSec === 'number' ? s.recordingTimeSec : undefined,
            aiVersionId: typeof s.aiVersionId === 'string' ? s.aiVersionId : undefined,
          }));
          safeSetSlots(planSlots);
        } else if (recData) {
          const recSlots: PlannerUISlot[] = (recData.recommendations || []).map((r: any) => ({
            slotId: typeof r.slotId === 'string' ? r.slotId : undefined,
            dayOfWeek: r.dayOfWeek,
            blockStartHour: r.blockStartHour,
            format: (typeof r.format === 'string' && r.format) ? r.format : 'reel',
            categories: r.categories || {},
            status: r.status,
            isExperiment: !!r.isExperiment,
            expectedMetrics: r.expectedMetrics || {},
            title: r.title,
            scriptShort: r.scriptShort,
            themes: r.themes || [],
            themeKeyword: r.themeKeyword,
            rationale: typeof r.rationale === 'string' ? r.rationale : undefined,
            recordingTimeSec: typeof r.recordingTimeSec === 'number' ? r.recordingTimeSec : undefined,
            aiVersionId: typeof r.aiVersionId === 'string' ? r.aiVersionId : undefined,
          }));
          safeSetSlots(recSlots);
        }

        if (recData?.heatmap) {
          const hm: TimeBlockScoreUI[] = (recData.heatmap || []).map((h: any) => ({
            dayOfWeek: h.dayOfWeek,
            blockStartHour: h.blockStartHour,
            score: typeof h.score === 'number' ? h.score : 0,
          }));
          safeSetHeatmap(hm);
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // requisição cancelada, ignora
      setError(err?.message || 'Erro inesperado');
    } finally {
      if (fetchIdRef.current === myId) setLoading(false);
    }
  }, [publicMode, userId, normalizedWeekStart, targetSlotsPerWeek]);

  // 🔧 Sem “de-dupe” manual: no Strict Mode a 1ª execução é abortada, a 2ª completa normalmente
  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  const saveSlots = useCallback(async (updatedSlots: PlannerUISlot[], userTimeZone?: string) => {
    const body = {
      weekStart: normalizedWeekStart.toISOString(),
      userTimeZone,
      slots: updatedSlots,
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
    const planSlots: PlannerUISlot[] = (data?.plan?.slots || []).map((s: any) => ({
      slotId: typeof s.slotId === 'string' ? s.slotId : undefined,
      dayOfWeek: s.dayOfWeek,
      blockStartHour: s.blockStartHour,
      format: (typeof s.format === 'string' && s.format) ? s.format : 'reel',
      categories: s.categories || {},
      status: s.status,
      isExperiment: !!s.isExperiment,
      expectedMetrics: s.expectedMetrics || {},
      title: s.title,
      scriptShort: s.scriptShort,
      themes: s.themes || [],
      themeKeyword: s.themeKeyword,
      rationale: typeof s.rationale === 'string' ? s.rationale : undefined,
      recordingTimeSec: typeof s.recordingTimeSec === 'number' ? s.recordingTimeSec : undefined,
      aiVersionId: typeof s.aiVersionId === 'string' ? s.aiVersionId : undefined,
    }));
    safeSetSlots(planSlots);
    return planSlots;
  }, [normalizedWeekStart]);

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
