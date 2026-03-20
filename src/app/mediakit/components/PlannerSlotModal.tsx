"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { prefillInspirationCache } from '../utils/inspirationCache';
import { setCachedThemes } from '../utils/plannerThemesCache';
import { getPlannerSlotPresentation } from './plannerSlotPresentation';

const DiscoverVideoModal = dynamic(() => import('@/app/discover/components/DiscoverVideoModal'), {
  ssr: false,
  loading: () => null,
});

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

const toVideoProxyUrl = (raw?: string | null) => {
  if (!raw) return undefined;
  if (raw.startsWith('/api/proxy/video/')) return raw;
  if (/^https?:\/\//i.test(raw)) return `/api/proxy/video/${encodeURIComponent(raw)}`;
  return raw;
};

type InspirationVideoItem = {
  id: string;
  caption?: string;
  postLink?: string | null;
  posterUrl?: string | null;
  videoUrl?: string | null;
};

type InspirationPost = {
  id: string;
  caption: string;
  views: number;
  date: string;
  thumbnailUrl?: string | null;
  postLink?: string | null;
  videoUrl?: string | null;
};

type CommunityPost = {
  id: string;
  caption: string;
  views: number;
  date: string;
  coverUrl?: string | null;
  postLink?: string | null;
  videoUrl?: string | null;
  reason?: string[];
};

type ModalSectionKey = 'themes' | 'kpis' | 'inspirations' | 'community';

const DEFAULT_SECTIONS_OPEN: Record<ModalSectionKey, boolean> = {
  themes: true,
  kpis: false,
  inspirations: false,
  community: false,
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const MODAL_CACHE_TTL_MS = 180_000;
const MODAL_CACHE_MAX_ENTRIES = 120;
const inspirationPostsCache = new Map<string, CacheEntry<InspirationPost[]>>();
const communityPostsCache = new Map<string, CacheEntry<CommunityPost[]>>();

function pruneModalCache<T>(cache: Map<string, CacheEntry<T>>) {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
  while (cache.size > MODAL_CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (typeof firstKey !== 'string') break;
    cache.delete(firstKey);
  }
}

function readModalCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  pruneModalCache(cache);
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeModalCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  pruneModalCache(cache);
  cache.set(key, {
    value,
    expiresAt: Date.now() + MODAL_CACHE_TTL_MS,
  });
}

function stableListKey(values?: string[]) {
  if (!Array.isArray(values) || !values.length) return '';
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .sort()
    .join(',');
}

function normalizeThemeText(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function buildModalSlotKey(slot: PlannerSlotData, format: string) {
  return [
    String(slot.dayOfWeek ?? ''),
    String(slot.blockStartHour ?? ''),
    format || 'reel',
    stableListKey(slot.categories?.context),
    stableListKey(slot.categories?.proposal),
    stableListKey(slot.categories?.reference),
    String(slot.categories?.tone || ''),
  ].join('|');
}

function buildInspirationsCacheKey(userId: string, slot: PlannerSlotData, format: string) {
  return `self|${userId}|${buildModalSlotKey(slot, format)}`;
}

function buildCommunityCacheKey(userId: string, slot: PlannerSlotData, format: string, theme: string) {
  return `community|${userId}|${buildModalSlotKey(slot, format)}|${theme.trim().toLowerCase()}`;
}

export interface PlannerSlotData {
  slotId?: string;
  dayOfWeek: number;
  blockStartHour: number;
  format: string;
  categories?: { context?: string[]; tone?: string; proposal?: string[]; reference?: string[] };
  contentIntent?: string[];
  narrativeForm?: string[];
  contentSignals?: string[];
  stance?: string[];
  proofStyle?: string[];
  commercialMode?: string[];
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
  targetUserId?: string | null;
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

type CollapsibleSectionProps = {
  sectionKey: ModalSectionKey;
  title: string;
  isOpen: boolean;
  onToggle: (key: ModalSectionKey) => void;
  action?: React.ReactNode;
  children: React.ReactNode;
};

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  sectionKey,
  title,
  isOpen,
  onToggle,
  action,
  children,
}) => {
  const contentId = `planner-slot-section-${sectionKey}`;
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.035)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-3 py-2.5 sm:px-5 sm:py-3">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => onToggle(sectionKey)}
          className="flex min-h-11 flex-1 items-center justify-between gap-3 rounded-xl px-1 text-left transition hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 sm:text-[11px]">{title}</span>
          <span className="text-sm font-semibold text-slate-500" aria-hidden>
            {isOpen ? '−' : '+'}
          </span>
        </button>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {isOpen ? (
        <div id={contentId} className="space-y-3.5 px-3 py-3.5 sm:space-y-4 sm:px-5 sm:py-5">
          {children}
        </div>
      ) : null}
    </section>
  );
};

export const PlannerSlotModal: React.FC<PlannerSlotModalProps> = ({
  open,
  onClose,
  userId,
  slot,
  onSave,
  onDuplicateSlot,
  onDeleteSlot,
  readOnly = false,
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
  const [inspPosts, setInspPosts] = useState<InspirationPost[]>([]);
  const [inspExpanded, setInspExpanded] = useState<boolean>(false);
  const [autoInspirationsFetched, setAutoInspirationsFetched] = useState(false);
  const [communityLoading, setCommunityLoading] = useState<boolean>(false);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityExpanded, setCommunityExpanded] = useState<boolean>(false);
  const [autoCommunityFetched, setAutoCommunityFetched] = useState(false);
  const [activeInspirationVideo, setActiveInspirationVideo] = useState<InspirationVideoItem | null>(null);
  const [nextInspirationVideo, setNextInspirationVideo] = useState<InspirationVideoItem | null>(null);
  const [selectedThemeForSave, setSelectedThemeForSave] = useState<string | null>(null);
  const [sectionsOpen, setSectionsOpen] = useState<Record<ModalSectionKey, boolean>>(() => ({ ...DEFAULT_SECTIONS_OPEN }));
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
    setAutoInspirationsFetched(false);
    setAutoCommunityFetched(false);
    setSectionsOpen({ ...DEFAULT_SECTIONS_OPEN });
    setSelectedThemeForSave(null);
    setActiveInspirationVideo(null);
    setNextInspirationVideo(null);
  }, [open, slot, derivedTheme]);

  useEffect(() => {
    if (!selectedThemeForSave) return;
    if (normalizeThemeText(selectedThemeForSave) === normalizeThemeText(title)) return;
    setSelectedThemeForSave(null);
  }, [title, selectedThemeForSave]);

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
    if (!open || activeInspirationVideo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, activeInspirationVideo]);

  const headerText = useMemo(() => {
    if (!slot) return '';
    const day = DAYS_PT[slot.dayOfWeek % 7] || '';
    const block = blockLabel(slot.blockStartHour);
    return `${day} • ${block}`;
  }, [slot]);

  const effectiveTheme = useMemo(() => (themeKw || derivedTheme || '').trim(), [themeKw, derivedTheme]);
  const inspirationsCacheKey = useMemo(
    () => (slot ? buildInspirationsCacheKey(userId, slot, format || 'reel') : null),
    [slot, userId, format]
  );
  const communityCacheKey = useMemo(
    () => (slot ? buildCommunityCacheKey(userId, slot, format || 'reel', effectiveTheme) : null),
    [slot, userId, format, effectiveTheme]
  );

  const statusDetails = useMemo(() => {
    if (!slot) return null;
    if (slot.status === 'posted') return { icon: '🔥', label: 'Campeão' };
    if (slot.status === 'test' || slot.isExperiment) return { icon: '🧪', label: 'Teste' };
    if (slot.status === 'drafted') return { icon: '👀', label: 'Rascunho' };
    return { icon: '👀', label: 'Sugestão' };
  }, [slot]);

  const slotPresentation = useMemo(
    () =>
      slot
        ? getPlannerSlotPresentation({
            ...slot,
            format,
            title,
            scriptShort: description,
            themeKeyword: effectiveTheme,
            themes: themesLocal,
          })
        : null,
    [slot, format, title, description, effectiveTheme, themesLocal]
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

  const fetchInspirations = useCallback(async (opts?: { force?: boolean }) => {
    if (!slot || !inspirationsCacheKey) return;
    const force = Boolean(opts?.force);
    if (!force) {
      const cached = readModalCache(inspirationPostsCache, inspirationsCacheKey);
      if (cached) {
        setInspPosts(cached);
        return;
      }
    }
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
          format,
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

      const mapped: InspirationPost[] = arr.map((p: any) => ({
          id: String(p.id),
          caption: String(p.caption || ''),
          views: Number(p.views || 0),
          date: String(p.date || ''),
          thumbnailUrl: p.thumbnailUrl || null,
          postLink: p.postLink || null,
          videoUrl: p.videoUrl || null,
      }));
      setInspPosts(mapped);
      writeModalCache(inspirationPostsCache, inspirationsCacheKey, mapped);
    } catch (err: any) {
      setInspError(err?.message || 'Erro ao carregar conteúdos');
    } finally {
      setInspLoading(false);
    }
  }, [slot, userId, format, inspirationsCacheKey]);

  useEffect(() => {
    if (!open || !slot || !sectionsOpen.inspirations || autoInspirationsFetched) return;
    setAutoInspirationsFetched(true);
    void fetchInspirations();
  }, [open, slot, sectionsOpen.inspirations, autoInspirationsFetched, fetchInspirations]);



  const fetchCommunityInspirations = useCallback(async (opts?: { force?: boolean }) => {
    if (!slot || !communityCacheKey) return;
    const force = Boolean(opts?.force);
    if (!force) {
      const cached = readModalCache(communityPostsCache, communityCacheKey);
      if (cached) {
        setCommunityPosts(cached);
        return;
      }
    }
    setCommunityLoading(true);
    setCommunityError(null);
    try {
      const res = await fetch('/api/planner/inspirations/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          categories: slot.categories || {},
          contentIntent: slot.contentIntent || [],
          narrativeForm: slot.narrativeForm || [],
          contentSignals: slot.contentSignals || [],
          stance: slot.stance || [],
          proofStyle: slot.proofStyle || [],
          commercialMode: slot.commercialMode || [],
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

      const mapped: CommunityPost[] = arr.map((p: any) => ({
          id: String(p.id),
          caption: String(p.caption || ''),
          views: Number(p.views || 0),
          date: String(p.date || ''),
          coverUrl: p.coverUrl || null,
          postLink: p.postLink || null,
          videoUrl: p.videoUrl || null,
          reason: Array.isArray(p.reason) ? p.reason : [],
      }));
      setCommunityPosts(mapped);
      writeModalCache(communityPostsCache, communityCacheKey, mapped);
    } catch (err: any) {
      setCommunityError(err?.message || 'Erro ao carregar comunidade');
    } finally {
      setCommunityLoading(false);
    }
  }, [slot, description, effectiveTheme, userId, format, communityCacheKey]);

  useEffect(() => {
    if (!open || !slot || !sectionsOpen.community || autoCommunityFetched) return;
    setAutoCommunityFetched(true);
    void fetchCommunityInspirations();
  }, [open, slot, sectionsOpen.community, autoCommunityFetched, fetchCommunityInspirations]);

  useEffect(() => {
    if (!open || !slot) return;
    setAutoInspirationsFetched(false);
    setAutoCommunityFetched(false);

    if (inspirationsCacheKey) {
      const cachedSelf = readModalCache(inspirationPostsCache, inspirationsCacheKey);
      if (cachedSelf) {
        setInspPosts(cachedSelf);
        setAutoInspirationsFetched(true);
      }
    }

    if (communityCacheKey) {
      const cachedCommunity = readModalCache(communityPostsCache, communityCacheKey);
      if (cachedCommunity) {
        setCommunityPosts(cachedCommunity);
        setAutoCommunityFetched(true);
      }
    }
  }, [open, slot, inspirationsCacheKey, communityCacheKey]);

  const handleOpenInspirationVideo = useCallback((items: InspirationVideoItem[], index: number) => {
    const current = items[index];
    if (!current) return;
    if (!current.postLink && !current.videoUrl) return;
    const next = index + 1 < items.length ? (items[index + 1] ?? null) : null;
    setActiveInspirationVideo(current);
    setNextInspirationVideo(next);
  }, []);

  const handleCloseInspirationVideo = useCallback(() => {
    setActiveInspirationVideo(null);
    setNextInspirationVideo(null);
  }, []);

  const toggleSection = useCallback((key: ModalSectionKey) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if ((!open && !isMounted) || !slot) return null;

  const dialogLabelId = 'planner-slot-modal-title';
  const dialogDescId = 'planner-slot-modal-desc';

  return (
    <>
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
        <header className="border-b border-slate-200/80 bg-white/85 px-4 pb-3 pt-2 backdrop-blur sm:px-6 sm:pb-4 sm:pt-3">
          <div className="flex justify-end">
            <button
              ref={closeBtnRef}
              type="button"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-neutral-200 text-sm text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900 sm:h-9 sm:w-9 sm:text-base"
              onClick={onClose}
              aria-label="Fechar painel"
            >
              ×
            </button>
          </div>
          <div className="mt-2.5 flex flex-col gap-1 sm:mt-3">
            {statusDetails ? (
              <div className="flex">
                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200/90 bg-neutral-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-neutral-600 sm:px-2.5 sm:text-[10px]">
                  <span aria-hidden>{statusDetails.icon}</span>
                  {statusDetails.label}
                </span>
              </div>
            ) : null}
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
              <p id={dialogLabelId} className="text-[1.34rem] font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-[1.72rem]">
                {headerText}
              </p>
            </div>
          </div>
        </header>

        <div id={dialogDescId} className="flex-1 overflow-y-auto bg-white">
          <div className="space-y-6 px-4 py-4 sm:space-y-7 sm:px-7 sm:py-6">
            <section className="space-y-4 sm:space-y-5">
              {!readOnly ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Bastidores do drop de domingo"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[1.05rem] font-semibold leading-[1.25] text-slate-900 placeholder-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10 sm:text-[1.22rem]"
                />
              ) : (
                <h2 className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[1.05rem] font-semibold leading-[1.25] text-slate-900 sm:text-[1.22rem]">
                  {title || effectiveTheme || 'Defina o título da pauta'}
                </h2>
              )}

              {!readOnly ? (
                <div className="space-y-2">
                  <label htmlFor="planner-slot-script" className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 sm:text-[11px]">
                    Roteiro
                  </label>
                  <textarea
                    id="planner-slot-script"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Estruture abertura, desenvolvimento e CTA para salvar mais rápido."
                    className="min-h-[112px] w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-[15px] leading-6 text-slate-800 placeholder-slate-400 focus:border-brand-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/10 sm:min-h-[132px]"
                  />
                </div>
              ) : (
                <p className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-[15px] leading-6 text-slate-700">
                  {description || 'Sem roteiro preenchido para esta pauta.'}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                <div className="min-h-[76px] rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:min-h-[84px]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 sm:text-[11px]">Formato</p>
                  <p className="mt-1 text-[13px] font-semibold text-slate-900 sm:text-sm">{formatLabel}</p>
                </div>
                <div className="min-h-[76px] rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:min-h-[84px]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 sm:text-[11px]">Tema</p>
                  <p className="mt-1 line-clamp-2 text-[13px] font-semibold text-slate-900 sm:text-sm">{effectiveTheme || '—'}</p>
                </div>
                <div className="min-h-[76px] rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:min-h-[84px]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 sm:text-[11px]">Projeção</p>
                  <p className="mt-1 text-[13px] font-bold text-emerald-700 sm:text-sm">{p50Compact || '—'}</p>
                </div>
                <div className="min-h-[76px] rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:min-h-[84px]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 sm:text-[11px]">Intenção</p>
                  <p className="mt-1 line-clamp-2 text-[13px] text-slate-800 sm:text-sm">{slotPresentation?.intentLabel || '—'}</p>
                </div>
                <div className="min-h-[76px] rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:min-h-[84px]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 sm:text-[11px]">Contexto</p>
                  <p className="mt-1 line-clamp-2 text-[13px] text-slate-800 sm:text-sm">{slotPresentation?.contextLabel || '—'}</p>
                </div>
                <div className="min-h-[76px] rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:min-h-[84px]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 sm:text-[11px]">Narrativa</p>
                  <p className="mt-1 line-clamp-2 text-[13px] text-slate-800 sm:text-sm">{slotPresentation?.narrativeLabel || '—'}</p>
                </div>
                <div className="min-h-[76px] rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:col-span-3 sm:min-h-[84px]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 sm:text-[11px]">{slotPresentation?.focusDetailLabel || 'Camada extra'}</p>
                  <p className="mt-1 line-clamp-2 text-[13px] text-slate-800 sm:text-sm">{slotPresentation?.focusDetailValue || '—'}</p>
                </div>
              </div>

              {slotPresentation?.metaChips.length ? (
                <div className="flex flex-wrap gap-2">
                  {slotPresentation.metaChips.map((chip) => (
                    <span
                      key={`slot-meta-${chip.key}`}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600"
                    >
                      <span className="mr-1 text-slate-400">{chip.label}</span>
                      <span className="text-slate-800">{chip.value}</span>
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
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

            <CollapsibleSection
              sectionKey="themes"
              title="Pautas recomendadas"
              isOpen={sectionsOpen.themes}
              onToggle={toggleSection}
              action={!readOnly ? (
                <button
                  type="button"
                  onClick={() => handleRegenerateThemes()}
                  disabled={themesLoading}
                  className="rounded-full px-2 py-1 text-[11px] font-semibold text-brand-primary transition hover:bg-brand-primary/5 hover:text-brand-dark disabled:opacity-50"
                >
                  {themesLoading ? 'Atualizando…' : 'Gerar novas ideias'}
                </button>
              ) : undefined}
            >
              {!readOnly && selectedThemeForSave ? (
                <div
                  className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
                  role="status"
                  aria-live="polite"
                >
                  <span aria-hidden>✓</span>
                  <span>Pauta selecionada virou o título e está pronta para salvar.</span>
                </div>
              ) : (
                <p className="text-xs text-slate-600">Selecione uma pauta para preencher o título com um toque.</p>
              )}
              {themesLoading && !themesLocal.length ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, idx) => (
                    <div key={`theme-skel-${idx}`} className="h-12 w-full animate-pulse rounded-xl bg-slate-50" />
                  ))}
                </div>
              ) : themesLocal.length > 0 ? (
                <div className="grid gap-2">
                  {themesLocal.slice(0, 4).map((t, i) => {
                    const isSelected = normalizeThemeText(selectedThemeForSave) === normalizeThemeText(t);
                    return (
                      <button
                        key={`theme-${i}`}
                        type="button"
                        onClick={() => {
                          setTitle(t);
                          setThemeKw(t);
                          setSelectedThemeForSave(t);
                        }}
                        className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left shadow-sm transition sm:px-4 sm:py-3 ${isSelected
                            ? 'border border-emerald-300 bg-emerald-50/80 ring-1 ring-emerald-200'
                            : 'border border-slate-100 bg-white hover:border-brand-primary/30 hover:bg-brand-primary/5 hover:shadow-md'
                          }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isSelected
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-brand-primary'
                            }`}
                          aria-hidden
                        >
                          {isSelected ? '✓' : i + 1}
                        </span>
                        <span className={`text-sm font-medium ${isSelected ? 'text-emerald-900' : 'text-slate-700 group-hover:text-slate-900'}`}>
                          {t}
                        </span>
                        {isSelected ? (
                          <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-emerald-700">
                            Selecionada
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm italic text-slate-500">Nenhuma pauta disponível para este slot.</p>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              sectionKey="kpis"
              title="KPIs projetados"
              isOpen={sectionsOpen.kpis}
              onToggle={toggleSection}
            >
              {typeof recordingTimeSec === 'number' ? (
                <p className="text-xs font-medium text-slate-600">⏱️ {Math.round(recordingTimeSec / 60) || 1} min de gravação</p>
              ) : null}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                {kpiCards.map((kpi) => (
                  <div key={kpi.key} className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-center sm:p-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 sm:text-[11px]">{kpi.label}</span>
                    <span className={`text-base font-bold sm:text-lg ${kpi.value ? 'text-slate-900' : 'text-slate-300'}`}>{kpi.value || '—'}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              sectionKey="inspirations"
              title="Conteúdos que inspiram"
              isOpen={sectionsOpen.inspirations}
              onToggle={toggleSection}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSectionsOpen((prev) => ({ ...prev, inspirations: true }));
                    setAutoInspirationsFetched(true);
                    void fetchInspirations({ force: true });
                  }}
                  disabled={inspLoading}
                  className="rounded-full px-2 py-1 text-[11px] font-semibold text-brand-primary transition hover:bg-brand-primary/5 hover:text-brand-dark disabled:opacity-50"
                >
                  {inspLoading ? 'Carregando…' : 'Atualizar'}
                </button>
              }
            >
              {inspError ? <p className="text-xs text-red-600">{inspError}</p> : null}
              {inspLoading && !inspPosts.length ? (
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
              ) : null}
              {inspPosts.length > 0 ? (
                <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200">
                  {(inspExpanded ? inspPosts : inspPosts.slice(0, 6)).map((p, idx, list) => {
                    const viewsLabel = formatCompact(p.views) || p.views.toLocaleString('pt-BR');
                    return (
                      <button
                        key={`insp-${p.id}`}
                        type="button"
                        onClick={() =>
                          handleOpenInspirationVideo(
                            list.map((item) => ({
                              id: item.id,
                              caption: item.caption,
                              postLink: item.postLink,
                              posterUrl: item.thumbnailUrl,
                              videoUrl: item.videoUrl,
                            })),
                            idx
                          )
                        }
                        className="group flex w-[200px] shrink-0 snap-start flex-col gap-3 rounded-xl transition hover:-translate-y-1"
                      >
                        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-slate-100 shadow-sm group-hover:shadow-md">
                          {p.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={toProxyUrl(p.thumbnailUrl)}
                              alt="Inspiracao"
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            />
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
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {!inspLoading && !inspPosts.length && !inspError ? (
                <p className="text-sm italic text-slate-500">Sem conteúdos similares para este horário agora.</p>
              ) : null}
            </CollapsibleSection>

            <CollapsibleSection
              sectionKey="community"
              title="Inspirações da comunidade"
              isOpen={sectionsOpen.community}
              onToggle={toggleSection}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSectionsOpen((prev) => ({ ...prev, community: true }));
                    setAutoCommunityFetched(true);
                    void fetchCommunityInspirations({ force: true });
                  }}
                  disabled={communityLoading}
                  className="rounded-full px-2 py-1 text-[11px] font-semibold text-brand-primary transition hover:bg-brand-primary/5 hover:text-brand-dark disabled:opacity-50"
                >
                  {communityLoading ? 'Carregando…' : 'Atualizar'}
                </button>
              }
            >
              {communityError ? <p className="text-xs text-red-600">{communityError}</p> : null}
              {communityLoading && !communityPosts.length ? (
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
              ) : null}
              {communityPosts.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(communityExpanded ? communityPosts : communityPosts.slice(0, 4)).map((p, idx, list) => (
                    <button
                      key={`community-${p.id}`}
                      type="button"
                      onClick={() =>
                        handleOpenInspirationVideo(
                          list.map((item) => ({
                            id: item.id,
                            caption: item.caption,
                            postLink: item.postLink,
                            posterUrl: item.coverUrl,
                            videoUrl: item.videoUrl,
                          })),
                          idx
                        )
                      }
                      className="flex gap-3 rounded-2xl border border-neutral-200/80 bg-white p-3 text-left shadow-sm transition hover:border-brand-primary/30 hover:shadow-md"
                    >
                      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
                        {p.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={toProxyUrl(p.coverUrl)}
                            alt="Post da comunidade"
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">Sem capa</div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="line-clamp-2 text-sm font-semibold text-neutral-900">{p.caption || 'Post sem legenda'}</p>
                        <div className="text-xs text-neutral-500">
                          {formatCompact(p.views) || p.views.toLocaleString('pt-BR')} views • {p.date ? new Date(p.date).toLocaleDateString('pt-BR') : ''}
                        </div>
                        {p.reason && p.reason.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.reason.slice(0, 3).map((tag, idx) => (
                              <span key={`reason-${p.id}-${idx}`} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
              {!communityLoading && !communityPosts.length && !communityError ? (
                <p className="text-xs italic text-neutral-500">Nenhuma inspiração da comunidade para este contexto.</p>
              ) : null}
              {communityPosts.length > 4 ? (
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => setCommunityExpanded((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-900"
                  >
                    {communityExpanded ? 'Ver menos' : `Ver todos (${communityPosts.length})`}
                  </button>
                </div>
              ) : null}
            </CollapsibleSection>
          </div>
        </div>

        <div
          className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-20px_30px_rgba(15,23,42,0.06)] sm:px-6 sm:py-4"
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
            <div className="space-y-2.5 sm:space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <p className="text-[11px] text-slate-600 sm:text-xs">
                Ao salvar, esta pauta também será criada em <span className="font-semibold text-slate-700">Meus Roteiros</span>.
              </p>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end">
                <GradientPillButton
                  type="button"
                  disabled={loading}
                  onClick={handleSave}
                  className="min-h-11 w-full sm:w-auto"
                >
                  {loading ? 'Processando…' : 'Salvar pauta'}
                </GradientPillButton>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
      {activeInspirationVideo ? (
        <DiscoverVideoModal
          open={Boolean(activeInspirationVideo)}
          onClose={handleCloseInspirationVideo}
          postLink={activeInspirationVideo.postLink || undefined}
          videoUrl={toVideoProxyUrl(activeInspirationVideo.videoUrl)}
          posterUrl={toProxyUrl(activeInspirationVideo.posterUrl)}
          nextItem={
            nextInspirationVideo
              ? {
                  id: nextInspirationVideo.id,
                  videoUrl: toVideoProxyUrl(nextInspirationVideo.videoUrl),
                  postLink: nextInspirationVideo.postLink || undefined,
                  posterUrl: toProxyUrl(nextInspirationVideo.posterUrl),
                  caption: nextInspirationVideo.caption,
                }
              : undefined
          }
          zIndexClassName="z-[650]"
        />
      ) : null}
    </>
  );
};

export default PlannerSlotModal;
