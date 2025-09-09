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
}

export interface PlannerSlotModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  weekStartISO: string;
  slot: PlannerSlotData | null;
  onSave: (updated: PlannerSlotData) => Promise<void>;
  readOnly?: boolean;
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

export const PlannerSlotModal: React.FC<PlannerSlotModalProps> = ({ open, onClose, userId, weekStartISO, slot, onSave, readOnly = false }) => {
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<string>('reel');
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

  useEffect(() => {
    if (!open || !slot) return;
    setError(null);
    setTitle(slot.title || (slot.themes && slot.themes[0]) || '');
    setDescription(slot.scriptShort || '');
    setFormat(slot.format || 'reel');
    // inicializa input com o tema atual (ou derivado dos temas sugeridos)
    setThemeKw((slot.themeKeyword || derivedTheme || '').trim());
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

  const handleGenerate = async (strategy?: string) => {
    if (!slot) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/planner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // enviamos themeKeyword para o backend (será usado para correlacionar com as categorias no roteiro)
        body: JSON.stringify({
          weekStart: weekStartISO,
          slot: { ...slot, format, themeKeyword: effectiveTheme },
          strategy: strategy || 'default',
        }),
      });
      if (!res.ok) throw new Error('Falha ao gerar roteiro');
      const data = await res.json();
      const gen = data?.generated;
      if (gen?.title) setTitle(gen.title);
      if (gen?.script) setDescription(gen.script);
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
            {/* Info pills (tema, views, formato) */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {(() => {
                const effective = (themeKw || derivedTheme || '').trim();
                return effective ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200" title="Tema-chave: palavra mais recorrente das legendas (editável abaixo)">
                    Tema: {effective}
                  </span>
                ) : null;
              })()}
              {typeof p50 === 'number' && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500 text-white" title={viewsTooltip} aria-label={viewsTooltip}>
                  {formatCompact(p50)}
                </span>
              )}
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                {format === 'reel'
                  ? 'Reel'
                  : format === 'photo'
                  ? 'Foto'
                  : format === 'carousel'
                  ? 'Carrossel'
                  : format === 'story'
                  ? 'Story'
                  : format === 'live'
                  ? 'Live'
                  : format === 'long_video'
                  ? 'Vídeo Longo'
                  : format}
              </span>
            </div>

            {/* Aviso quando for teste */}
            {isTest && (
              <div className="text-xs bg-yellow-50 border border-yellow-200 rounded-md p-2 text-yellow-800 mb-3">
                Este é um slot de <b>teste</b>: usamos para experimentar formatos/ideias que funcionaram em outros dia/horários e descobrir novas possibilidades neste bloco.
              </div>
            )}

            {/* Chips simples das categorias */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Contexto</div>
                <div className="flex flex-wrap gap-2">
                  {idsToLabels(slot.categories?.context, 'context').slice(0, 6).map((c, i) => (
                    <span key={`ctx-${i}`} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{c}</span>
                  ))}
                  {(!slot.categories?.context || slot.categories.context.length === 0) && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">—</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Proposta</div>
                <div className="flex flex-wrap gap-2">
                  {idsToLabels(slot.categories?.proposal, 'proposal').slice(0, 6).map((p, i) => (
                    <span key={`pr-${i}`} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{p}</span>
                  ))}
                  {(!slot.categories?.proposal || slot.categories.proposal.length === 0) && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">—</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Tom</div>
                <div className="flex flex-wrap gap-2">
                  {slot.categories?.tone ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                      {getCategoryById(slot.categories.tone, 'tone')?.label || slot.categories.tone}
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">—</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Referência</div>
                <div className="flex flex-wrap gap-2">
                  {idsToLabels(slot.categories?.reference, 'reference').slice(0, 6).map((r, i) => (
                    <span key={`rf-${i}`} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{r}</span>
                  ))}
                  {(!slot.categories?.reference || slot.categories.reference.length === 0) && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">—</span>
                  )}
                </div>
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
                Essa palavra aparece no card e é usada para orientar o gancho do roteiro. Se vazio, usamos o tema sugerido automaticamente.
              </p>
            </div>

            {/* Temas sugeridos */}
            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">Temas de conteúdo</div>
              <div className="space-y-2">
                {(slot.themes || []).slice(0, 6).map((t, i) => (
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
                {(!slot.themes || slot.themes.length === 0) && (
                  <div className="text-xs text-gray-500">Sem sugestões para este horário.</div>
                )}
              </div>
            </div>

            {/* Título e Descrição (para roteiros) */}
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-700" htmlFor="title">Título</label>
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
                <label className="text-sm font-semibold text-gray-700" htmlFor="desc">Roteiro curto</label>
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

            {/* Métricas esperadas (baseadas em VIEWS) */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
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
            <p className="mt-1 text-xs text-gray-500">
              P50 = mediana; P90 = valor alto provável. Estimativas em views, baseadas no histórico recente.
            </p>
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
                      className="w-full sm:w-auto border text-gray-700 hover:bg-gray-50"
                      onClick={() => handleGenerate('default')}
                    >
                      {loading ? 'Gerando…' : 'Gerar com IA'}
                    </Button>
                    <Button
                      disabled={loading}
                      className="w-full sm:w-auto border text-gray-700 hover:bg-gray-50"
                      onClick={() => handleGenerate('strong_hook')}
                    >
                      Regenerar
                    </Button>
                    <Button
                      disabled={loading}
                      className="w-full sm:w-auto bg-pink-600 text-white hover:bg-pink-700"
                      onClick={handleSave}
                    >
                      Salvar
                    </Button>
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
