import { isPlanActiveLike } from "@/utils/planStatus";

type TrialEligibilitySource = {
  planStatus?: unknown;
  whatsappTrialEligible?: unknown;
  whatsappTrialStartedAt?: unknown;
  whatsappTrialActive?: unknown;
};

export const WHATSAPP_TRIAL_DURATION_MS = 48 * 60 * 60 * 1000;

export function isWhatsappTrialEnabled(): boolean {
  return (
    String(
      process.env.WHATSAPP_TRIAL_ENABLED ??
        process.env.NEXT_PUBLIC_WHATSAPP_TRIAL_ENABLED ??
        "true"
    )
      .toLowerCase()
      .trim() !== "false"
  );
}

export function canStartWhatsappTrial(user: TrialEligibilitySource): boolean {
  if (!isWhatsappTrialEnabled()) return false;
  if (user.whatsappTrialEligible === false) return false;
  if (user.whatsappTrialActive) return false;
  if (user.whatsappTrialStartedAt) return false;
  return !isPlanActiveLike(user.planStatus);
}

export interface WhatsappTrialActivationPayload {
  expiresAt: Date;
  set: Record<string, unknown>;
}

export function buildWhatsappTrialActivation(now = new Date()): WhatsappTrialActivationPayload {
  const expiresAt = new Date(now.getTime() + WHATSAPP_TRIAL_DURATION_MS);
  return {
    expiresAt,
    set: {
      whatsappTrialActive: true,
      whatsappTrialStartedAt: now,
      whatsappTrialExpiresAt: expiresAt,
      whatsappTrialEligible: false,
      whatsappTrialLastReminderAt: null,
      whatsappTrialLastNotificationAt: null,
      planStatus: "trial",
      planExpiresAt: expiresAt,
      currentPeriodEnd: expiresAt,
    },
  };
}

export interface WhatsappTrialDeactivationOptions {
  recordNotificationTimestamp?: boolean;
  resetPlanStatus?: boolean;
}

export function buildWhatsappTrialDeactivation(
  now = new Date(),
  options: WhatsappTrialDeactivationOptions = {}
): { set: Record<string, unknown> } {
  const set: Record<string, unknown> = {
    whatsappTrialActive: false,
    whatsappTrialEligible: false,
  };

  if (options.recordNotificationTimestamp) {
    set.whatsappTrialLastNotificationAt = now;
  }

  if (options.resetPlanStatus) {
    set.planStatus = "inactive";
    set.planExpiresAt = null;
    set.currentPeriodEnd = null;
  }

  return { set };
}
