"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { idsToLabels } from '@/app/lib/classification';
import { prefillInspirationCache } from '../utils/inspirationCache';
import { setCachedThemes } from '../utils/plannerThemesCache';

const DAYS_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function blockLabel(start: number) {
  const end = (start + 3) % 24;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(start)}–${pad(end)}`;
}

function formatCompact(n?: number) {
  if (typeof n !== 'number' || !isFinite(n)) return '';
  try {
    return n.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  } catch {
    return String(n);
  }
}

const toProxyUrl = (raw?: string | null) => {
  if (!raw) return '';
  if (raw.startsWith('/api/proxy/thumbnail/')) return raw;
  if (/^https?:\/\//i.test(raw)) return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
  return raw;
};

type GenerationStrategy = 'default' | 'strong_hook' | 'more_humor' | 'practical_imperative';

export interface PlannerSlotData {
  slotId?: string;
  dayOfWeek: number;
  blockStartHour: number;
  format: string;
  categories?: { context?: string[]; tone?: string; proposal?: string[]; reference?: string[] };
  status?: 'planned' | 'drafted' | 'test' | 'posted';
  isExperiment?: boolean;
  expectedMetrics?: { viewsP50?: number; viewsP90?: number; sharesP50?: number };
  title?: string;
  scriptShort?: string;
  themes?: string[];
  themeKeyword?: string;
  rationale?: string[];
  recordingTimeSec?: number;
  aiVersionId?: string | null;
}

export interface PlannerSlotModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  weekStartISO: string;
  slot: PlannerSlotData | null;
  onSave: (updated: PlannerSlotData) => Promise<void>;
  onDuplicateSlot?: (slot: PlannerSlotData) => Promise<void>;
  onDeleteSlot?: (slot: PlannerSlotData) => Promise<void>;
  readOnly?: boolean;
  canGenerate?: boolean;
  onUpgradeRequest?: () => void;
  upgradeMessage?: string;
}

const GradientPillButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className = '',
  children,
  disabled,
  ...props
}) => (
  <button
    {...props}
    disabled={disabled}
    className={`inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D62E5E] to-[#6E1F93] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-[#c92d60] hover:to-[#5a1877] ${disabled ? 'cursor-not-allowed opacity-60 hover:from-[#D62E5E] hover:to-[#6E1F93]' : ''
      } ${className}`}
  >
    {children}
  </button>
);

const OutlinePillButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className = '',
  children,
  disabled,
  ...props
}) => (
  <button
    {...props}
    disabled={disabled}
    className={`inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-900 ${disabled ? 'cursor-not-allowed opacity-50 hover:border-neutral-300 hover:text-neutral-700' : ''
      } ${className}`}
  >
    {children}
  </button>
);

export const PlannerSlotModal: React.FC<PlannerSlotModalProps> = ({
  open,
  onClose,
  userId,
  weekStartISO,
  slot,
  onSave,
  onDuplicateSlot,
  onDeleteSlot,
  readOnly = false,
  canGenerate = true,
  onUpgradeRequest,
  upgradeMessage,
}) => {
  void onDuplicateSlot;
  void onDeleteSlot;
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<string>('reel');
  const [recordingTimeSec, setRecordingTimeSec] = useState<number | undefined>(undefined);
  const [aiVersionId, setAiVersionId] = useState<string | null>(null);
  const [themeKw, setThemeKw] = useState<string>('');
  const [themesLocal, setThemesLocal] = useState<string[]>([]);
  const [themesLoading, setThemesLoading] = useState(false);
  const [autoThemesFetched, setAutoThemesFetched] = useState(false);
  const [inspLoading, setInspLoading] = useState<boolean>(false);
  const [inspError, setInspError] = useState<string | null>(null);
  const [inspPosts, setInspPosts] = useState<
    Array<{ id: string; caption: string; views: number; date: string; thumbnailUrl?: string | null; postLink?: string | null }>
  >([]);
  const [inspExpanded, setInspExpanded] = useState<boolean>(false);
  const [communityLoading, setCommunityLoading] = useState<boolean>(false);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [communityPosts, setCommunityPosts] = useState<
    Array<{ id: string; caption: string; views: number; date: string; coverUrl?: string | null; postLink?: string | null; reason?: string[] }>
  >([]);
  const [communityExpanded, setCommunityExpanded] = useState<boolean>(false);
  const [inspirationsOpen, setInspirationsOpen] = useState(true);
  const [communityOpen, setCommunityOpen] = useState(true);
  const [isMounted, setIsMounted] = useState(open);
  const [isVisible, setIsVisible] = useState(open);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const derivedTheme = useMemo(() => {
    if (!slot) return '';
    const raw = (slot.themeKeyword || '').trim();
    if (raw) return raw;
    const first = slot.themes && slot.themes[0] ? String(slot.themes[0]) : '';
    const simple = first.split(/[:\-–—|]/)[0]?.trim() || first.trim();
    return simple;
  }, [slot]);

  useEffect(() => {
    if (!open || !slot) return;
    setError(null);
    setTitle(slot.title || (slot.themes && slot.themes[0]) || '');
    setDescription(slot.scriptShort || '');
    setFormat(slot.format || 'reel');
    setAiVersionId(typeof slot.aiVersionId === 'string' ? slot.aiVersionId : slot.aiVersionId ?? null);
    setRecordingTimeSec(typeof slot.recordingTimeSec === 'number' ? slot.recordingTimeSec : undefined);
    setThemeKw((slot.themeKeyword || derivedTheme || '').trim());
    setThemesLocal(Array.isArray(slot.themes) ? [...slot.themes] : []);
    setInspPosts([]);
    setCommunityPosts([]);
    setInspError(null);
    setCommunityError(null);
    setAutoThemesFetched(false);
    setInspExpanded(false);
    setCommunityExpanded(false);
    setInspirationsOpen(true);
    setCommunityOpen(true);
  }, [open, slot, derivedTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    if (open) {
      setIsMounted(true);
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setIsVisible(false);
    return undefined;
  }, [open]);

  useEffect(() => {
    if (open || !isMounted) return;
    if (typeof window === 'undefined') {
      setIsMounted(false);
      return;
    }
    const timeout = window.setTimeout(() => setIsMounted(false), prefersReducedMotion ? 0 : 220);
    return () => window.clearTimeout(timeout);
  }, [open, isMounted, prefersReducedMotion]);

  useEffect(() => {
    if (open) setTimeout(() => closeBtnRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const headerText = useMemo(() => {
    if (!slot) return '';
    const day = DAYS_PT[slot.dayOfWeek % 7] || '';
    const block = blockLabel(slot.blockStartHour);
    return `${day} • ${block}`;
  }, [slot]);

  const effectiveTheme = useMemo(() => (themeKw || derivedTheme || '').trim(), [themeKw, derivedTheme]);

  const statusDetails = useMemo(() => {
    if (!slot) return null;
    if (slot.status === 'posted') return { icon: '🔥', label: 'Campeão' };
    if (slot.status === 'test' || slot.isExperiment) return { icon: '🧪', label: 'Teste' };
    if (slot.status === 'drafted') return { icon: '👀', label: 'Rascunho' };
    return { icon: '👀', label: 'Sugestão' };
  }, [slot]);

  const contextLabels = useMemo(() => idsToLabels(slot?.categories?.context, 'context'), [slot?.categories?.context]);
  const proposalLabels = useMemo(() => idsToLabels(slot?.categories?.proposal, 'proposal'), [slot?.categories?.proposal]);

  const contextSummary = useMemo(
    () => (contextLabels.length ? contextLabels.slice(0, 2).join(' • ') : ''),
    [contextLabels]
  );
  const proposalSummary = useMemo(
    () => (proposalLabels.length ? proposalLabels.slice(0, 2).join(' • ') : ''),
    [proposalLabels]
  );

  const formatLabel = useMemo(() => {
    const map: Record<string, string> = {
      reel: 'Reel',
      photo: 'Foto',
      carousel: 'Carrossel',
      story: 'Story',
      live: 'Live',
      long_video: 'Vídeo Longo',
    };
    return map[format] || map.reel;
  }, [format]);

  const summaryChips = useMemo(
    () => [
      { key: 'objective', icon: '🎯', value: proposalSummary, fallback: 'Defina o objetivo' },
      { key: 'theme', icon: '💬', value: effectiveTheme, fallback: 'Tema em aberto' },
      { key: 'format', icon: '🎬', value: formatLabel, fallback: 'Formato indefinido' },
      { key: 'context', icon: '👥', value: contextSummary, fallback: 'Público amplo' },
    ],
    [contextSummary, effectiveTheme, formatLabel, proposalSummary]
  );

  const p50Compact = formatCompact(slot?.expectedMetrics?.viewsP50);
  const p90Compact = formatCompact(slot?.expectedMetrics?.viewsP90);
  const savesCompact = formatCompact(slot?.expectedMetrics?.sharesP50);

  const kpiCards = useMemo(
    () => [
      { key: 'p50', label: 'Views P50', value: p50Compact },
      { key: 'p90', label: 'Views P90', value: p90Compact },
      { key: 'saves', label: 'Saves / Compart.', value: savesCompact },
    ],
    [p50Compact, p90Compact, savesCompact]
  );

  const buildPayload = useCallback((): PlannerSlotData => {
    if (!slot) throw new Error('Slot indisponível');
    return {
      ...slot,
      title,
      format,
      themeKeyword: effectiveTheme,
      scriptShort: description,
      recordingTimeSec,
      aiVersionId: typeof aiVersionId === 'string' ? aiVersionId : slot.aiVersionId ?? null,
      themes: themesLocal,
    };
  }, [slot, title, format, effectiveTheme, description, recordingTimeSec, aiVersionId, themesLocal]);

  const handleSave = async () => {
    if (!slot) return;
    try {
      setLoading(true);
      await onSave(buildPayload());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar pauta');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateThemes = useCallback(
    async (silent = false) => {
      if (!slot) return;
      if (!silent) setThemesLoading(true);
      if (!silent) setError(null);
      try {
        const res = await fetch('/api/planner/themes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayOfWeek: slot.dayOfWeek,
            blockStartHour: slot.blockStartHour,
            categories: slot.categories || {},
            includeCaptions: true,
          }),
        });
        if (!res.ok) throw new Error('Falha ao gerar pautas');
        const data = await res.json();
        const arr: string[] = Array.isArray(data?.themes) ? data.themes : [];
        setThemesLocal(arr);
        setCachedThemes(slot as any, arr);
        if (!themeKw && typeof data?.keyword === 'string' && data.keyword.trim()) {
          setThemeKw(String(data.keyword).trim());
        }
      } catch (err: any) {
        if (!silent) setError(err?.message || 'Erro ao gerar pautas');
      } finally {
        if (!silent) setThemesLoading(false);
      }
    },
    [slot, themeKw]
  );

  useEffect(() => {
    if (!open || !slot || autoThemesFetched) return;

    // If we already have themes, don't regenerate
    if (slot.themes && slot.themes.length > 0) {
      setAutoThemesFetched(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await handleRegenerateThemes(true);
      } finally {
        if (!cancelled) setAutoThemesFetched(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, slot, autoThemesFetched, handleRegenerateThemes]);

  const fetchInspirations = useCallback(async () => {
    if (!slot) return;
    setInspLoading(true);
    setInspError(null);
    try {
      const res = await fetch('/api/planner/inspirations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          dayOfWeek: slot.dayOfWeek,
          blockStartHour: slot.blockStartHour,
          categories: slot.categories || {},
          limit: 8,
        }),
      });
      if (!res.ok) throw new Error('Falha ao buscar conteúdos');
      const data = await res.json();
      const arr = Array.isArray(data?.posts) ? data.posts : [];

      const first = arr[0];
      if (first) {
        prefillInspirationCache(slot as any, {
          self: {
            id: String(first.id),
            caption: String(first.caption || ''),
            views: Number(first.views || 0),
            thumbnailUrl: first.thumbnailUrl || null,
            postLink: first.postLink || null,
          }
        });
      }

      setInspPosts(
        arr.map((p: any) => ({
          id: String(p.id),
          caption: String(p.caption || ''),
          views: Number(p.views || 0),
          date: String(p.date || ''),
          thumbnailUrl: p.thumbnailUrl || null,
          postLink: p.postLink || null,
        }))
      );
    } catch (err: any) {
      setInspError(err?.message || 'Erro ao carregar conteúdos');
    } finally {
      setInspLoading(false);
    }
  }, [slot, userId]);

  useEffect(() => {
    if (!open || !slot || !inspirationsOpen) return;
    if (inspLoading || inspPosts.length) return;
    void fetchInspirations();
  }, [open, slot, inspirationsOpen, inspLoading, inspPosts.length, fetchInspirations]);



  const fetchCommunityInspirations = useCallback(async () => {
    if (!slot) return;
    setCommunityLoading(true);
    setCommunityError(null);
    try {
      const res = await fetch('/api/planner/inspirations/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          categories: slot.categories || {},
          script: description || slot.scriptShort || '',
          themeKeyword: effectiveTheme,
          limit: 12,
        }),
      });
      if (!res.ok) throw new Error('Falha ao buscar conteúdos da comunidade');
      const data = await res.json();
      const arr = Array.isArray(data?.posts) ? data.posts : [];

      const first = arr[0];
      if (first) {
        prefillInspirationCache(slot as any, {
          community: {
            id: String(first.id),
            caption: String(first.caption || ''),
            views: Number(first.views || 0),
            coverUrl: first.coverUrl || null,
            postLink: first.postLink || null,
          }
        });
      }

      setCommunityPosts(
        arr.map((p: any) => ({
          id: String(p.id),
          caption: String(p.caption || ''),
          views: Number(p.views || 0),
          date: String(p.date || ''),
          coverUrl: p.coverUrl || null,
          postLink: p.postLink || null,
          reason: Array.isArray(p.reason) ? p.reason : [],
        }))
      );
    } catch (err: any) {
      setCommunityError(err?.message || 'Erro ao carregar comunidade');
    } finally {
      setCommunityLoading(false);
    }
  }, [slot, description, effectiveTheme, userId]);

  useEffect(() => {
    if (!open || !slot || !communityOpen) return;
    if (communityLoading || communityPosts.length) return;
    void fetchCommunityInspirations();
  }, [open, slot, communityOpen, communityLoading, communityPosts.length, fetchCommunityInspirations]);

  const handleGenerate = async (strategy: GenerationStrategy = 'default') => {
    if (!slot) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/planner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: weekStartISO,
          slot: { ...slot, format, themeKeyword: effectiveTheme },
          strategy,
          noSignals: false,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error('Faça login para gerar roteiros com IA.');
        if (res.status === 403) throw new Error('Plano inativo. Assine para gerar roteiros com IA.');
        if (res.status === 429) throw new Error('Limite de geração atingido. Tente em alguns minutos.');
        throw new Error(`Falha ao gerar roteiro (status ${res.status})`);
      }
      const data = await res.json();
      const gen = data?.generated;
      if (gen?.title) setTitle(gen.title);
      if (gen?.script) setDescription(gen.script);
      if (typeof gen?.recordingTimeSec === 'number') setRecordingTimeSec(gen.recordingTimeSec);
      const newSlot = data?.slot;
      if (newSlot && typeof newSlot.aiVersionId === 'string') {
        setAiVersionId(newSlot.aiVersionId);
      } else if (newSlot && newSlot?.aiVersionId === null) {
        setAiVersionId(null);
      }
      if (newSlot && typeof newSlot.recordingTimeSec === 'number') {
        setRecordingTimeSec(newSlot.recordingTimeSec);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao gerar roteiro');
    } finally {
      setLoading(false);
    }
  };

  if ((!open && !isMounted) || !slot) return null;

  const dialogLabelId = 'planner-slot-modal-title';
  const dialogDescId = 'planner-slot-modal-desc';

  const requestGeneration = () => {
    if (!slot || !canGenerate) {
      if (!canGenerate && upgradeMessage) setError(upgradeMessage);
      if (!canGenerate) onUpgradeRequest?.();
      return;
    }
    handleGenerate('strong_hook');
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center px-4 py-6 sm:px-6">
      <button
        type="button"
        aria-label="Fechar painel"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/50 ${prefersReducedMotion ? '' : 'transition-opacity duration-200 ease-out'} ${isVisible ? 'opacity-100' : 'opacity-0'
          }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogLabelId}
        aria-describedby={dialogDescId}
        className={`relative z-10 flex h-full max-h-[95vh] w-full flex-col bg-[#F8FAFF] shadow-2xl sm:max-h-[90vh] sm:w-[620px] lg:w-[700px] sm:rounded-[32px] sm:border sm:border-slate-100 ${prefersReducedMotion ? '' : 'transition-transform duration-200 ease-out'
          } ${isVisible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-[0.98]'}`}
      >
        <header
          className="border-b border-slate-200/80 bg-white/70 px-5 pt-6 pb-4 sm:px-6 sm:pt-7 sm:pb-5 backdrop-blur"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-neutral-500">
                Horário recomendado
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <p id={dialogLabelId} className="text-3xl font-semibold leading-tight text-neutral-900">
                  {headerText}
                </p>
                {statusDetails && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600">
                    <span aria-hidden>{statusDetails.icon}</span>
                    {statusDetails.label}
                  </span>
                )}
              </div>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-neutral-200 text-base text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900"
              onClick={onClose}
              aria-label="Fechar painel"
            >
              ×
            </button>
          </div>
        </header>

        <div id={dialogDescId} className="flex-1 overflow-y-auto bg-[#F8FAFF]">
          <div className="space-y-5 px-5 py-6 sm:px-6">
            <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm sm:px-5">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Resumo do card</p>
                <p className="text-sm text-slate-500">Só o essencial para o slot do dia.</p>
              </div>
              {!readOnly ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Bastidores do drop de domingo"
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-2 text-lg font-semibold text-neutral-900 shadow-inner focus:border-neutral-400 focus:outline-none"
                />
              ) : (
                <p className="text-lg font-semibold leading-snug text-neutral-900">
                  {title || effectiveTheme || 'Defina o título da pauta'}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {summaryChips.map((chip) => (
                  <div
                    key={chip.key}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-sm"
                  >
                    <span className="text-base" aria-hidden>
                      {chip.icon}
                    </span>
                    <span className={`truncate ${chip.value ? 'text-neutral-900' : 'text-neutral-400'}`}>
                      {chip.value || chip.fallback}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <OutlinePillButton
                  type="button"
                  onClick={() => title && navigator.clipboard?.writeText(title)}
                  disabled={!title}
                >
                  Copiar título
                </OutlinePillButton>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Pautas recomendadas</p>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRegenerateThemes()}
                      disabled={themesLoading}
                      className="text-xs font-semibold text-neutral-600 underline-offset-2 transition hover:text-neutral-900 disabled:text-neutral-300"
                    >
                      {themesLoading ? 'Atualizando…' : 'Atualizar'}
                    </button>
                  )}
                </div>
                {themesLoading && !themesLocal.length ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, idx) => (
                      <div key={`theme-skel-${idx}`} className="h-4 w-full animate-pulse rounded bg-neutral-100" />
                    ))}
                  </div>
                ) : themesLocal.length > 0 ? (
                  <div className="space-y-2">
                    {themesLocal.slice(0, 4).map((t, i) => (
                      <button
                        key={`theme-${i}`}
                        type="button"
                        onClick={() => {
                          setTitle(t);
                          setThemeKw(t);
                        }}
                        className="block w-full text-left text-base font-semibold text-neutral-900 transition hover:text-neutral-600"
                      >
                        {String(i + 1).padStart(2, '0')} · {t}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">Nenhuma pauta disponível para este slot.</p>
                )}
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">KPIs projetados</p>
                {typeof recordingTimeSec === 'number' && (
                  <span className="text-xs text-neutral-500">⏱️ {Math.round(recordingTimeSec / 60) || 1} min de gravação</span>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {kpiCards.map((kpi) => (
                  <div key={kpi.key} className="rounded-2xl border border-neutral-200 px-4 py-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{kpi.label}</p>
                    <p className={`text-2xl font-semibold ${kpi.value ? 'text-neutral-900' : 'text-neutral-300'}`}>{kpi.value || '—'}</p>
                    <p className="text-[11px] text-neutral-400">{kpi.label === 'Views P90' ? 'potencial máximo' : kpi.label === 'Saves / Compart.' ? 'meta estimada' : 'mediana do bloco'}</p>
                  </div>
                ))}
              </div>
            </section>


            <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm sm:px-5">
              <div className="flex flex-wrap items-start gap-3">
                <button
                  type="button"
                  className="flex flex-1 items-center justify-between rounded-2xl border border-transparent px-1 text-left text-sm font-semibold text-neutral-900 transition hover:border-neutral-200"
                  onClick={() => setInspirationsOpen((prev) => !prev)}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden>📈</span> Conteúdos que inspiram
                  </span>
                  <span className="text-xl text-neutral-400">{inspirationsOpen ? '−' : '+'}</span>
                </button>
                <OutlinePillButton
                  type="button"
                  onClick={() => {
                    setInspirationsOpen(true);
                    void fetchInspirations();
                  }}
                  disabled={inspLoading}
                  className="whitespace-nowrap"
                >
                  {inspLoading ? 'Carregando…' : 'Atualizar'}
                </OutlinePillButton>
              </div>
              {inspirationsOpen && (
                <>
                  {inspError && <p className="text-xs text-red-600">{inspError}</p>}
                  {inspLoading && !inspPosts.length && (
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {[...Array(3)].map((_, i) => (
                        <div key={`insp-skel-${i}`} className="min-w-[220px] rounded-2xl border border-neutral-100 bg-neutral-50 p-4 animate-pulse">
                          <div className="h-32 w-full rounded-xl bg-neutral-200" />
                          <div className="mt-3 space-y-2">
                            <div className="h-3 rounded bg-neutral-200" />
                            <div className="h-3 w-2/3 rounded bg-neutral-200" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {inspPosts.length > 0 && (
                    <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
                      {(inspExpanded ? inspPosts : inspPosts.slice(0, 6)).map((p) => {
                        const viewsLabel = formatCompact(p.views) || p.views.toLocaleString('pt-BR');
                        const isHighMatch = p.views >= 750000;
                        return (
                          <a
                            key={`insp-${p.id}`}
                            href={p.postLink || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="snap-start min-w-[240px] max-w-[260px] overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                          >
                            <div className="relative aspect-[4/3] w-full">
                              {p.thumbnailUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={toProxyUrl(p.thumbnailUrl)} alt="Conteúdo de inspiração" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-xs text-neutral-500">Sem imagem</div>
                              )}
                              <span
                                className={`absolute left-3 top-3 rounded-full px-2 py-1 text-[10px] font-semibold text-white ${isHighMatch ? 'bg-rose-500' : 'bg-purple-600'
                                  }`}
                              >
                                🏆 {isHighMatch ? 'Match alto' : 'Match da IA'}
                              </span>
                            </div>
                            <div className="space-y-2 p-3">
                              <p className="line-clamp-2 text-sm font-semibold text-neutral-900" title={p.caption}>
                                {p.caption || 'Legenda não disponível'}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                                <span className="font-semibold text-neutral-900">{viewsLabel} views</span>
                                <span>{p.date ? new Date(p.date).toLocaleDateString('pt-BR') : ''}</span>
                              </div>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  )}
                  {!inspLoading && !inspPosts.length && !inspError && (
                    <p className="text-xs text-neutral-500">Sem conteúdos similares para este horário agora.</p>
                  )}
                  {inspPosts.length > 6 && (
                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        onClick={() => setInspExpanded((v) => !v)}
                        className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-900"
                      >
                        {inspExpanded ? 'Ver menos' : `Ver todos (${inspPosts.length})`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm sm:px-5">
              <div className="flex flex-wrap items-start gap-3">
                <button
                  type="button"
                  className="flex flex-1 items-center justify-between rounded-2xl border border-transparent px-1 text-left text-sm font-semibold text-neutral-900 transition hover:border-neutral-200"
                  onClick={() => setCommunityOpen((prev) => !prev)}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden>🤝</span> Inspirações da comunidade
                  </span>
                  <span className="text-xl text-neutral-400">{communityOpen ? '−' : '+'}</span>
                </button>
                <OutlinePillButton
                  type="button"
                  onClick={() => {
                    setCommunityOpen(true);
                    void fetchCommunityInspirations();
                  }}
                  disabled={communityLoading}
                  className="whitespace-nowrap"
                >
                  {communityLoading ? 'Carregando…' : 'Atualizar'}
                </OutlinePillButton>
              </div>
              {communityOpen && (
                <>
                  {communityError && <p className="text-xs text-red-600">{communityError}</p>}
                  {communityLoading && !communityPosts.length && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={`comm-skel-${i}`} className="flex animate-pulse items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
                          <div className="h-16 w-16 rounded-2xl bg-neutral-200" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 rounded bg-neutral-200" />
                            <div className="h-3 w-2/3 rounded bg-neutral-200" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {communityPosts.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(communityExpanded ? communityPosts : communityPosts.slice(0, 4)).map((p) => (
                        <div key={`community-${p.id}`} className="flex gap-3 rounded-2xl border border-neutral-200/80 bg-white p-3 shadow-sm">
                          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
                            {p.coverUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={toProxyUrl(p.coverUrl)} alt="Post da comunidade" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">Sem capa</div>
                            )}
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="line-clamp-2 text-sm font-semibold text-neutral-900">{p.caption || 'Post sem legenda'}</p>
                            <div className="text-xs text-neutral-500">
                              {formatCompact(p.views) || p.views.toLocaleString('pt-BR')} views • {p.date ? new Date(p.date).toLocaleDateString('pt-BR') : ''}
                            </div>
                            {p.reason && p.reason.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {p.reason.slice(0, 3).map((tag, idx) => (
                                  <span key={`reason-${p.id}-${idx}`} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!communityLoading && !communityPosts.length && !communityError && (
                    <p className="text-xs text-neutral-500">Nenhuma inspiração da comunidade para este contexto.</p>
                  )}
                  {communityPosts.length > 4 && (
                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        onClick={() => setCommunityExpanded((v) => !v)}
                        className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-900"
                      >
                        {communityExpanded ? 'Ver menos' : `Ver todos (${communityPosts.length})`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </div>

        <div
          className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-20px_30px_rgba(15,23,42,0.06)] sm:px-6"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          {readOnly ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-900"
            >
              Fechar
            </button>
          ) : (
            <div className="space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2">
                  <OutlinePillButton
                    type="button"
                    disabled={loading}
                    onClick={handleSave}
                  >
                    Salvar
                  </OutlinePillButton>
                </div>
                <GradientPillButton
                  type="button"
                  disabled={loading || !slot || !canGenerate}
                  onClick={requestGeneration}
                  className="w-full sm:w-auto"
                >
                  {loading ? 'Processando…' : 'Gerar com IA'}
                </GradientPillButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlannerSlotModal;
