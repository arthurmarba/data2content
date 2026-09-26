/** @jest-environment node */
import UserModel from "@/app/models/User";
import { claimOnboardingOffer } from "./offerAfterNarrative";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/User", () => ({
  __esModule: true,
  default: { findById: jest.fn(), updateOne: jest.fn() },
}));

const userId = "507f1f77bcf86cd799439011";

function planStatus(value: string) {
  jest.mocked(UserModel.findById).mockReturnValue({ select: () => ({ lean: async () => ({ planStatus: value }) }) } as never);
}

describe("oferta depois da narrativa", () => {
  const original = process.env.ONBOARDING_OFFER_AFTER_NARRATIVE_ENABLED;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ONBOARDING_OFFER_AFTER_NARRATIVE_ENABLED = "1";
    planStatus("inactive");
    jest.mocked(UserModel.updateOne).mockResolvedValue({ modifiedCount: 1 } as never);
  });
  afterAll(() => {
    if (original === undefined) delete process.env.ONBOARDING_OFFER_AFTER_NARRATIVE_ENABLED;
    else process.env.ONBOARDING_OFFER_AFTER_NARRATIVE_ENABLED = original;
  });

  it("reserva a oferta para conta gratuita com narrativa", async () => {
    expect(await claimOnboardingOffer(userId, { skipped: false, hasNarrative: true })).toEqual({ eligible: true, reason: "eligible" });
  });

  it("não vende no vazio nem para quem pulou", async () => {
    expect((await claimOnboardingOffer(userId, { skipped: false, hasNarrative: false })).reason).toBe("no_narrative");
    expect((await claimOnboardingOffer(userId, { skipped: true, hasNarrative: false })).reason).toBe("skipped");
  });

  it("aparece uma vez só e nunca para quem já é Pro", async () => {
    jest.mocked(UserModel.updateOne).mockResolvedValueOnce({ modifiedCount: 0 } as never);
    expect((await claimOnboardingOffer(userId, { skipped: false, hasNarrative: true })).reason).toBe("already_seen");
    planStatus("active");
    expect((await claimOnboardingOffer(userId, { skipped: false, hasNarrative: true })).reason).toBe("already_pro");
  });

  it("fica desligada sem a chave", async () => {
    process.env.ONBOARDING_OFFER_AFTER_NARRATIVE_ENABLED = "0";
    expect((await claimOnboardingOffer(userId, { skipped: false, hasNarrative: true })).reason).toBe("disabled");
    expect(UserModel.updateOne).not.toHaveBeenCalled();
  });
});
