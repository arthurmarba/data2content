export type AdminBrandProposalStatus = 'novo' | 'visto' | 'respondido' | 'aceito' | 'rejeitado';
export type AdminBrandProposalBudgetIntent = 'provided' | 'requested';

export interface AdminBrandProposalCreatorSummary {
  id: string;
  name: string;
  email: string;
  username: string | null;
  mediaKitSlug: string | null;
}

export interface AdminBrandProposalListItem {
  id: string;
  status: AdminBrandProposalStatus;
  brandName: string;
  contactName: string | null;
  contactEmail: string;
  contactWhatsapp: string | null;
  campaignTitle: string;
  budget: number | null;
  budgetIntent: AdminBrandProposalBudgetIntent;
  currency: string;
  creatorProposedBudget: number | null;
  creatorProposedCurrency: string | null;
  creatorProposedAt: string | null;
  mediaKitSlug: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  creator: AdminBrandProposalCreatorSummary;
}

export interface AdminBrandProposalDetail extends AdminBrandProposalListItem {
  campaignDescription: string | null;
  deliverables: string[];
  referenceLinks: string[];
  originIp: string | null;
  userAgent: string | null;
  lastResponseAt: string | null;
  lastResponseMessage: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  utmReferrer: string | null;
  utmFirstTouchAt: string | null;
  utmLastTouchAt: string | null;
}

export interface AdminBrandProposalListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: AdminBrandProposalStatus | 'all';
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'brandName'
    | 'campaignTitle'
    | 'status'
    | 'budget'
    | 'creatorName';
  sortOrder?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
}

export const ADMIN_BRAND_PROPOSAL_STATUS_OPTIONS: ReadonlyArray<{
  value: AdminBrandProposalStatus | 'all';
  label: string;
}> = [
  { value: 'all', label: 'Todos' },
  { value: 'novo', label: 'Novo' },
  { value: 'visto', label: 'Visto' },
  { value: 'respondido', label: 'Respondido' },
  { value: 'aceito', label: 'Aceito' },
  { value: 'rejeitado', label: 'Rejeitado' },
];
