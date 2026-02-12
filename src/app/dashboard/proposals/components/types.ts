import type { ProposalAnalysisStoredSnapshot, ProposalAnalysisV2 } from '@/types/proposals';

export type ProposalStatus = 'novo' | 'visto' | 'respondido' | 'aceito' | 'rejeitado';

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
  currency: string;
  createdAt: string | null;
  lastResponseAt: string | null;
  lastResponseMessage: string | null;
}

export interface ProposalDetail extends ProposalListItem {
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
}
