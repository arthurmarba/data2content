export type PaywallContext =
  | "default"
  | "reply_email"
  | "ai_analysis"
  | "calculator"
  | "narrative_map"
  | "mentoria"
  | "media_kit"
  | "publis"
  | "planning"
  | "whatsapp"
  | "instagram_report"
  | "community"
  | "recorded_meetings"
  | "onboarding"
  | "chatgpt_intelligence";

export type PostCheckoutIntent =
  | "connect_instagram"
  | "join_community"
  | "watch_recorded_meeting";

export type PaywallEventDetail = {
  context?: PaywallContext | null;
  source?: string | null;
  returnTo?: string | null;
  proposalId?: string | null;
  postCheckoutIntent?: PostCheckoutIntent | null;
};

export const PAYWALL_RETURN_STORAGE_KEY = "d2c.paywall.return";
export const PAYWALL_URL_PARAM = "d2c_paywall";
export const PAYWALL_CONTEXT_PARAM = "d2c_paywall_context";
export const PAYWALL_AUTOSTART_PARAM = "d2c_paywall_autostart";
export const PAYWALL_PERIOD_PARAM = "d2c_paywall_period";
export const PAYWALL_CURRENCY_PARAM = "d2c_paywall_currency";
export const PAYWALL_COUPON_PARAM = "d2c_paywall_coupon";
export const PAYWALL_SOURCE_PARAM = "d2c_paywall_source";
export const PAYWALL_RETURN_PARAM = "d2c_paywall_return";
export const PAYWALL_INTENT_PARAM = "d2c_paywall_intent";
export const ACTIVATION_JOURNEY_STORAGE_KEY = "d2c.activation.intent";
