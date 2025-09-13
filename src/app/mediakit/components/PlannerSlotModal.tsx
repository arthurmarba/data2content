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
}

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button {...props} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${className}`} />
);

// Badge de status no header
const StatusBadge: React.FC<{ status?: PlannerSlotData['status']; isExperiment?: boolean }> = ({ status, isExperiment }) => {
  const st = status || (isExperiment ? 'test' : 'planned');
  const styles: Record<string, string> = {
    planned: 'bg-green-50 text-green-700 border-green-200',
    drafted: 'bg-blue-50 text-blue-700 border-blue-200',
    test: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    posted: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  const labels: Record<string, string> = {
    planned: 'Sugestão',
    drafted: 'Rascunho',
    test: 'Teste',
    posted: 'Publicado',
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${styles[st] || styles.planned}`}>
      {labels[st] || 'Sugestão'}
    </span>
  );
};

export const PlannerSlotModal: React.FC<PlannerSlotModalProps> = ({ open, onClose, userId, weekStartISO, slot, onSave, readOnly = false, altStrongBlocks = [] }) => {
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<string>('reel');
  // meta desabilitada na UI; estratégia padrão é 'default'
  const [strategy, setStrategy] = useState<'default'|'strong_hook'|'more_humor'|'practical_imperative'>('default');
  const triedAutoGenRef = useRef(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

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
  const [sampleCaptions, setSampleCaptions] = useState<string[]>([]);
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

  useEffect(() => {
    if (!open || !slot) return;
    setError(null);
    setTitle(slot.title || (slot.themes && slot.themes[0]) || '');
    setDescription(slot.scriptShort || '');
    setFormat(slot.format || 'reel');
    // inicializa input com o tema atual (ou derivado dos temas sugeridos)
    setThemeKw((slot.themeKeyword || derivedTheme || '').trim());
    setThemesLocal(Array.isArray(slot.themes) ? [...slot.themes] : []);
    setBeats([]);
    setRecordingTimeSec(undefined);
    triedAutoGenRef.current = false;
  }, [open, slot, derivedTheme]);

  // Focus inicial no botão fechar para acessibilidade
  useEffect(() => {
    if (open) {
      setTimeout(() => closeBtnRef.current?.focus(), 0);
    }
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
      const caps: string[] = Array.isArray(data?.captions) ? data.captions : [];
      setSampleCaptions(caps);
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
      await onSave({ ...slot, title, format, themeKeyword: effectiveTheme });
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

  if (!open || !slot) return null;

  const isTest = slot.status === 'test' || !!slot.isExperiment;
  const p50 = slot.expectedMetrics?.viewsP50;
  const p90 = slot.expectedMetrics?.viewsP90;

  const viewsTooltip =
    typeof p50 === 'number' || typeof p90 === 'number'
      ? [
          typeof p50 === 'number' ? `Views esperadas (P50): ${p50.toLocaleString('pt-BR')}` : null,
          typeof p90 === 'number' ? `Alta prob. (P90): ${p90.toLocaleString('pt-BR')}` : null,
        ]
          .filter(Boolean)
          .join(' • ')
      : undefined;

  const dialogLabelId = 'planner-slot-modal-title';
  const dialogDescId = 'planner-slot-modal-desc';

  return (
    <div className="fixed inset-0 z-[100] bg-black/50" role="dialog" aria-modal="true" aria-labelledby={dialogLabelId} aria-describedby={dialogDescId}>
      {/* Container responsivo: sheet full-screen no mobile, card central no desktop */}
      <div className="absolute inset-x-0 bottom-0 top-0 sm:inset-0 sm:flex sm:items-center sm:justify-center">
        <div
          className="relative w-full h-[100svh] sm:h-auto sm:max-h-[85vh] sm:w-[min(680px,92vw)] bg-white sm:rounded-xl shadow-2xl flex flex-col"
        >
          {/* HEADER sticky */}
          <div
            className="sticky top-0 z-10 bg-white border-b"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px))' }}
          >
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <h3 id={dialogLabelId} className="text-base sm:text-lg font-bold text-gray-800 truncate">
                  {headerText}
                </h3>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <StatusBadge status={slot.status} isExperiment={slot.isExperiment} />
                {slot.rationale && slot.rationale.length > 0 && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                    confidence === 'Alta' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    confidence === 'Média' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-gray-50 text-gray-600 border-gray-200'
                  }`} title="Confiança estimada pela quantidade de evidência no histórico">
                    Evidência: {confidence}
                  </span>
                )}
                {(beats && beats.length > 0) && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200" title="Estimativa com base na duração e nº de etapas">
                    Esforço: {effort}
                  </span>
                )}
              </div>
              {/* Segmented de formato */}
              <div className="mt-2 flex flex-wrap gap-1" aria-label="Selecionar formato">
                {[
                  { id: 'reel', label: 'Reel' },
                  { id: 'photo', label: 'Foto' },
                  { id: 'carousel', label: 'Carrossel' },
                  { id: 'story', label: 'Story' },
                  { id: 'live', label: 'Live' },
                  { id: 'long_video', label: 'Vídeo Longo' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setFormat(opt.id)}
                    className={
                      `px-2 py-1 rounded-full text-xs border transition ${
                        format === opt.id
                          ? 'bg-pink-600 text-white border-pink-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`
                    }
                    aria-pressed={format === opt.id}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              </div>
              <button
                ref={closeBtnRef}
                className="shrink-0 text-2xl leading-none px-2 text-gray-500 hover:text-gray-800"
                onClick={onClose}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
          </div>

          {/* SCROLL AREA */}
          <div id={dialogDescId} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {/* Tema e layout em duas colunas */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {(() => {
                const effective = (themeKw || derivedTheme || '').trim();
                return effective ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200" title="Tema-chave: palavra mais recorrente das legendas (editável abaixo)">
                    Tema: {effective}
                  </span>
                ) : null;
              })()}
            </div>

            <div className="grid grid-cols-1 gap-5">
              {/* Métricas esperadas no topo */}
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div
                    className="bg-gray-50 rounded-md p-3"
                    title={typeof p50 === 'number' ? `Estimativa de views (P50): ${p50.toLocaleString('pt-BR')}` : undefined}
                  >
                    <div className="text-gray-500">Views esperadas (P50)</div>
                    <div className="font-semibold">{p50?.toLocaleString('pt-BR') ?? '—'}</div>
                  </div>
                  <div
                    className="bg-gray-50 rounded-md p-3"
                    title={typeof p90 === 'number' ? `Views (P90): ${p90.toLocaleString('pt-BR')}` : undefined}
                  >
                    <div className="text-gray-500">Views (P90)</div>
                    <div className="font-semibold">{p90?.toLocaleString('pt-BR') ?? '—'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3">
                    <div className="text-gray-500">Compartilhamentos (P50)</div>
                    <div className="font-semibold">{slot.expectedMetrics?.sharesP50?.toLocaleString('pt-BR') ?? '—'}</div>
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  <span title="P50 = mediana; P90 = valor alto provável. Estimativas em views, com base no histórico recente.">O que é P50/P90?</span>
                </div>
              </div>
              {/* Coluna Esquerda: Resumo */}
              <div>
                {/* Legenda de categorias */}
                <div className="text-[11px] text-gray-500 mb-1">
                  Legenda:
                  <span className="ml-2 inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span> Contexto</span>
                  <span className="ml-3 inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Proposta</span>
                  <span className="ml-3 inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400"></span> Tom</span>
                  <span className="ml-3 inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Referência</span>
                </div>
                {/* Chips por categoria */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1">Contexto</div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {idsToLabels(slot.categories?.context, 'context').slice(0, 6).map((c, i) => (
                        <span key={`ctx-${i}`} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{c}</span>
                      ))}
                      {(() => {
                        const total = slot.categories?.context?.length || 0;
                        const extra = Math.max(0, total - 6);
                        return extra > 0 ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">+{extra}</span>
                        ) : null;
                      })()}
                      {(!slot.categories?.context || slot.categories.context.length === 0) && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">—</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1">Proposta</div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {idsToLabels(slot.categories?.proposal, 'proposal').slice(0, 6).map((p, i) => (
                        <span key={`pr-${i}`} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{p}</span>
                      ))}
                      {(() => {
                        const total = slot.categories?.proposal?.length || 0;
                        const extra = Math.max(0, total - 6);
                        return extra > 0 ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">+{extra}</span>
                        ) : null;
                      })()}
                      {(!slot.categories?.proposal || slot.categories.proposal.length === 0) && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">—</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1">Tom</div>
                    <div className="flex flex-wrap gap-2">
                      {slot.categories?.tone ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          {getCategoryById(slot.categories.tone, 'tone')?.label || slot.categories.tone}
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">—</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1">Referência</div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {idsToLabels(slot.categories?.reference, 'reference').slice(0, 6).map((r, i) => (
                        <span key={`rf-${i}`} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{r}</span>
                      ))}
                      {(() => {
                        const total = slot.categories?.reference?.length || 0;
                        const extra = Math.max(0, total - 6);
                        return extra > 0 ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">+{extra}</span>
                        ) : null;
                      })()}
                      {(!slot.categories?.reference || slot.categories.reference.length === 0) && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Título e Descrição (para roteiros) */}
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-gray-700" htmlFor="title">Título</label>
                      <button type="button" className="text-xs text-gray-600 hover:text-gray-800" onClick={() => navigator.clipboard?.writeText(title || '')} disabled={!title}>Copiar</button>
                    </div>
                    <input
                      id="title"
                      type="text"
                      className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                      placeholder="Ex.: 3 truques para ..."
                      value={title}
                      disabled={readOnly}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-gray-700" htmlFor="desc">Roteiro curto</label>
                      <button type="button" className="text-xs text-gray-600 hover:text-gray-800" onClick={() => navigator.clipboard?.writeText(description || '')} disabled={!description}>Copiar</button>
                    </div>
                    <textarea
                      id="desc"
                      className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 min-h-[120px]"
                      placeholder="Estrutura de fala, ganchos e CTA..."
                      value={description}
                      disabled={readOnly}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>

                {/* Controles de geração (sem Meta) */}
                {!readOnly && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1 text-xs text-gray-700" title="Quando ligado, a IA pode usar sinais externos (notícias/tópicos) para criar gancho.">
                      <input type="checkbox" className="accent-pink-600" checked={useSignals} onChange={(e)=>setUseSignals(e.target.checked)} disabled={loading || readOnly} />
                      Usar sinais externos
                    </label>
                    <div className="inline-flex rounded-md overflow-hidden border ml-2">
                      {[
                        { id: 'default', label: 'Padrão' },
                        { id: 'strong_hook', label: 'Gancho forte' },
                        { id: 'more_humor', label: 'Mais humor' },
                        { id: 'practical_imperative', label: 'Mais prático' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className={`px-3 py-1.5 text-xs ${strategy === (opt.id as any) ? 'bg-pink-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} ${opt.id === 'default' ? '' : 'border-l'} border-gray-200`}
                          onClick={() => setStrategy(opt.id as any)}
                          aria-pressed={strategy === (opt.id as any)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <Button
                      disabled={loading}
                      className="border text-gray-700 hover:bg-gray-50"
                      onClick={() => handleGenerate(strategy)}
                    >
                      {loading ? 'Gerando…' : 'Gerar roteiro'}
                    </Button>
                  </div>
                )}

                {/* Temas de conteúdo (sugestões) */}
                <div className="mt-3">
                  <div className="flex items-center justify-end mb-2">
                    {!readOnly && (
                      <Button
                        className="border text-gray-700 hover:bg-gray-50"
                        onClick={handleRegenerateThemes}
                        disabled={loading}
                      >
                        {loading ? 'Gerando…' : 'Regenerar pautas'}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {(themesLocal || []).slice(0, 6).map((t, i) => (
                      <button
                        key={`theme-${i}`}
                        type="button"
                        onClick={() => setTitle(t)}
                        className="w-full text-left border rounded-md px-3 py-2 text-sm hover:bg-rose-50"
                        title="Usar este tema como título"
                      >
                        {t}
                      </button>
                    ))}
                    {(!themesLocal || themesLocal.length === 0) && (
                      <div className="text-xs text-gray-500">Sem sugestões para este horário.</div>
                    )}
                  </div>
                </div>

                {/* 🔸 Tema-chave (editável) */}
                <div className="space-y-1 mt-4">
                  <label className="text-sm font-semibold text-gray-700" htmlFor="themeKeyword">Tema (1 palavra)</label>
                  <input
                    id="themeKeyword"
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    placeholder="ex.: comida"
                    value={themeKw}
                    disabled={readOnly}
                    onChange={(e) => setThemeKw(e.target.value)}
                  />
                  <p className="text-[11px] text-gray-500">
                    Essa palavra aparece no card e orienta o gancho do roteiro. Se vazio, usamos o tema sugerido automaticamente.
                  </p>
                </div>

                

                {/* Por que sugerimos? — removido conforme solicitação */}

                {/* Conteúdos que inspiraram */}
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-700">Conteúdos que inspiraram</div>
                    <Button className="border text-gray-700 hover:bg-gray-50" onClick={fetchInspirations} disabled={inspLoading}>
                      {inspLoading ? 'Carregando…' : (inspPosts.length ? 'Atualizar' : 'Ver conteúdos')}
                    </Button>
                  </div>
                  {inspError && <div className="text-[11px] text-red-600 mt-1">{inspError}</div>}
                  {(inspLoading && !inspPosts.length) && (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={`insp-skel-${i}`} className="h-36 bg-gray-100 rounded-md animate-pulse" />
                      ))}
                    </div>
                  )}
                  {inspPosts.length > 0 && (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(inspExpanded ? inspPosts : inspPosts.slice(0,3)).map((p) => (
                        <a key={`insp-${p.id}`} href={p.postLink || '#'} target="_blank" rel="noreferrer"
                           className="block border rounded-md overflow-hidden hover:shadow-sm bg-white">
                          {p.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.thumbnailUrl} alt="thumb" className="w-full h-28 object-cover" />
                          ) : (
                            <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">sem imagem</div>
                          )}
                          <div className="p-2">
                            <div className="text-[11px] text-gray-600 line-clamp-2" title={p.caption}>{p.caption}</div>
                            <div className="mt-1 text-[10px] text-gray-500">{new Date(p.date).toLocaleDateString('pt-BR')} • {p.views.toLocaleString('pt-BR')} views</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                  {inspPosts.length > 3 && (
                    <div className="mt-2">
                      <Button className="border text-gray-700 hover:bg-gray-50" onClick={() => setInspExpanded(v => !v)}>
                        {inspExpanded ? 'Ver menos' : `Ver todos (${inspPosts.length})`}
                      </Button>
                    </div>
                  )}
                  {!inspLoading && !inspPosts.length && !inspError && (
                    <div className="text-[11px] text-gray-500 mt-1">Sem conteúdos suficientes para este horário.</div>
                  )}
                </div>

                {/* Outros horários fortes */}
                {(altStrongBlocks && altStrongBlocks.length > 0) && (
                  <div className="mt-3">
                    <div className="text-sm font-semibold text-gray-700">Outros horários fortes hoje</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {altStrongBlocks.map((h, i) => (
                        <span key={`alt-${i}`} className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200" title={`Score relativo: ${(h.score * 100).toFixed(0)}%`}>
                          {blockLabel(h.blockStartHour)} • {(h.score * 100).toFixed(0)}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hipótese e critério (apenas teste) */}
                {testHypothesis && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-900">
                    <div><b>Hipótese do teste:</b> {testHypothesis.hypo}</div>
                    <div><b>Critério de sucesso:</b> {testHypothesis.crit}</div>
                  </div>
                )}
              </div>

              {/* Coluna Direita: Roteiro e geração (ajustada: meta removida e campos movidos acima) */}
              <div>

                {/* Plano de cena (opcional) */}
                {(beats && beats.length > 0) && (
                  <div className="mt-3">
                    <div className="text-sm font-semibold text-gray-700 mb-1">Plano de cena</div>
                    <ol className="list-decimal ml-5 text-xs text-gray-700 space-y-1">
                      {beats.map((b, i) => (
                        <li key={`beat-${i}`} className="truncate" title={b}>{b}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Inspiração da comunidade */}
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-700">Inspiração da comunidade</div>
                    <Button className="border text-gray-700 hover:bg-gray-50" onClick={fetchCommunityInspirations} disabled={communityLoading}>
                      {communityLoading ? 'Carregando…' : (communityPosts.length ? 'Atualizar' : 'Ver conteúdos da comunidade')}
                    </Button>
                  </div>
                  {communityError && <div className="text-[11px] text-red-600 mt-1">{communityError}</div>}
                  {(communityLoading && !communityPosts.length) && (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={`comm-skel-${i}`} className="h-36 bg-gray-100 rounded-md animate-pulse" />
                      ))}
                    </div>
                  )}
                  {communityPosts.length > 0 && (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(communityExpanded ? communityPosts : communityPosts.slice(0, 3)).map((p) => (
                        <a key={`c-insp-${p.id}`} href={p.postLink || '#'} target="_blank" rel="noreferrer"
                           className="block border rounded-md overflow-hidden hover:shadow-sm bg-white">
                          {p.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.coverUrl} alt="thumb" className="w-full h-28 object-cover" />
                          ) : (
                            <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">sem imagem</div>
                          )}
                          <div className="p-2">
                            <div className="text-[11px] text-gray-600 line-clamp-2" title={p.caption}>{p.caption}</div>
                            <div className="mt-1 text-[10px] text-gray-500">{new Date(p.date).toLocaleDateString('pt-BR')} • {p.views.toLocaleString('pt-BR')} views</div>
                            {p.reason && p.reason.length > 0 && (
                              <div className="mt-1 text-[10px] text-gray-500 truncate" title={`Por que sugerimos: ${p.reason.join(', ')}`}>
                                Por que: {p.reason.slice(0, 2).join(', ')}
                              </div>
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                  {communityPosts.length > 3 && (
                    <div className="mt-2">
                      <Button className="border text-gray-700 hover:bg-gray-50" onClick={() => setCommunityExpanded(v => !v)}>
                        {communityExpanded ? 'Ver menos' : `Ver todos (${communityPosts.length})`}
                      </Button>
                    </div>
                  )}
                  {!communityLoading && !communityPosts.length && !communityError && (
                    <div className="text-[11px] text-gray-500 mt-1">Sem recomendações da comunidade no momento.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER sticky */}
          <div
            className="sticky bottom-0 z-10 bg-white border-t"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="px-4 py-3 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {error && <div className="text-xs text-red-600">{error}</div>}
              <div className="w-full sm:w-auto sm:ml-auto flex flex-col sm:flex-row gap-2">
                {readOnly ? (
                  <Button className="w-full border text-gray-700 hover:bg-gray-50" onClick={onClose}>Fechar</Button>
                ) : (
                  <>
                    <Button
                      disabled={loading}
                      className="w-full sm:w-auto bg-pink-600 text-white hover:bg-pink-700"
                      onClick={handleSave}
                    >
                      Salvar
                    </Button>
                    <Button className="w-full sm:w-auto border text-gray-700 hover:bg-gray-50" onClick={onClose}>Fechar</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlannerSlotModal;
