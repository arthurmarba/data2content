import {
  WHATSAPP_TRIAL_DURATION_MS,
  buildWhatsappTrialActivation,
  buildWhatsappTrialDeactivation,
  canStartWhatsappTrial,
} from "@/app/lib/whatsappTrial";

describe("whatsappTrial helpers", () => {

  describe("canStartWhatsappTrial", () => {
    it("always blocks new trials", () => {
      expect(canStartWhatsappTrial({ planStatus: "inactive" })).toBe(false);
      expect(canStartWhatsappTrial({ planStatus: "active" })).toBe(false);
    });
  });

  describe("buildWhatsappTrialActivation", () => {
    it("returns consistent payload", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      const activation = buildWhatsappTrialActivation(now);

      expect(activation.expiresAt.getTime()).toBe(
        now.getTime() + WHATSAPP_TRIAL_DURATION_MS
      );
      expect(activation.set).toMatchObject({
        whatsappTrialActive: true,
        whatsappTrialStartedAt: now,
        whatsappTrialExpiresAt: activation.expiresAt,
        whatsappTrialEligible: false,
      });
    });
  });

  describe("buildWhatsappTrialDeactivation", () => {
    it("omits notification timestamp when not requested", () => {
      const now = new Date("2024-01-02T12:00:00Z");
      const { set } = buildWhatsappTrialDeactivation(now, {
        resetPlanStatus: true,
        recordNotificationTimestamp: false,
      });

      expect(set).toMatchObject({
        whatsappTrialActive: false,
        whatsappTrialEligible: false,
        planStatus: "inactive",
        planExpiresAt: null,
        currentPeriodEnd: null,
      });
      expect(set).not.toHaveProperty("whatsappTrialLastNotificationAt");
    });

    it("includes notification timestamp when requested", () => {
      const now = new Date("2024-01-03T08:30:00Z");
      const { set } = buildWhatsappTrialDeactivation(now, {
        resetPlanStatus: false,
        recordNotificationTimestamp: true,
      });

      expect(set).toMatchObject({
        whatsappTrialActive: false,
        whatsappTrialEligible: false,
        whatsappTrialLastNotificationAt: now,
      });
      expect(set).not.toHaveProperty("planStatus");
    });
  });
});
