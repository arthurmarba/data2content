import type {
  ProposalAnalysisStoredSnapshot,
  ProposalAnalysisV2,
  ProposalPricingConsistency,
  ProposalPricingSource,
} from '@/types/proposals';

export type ProposalStatus = 'novo' | 'visto' | 'respondido' | 'aceito' | 'rejeitado';
export type ProposalBudgetIntent = 'provided' | 'requested';

export type CampaignsStep = 'inbox' | 'detail' | 'reply';

export type InboxTab = 'incoming' | 'negotiation' | 'won' | 'lost';

export type AnalysisViewMode = 'summary' | 'expanded';

export type ReplyIntent = 'accept' | 'adjust_value' | 'adjust_scope' | 'collect_budget';

export interface ProposalListItem {
  id: string;
  brandName: string;
  campaignTitle: string;
  status: ProposalStatus;
  budget: number | null;
  budgetIntent: ProposalBudgetIntent;
  currency: string;
  creatorProposedBudget: number | null;
  creatorProposedCurrency: string | null;
  creatorProposedAt: string | null;
  createdAt: string | null;
  lastResponseAt: string | null;
  lastResponseMessage: string | null;
}

export interface ProposalDetail extends ProposalListItem {
  contactName: string | null;
  contactEmail: string;
  contactWhatsapp: string | null;
  campaignDescription: string | null;
  deliverables: string[];
  referenceLinks: string[];
  originIp: string | null;
  userAgent: string | null;
  mediaKitSlug: string | null;
  updatedAt: string | null;
  latestAnalysis?: ProposalAnalysisStoredSnapshot | null;
  analysisHistory?: ProposalAnalysisStoredSnapshot[];
}

export interface ProposalAnalysisViewModel {
  analysisMessage: string | null;
  analysisV2: ProposalAnalysisV2 | null;
  analysisPricingMeta?: {
    pricingConsistency: ProposalPricingConsistency | null;
    pricingSource: ProposalPricingSource | null;
    limitations: string[];
  };
}
