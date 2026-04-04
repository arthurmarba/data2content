export type PaywallContext =
  | "default"
  | "reply_email"
  | "ai_analysis"
  | "calculator"
  | "mentoria"
  | "media_kit"
  | "publis"
  | "planning"
  | "whatsapp";

export type PaywallEventDetail = {
  context?: PaywallContext | null;
  source?: string | null;
  returnTo?: string | null;
  proposalId?: string | null;
};

export const PAYWALL_RETURN_STORAGE_KEY = "d2c.paywall.return";
export const PAYWALL_URL_PARAM = "d2c_paywall";
export const PAYWALL_CONTEXT_PARAM = "d2c_paywall_context";
export const PAYWALL_AUTOSTART_PARAM = "d2c_paywall_autostart";
export const PAYWALL_PERIOD_PARAM = "d2c_paywall_period";
export const PAYWALL_CURRENCY_PARAM = "d2c_paywall_currency";
export const ACTIVATION_JOURNEY_STORAGE_KEY = "d2c.activation.intent";
