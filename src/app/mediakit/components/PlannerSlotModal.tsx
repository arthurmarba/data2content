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
  const toneLabels = useMemo(() => idsToLabels(slot?.categories?.tone ? [slot.categories.tone] : [], 'tone'), [slot?.categories?.tone]);
  const referenceLabels = useMemo(() => idsToLabels(slot?.categories?.reference, 'reference'), [slot?.categories?.reference]);

  const contextSummary = useMemo(
    () => (contextLabels.length ? contextLabels.slice(0, 2).join(' • ') : ''),
    [contextLabels]
  );
  const proposalSummary = useMemo(
    () => (proposalLabels.length ? proposalLabels.slice(0, 2).join(' • ') : ''),
    [proposalLabels]
  );
  const toneSummary = useMemo(
    () => (toneLabels.length ? toneLabels[0] : ''),
    [toneLabels]
  );
  const referenceSummary = useMemo(
    () => (referenceLabels.length ? referenceLabels.slice(0, 2).join(' • ') : ''),
    [referenceLabels]
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
          format,
          tone: slot.categories?.tone,
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
  }, [slot, description, effectiveTheme, userId, format]);

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
        className={`relative z-10 flex h-full max-h-[95vh] w-full flex-col bg-[#F8FAFF] shadow-2xl rounded-2xl overflow-hidden sm:max-h-[90vh] sm:w-[620px] lg:w-[700px] sm:rounded-[32px] sm:border sm:border-slate-100 ${prefersReducedMotion ? '' : 'transition-transform duration-200 ease-out'
          } ${isVisible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-[0.98]'}`}
      >
        <header
          className="border-b border-slate-200/80 bg-white/70 px-5 pt-6 pb-4 sm:px-6 sm:pt-7 sm:pb-5 backdrop-blur"
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

        <div id={dialogDescId} className="flex-1 overflow-y-auto bg-white">
          <div className="space-y-8 px-5 py-6 sm:px-8">
            {/* Main Content Section */}
            <section className="space-y-6">
              {!readOnly ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Bastidores do drop de domingo"
                  className="w-full border-b border-slate-200 px-0 py-2 text-2xl font-bold text-slate-900 placeholder-slate-400 focus:border-brand-primary focus:outline-none focus:ring-0"
                />
              ) : (
                <h2 className="text-2xl font-bold leading-tight text-slate-900">
                  {title || effectiveTheme || 'Defina o título da pauta'}
                </h2>
              )}

              {/* 4-Column Grid Layout for Summary (2 rows) */}
              <div className="grid grid-cols-2 gap-y-6 gap-x-4 sm:grid-cols-4 lg:grid-cols-4 lg:divide-x lg:divide-slate-100">
                {/* Row 1 */}
                <div className="flex flex-col gap-2 px-2 lg:first:pl-0">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Formato</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-900">{formatLabel}</span>
                </div>
                <div className="flex flex-col gap-2 px-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Tema</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-900 line-clamp-2" title={effectiveTheme}>{effectiveTheme || '—'}</span>
                </div>
                <div className="flex flex-col gap-2 px-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Proposta</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-900 line-clamp-2" title={proposalSummary}>{proposalSummary || '—'}</span>
                </div>
                <div className="flex flex-col gap-2 px-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Contexto</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-900 line-clamp-2" title={contextSummary}>{contextSummary || '—'}</span>
                </div>

                {/* Row 2 */}
                <div className="flex flex-col gap-2 px-2 lg:first:pl-0 border-t border-slate-100 pt-4 lg:border-t-0 lg:pt-0">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Tom</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-900 line-clamp-2 capitalize">{toneSummary || '—'}</span>
                </div>
                <div className="flex flex-col gap-2 px-2 border-t border-slate-100 pt-4 lg:border-t-0 lg:pt-0">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Referência</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-900 line-clamp-2">{referenceSummary || '—'}</span>
                </div>
                <div className="flex flex-col gap-2 px-2 border-t border-slate-100 pt-4 lg:border-t-0 lg:pt-0">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Projeção</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700">{p50Compact || '—'}</span>
                </div>
                {/* Empty slot for alignment if needed, or just leave 7 items */}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => title && navigator.clipboard?.writeText(title)}
                  disabled={!title}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                >
                  Copiar título
                </button>
              </div>
            </section>

            {/* Recommended Themes */}
            <section className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Pautas recomendadas</h3>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRegenerateThemes()}
                    disabled={themesLoading}
                    className="text-xs font-semibold text-brand-primary hover:text-brand-dark transition disabled:opacity-50"
                  >
                    {themesLoading ? 'Atualizando…' : 'Gerar novas ideias'}
                  </button>
                )}
              </div>

              {themesLoading && !themesLocal.length ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, idx) => (
                    <div key={`theme-skel-${idx}`} className="h-12 w-full animate-pulse rounded-xl bg-slate-50" />
                  ))}
                </div>
              ) : themesLocal.length > 0 ? (
                <div className="grid gap-2">
                  {themesLocal.slice(0, 4).map((t, i) => (
                    <button
                      key={`theme-${i}`}
                      type="button"
                      onClick={() => {
                        setTitle(t);
                        setThemeKw(t);
                      }}
                      className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand-primary/30 hover:bg-brand-primary/5 hover:shadow-md"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 group-hover:bg-white group-hover:text-brand-primary">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                        {t}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">Nenhuma pauta disponível para este slot.</p>
              )}
            </section>

            {/* KPIs */}
            <section className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">KPIs projetados</h3>
                {typeof recordingTimeSec === 'number' && (
                  <span className="text-xs font-medium text-slate-400">⏱️ {Math.round(recordingTimeSec / 60) || 1} min de gravação</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                {kpiCards.map((kpi) => (
                  <div key={kpi.key} className="flex flex-col gap-1 rounded-xl bg-slate-50 p-4 text-center border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{kpi.label}</span>
                    <span className={`text-xl font-bold ${kpi.value ? 'text-slate-900' : 'text-slate-300'}`}>{kpi.value || '—'}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Inspirations */}
            <section className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Conteúdos que inspiram</h3>
                <button
                  type="button"
                  onClick={() => {
                    setInspirationsOpen(true);
                    void fetchInspirations();
                  }}
                  disabled={inspLoading}
                  className="text-xs font-semibold text-brand-primary hover:text-brand-dark transition disabled:opacity-50"
                >
                  {inspLoading ? 'Carregando…' : 'Atualizar'}
                </button>
              </div>

              {inspirationsOpen && (
                <>
                  {inspError && <p className="text-xs text-red-600">{inspError}</p>}
                  {inspLoading && !inspPosts.length && (
                    <div className="flex gap-4 overflow-x-auto pb-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={`insp-skel-${i}`} className="min-w-[200px] w-[200px] shrink-0 animate-pulse rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <div className="aspect-[4/5] w-full rounded-lg bg-slate-200" />
                          <div className="mt-3 space-y-2">
                            <div className="h-3 w-3/4 rounded bg-slate-200" />
                            <div className="h-3 w-1/2 rounded bg-slate-200" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {inspPosts.length > 0 && (
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                      {(inspExpanded ? inspPosts : inspPosts.slice(0, 6)).map((p) => {
                        const viewsLabel = formatCompact(p.views) || p.views.toLocaleString('pt-BR');
                        return (
                          <a
                            key={`insp-${p.id}`}
                            href={p.postLink || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="snap-start shrink-0 w-[200px] group flex flex-col gap-3 rounded-xl transition hover:-translate-y-1"
                          >
                            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-slate-100 shadow-sm group-hover:shadow-md">
                              {p.thumbnailUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={toProxyUrl(p.thumbnailUrl)} alt="Inspiracao" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">Sem imagem</div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                              <div className="absolute bottom-3 left-3 right-3 text-white">
                                <div className="flex items-center gap-1.5 text-[10px] font-medium">
                                  <span>👁️ {viewsLabel}</span>
                                </div>
                              </div>
                            </div>
                            <p className="line-clamp-2 text-xs font-medium text-slate-700 group-hover:text-slate-900">
                              {p.caption || 'Sem legenda'}
                            </p>
                          </a>
                        );
                      })}
                    </div>
                  )}
                  {!inspLoading && !inspPosts.length && !inspError && (
                    <p className="text-sm text-slate-500 italic">Sem conteúdos similares para este horário agora.</p>
                  )}
                </>
              )}
            </section>

            {/* Community Inspirations */}
            <section className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Inspirações da comunidade</h3>
                  <button
                    type="button"
                    onClick={() => setCommunityOpen((prev) => !prev)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    {communityOpen ? '−' : '+'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCommunityOpen(true);
                    void fetchCommunityInspirations();
                  }}
                  disabled={communityLoading}
                  className="text-xs font-semibold text-brand-primary hover:text-brand-dark transition disabled:opacity-50"
                >
                  {communityLoading ? 'Carregando…' : 'Atualizar'}
                </button>
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
                        <div key={`community-${p.id}`} className="flex gap-3 rounded-2xl border border-neutral-200/80 bg-white p-3 shadow-sm transition hover:border-brand-primary/30 hover:shadow-md">
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
                    <p className="text-xs text-neutral-500 italic">Nenhuma inspiração da comunidade para este contexto.</p>
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
