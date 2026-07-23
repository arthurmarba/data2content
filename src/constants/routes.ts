// src/constants/routes.ts
// Rotas compartilhadas em toda a aplicação
export const MAIN_DASHBOARD_ROUTE = "/dashboard" as const;
export const CAMPAIGNS_ROUTE = "/campaigns" as const;
export const BRAND_CAMPAIGN_ROUTE = "/campaigns/new" as const;
export const CASTING_ROUTE = "/casting" as const;

export type CampaignEntrySource =
  | "sidebar"
  | "home_alert"
  | "home_board"
  | "email"
  | "deep_link"
  | "direct";

export function buildCampaignProposalHref(
  proposalId: string,
  options?: { source?: CampaignEntrySource }
) {
  const sourceQuery = options?.source
    ? `&source=${encodeURIComponent(options.source)}`
    : "";
  return `${CAMPAIGNS_ROUTE}?proposalId=${encodeURIComponent(proposalId)}${sourceQuery}`;
}

export function buildCampaignProposalUrl(
  baseUrl: string,
  proposalId: string,
  options?: { source?: CampaignEntrySource }
) {
  return `${baseUrl.replace(/\/+$/, "")}${buildCampaignProposalHref(proposalId, options)}`;
}
