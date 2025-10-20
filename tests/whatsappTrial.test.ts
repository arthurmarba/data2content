import {
  WHATSAPP_TRIAL_DURATION_MS,
  buildWhatsappTrialActivation,
  buildWhatsappTrialDeactivation,
  canStartWhatsappTrial,
} from "@/app/lib/whatsappTrial";

describe("whatsappTrial helpers", () => {
  const originalEnabled = process.env.WHATSAPP_TRIAL_ENABLED;
  const originalPublicEnabled = process.env.NEXT_PUBLIC_WHATSAPP_TRIAL_ENABLED;

  beforeEach(() => {
    delete process.env.WHATSAPP_TRIAL_ENABLED;
    delete process.env.NEXT_PUBLIC_WHATSAPP_TRIAL_ENABLED;
  });

  afterEach(() => {
    if (originalEnabled === undefined) {
      delete process.env.WHATSAPP_TRIAL_ENABLED;
    } else {
      process.env.WHATSAPP_TRIAL_ENABLED = originalEnabled;
    }

    if (originalPublicEnabled === undefined) {
      delete process.env.NEXT_PUBLIC_WHATSAPP_TRIAL_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_WHATSAPP_TRIAL_ENABLED = originalPublicEnabled;
    }
  });

  describe("canStartWhatsappTrial", () => {
    it("allows trial when plan inactive and flags allow", () => {
      const eligible = canStartWhatsappTrial({ planStatus: "inactive" });
      expect(eligible).toBe(true);
    });

    it("blocks when already active-like", () => {
      const eligible = canStartWhatsappTrial({ planStatus: "active" });
      expect(eligible).toBe(false);
    });

    it("blocks when trial disabled by flag", () => {
      process.env.WHATSAPP_TRIAL_ENABLED = "false";
      const eligible = canStartWhatsappTrial({ planStatus: "inactive" });
      expect(eligible).toBe(false);
    });

    it("blocks when user already started trial", () => {
      const eligible = canStartWhatsappTrial({
        planStatus: "inactive",
        whatsappTrialStartedAt: new Date(),
      });
      expect(eligible).toBe(false);
    });

    it("blocks when user marked as ineligible", () => {
      const eligible = canStartWhatsappTrial({
        planStatus: "inactive",
        whatsappTrialEligible: false,
      });
      expect(eligible).toBe(false);
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
        planStatus: "trial",
        planExpiresAt: activation.expiresAt,
        currentPeriodEnd: activation.expiresAt,
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
