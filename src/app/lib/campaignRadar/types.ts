export type CampaignOpportunityType =
  | "open_application"
  | "creator_program"
  | "invitation_only"
  | "challenge"
  | "barter"
  | "ugc"
  | "informational"
  | "unknown";

export type CampaignCompensationType =
  | "fixed"
  | "range"
  | "variable"
  | "barter"
  | "prize"
  | "unknown";

export type CampaignCompensationBasis =
  | "per_creator"
  | "per_delivery"
  | "per_view"
  | "per_sale"
  | "total_campaign_budget"
  | "unknown";

export type CampaignReviewStatus = "pending" | "approved" | "rejected";

export interface CampaignCompensation {
  type: CampaignCompensationType;
  minimum: number | null;
  maximum: number | null;
  currency: "BRL";
  basis: CampaignCompensationBasis;
  sourceText: string | null;
  confirmed: boolean;
  includesProduct: boolean;
}

export interface CampaignEvidence {
  field: string;
  excerpt: string;
}

export interface CampaignReview {
  status: CampaignReviewStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  notes: string | null;
}

export interface CampaignOpportunity {
  id: string;
  sourceId: string;
  sourcePlatform: string;
  sourceUrl: string;
  applicationUrl: string;
  applicationLabel: string;
  requiresAccount: boolean;
  title: string;
  brand: string | null;
  summary: string;
  opportunityType: CampaignOpportunityType;
  territories: string[];
  platforms: string[];
  formats: string[];
  requirements: string[];
  deliverables: string[];
  compensation: CampaignCompensation;
  applicationDeadline: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  lastVerifiedAt: string;
  status: "open" | "closed" | "uncertain";
  evidence: CampaignEvidence[];
  review: CampaignReview;
}

export interface CampaignSourceCoverage {
  sourceId: string;
  sourcePlatform: string;
  discoveryUrl: string;
  fetchedAt: string;
  discoveredDocuments: number;
  emittedOpportunities: number;
  warnings: string[];
}

export interface CampaignRadarBatch {
  schemaVersion: "campaign_radar_batch_v1";
  generatedAt: string;
  reportDate: string;
  coverageStatement: string;
  sources: CampaignSourceCoverage[];
  opportunities: CampaignOpportunity[];
}

export interface CampaignReviewDecision {
  id: string;
  status: "approved" | "rejected";
  notes?: string | null;
  overrides?: Partial<
    Pick<
      CampaignOpportunity,
      | "title"
      | "brand"
      | "summary"
      | "applicationUrl"
      | "applicationLabel"
      | "status"
      | "applicationDeadline"
      | "territories"
      | "requirements"
      | "deliverables"
      | "compensation"
    >
  >;
}

export interface CampaignReviewManifest {
  schemaVersion: "campaign_radar_review_v1";
  reviewedAt: string;
  reviewedBy: string;
  decisions: CampaignReviewDecision[];
}
