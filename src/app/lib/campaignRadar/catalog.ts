import type { CampaignRadarSourceVisibility } from "@/app/models/CampaignRadarOpportunity";
import {
  dedupeStrings,
  inferFormats,
  inferPlatforms,
  inferTerritories,
} from "./normalization";
import { isSourceApprovedForPlugin, sourceRegistryEntry } from "./sourceRegistry";
import type { CampaignOpportunity } from "./types";

export interface CatalogCampaignOpportunity extends CampaignOpportunity {
  reportDate: string;
  catalogBatchId: string;
  activeInCatalog: boolean;
  sourceVisibility: CampaignRadarSourceVisibility;
}

function sourceVisibility(sourceId: string): CampaignRadarSourceVisibility {
  const entry = sourceRegistryEntry(sourceId);
  return (
    entry?.inventoryVisibility === "public" || entry?.inventoryVisibility === "partial_public"
  ) && isSourceApprovedForPlugin(sourceId)
    ? "publicly_observable"
    : "restricted";
}

function searchableText(opportunity: CampaignOpportunity): string {
  return [
    opportunity.title,
    opportunity.brand,
    opportunity.summary,
    ...opportunity.territories,
    ...opportunity.platforms,
    ...opportunity.formats,
    ...opportunity.requirements,
    ...opportunity.deliverables,
  ]
    .filter(Boolean)
    .join("\n");
}

export function normalizeOpportunityForCatalog(
  opportunity: CampaignOpportunity,
  reportDate: string,
): CatalogCampaignOpportunity {
  const text = searchableText(opportunity);
  const visibility = sourceVisibility(opportunity.sourceId);
  const approvedAndCurrent =
    opportunity.review.status === "approved" && opportunity.status !== "closed";

  return {
    ...opportunity,
    reportDate,
    catalogBatchId: `campaign-radar:${reportDate}`,
    activeInCatalog: approvedAndCurrent,
    sourceVisibility: visibility,
    territories: dedupeStrings([...opportunity.territories, ...inferTerritories(text)], 20),
    platforms: dedupeStrings([...opportunity.platforms, ...inferPlatforms(text)], 12),
    formats: dedupeStrings([...opportunity.formats, ...inferFormats(text)], 12),
  };
}

export function isPubliclyQueryableOpportunity(
  opportunity: Pick<
    CatalogCampaignOpportunity,
    "activeInCatalog" | "sourceVisibility" | "status" | "review" | "opportunityType"
  >,
  includePrograms = false,
): boolean {
  if (!opportunity.activeInCatalog) return false;
  if (opportunity.sourceVisibility !== "publicly_observable") return false;
  if (opportunity.status !== "open") return false;
  if (opportunity.review.status !== "approved") return false;
  if (opportunity.opportunityType === "challenge") return false;
  if (!includePrograms && opportunity.opportunityType === "creator_program") return false;
  return true;
}
