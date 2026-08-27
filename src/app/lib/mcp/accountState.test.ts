import { evaluateMcpAccountState } from "./accountState";

describe("evaluateMcpAccountState", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");

  it("keeps a free account available with aggregate context", () => {
    expect(
      evaluateMcpAccountState(
        {
          planStatus: "inactive",
          onboardingAnswers: { creatorPurpose: "Ajudo creators a comunicarem ideias com clareza." },
        },
        now,
      ),
    ).toMatchObject({
      accountAvailable: true,
      reason: "ready_free",
      accessLevel: "free",
      northDeclared: true,
      capabilities: {
        aggregateCommunityContext: true,
        privateCreatorIntelligence: false,
        membershipBenefits: false,
      },
    });
  });

  it("requires both PRO access and Instagram for private creator intelligence", () => {
    expect(evaluateMcpAccountState({ planStatus: "active" }, now)).toMatchObject({
      reason: "ready_pro_without_instagram",
      accessLevel: "pro",
      capabilities: { privateCreatorIntelligence: false, membershipBenefits: true },
    });

    expect(
      evaluateMcpAccountState(
        {
          planStatus: "active",
          isInstagramConnected: true,
          instagramAccountId: "ig-1",
        },
        now,
      ),
    ).toMatchObject({
      reason: "ready_pro_with_instagram",
      capabilities: { privateCreatorIntelligence: true },
    });
  });

  it("marks the community invite as pending only until a PRO member opens it", () => {
    expect(evaluateMcpAccountState({ planStatus: "active" }, now).communityInvitePending).toBe(true);
    expect(
      evaluateMcpAccountState(
        { planStatus: "active", whatsappGroupLinkOpenedAt: new Date("2026-08-20") },
        now,
      ).communityInvitePending,
    ).toBe(false);
  });
});
