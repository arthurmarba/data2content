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

/**
 * Motivos de cancelamento de assinatura.
 * `code` é estável e persistido no banco (analytics de churn);
 * `label` é apenas o texto exibido ao usuário (pode mudar sem quebrar histórico).
 */
export const CANCELLATION_REASONS = [
  { code: "price_too_high", label: "Preço muito alto" },
  { code: "not_enough_usage", label: "Não uso o suficiente" },
  { code: "missing_features", label: "Falta de funcionalidades" },
  { code: "found_alternative", label: "Encontrei outra solução" },
  { code: "hard_to_use", label: "Dificuldade de uso" },
  { code: "poor_support", label: "Suporte insatisfatório" },
  { code: "too_many_bugs", label: "Muitos erros / Bugs" },
  { code: "strategy_change", label: "Mudança de estratégia" },
  { code: "temporary", label: "Projeto temporário / Sazonal" },
  { code: "other", label: "Outro" },
] as const;

export type CancellationReasonCode = (typeof CANCELLATION_REASONS)[number]["code"];

export const CANCELLATION_REASON_CODES: readonly CancellationReasonCode[] =
  CANCELLATION_REASONS.map((r) => r.code);

const LABEL_BY_CODE: Record<string, string> = Object.fromEntries(
  CANCELLATION_REASONS.map((r) => [r.code, r.label])
);
const CODE_BY_LABEL: Record<string, CancellationReasonCode> = Object.fromEntries(
  CANCELLATION_REASONS.map((r) => [r.label, r.code])
);

/** Verifica se uma string é um código de motivo válido. */
export function isCancellationReasonCode(
  value: unknown
): value is CancellationReasonCode {
  return typeof value === "string" && value in LABEL_BY_CODE;
}

/** Converte um código em label PT-BR (retorna o próprio código se desconhecido). */
export function cancellationReasonLabel(code: string): string {
  return LABEL_BY_CODE[code] ?? code;
}

/**
 * Normaliza uma lista de motivos vinda do cliente para códigos estáveis.
 * Aceita códigos novos e labels legados (compat retroativa).
 */
export function normalizeCancellationReasons(
  input: unknown
): CancellationReasonCode[] {
  if (!Array.isArray(input)) return [];
  const out: CancellationReasonCode[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const code = isCancellationReasonCode(raw) ? raw : CODE_BY_LABEL[raw];
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

export type AccessRequirement =
  | "instagram_connection"
  | "pro_trial"
  | "paid_subscription";

export interface FeatureAccessGate {
  feature: string;
  requirements: AccessRequirement[];
}
