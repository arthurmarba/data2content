import mongoose, { Schema, type Document, type Model } from "mongoose";
import type {
  CampaignCompensationBasis,
  CampaignCompensationType,
  CampaignOpportunityType,
  CampaignReviewStatus,
} from "@/app/lib/campaignRadar/types";

export type CampaignRadarSourceVisibility = "publicly_observable" | "restricted";

export interface ICampaignRadarOpportunity extends Document {
  opportunityId: string;
  catalogBatchId: string;
  reportDate: string;
  activeInCatalog: boolean;
  sourceId: string;
  sourcePlatform: string;
  sourceVisibility: CampaignRadarSourceVisibility;
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
  compensation: {
    type: CampaignCompensationType;
    minimum: number | null;
    maximum: number | null;
    currency: "BRL";
    basis: CampaignCompensationBasis;
    sourceText: string | null;
    confirmed: boolean;
    includesProduct: boolean;
  };
  applicationDeadline: Date | null;
  publishedAt: Date | null;
  discoveredAt: Date;
  lastVerifiedAt: Date;
  status: "open" | "closed" | "uncertain";
  evidence: Array<{ field: string; excerpt: string }>;
  review: {
    status: CampaignReviewStatus;
    reviewedAt: Date | null;
    reviewedBy: string | null;
    notes: string | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CompensationSchema = new Schema<ICampaignRadarOpportunity["compensation"]>(
  {
    type: {
      type: String,
      enum: ["fixed", "range", "variable", "barter", "prize", "unknown"],
      required: true,
    },
    minimum: { type: Number, default: null },
    maximum: { type: Number, default: null },
    currency: { type: String, enum: ["BRL"], default: "BRL" },
    basis: {
      type: String,
      enum: [
        "per_creator",
        "per_delivery",
        "per_view",
        "per_sale",
        "total_campaign_budget",
        "unknown",
      ],
      required: true,
    },
    sourceText: { type: String, default: null, trim: true },
    confirmed: { type: Boolean, default: false },
    includesProduct: { type: Boolean, default: false },
  },
  { _id: false },
);

const EvidenceSchema = new Schema<{ field: string; excerpt: string }>(
  {
    field: { type: String, required: true, trim: true },
    excerpt: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const ReviewSchema = new Schema<ICampaignRadarOpportunity["review"]>(
  {
    status: { type: String, enum: ["pending", "approved", "rejected"], required: true },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: null, trim: true },
    notes: { type: String, default: null, trim: true },
  },
  { _id: false },
);

const CampaignRadarOpportunitySchema = new Schema<ICampaignRadarOpportunity>(
  {
    opportunityId: { type: String, required: true, unique: true, index: true, trim: true },
    catalogBatchId: { type: String, required: true, index: true, trim: true },
    reportDate: { type: String, required: true, index: true, trim: true },
    activeInCatalog: { type: Boolean, required: true, default: false, index: true },
    sourceId: { type: String, required: true, index: true, trim: true },
    sourcePlatform: { type: String, required: true, trim: true },
    sourceVisibility: {
      type: String,
      enum: ["publicly_observable", "restricted"],
      required: true,
      index: true,
    },
    sourceUrl: { type: String, required: true, trim: true },
    applicationUrl: { type: String, required: true, trim: true },
    applicationLabel: { type: String, required: true, trim: true },
    requiresAccount: { type: Boolean, required: true, default: false },
    title: { type: String, required: true, trim: true },
    brand: { type: String, default: null, trim: true },
    summary: { type: String, required: true, trim: true },
    opportunityType: {
      type: String,
      enum: [
        "open_application",
        "creator_program",
        "invitation_only",
        "challenge",
        "barter",
        "ugc",
        "informational",
        "unknown",
      ],
      required: true,
      index: true,
    },
    territories: { type: [String], default: [], index: true },
    platforms: { type: [String], default: [], index: true },
    formats: { type: [String], default: [], index: true },
    requirements: { type: [String], default: [] },
    deliverables: { type: [String], default: [] },
    compensation: { type: CompensationSchema, required: true },
    applicationDeadline: { type: Date, default: null, index: true },
    publishedAt: { type: Date, default: null },
    discoveredAt: { type: Date, required: true },
    lastVerifiedAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ["open", "closed", "uncertain"], required: true, index: true },
    evidence: { type: [EvidenceSchema], default: [] },
    review: { type: ReviewSchema, required: true },
  },
  { timestamps: true, collection: "campaign_radar_opportunities" },
);

CampaignRadarOpportunitySchema.index({
  activeInCatalog: 1,
  sourceVisibility: 1,
  status: 1,
  "review.status": 1,
  applicationDeadline: 1,
});
CampaignRadarOpportunitySchema.index({ territories: 1, activeInCatalog: 1 });
CampaignRadarOpportunitySchema.index({ "compensation.minimum": 1, activeInCatalog: 1 });

const CampaignRadarOpportunityModel: Model<ICampaignRadarOpportunity> =
  (mongoose.models.CampaignRadarOpportunity as Model<ICampaignRadarOpportunity> | undefined) ??
  mongoose.model<ICampaignRadarOpportunity>(
    "CampaignRadarOpportunity",
    CampaignRadarOpportunitySchema,
  );

export default CampaignRadarOpportunityModel;
