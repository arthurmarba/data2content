import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ProposalAnalysisV2 } from '@/types/proposals';

import type { AnalysisViewMode } from './types';

interface AnalysisSummaryCardProps {
  analysisV2: ProposalAnalysisV2 | null;
  analysisMessage: string | null;
  viewMode: AnalysisViewMode;
  onToggleViewMode: () => void;
  formatMoney: (value: number | null, currency: string) => string;
  formatGapLabel: (value: number | null) => string;
}

const VERDICT_STYLES: Record<ProposalAnalysisV2['verdict'], { label: string; bg: string; text: string; border: string }> = {
  aceitar: { label: 'Pode fechar', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  ajustar: { label: 'Pedir ajuste de valor', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
  aceitar_com_extra: { label: 'Aceitar com extra', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
  ajustar_escopo: { label: 'Ajustar escopo', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100' },
  coletar_orcamento: { label: 'Pedir orçamento', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
};

function renderBulletList(items: string[]): JSX.Element | null {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-slate-700">
      {items.map((item) => (
        <p key={item} className="flex gap-2">
          <span className="text-slate-400 select-none">•</span>
          <span>{item}</span>
        </p>
      ))}
    </div>
  );
}

export default function AnalysisSummaryCard({
  analysisV2,
  analysisMessage,
  viewMode,
  onToggleViewMode,
  formatMoney,
  formatGapLabel,
}: AnalysisSummaryCardProps) {
  if (!analysisV2 && !analysisMessage) {
    return null;
  }

  // Fallback for old textual analysis (legacy)
  if (!analysisV2 && analysisMessage) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Resumo da IA</p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{analysisMessage}</p>
      </div>
    );
  }

  if (!analysisV2) return null;

  const verdictStyle = VERDICT_STYLES[analysisV2.verdict];
  const nextAction = analysisV2.playbook[0] || 'Responda de forma clara com valor, escopo e prazo.';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

      {/* Verdict Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Diagnóstico IA</p>
          <span className={`inline-block text-sm font-bold px-2 py-0.5 rounded-md ${verdictStyle.bg} ${verdictStyle.text} border ${verdictStyle.border}`}>
            {verdictStyle.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleViewMode}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          {viewMode === 'summary' ? 'Detalhes' : 'Resumir'}
          {viewMode === 'summary' ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Next Action - Highlighted (Muted) */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Recomendação</p>
          <p className="text-sm font-medium leading-relaxed text-slate-800">{nextAction}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Confiança</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-sm font-bold text-slate-900">{analysisV2.confidence.label}</span>
              <span className="text-xs font-medium text-slate-500">({(analysisV2.confidence.score * 100).toFixed(0)}%)</span>
            </div>
          </div>
          <div className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Faixa ideal</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {formatMoney(analysisV2.pricing.floor, analysisV2.pricing.currency)} - {formatMoney(analysisV2.pricing.anchor, analysisV2.pricing.currency)}
            </p>
          </div>
        </div>

        {viewMode === 'expanded' && (
          <div className="pt-4 mt-2 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Oferta da marca</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {formatMoney(analysisV2.pricing.offered, analysisV2.pricing.currency)}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Diferença</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{formatGapLabel(analysisV2.pricing.gapPercent)}</p>
              </div>
            </div>

            {analysisV2.rationale.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Por que?</p>
                {renderBulletList(analysisV2.rationale)}
              </div>
            )}

            {analysisV2.playbook.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Estratégia</p>
                {renderBulletList(analysisV2.playbook)}
              </div>
            )}

            {analysisV2.cautions.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 mb-2">Atenção</p>
                <div className="text-slate-700 text-sm">
                  {renderBulletList(analysisV2.cautions)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
