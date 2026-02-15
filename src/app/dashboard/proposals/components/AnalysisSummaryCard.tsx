import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ProposalAnalysisV2, ProposalPricingConsistency, ProposalPricingSource } from '@/types/proposals';

import type { AnalysisViewMode } from './types';

interface AnalysisSummaryCardProps {
  analysisV2: ProposalAnalysisV2 | null;
  analysisMessage: string | null;
  analysisPricingMeta: {
    pricingConsistency: ProposalPricingConsistency | null;
    pricingSource: ProposalPricingSource | null;
    limitations: string[];
  };
  viewMode: AnalysisViewMode;
  onToggleViewMode: () => void;
};

function renderBulletList(items: string[]): JSX.Element | null {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5 text-sm leading-6 text-slate-700">
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
  analysisPricingMeta,
  viewMode,
  onToggleViewMode,
}: AnalysisSummaryCardProps) {
  if (!analysisV2 && !analysisMessage) {
    return null;
  }

  // Fallback for old textual analysis (legacy)
  if (!analysisV2 && analysisMessage) {
    return (
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-500">Resumo da IA</p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{analysisMessage}</p>
      </div>
    );
  }

  if (!analysisV2) return null;

  const nextAction = analysisV2.playbook[0] || 'Responda de forma clara com valor, escopo e prazo.';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onToggleViewMode}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-700"
        >
          {viewMode === 'summary' ? 'Detalhes' : 'Resumir'}
          {viewMode === 'summary' ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="space-y-3">
        {(analysisPricingMeta.pricingSource || analysisPricingMeta.pricingConsistency) && (
          <div className="flex flex-wrap gap-2">
            {analysisPricingMeta.pricingSource && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {analysisPricingMeta.pricingSource === 'calculator_core_v1'
                  ? 'Baseado no motor da Calculadora'
                  : 'Baseado em histórico local'}
              </span>
            )}
            {analysisPricingMeta.pricingConsistency && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                Consistência: {analysisPricingMeta.pricingConsistency}
              </span>
            )}
          </div>
        )}

        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">Recomendação</p>
          <p className="text-sm leading-relaxed text-slate-800">{nextAction}</p>
        </div>

        {analysisPricingMeta.limitations.length > 0 && (
          <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">Atenção de contexto</p>
            <div className="space-y-1 text-xs leading-5 text-amber-800">
              {analysisPricingMeta.limitations.map((item) => (
                <p key={item}>• {item}</p>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'expanded' && (
          <div className="mt-1 space-y-4 border-t border-slate-100 pt-3 animate-in slide-in-from-top-2 duration-300">
            {analysisV2.rationale.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-500">Por que?</p>
                {renderBulletList(analysisV2.rationale)}
              </div>
            )}

            {analysisV2.playbook.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-500">Estratégia</p>
                {renderBulletList(analysisV2.playbook)}
              </div>
            )}

            {analysisV2.cautions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600">Atenção</p>
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
