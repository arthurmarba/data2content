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

const RISK_TERM_PATTERN =
  /(risco|aten[cç][aã]o|cuidado|urgente|prazo|restri[cç][aã]o|limita[cç][aã]o|penalidade|multa|problema|bloqueio|conflito|evite|n[aã]o)\b/i;

function getBulletTone(item: string): { bulletClass: string; textClass: string } {
  if (RISK_TERM_PATTERN.test(item)) {
    return {
      bulletClass: "text-amber-500",
      textClass: "font-medium text-amber-900",
    };
  }

  return {
    bulletClass: "text-zinc-400",
    textClass: "text-zinc-700",
  };
}

function renderBulletList(items: string[]): JSX.Element | null {
  if (!items.length) return null;
  return (
    <div className="space-y-2 text-sm leading-6 text-zinc-700">
      {items.map((item) => {
        const tone = getBulletTone(item);
        return (
          <p key={item} className="flex gap-2">
            <span className={`${tone.bulletClass} select-none`}>•</span>
            <span className={tone.textClass}>{item}</span>
          </p>
        );
      })}
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
      <div className="dashboard-panel-subtle rounded-[1.35rem] p-4">
        <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">{analysisMessage}</p>
      </div>
    );
  }

  if (!analysisV2) return null;

  const nextAction = analysisV2.playbook[0] || 'Responda com valor, escopo e prazo.';
  const cautionItems = [...analysisPricingMeta.limitations, ...analysisV2.cautions].slice(0, 2);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onToggleViewMode}
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 transition hover:text-zinc-900"
        >
          {viewMode === 'summary' ? 'Detalhes' : 'Resumir'}
          {viewMode === 'summary' ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="dashboard-panel-subtle space-y-3 rounded-[1.35rem] p-4">
        <div>
          <p className="dashboard-muted-label mb-2 text-pink-500">Recomendação</p>
          <p className="text-sm leading-relaxed text-zinc-800">{nextAction}</p>
        </div>

        {cautionItems.length > 0 && (
          <div className="rounded-[1.1rem] border border-amber-100 bg-amber-50/80 px-3 py-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Atenção</p>
            <div className="space-y-1 text-xs leading-5 text-amber-800">
              {cautionItems.map((item) => (
                <p key={item}>• {item}</p>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'expanded' && (
          <div className="mt-1 space-y-4 border-t border-zinc-100 pt-3 animate-in slide-in-from-top-2 duration-300">
            {analysisV2.rationale.length > 0 && (
              <div>
                <p className="dashboard-muted-label mb-2">Por que?</p>
                {renderBulletList(analysisV2.rationale)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
