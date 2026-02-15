export type ProposalSuggestionType =
  | 'aceitar'
  | 'ajustar'
  | 'aceitar_com_extra'
  | 'ajustar_escopo'
  | 'coletar_orcamento';

export type ProposalConfidenceLabel = 'alta' | 'media' | 'baixa';
export type ProposalPricingConsistency = 'alta' | 'media' | 'baixa';
export type ProposalPricingSource = 'calculator_core_v1' | 'historical_only';

export interface ProposalAnalysisPricing {
  currency: string;
  offered: number | null;
  target: number | null;
  anchor: number | null;
  floor: number | null;
  gapPercent: number | null;
}

export interface ProposalAnalysisV2 {
  verdict: ProposalSuggestionType;
  confidence: {
    score: number;
    label: ProposalConfidenceLabel;
  };
  pricing: ProposalAnalysisPricing;
  rationale: string[];
  playbook: string[];
  cautions: string[];
}

export interface ProposalAnalysisMeta {
  model: string;
  fallbackUsed: boolean;
  latencyMs: number;
  contextSignals: string[];
}

export interface ProposalAnalysisApiResponse {
  analysis: string;
  replyDraft: string;
  suggestionType: ProposalSuggestionType;
  suggestedValue: number | null;
  pricingConsistency?: ProposalPricingConsistency;
  pricingSource?: ProposalPricingSource;
  limitations?: string[];
  analysisV2?: ProposalAnalysisV2;
  meta?: ProposalAnalysisMeta;
}

export interface ProposalAnalysisStoredSnapshot {
  createdAt: string | null;
  version: string | null;
  analysis: string | null;
  replyDraft: string | null;
  suggestionType: ProposalSuggestionType | null;
  suggestedValue: number | null;
  pricingConsistency: ProposalPricingConsistency | null;
  pricingSource: ProposalPricingSource | null;
  limitations: string[];
  analysisV2: ProposalAnalysisV2 | null;
  meta: ProposalAnalysisMeta | null;
}
