"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { idsToLabels, getCategoryById } from '@/app/lib/classification';

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
  /** opcional: palavra-chave do tema (ex.: “comida”). cai para o primeiro tema sugerido se ausente */
  themeKeyword?: string;
  /** notas internas do recomendador (para explicabilidade) */
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
  readOnly?: boolean;
  altStrongBlocks?: { blockStartHour: number; score: number }[];
  canGenerate?: boolean;
  showGenerateCta?: boolean;
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
    className={`inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D62E5E] to-[#6E1F93] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-[#c92d60] hover:to-[#5a1877] ${
      disabled ? 'cursor-not-allowed opacity-60 hover:from-[#D62E5E] hover:to-[#6E1F93]' : ''
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
    className={`inline-flex items-center justify-center gap-2 rounded-full border border-[#6E1F93] px-4 py-2 text-xs font-semibold text-[#6E1F93] transition hover:bg-[#F3F0FF] ${
      disabled ? 'cursor-not-allowed border-[#D5C8F5] text-[#B7A4E8] hover:bg-transparent' : ''
    } ${className}`}
  >
    {children}
  </button>
);

const MetricChip: React.FC<{ icon?: string; label: string; tone?: 'default' | 'highlight' | 'warning' }> = ({
  icon,
  label,
  tone = 'default',
}) => {
  const styles =
    tone === 'highlight'
      ? 'bg-[#FFF2F6] text-[#D62E5E] border-[#FBD8E2]'
      : tone === 'warning'
        ? 'bg-[#FFF7E6] text-[#B9730F] border-[#F5D8A0]'
        : 'bg-white text-[#4B4B55] border-[#E6E6EB]';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}>
      {icon && <span aria-hidden>{icon}</span>}
      {label}
    </span>
  );
};

const FORMAT_OPTIONS = [
  { id: 'reel', label: 'Reel' },
  { id: 'photo', label: 'Foto' },
  { id: 'carousel', label: 'Carrossel' },
  { id: 'story', label: 'Story' },
  { id: 'live', label: 'Live' },
  { id: 'long_video', label: 'Vídeo Longo' },
] as const;

export const PlannerSlotModal: React.FC<PlannerSlotModalProps> = ({
  open,
  onClose,
  userId,
  weekStartISO,
  slot,
  onSave,
  readOnly = false,
  altStrongBlocks = [],
  canGenerate = true,
  showGenerateCta = false,
  onUpgradeRequest,
  upgradeMessage,
}) => {
  // Proxy helper to avoid hotlink issues and allow caching via our server
  const toProxyUrl = (raw?: string | null) => {
    if (!raw) return '';
    if (raw.startsWith('/api/proxy/thumbnail/')) return raw;
    if (/^https?:\/\//i.test(raw)) return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
    return raw;
  };
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<string>('reel');
  // meta desabilitada na UI; estratégia padrão é 'default'
  const [strategy, setStrategy] = useState<'default'|'strong_hook'|'more_humor'|'practical_imperative'>('default');
  const triedAutoGenRef = useRef(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [aiVersionId, setAiVersionId] = useState<string | null>(null);

  // tema derivado (fallback para primeiro item de themes se não houver themeKeyword)
  const derivedTheme = useMemo(() => {
    if (!slot) return '';
    const raw = (slot.themeKeyword || '').trim();
    if (raw) return raw;
    const first = (slot.themes && slot.themes[0]) ? String(slot.themes[0]) : '';
    const simple = first.split(/[:\-–—|]/)[0]?.trim() || first.trim();
    return simple;
  }, [slot]);

  // 🔸 estado do tema editável
  const [themeKw, setThemeKw] = useState<string>('');
  const [themesLocal, setThemesLocal] = useState<string[]>([]);
  const [beats, setBeats] = useState<string[]>([]);
  const [recordingTimeSec, setRecordingTimeSec] = useState<number | undefined>(undefined);
  const [signalsUsed, setSignalsUsed] = useState<Array<{ title: string; url?: string; source?: string }>>([]);
  const [useSignals, setUseSignals] = useState<boolean>(true);
  const [inspLoading, setInspLoading] = useState<boolean>(false);
  const [inspError, setInspError] = useState<string | null>(null);
  const [inspPosts, setInspPosts] = useState<Array<{ id: string; caption: string; views: number; date: string; thumbnailUrl?: string|null; postLink?: string|null }>>([]);
  const [inspExpanded, setInspExpanded] = useState<boolean>(false);
  const [communityLoading, setCommunityLoading] = useState<boolean>(false);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [communityPosts, setCommunityPosts] = useState<Array<{ id: string; caption: string; views: number; date: string; coverUrl?: string|null; postLink?: string|null; reason?: string[] }>>([]);
  const [communityExpanded, setCommunityExpanded] = useState<boolean>(false);
  const [showTechnical, setShowTechnical] = useState<boolean>(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showScriptPanel, setShowScriptPanel] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [isMounted, setIsMounted] = useState(open);
  const [isVisible, setIsVisible] = useState(open);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (!open || !slot) return;
    setError(null);
    setTitle(slot.title || (slot.themes && slot.themes[0]) || '');
    setDescription(slot.scriptShort || '');
    setFormat(slot.format || 'reel');
    setAiVersionId(typeof slot.aiVersionId === 'string' ? slot.aiVersionId : slot.aiVersionId ?? null);
    // inicializa input com o tema atual (ou derivado dos temas sugeridos)
    setThemeKw((slot.themeKeyword || derivedTheme || '').trim());
    setThemesLocal(Array.isArray(slot.themes) ? [...slot.themes] : []);
    setBeats([]);
    setRecordingTimeSec(typeof slot.recordingTimeSec === 'number' ? slot.recordingTimeSec : undefined);
    triedAutoGenRef.current = false;
    setShowScriptPanel(false);
    setIsEditingTitle(false);
    setIsEditingScript(false);
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

  // Focus inicial no botão fechar para acessibilidade
  useEffect(() => {
    if (open) {
      setTimeout(() => closeBtnRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = scrollAreaRef.current;
    if (!node) return;
    const handleScroll = () => {
      const max = node.scrollHeight - node.clientHeight;
      if (max <= 0) {
        setScrollProgress(0);
        return;
      }
      setScrollProgress(Math.min(100, Math.max(0, (node.scrollTop / max) * 100)));
    };
    handleScroll();
    node.addEventListener('scroll', handleScroll, { passive: true });
    return () => node.removeEventListener('scroll', handleScroll);
  }, [open]);

  // Lock scroll do body quando o modal está aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Fecha no ESC
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

  const effectiveTheme = (themeKw || derivedTheme || '').trim();
  const contextLabels = useMemo(() => idsToLabels(slot?.categories?.context, 'context'), [slot?.categories?.context]);
  const proposalLabels = useMemo(() => idsToLabels(slot?.categories?.proposal, 'proposal'), [slot?.categories?.proposal]);
  const referenceLabels = useMemo(() => idsToLabels(slot?.categories?.reference, 'reference'), [slot?.categories?.reference]);
  const toneLabel = useMemo(
    () => (slot?.categories?.tone ? getCategoryById(slot.categories.tone, 'tone')?.label || slot.categories.tone : null),
    [slot?.categories?.tone]
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
  const contextSummary = useMemo(() => (contextLabels.length ? contextLabels.slice(0, 2).join(' • ') : 'Livre'), [contextLabels]);
  const proposalSummary = useMemo(
    () => (proposalLabels.length ? proposalLabels.slice(0, 2).join(' • ') : 'Em aberto'),
    [proposalLabels]
  );
  const referenceSummary = useMemo(
    () => (referenceLabels.length ? referenceLabels.slice(0, 2).join(' • ') : 'Sem referência definida'),
    [referenceLabels]
  );

  const handleRegenerateThemes = async () => {
    if (!slot) return;
    setLoading(true);
    setError(null);
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
      if (!themeKw && typeof data?.keyword === 'string' && data.keyword.trim()) {
        setThemeKw(String(data.keyword).trim());
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao gerar pautas');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (strategyOverride?: string) => {
    if (!slot) return;
    setLoading(true);
    setError(null);
    try {
      // Escolhe estratégia: override > selecionada > 'default'
      let strat: string | undefined = (strategyOverride && strategyOverride !== 'default') ? strategyOverride : undefined;
      if (!strat && strategy && strategy !== 'default') strat = strategy;
      if (!strat) strat = 'default';
      const res = await fetch('/api/planner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // enviamos themeKeyword para o backend (será usado para correlacionar com as categorias no roteiro)
        body: JSON.stringify({
          weekStart: weekStartISO,
          slot: { ...slot, format, themeKeyword: effectiveTheme },
          strategy: strat || 'default',
          noSignals: !useSignals,
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
      const genBeats = Array.isArray(gen?.beats) ? gen.beats.filter((s: any) => typeof s === 'string') : [];
      if (genBeats.length) setBeats(genBeats);
      if (typeof gen?.recordingTimeSec === 'number') setRecordingTimeSec(gen.recordingTimeSec);
      const sig: any[] = Array.isArray(data?.externalSignalsUsed) ? data.externalSignalsUsed : [];
      setSignalsUsed(sig.filter(Boolean));
      const newSlot = data?.slot;
      if (newSlot && typeof newSlot.aiVersionId === 'string') {
        setAiVersionId(newSlot.aiVersionId);
      } else if (newSlot && newSlot?.aiVersionId === null) {
        setAiVersionId(null);
      }
      if (newSlot && typeof newSlot.recordingTimeSec === 'number') {
        setRecordingTimeSec(newSlot.recordingTimeSec);
      }
      setShowScriptPanel(true);
      setIsEditingScript(false);
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  // Desativa autogerar ao abrir — seguimos com seleção manual de tema
  useEffect(() => {
    if (!open || !slot) return;
    triedAutoGenRef.current = true;
  }, [open, slot]);

  const handleSave = async () => {
    if (!slot) return;
    try {
      setLoading(true);
      await onSave({
        ...slot,
        title,
        format,
        themeKeyword: effectiveTheme,
        scriptShort: description,
        recordingTimeSec,
        aiVersionId: typeof aiVersionId === 'string' ? aiVersionId : slot.aiVersionId ?? null,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  // confiança baseada nos "n=" em rationale (amostra)
  const confidence = useMemo(() => {
    const rats = slot?.rationale || [];
    const counts: number[] = [];
    const re = /\bn=(\d+)\b/;
    for (const r of rats) {
      const m = String(r).match(re);
      if (m) counts.push(Number(m[1]));
    }
    const total = counts.reduce((a, b) => a + b, 0);
    const max = counts.length ? Math.max(...counts) : 0;
    if (max >= 20 || total >= 40) return 'Alta';
    if (max >= 8 || total >= 16) return 'Média';
    return 'Baixa';
  }, [slot?.rationale]);

  const effort = useMemo(() => {
    const sec = typeof recordingTimeSec === 'number' ? recordingTimeSec : undefined;
    const b = beats.length;
    if ((sec !== undefined && sec <= 30 && b <= 3) || (sec === undefined && b <= 3)) return 'Rápido';
    if ((sec !== undefined && sec <= 60 && b <= 5) || (sec === undefined && b <= 5)) return 'Médio';
    return 'Elaborado';
  }, [recordingTimeSec, beats]);

  const testHypothesis = useMemo(() => {
    if (!slot) return null;
    const isTest = slot.status === 'test' || !!slot.isExperiment;
    if (!isTest) return null;
    const proposals = (slot.categories?.proposal || []).map(p => p.toLowerCase());
    const contexts = (slot.categories?.context || []).map(c => c.toLowerCase());
    const hasP = (id: string) => proposals.includes(id);
    const hasC = (id: string) => contexts.includes(id);
    let hypo = 'Explorar combinação de categorias neste horário para descobrir lift.';
    if (hasP('comparison') && hasC('regional_stereotypes')) hypo = 'VS regional pode elevar engajamento neste horário.';
    else if (hasP('tutorial') || hasP('how_to') || hasP('tips')) hypo = 'Conteúdo prático pode aumentar salvamentos/engajamento.';
    else if (hasP('humor_scene')) hypo = 'Humor situacional pode aumentar compartilhamentos.';
    // critério
    const rat = (slot.rationale || []).find(r => /blockAvg=\d+(\.\d+)?/.test(String(r)));
    const m = rat ? String(rat).match(/blockAvg=(\d+(?:\.\d+)?)/) : null;
    const blockAvg = m ? Number(m[1]) : undefined;
    let crit = 'Sucesso: P50 do post >= P50 do bloco.';
    if (typeof blockAvg === 'number' && slot.expectedMetrics?.viewsP50) {
      crit = `Sucesso: P50 estimado ${slot.expectedMetrics.viewsP50.toLocaleString('pt-BR')} >= bloco ${Math.round(blockAvg).toLocaleString('pt-BR')}.`;
    }
    return { hypo, crit };
  }, [slot]);

  const fetchInspirations = async () => {
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
      setInspPosts(arr.map((p: any) => ({
        id: String(p.id),
        caption: String(p.caption || ''),
        views: Number(p.views || 0),
        date: String(p.date || ''),
        thumbnailUrl: p.thumbnailUrl || null,
        postLink: p.postLink || null,
      })));
    } catch (err: any) {
      setInspError(err?.message || 'Erro ao carregar conteúdos');
    } finally {
      setInspLoading(false);
    }
  };

  const fetchCommunityInspirations = async () => {
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
      setCommunityPosts(arr.map((p: any) => ({
        id: String(p.id),
        caption: String(p.caption || ''),
        views: Number(p.views || 0),
        date: String(p.date || ''),
        coverUrl: p.coverUrl || null,
        postLink: p.postLink || null,
        reason: Array.isArray(p.reason) ? p.reason : [],
      })));
    } catch (err: any) {
      setCommunityError(err?.message || 'Erro ao carregar comunidade');
    } finally {
      setCommunityLoading(false);
    }
  };

  const statusDetails = useMemo(() => {
    const st = slot?.status || (slot?.isExperiment ? 'test' : 'planned');
    switch (st) {
      case 'test':
        return { label: 'Em teste', tone: 'highlight' as const, icon: '🧪' };
      case 'posted':
        return { label: 'Publicado', tone: 'default' as const, icon: '✅' };
      case 'drafted':
        return { label: 'Rascunho', tone: 'default' as const, icon: '✏️' };
      default:
        return { label: 'Sugestão ativa', tone: 'default' as const, icon: '✨' };
    }
  }, [slot?.status, slot?.isExperiment]);

  if ((!open && !isMounted) || !slot) return null;

  const isTest = slot.status === 'test' || !!slot.isExperiment;
  const p50 = slot.expectedMetrics?.viewsP50;
  const p90 = slot.expectedMetrics?.viewsP90;
  const p50Compact = formatCompact(p50);
  const p90Compact = formatCompact(p90);
  const sharesCompact = formatCompact(slot.expectedMetrics?.sharesP50);

  const dialogLabelId = 'planner-slot-modal-title';
  const dialogDescId = 'planner-slot-modal-desc';

  return (
    <div className="fixed inset-0 z-[500] flex items-stretch justify-center overflow-hidden">
      <div
        className={`absolute inset-0 z-0 bg-slate-950/80 backdrop-blur-sm ${prefersReducedMotion ? '' : 'transition-opacity duration-200 ease-out'} ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogLabelId}
        aria-describedby={dialogDescId}
        className={`relative z-10 flex min-h-[100svh] w-full max-w-full flex-col bg-white shadow-2xl ${prefersReducedMotion ? '' : 'transition-all duration-200 ease-out'} ${
          isVisible
            ? 'opacity-100 translate-y-0 sm:scale-100'
            : prefersReducedMotion
              ? 'opacity-0 translate-y-0'
              : 'opacity-0 translate-y-6 sm:scale-[0.98]'
        }`}
      >
        {/* HEADER sticky */}
        <div
          className="sticky top-0 z-10 border-b border-[#E6E6EB] bg-[#FAFAFB]"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <button
              ref={closeBtnRef}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E6E6EB] text-lg text-[#4B4B55] transition hover:border-[#6E1F93] hover:text-[#6E1F93]"
              onClick={onClose}
              aria-label="Fechar"
            >
              ←
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-center text-center gap-1">
              <span className="text-sm font-semibold text-[#1C1C1E] truncate">
                {effectiveTheme || 'Pauta IA em destaque'}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6E1F93]">
                {headerText}
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-[#6E1F93]">
                {p50Compact && (
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden>🔥</span>
                    {p50Compact} views
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[#8F90A0]">•</span>
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden>{statusDetails.icon}</span>
                  {statusDetails.label}
                </span>
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#D62E5E] to-[#6E1F93] text-lg text-white shadow">
              🤖
            </div>
          </div>
          <div className="px-4 pb-3 sm:px-6">
            <div className="flex flex-wrap justify-center gap-2 text-[11px] text-[#4B4B55]">
              {p90Compact && (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden>🚀</span>
                  {p90Compact} views (P90)
                </span>
              )}
              {sharesCompact && (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden>🔁</span>
                  {sharesCompact} compartilhamentos
                </span>
              )}
              {(slot.rationale && slot.rationale.length > 0) && (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden>📊</span>
                  Evidência {confidence}
                </span>
              )}
              {(beats && beats.length > 0) && (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden>🎬</span>
                  Esforço {effort}
                </span>
              )}
            </div>
          </div>
          <div className="h-1 w-full bg-[#F0F1F5]">
            <div
              className="h-full bg-gradient-to-r from-[#D62E5E] to-[#6E1F93] transition-[width]"
              style={{ width: `${scrollProgress}%` }}
            />
          </div>
        </div>

          {/* SCROLL AREA */}
          <div id={dialogDescId} ref={scrollAreaRef} className="flex-1 overflow-y-auto bg-[#FAFAFB]">
            <div className="px-4 py-5 sm:px-6 sm:py-6 space-y-6">
              <section className="rounded-3xl border border-[#FBE2E9] bg-white p-5 shadow-sm space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#D62E5E]">
                      💡 Pauta sugerida
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#6E1F93]"
                        onClick={() => setIsEditingTitle((prev) => !prev)}
                      >
                        {isEditingTitle ? 'Concluir' : 'Editar título'}
                      </button>
                    )}
                  </div>
                  {isEditingTitle && !readOnly ? (
                    <input
                      id="title"
                      type="text"
                      className="w-full rounded-xl border border-[#E6E6EB] bg-white px-3 py-2 text-sm shadow-inner focus:border-[#D62E5E] focus:outline-none focus:ring-2 focus:ring-[#FAD9E2]"
                      placeholder="Ex.: 3 truques para..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  ) : (
                    <h3 id={dialogLabelId} className="text-[16px] font-semibold text-[#1C1C1E] leading-relaxed">
                      {title || effectiveTheme || 'Ajuste o título da pauta com a sua voz'}
                    </h3>
                  )}

                  <div className="flex flex-wrap gap-2 text-[13px] font-semibold text-[#6E1F93]">
                    {p50Compact && (
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden>🔥</span>
                        {p50Compact} views
                      </span>
                    )}
                    {statusDetails && (
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden>{statusDetails.icon}</span>
                        {statusDetails.label}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-[13px] text-[#4B4B55]">
                    <div>🎬 {formatLabel}</div>
                    <div>💬 {contextSummary}</div>
                    <div>🏷️ {proposalSummary}</div>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                    <OutlinePillButton
                      type="button"
                      onClick={() => title && navigator.clipboard?.writeText(title)}
                      disabled={!title}
                    >
                      Copiar título
                    </OutlinePillButton>
                    {!readOnly && (
                      <OutlinePillButton
                        type="button"
                        onClick={handleRegenerateThemes}
                        disabled={loading}
                      >
                        🔄 Outras ideias
                      </OutlinePillButton>
                    )}
                  </div>

                  {(themesLocal || []).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[#6E1F93]">Outras ideias do Mobi</p>
                      <div className="flex flex-wrap gap-2">
                        {(themesLocal || []).slice(0, 3).map((t, i) => (
                          <button
                            key={`theme-${i}`}
                            type="button"
                            onClick={() => {
                              setTitle(t);
                              setIsEditingTitle(false);
                            }}
                            className="rounded-full border border-[#FBD8E2] bg-[#FFF7FB] px-3 py-1 text-xs font-semibold text-[#D62E5E] transition hover:bg-[#FDF1F6]"
                            title="Usar este tema como título"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-[#E6E6EB] bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#1C1C1E]">
                      <span aria-hidden>📈</span> Conteúdos que inspiram
                    </p>
                    <p className="text-xs text-[#5A5A67]">
                      Posts reais que performaram em temas parecidos para você adaptar com a sua voz.
                    </p>
                  </div>
                  <OutlinePillButton
                    type="button"
                    onClick={fetchInspirations}
                    disabled={inspLoading}
                    className="whitespace-nowrap"
                    aria-label={inspLoading ? 'Carregando inspirações' : 'Atualizar inspirações'}
                  >
                    {inspLoading ? 'Carregando…' : <span aria-hidden>🔄</span>}
                  </OutlinePillButton>
                </div>
                {inspError && <div className="text-xs text-red-600">{inspError}</div>}
                {(inspLoading && !inspPosts.length) && (
                  <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={`insp-skel-${i}`}
                        className="min-w-[220px] rounded-2xl border border-[#EFE7FA] bg-[#F7F4FF] p-4 shadow-inner animate-pulse"
                      >
                        <div className="h-32 w-full rounded-xl bg-[#E8E0FB]" />
                        <div className="mt-3 space-y-2">
                          <div className="h-3 rounded bg-[#E0D5FF]" />
                          <div className="h-3 w-2/3 rounded bg-[#E0D5FF]" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {inspPosts.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin snap-x snap-mandatory">
                    {(inspExpanded ? inspPosts : inspPosts.slice(0, 6)).map((p) => {
                      const viewsLabel = formatCompact(p.views) || p.views.toLocaleString('pt-BR');
                      const isHighMatch = p.views >= 750000;
                      return (
                        <a
                          key={`insp-${p.id}`}
                          href={p.postLink || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="snap-start min-w-[240px] max-w-[260px] overflow-hidden rounded-3xl border border-[#EFE7FA] bg-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                        >
                          <div className="relative aspect-[4/3] w-full">
                            {p.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={toProxyUrl(p.thumbnailUrl)} alt="Conteúdo de inspiração" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-[#F3F0FF] text-xs text-[#6E1F93]">
                                sem imagem
                              </div>
                            )}
                            <span
                              className={`absolute left-3 top-3 rounded-full px-2 py-1 text-[10px] font-semibold text-white ${
                                isHighMatch ? 'bg-[#D62E5E]' : 'bg-[#6E1F93]'
                              }`}
                            >
                              🏆 {isHighMatch ? 'Match alto' : 'Match da IA'}
                            </span>
                          </div>
                          <div className="space-y-2 p-3">
                            <p className="line-clamp-2 text-sm font-semibold text-[#1C1C1E]" title={p.caption}>
                              {p.caption || 'Legenda não disponível'}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[#4B4B55]">
                              <span className="font-semibold text-[#1C1C1E]">{viewsLabel} views</span>
                              <span>{new Date(p.date).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
                {!inspLoading && !inspPosts.length && !inspError && (
                  <div className="text-xs text-[#8F90A0]">Sem conteúdos suficientes para este horário.</div>
                )}
                {inspPosts.length > 6 && (
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => setInspExpanded((v) => !v)}
                      className="inline-flex items-center gap-2 rounded-full border border-[#E6E6EB] px-4 py-1.5 text-xs font-semibold text-[#4B4B55] transition hover:border-[#6E1F93] hover:text-[#6E1F93]"
                    >
                      {inspExpanded ? 'Ver menos' : `Ver todos (${inspPosts.length})`}
                    </button>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-[#E4E4EA] bg-[#F9F9FB] p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#1C1C1E]">
                      <span aria-hidden>🤝</span> Inspirações da comunidade
                    </p>
                    <p className="text-xs text-[#5A5A67]">Creators que performaram bem em categorias parecidas.</p>
                  </div>
                  <OutlinePillButton
                    type="button"
                    onClick={fetchCommunityInspirations}
                    disabled={communityLoading}
                    className="whitespace-nowrap border-[#AFAFD5] text-[#4B4B55]"
                    aria-label={communityLoading ? 'Carregando inspirações da comunidade' : 'Atualizar inspirações da comunidade'}
                  >
                    {communityLoading ? 'Carregando…' : <span aria-hidden>🔄</span>}
                  </OutlinePillButton>
                </div>
                {communityError && <div className="text-xs text-red-600">{communityError}</div>}
                {(communityLoading && !communityPosts.length) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={`comm-skel-${i}`} className="flex animate-pulse items-center gap-3 rounded-2xl bg-white p-3">
                        <div className="h-16 w-16 rounded-2xl bg-[#E4E4EA]" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 rounded bg-[#D8D8E5]" />
                          <div className="h-3 w-2/3 rounded bg-[#D8D8E5]" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {communityPosts.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(communityExpanded ? communityPosts : communityPosts.slice(0, 4)).map((p) => {
                      const viewsLabel = formatCompact(p.views) || p.views.toLocaleString('pt-BR');
                      return (
                        <a
                          key={`c-insp-${p.id}`}
                          href={p.postLink || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 border-b border-[#E4E4EA] pb-3 transition hover:text-[#6E1F93]"
                        >
                          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E4E4EA]">
                            {p.coverUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={toProxyUrl(p.coverUrl)} alt="Post da comunidade" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-xs text-[#8F90A0]">sem imagem</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="line-clamp-1 text-sm font-semibold text-[#1C1C1E]" title={p.caption}>
                              {p.caption || 'Post sem legenda'}
                            </p>
                            <p className="text-xs font-semibold text-[#1C1C1E]">{viewsLabel} views</p>
                            {p.reason && p.reason.length > 0 && (
                              <p className="text-[11px] text-[#5A5A67]" title={`Match: ${p.reason.join(', ')}`}>
                                Match: {p.reason.slice(0, 2).join(', ')}
                              </p>
                            )}
                            <p className="text-[11px] text-[#8F90A0]">{new Date(p.date).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
                {!communityLoading && !communityPosts.length && !communityError && (
                      <div className="text-xs text-[#8F90A0]">Sem recomendações da comunidade no momento.</div>
                )}
                {communityPosts.length > 4 && (
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => setCommunityExpanded((v) => !v)}
                      className="inline-flex items-center gap-2 rounded-full border border-[#E6E6EB] px-4 py-1.5 text-xs font-semibold text-[#4B4B55] transition hover:border-[#6E1F93] hover:text-[#6E1F93]"
                    >
                      {communityExpanded ? 'Ver menos' : `Ver todos (${communityPosts.length})`}
                    </button>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-[#E6E6EB] bg-white p-4 shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-sm font-semibold text-[#1C1C1E]"
                  onClick={() => setShowTechnical((v) => !v)}
                >
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden>📊</span>
                    {showTechnical ? 'Ocultar dados da IA' : 'Ver dados da IA'}
                  </span>
                  <span className="text-lg text-[#6E1F93]">{showTechnical ? '−' : '+'}</span>
                </button>
                {showTechnical && (
                  <div className="mt-4 space-y-4 text-xs text-[#4B4B55]">
                    <div className="flex flex-wrap gap-2">
                      {p50Compact && <MetricChip icon="🔥" label={`${p50Compact} views (P50)`} tone="highlight" />}
                      {p90Compact && <MetricChip icon="🚀" label={`${p90Compact} views (P90)`} />}
                      {sharesCompact && <MetricChip icon="🔁" label={`${sharesCompact} compartilhamentos (P50)`} />}
                    </div>
                    {testHypothesis && (
                      <div className="rounded-xl border border-[#F5D8A0] bg-[#FFF7E6] p-3 space-y-1 text-[#8B5E1A]">
                        <div className="text-xs font-semibold text-[#B9730F]">Hipótese do teste</div>
                        <p>{testHypothesis.hypo}</p>
                        <p><strong>Critério de sucesso:</strong> {testHypothesis.crit}</p>
                      </div>
                    )}
                    {(altStrongBlocks && altStrongBlocks.length > 0) && (
                      <div>
                        <div className="text-xs font-semibold text-[#1C1C1E]">Outros horários quentes</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {altStrongBlocks.map((h, i) => (
                            <MetricChip
                              key={`alt-${i}`}
                              icon="⏱️"
                              label={`${blockLabel(h.blockStartHour)} • ${(h.score * 100).toFixed(0)}%`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {signalsUsed.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-[#1C1C1E]">Sinais usados pela IA</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {signalsUsed.map((sig, idx) => (
                            <li key={`sig-${idx}`}>
                              {sig.title || 'Sinal externo'}
                              {sig.source && <span className="text-[#8F90A0]"> • {sig.source}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(beats && beats.length > 0) && (
                      <div>
                        <div className="text-xs font-semibold text-[#1C1C1E]">Plano de cena sugerido</div>
                        <ol className="mt-2 list-decimal space-y-1 pl-5">
                          {beats.map((b, i) => (
                            <li key={`beat-${i}`} className="text-[#4B4B55]" title={b}>
                              {b}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {typeof recordingTimeSec === 'number' && (
                      <div className="text-[#4B4B55]">
                        ⏱️ Tempo estimado de gravação: {Math.round(recordingTimeSec / 60)} min
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>

          {showScriptPanel && (
            <div className="absolute inset-0 z-[120] flex flex-col">
              <button
                type="button"
                className="flex-1 bg-black/30"
                onClick={() => {
                  setShowScriptPanel(false);
                  setIsEditingScript(false);
                }}
                aria-label="Fechar painel de roteiro"
              />
              <div className="max-h-[70vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6E1F93]">✍️ Roteiro da IA</p>
                    <p className="text-sm text-[#5A5A67]">Rascunho pronto para você adaptar com a sua voz.</p>
                  </div>
                  <button
                    type="button"
                    className="text-xl text-[#8F90A0] hover:text-[#1C1C1E]"
                    onClick={() => {
                      setShowScriptPanel(false);
                      setIsEditingScript(false);
                    }}
                    aria-label="Fechar roteiro"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {isEditingScript ? (
                    <textarea
                      className="min-h-[180px] w-full rounded-xl border border-[#E6E6EB] bg-white px-3 py-2 text-sm leading-relaxed text-[#1C1C1E] focus:border-[#6E1F93] focus:outline-none focus:ring-2 focus:ring-[#D1C4F6]"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Personalize o roteiro com a sua voz..."
                    />
                  ) : (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-[#1C1C1E]">
                      {description
                        ? description
                        : 'Gere o roteiro para ver o rascunho da IA com ganchos, desenvolvimento e CTA.'}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <OutlinePillButton
                    type="button"
                    onClick={() => description && navigator.clipboard?.writeText(description)}
                    disabled={!description}
                  >
                    Copiar roteiro
                  </OutlinePillButton>
                  {!readOnly && (
                    <OutlinePillButton
                      type="button"
                      onClick={() => setIsEditingScript((prev) => !prev)}
                    >
                      {isEditingScript ? 'Concluir edição' : 'Editar roteiro'}
                    </OutlinePillButton>
                  )}
                  <OutlinePillButton
                    type="button"
                    onClick={() => handleGenerate(strategy)}
                    disabled={loading || readOnly || !slot || !canGenerate}
                  >
                    {loading ? 'Gerando…' : 'Regerar com IA'}
                  </OutlinePillButton>
                </div>
              </div>
            </div>
          )}

          {/* FOOTER sticky */}
          <div
            className="sticky bottom-0 z-10 bg-white border-t"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              {error && <div className="text-xs text-red-600">{error}</div>}
              <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
                {readOnly ? (
                  <button
                    type="button"
                    className="w-full rounded-full border border-[#D1D2D9] bg-white px-5 py-2 text-sm font-semibold text-[#4B4B55] transition hover:bg-[#F4F4F6]"
                    onClick={onClose}
                  >
                    Fechar
                  </button>
                ) : (
                  <>
                    <GradientPillButton
                      type="button"
                      disabled={loading || !slot || !canGenerate}
                      onClick={() => {
                        if (!slot || !canGenerate) {
                          if (!canGenerate && upgradeMessage) setError(upgradeMessage);
                          if (!canGenerate) onUpgradeRequest?.();
                          return;
                        }
                        handleGenerate(strategy);
                      }}
                      className="w-full px-6 py-2 text-sm sm:w-auto"
                    >
                      {loading ? 'Gerando…' : 'Gerar roteiro'}
                    </GradientPillButton>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={loading}
                      className="w-full rounded-full border border-[#6E1F93] bg-white px-5 py-2 text-sm font-semibold text-[#6E1F93] transition hover:bg-[#F3F0FF] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      Salvar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default PlannerSlotModal;
