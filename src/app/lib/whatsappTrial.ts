type TrialEligibilitySource = {
  planStatus?: unknown;
  whatsappTrialEligible?: unknown;
  whatsappTrialStartedAt?: unknown;
  whatsappTrialActive?: unknown;
};

export const WHATSAPP_TRIAL_DURATION_MS = 48 * 60 * 60 * 1000;

export function isWhatsappTrialEnabled(): boolean {
  return false;
}

export function canStartWhatsappTrial(user: TrialEligibilitySource): boolean {
  return false;
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
