import type {
  ProposalAnalysisMeta,
  ProposalAnalysisV2,
  ProposalPricingConsistency,
  ProposalPricingSource,
  ProposalSuggestionType,
} from '@/types/proposals';

export interface ProposalPricingCoreContext {
  source: 'calculator_core_v1' | 'fallback';
  calculatorJusto: number | null;
  calculatorEstrategico: number | null;
  calculatorPremium: number | null;
  confidence: number | null;
  resolvedDefaults: string[];
  limitations: string[];
}

export interface ProposalAnalysisContext {
  creator: {
    id: string;
    name?: string;
    handle?: string;
  };
  proposal: {
    id: string;
    brandName: string;
    campaignTitle?: string;
    campaignDescription?: string;
    deliverables: string[];
    offeredBudget: number | null;
    currency: string;
    mediaKitPublicUrl: string | null;
  };
  latestCalculation: {
    justo: number | null;
    estrategico: number | null;
    premium: number | null;
    segment: string | null;
    engagement: number | null;
    reach: number | null;
  } | null;
  benchmarks: {
    calcTarget: number | null;
    legacyCalcTarget: number | null;
    dealTarget: number | null;
    similarProposalTarget: number | null;
    closeRate: number | null;
    dealCountLast180d: number;
    similarProposalCount: number;
    totalProposalCount: number;
  };
  pricingCore: ProposalPricingCoreContext;
  contextSignals: string[];
}

export interface DeterministicAnalysisResult {
  verdict: ProposalSuggestionType;
  suggestionType: ProposalSuggestionType;
  suggestedValue: number | null;
  analysisV2: ProposalAnalysisV2;
  analysis: string;
  replyDraft: string;
  targetValue: number | null;
}

export interface LlmEnhancedPayload {
  analysis: string;
  replyDraft: string;
  rationale: string[];
  playbook: string[];
  cautions: string[];
}

export interface ProposalAnalysisV2Response {
  analysis: string;
  replyDraft: string;
  suggestionType: ProposalSuggestionType;
  suggestedValue: number | null;
  pricingConsistency: ProposalPricingConsistency;
  pricingSource: ProposalPricingSource;
  limitations: string[];
  analysisV2: ProposalAnalysisV2;
  meta: ProposalAnalysisMeta;
}
