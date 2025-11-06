export type PaywallContext =
  | "default"
  | "reply_email"
  | "ai_analysis"
  | "calculator"
  | "planning";

export type PaywallEventDetail = {
  context?: PaywallContext | null;
  source?: string | null;
  returnTo?: string | null;
  proposalId?: string | null;
};

export const PAYWALL_RETURN_STORAGE_KEY = "d2c.paywall.return";
