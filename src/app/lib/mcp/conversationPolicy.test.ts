import type { McpAccountState } from "./accountState";
import { buildMcpConversationPolicy } from "./conversationPolicy";

const urls = {
  profileUrl: "https://data2content.ai/dashboard/profile?source=chatgpt",
  instagramConnectUrl:
    "https://data2content.ai/dashboard/instagram/connect?source=chatgpt&next=chatgpt-plugin",
  communityJoinUrl:
    "https://data2content.ai/api/dashboard/community/pro-join?source=chatgpt",
};

function accountState(
  accessLevel: "free" | "pro",
  instagramConnected: boolean,
  options: { northDeclared?: boolean; communityInvitePending?: boolean } = {},
): McpAccountState {
  const northDeclared = options.northDeclared ?? true;
  return {
    accountAvailable: true,
    reason:
      accessLevel === "free"
        ? "ready_free"
        : instagramConnected
          ? "ready_pro_with_instagram"
          : "ready_pro_without_instagram",
    accessLevel,
    entitlement: {
      eligible: accessLevel === "pro",
      reason: accessLevel === "pro" ? "active" : "subscription_required",
      normalizedStatus: accessLevel === "pro" ? "active" : "inactive",
      validUntil: null,
      instagramConnected,
    },
    instagramConnected,
    creatorNorth: northDeclared ? "Ajudo creators a comunicarem com clareza." : null,
    northDeclared,
    communityInvitePending: options.communityInvitePending ?? accessLevel === "pro",
    capabilities: {
      aggregateCommunityContext: true,
      privateCreatorIntelligence: accessLevel === "pro" && instagramConnected,
      membershipBenefits: accessLevel === "pro",
    },
  };
}

describe("buildMcpConversationPolicy", () => {
  it("asks for the North before the first contextualized experience", () => {
    const policy = buildMcpConversationPolicy(
      accountState("free", false, { northDeclared: false }),
      urls,
    );

    expect(policy.onboardingPrompt).toContain("quero entender o seu Norte");
    expect(policy.availableContext).toBe("aggregate_only");
  });

  it("reminds free users about the personalized profile without selling a plan", () => {
    const policy = buildMcpConversationPolicy(accountState("free", false), urls);

    expect(policy.closingReminder).toEqual({
      frequency: "every_response",
      message: expect.stringContaining("perfil personalizado Data2Content"),
      url: urls.profileUrl,
    });
    expect(policy.commercialBoundary).toEqual({
      mentionSubscription: false,
      directToCheckout: false,
      profileIsInformationalDestination: true,
    });
    expect(
      [
        policy.onboardingPrompt,
        policy.closingReminder.message,
        policy.instagram.explanation,
        policy.community.inviteMessage,
      ].filter(Boolean).join(" "),
    ).not.toMatch(/checkout|preço|plano pro/i);
  });

  it("explains the optional Instagram connection to PRO users without private context", () => {
    const policy = buildMcpConversationPolicy(accountState("pro", false), urls);

    expect(policy.availableContext).toBe("north_and_aggregate");
    expect(policy.closingReminder).toMatchObject({
      frequency: "when_private_context_would_help",
      url: urls.instagramConnectUrl,
    });
    expect(policy.closingReminder.message).toContain("cenário, gancho, roteiro, tom de voz");
    expect(policy.instagram.optionalForOtherMembershipBenefits).toBe(true);
  });

  it("enables private context and exposes the community invite only once per conversation", () => {
    const policy = buildMcpConversationPolicy(
      accountState("pro", true, { communityInvitePending: true }),
      urls,
    );

    expect(policy.availableContext).toBe("private_and_aggregate");
    expect(policy.closingReminder.frequency).toBe("none");
    expect(policy.community).toMatchObject({
      included: true,
      inviteFrequency: "once_per_conversation",
      joinUrl: urls.communityJoinUrl,
    });
  });

  it("does not repeat a community invite that has already been opened", () => {
    const policy = buildMcpConversationPolicy(
      accountState("pro", true, { communityInvitePending: false }),
      urls,
    );

    expect(policy.community).toMatchObject({
      included: true,
      inviteFrequency: "none",
      inviteMessage: null,
      joinUrl: null,
    });
  });
});
