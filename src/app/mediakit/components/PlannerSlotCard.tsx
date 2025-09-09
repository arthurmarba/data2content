"use client";

import React from 'react';
import { idsToLabels, getCategoryById } from '@/app/lib/classification';

export interface PlannerSlotCardProps {
  title?: string;
  themeKeyword?: string;
  categories?: { context?: string[]; tone?: string; proposal?: string[]; reference?: string[] };
  expectedMetrics?: { viewsP50?: number; viewsP90?: number; sharesP50?: number };
  isExperiment?: boolean;
  status?: 'planned' | 'drafted' | 'test' | 'posted';
  formatId?: 'reel' | 'photo' | 'carousel' | 'story' | 'live' | 'long_video';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

function formatCompact(n?: number) {
  if (typeof n !== 'number' || !isFinite(n)) return '';
  try {
    return n.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  } catch {
    return String(n);
  }
}

function formatLabel(id?: string): string | undefined {
  switch (id) {
    case 'reel': return 'Reel';
    case 'photo': return 'Foto';
    case 'carousel': return 'Carrossel';
    case 'story': return 'Story';
    case 'live': return 'Live';
    case 'long_video': return 'Vídeo Longo';
    default: return id;
  }
}

const chipStyles = {
  format: 'bg-rose-50 text-rose-700 border border-rose-200',
  context: 'bg-blue-50 text-blue-700 border border-blue-200',
  tone: 'bg-purple-50 text-purple-700 border border-purple-200',
  proposal: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  reference: 'bg-amber-50 text-amber-700 border border-amber-200',
};

export const PlannerSlotCard: React.FC<PlannerSlotCardProps> = ({
  title,
  themeKeyword,
  categories,
  expectedMetrics,
  isExperiment,
  status,
  formatId,
  onClick
}) => {
  const p50 = expectedMetrics?.viewsP50;
  const p90 = expectedMetrics?.viewsP90;

  const isTest = status === 'test' || !!isExperiment;
  const isPosted = status === 'posted';

  const viewsTooltip =
    typeof p50 === 'number' || typeof p90 === 'number'
      ? [
          typeof p50 === 'number' ? `Views esperadas (P50): ${p50.toLocaleString('pt-BR')}` : null,
          typeof p90 === 'number' ? `Alta prob. (P90): ${p90.toLocaleString('pt-BR')}` : null,
        ].filter(Boolean).join(' • ')
      : undefined;

  const baseCardClasses =
    'relative w-full h-full text-left bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-pink-500 flex flex-col';
  const statusClasses = isPosted ? 'opacity-70 bg-gray-50' : '';

  const badge = isTest ? (
    <div
      className="absolute top-3 right-3 w-9 h-9 bg-yellow-400 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow z-10"
      title="Slot de teste (exploração de ideias/categorias com menor evidência neste bloco)"
    >
      TESTE
    </div>
  ) : (
    typeof p50 === 'number' && (
      <div
        className="absolute top-3 right-3 bg-green-500 text-white rounded-full px-2 py-1 text-xs font-semibold shadow z-10"
        title={viewsTooltip}
        aria-label={viewsTooltip}
        data-badge="views"
      >
        {formatCompact(p50)}
      </div>
    )
  );

  const allChips: { key: string; label: string; style: string }[] = [];
  const fmt = formatLabel(formatId);
  if (fmt) allChips.push({ key: 'format', label: fmt, style: chipStyles.format });
  
  idsToLabels(categories?.context, 'context').forEach((label) => 
    allChips.push({ key: `ctx-${label}`, label, style: chipStyles.context })
  );
  
  const toneLabel = categories?.tone ? (getCategoryById(categories.tone, 'tone')?.label || categories?.tone) : undefined;
  if (toneLabel) allChips.push({ key: 'tone', label: toneLabel, style: chipStyles.tone });

  idsToLabels(categories?.proposal, 'proposal').forEach((label) => 
    allChips.push({ key: `prp-${label}`, label, style: chipStyles.proposal })
  );

  idsToLabels(categories?.reference, 'reference').forEach((label) =>
    allChips.push({ key: `ref-${label}`, label, style: chipStyles.reference })
  );

  const fallbackTitle = () => {
    if (themeKeyword && themeKeyword.trim().length > 0) return themeKeyword;
    const parts: string[] = [];
    const contextLabels = idsToLabels(categories?.context, 'context');
    const proposalLabels = idsToLabels(categories?.proposal, 'proposal');
    if (fmt) parts.push(fmt);
    if (contextLabels[0]) parts.push(contextLabels[0]);
    if (proposalLabels[0]) parts.push(proposalLabels[0]);
    return parts.length ? `Sugestão: ${parts.join(' • ')}` : 'Tema sugerido';
  };

  const aria = [
    title || fallbackTitle(),
    themeKeyword ? `Tema: ${themeKeyword}` : '',
    typeof p50 === 'number' ? `Views P50 ${p50.toLocaleString('pt-BR')}` : '',
    typeof p90 === 'number' ? `Views P90 ${p90.toLocaleString('pt-BR')}` : '',
  ].filter(Boolean).join(' • ');

  return (
    <button
      type="button"
      className={`${baseCardClasses} ${statusClasses}`}
      onClick={onClick}
      aria-label={aria}
      title={title || fallbackTitle()}
      data-status={status || (isTest ? 'test' : 'planned')}
      data-views-p50={typeof p50 === 'number' ? p50 : undefined}
      data-views-p90={typeof p90 === 'number' ? p90 : undefined}
      data-theme={themeKeyword || undefined}
    >
      {badge}

      {isPosted && (
        <div
          className="absolute bottom-3 left-3 flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 z-10"
          title="Publicado"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="currentColor" />
          </svg>
          Publicado
        </div>
      )}
      
      {/* MUDANÇA DEFINITIVA 1: Criando espaço no topo e alinhando o conteúdo junto */}
      <div className="pt-12 px-3 pb-3 flex-1 flex flex-col justify-start">
        {/* Parte Superior: Chips */}
        <div>
          {allChips.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {allChips.slice(0, 6).map((chip) => (
                <span 
                  key={chip.key} 
                  // MUDANÇA DEFINITIVA 2: Chips mais curtos
                  className={`text-[11px] px-2 py-0.5 rounded-full ${chip.style} inline-block truncate max-w-24`}
                  title={chip.label}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Parte Inferior: Título */}
        <div className="pr-8 mt-2 text-sm font-semibold text-gray-800 line-clamp-4">
          {title || fallbackTitle()}
        </div>
      </div>
    </button>
  );
};

export default PlannerSlotCard;