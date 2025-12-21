// src/types/billing.ts
// Compartilha tipos entre API e frontend para o fluxo de acesso, trial e benefícios.

export type UiPlanStatus = "active" | "non_renewing" | "pending" | "inactive" | "expired";

export const PRO_TRIAL_STATES = ["eligible", "active", "expired", "converted", "unavailable"] as const;
export type ProTrialState = (typeof PRO_TRIAL_STATES)[number];

export interface ProTrialInfo {
  state: ProTrialState;
  activatedAt: string | null;
  expiresAt: string | null;
  remainingMs?: number | null;
}

export interface InstagramAccessInfo {
  connected: boolean;
  needsReconnect: boolean;
  lastSuccessfulSyncAt: string | null;
  accountId: string | null;
  username?: string | null;
}

export interface AccessPerksInfo {
  hasBasicStrategicReport: boolean;
  hasFullStrategicReport: boolean;
  microInsightAvailable: boolean;
  weeklyRaffleEligible: boolean;
}

export interface PlanStatusExtras {
  normalizedStatus?: string | null;
  hasPremiumAccess?: boolean;
  isGracePeriod?: boolean;
  needsBilling?: boolean;
}

export interface PlanStatusResponse {
  ok: boolean;
  status: UiPlanStatus | null;
  interval: "month" | "year" | null;
  priceId: string | null;
  planExpiresAt: string | null;
  cancelAtPeriodEnd: boolean;
  trial?: ProTrialInfo;
  instagram?: InstagramAccessInfo;
  perks?: AccessPerksInfo;
  extras?: PlanStatusExtras;
}

export type AccessRequirement =
  | "instagram_connection"
  | "pro_trial"
  | "paid_subscription";

export interface FeatureAccessGate {
  feature: string;
  requirements: AccessRequirement[];
}
