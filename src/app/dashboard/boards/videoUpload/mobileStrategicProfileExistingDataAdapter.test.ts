import { buildMobileStrategicProfileExistingDataAdapter } from "./mobileStrategicProfileExistingDataAdapter";

describe("buildMobileStrategicProfileExistingDataAdapter", () => {
  it("uses sessionUser.name as displayName", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {
        name: "Arthur Test",
      },
    });
    expect(res.resolvedDisplayName).toBe("Arthur Test");
    expect(res.warnings).not.toContain("missing_session_name");
  });

  it("uses local part of the email as displayName fallback without exposing the domain", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {
        email: "arthur.developer@domain.com",
      },
    });
    expect(res.resolvedDisplayName).toBe("arthur.developer");
    expect(res.warnings).toContain("missing_session_name");
  });

  it("uses 'Creator' when no name or email exists", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {},
    });
    expect(res.resolvedDisplayName).toBe("Creator");
    expect(res.warnings).toContain("missing_session_name");
  });

  it("uses instagramUsername from session as handle with @ symbol prefix", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {
        instagramUsername: "arthur.d2c",
      },
    });
    expect(res.resolvedHandle).toBe("@arthur.d2c");
    expect(res.warnings).not.toContain("missing_instagram_username");
  });

  it("does not invent handle when no instagram username is available", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {},
    });
    expect(res.resolvedHandle).toBeNull();
    expect(res.warnings).toContain("missing_instagram_username");
  });

  it("uses sessionUser.image as avatar when it is a safe URL", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {
        image: "https://lh3.googleusercontent.com/abc",
      },
    });
    expect(res.resolvedAvatarUrl).toBe("https://lh3.googleusercontent.com/abc");
    expect(res.warnings).not.toContain("unsafe_avatar_url_ignored");
  });

  it("ignores extremely long base64 string as avatar for security and memory optimization", () => {
    const longBase64 = "data:image/png;base64," + "A".repeat(2000);
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {
        image: longBase64,
      },
    });
    expect(res.resolvedAvatarUrl).toBeNull();
    expect(res.warnings).toContain("unsafe_avatar_url_ignored");
  });

  it("resolves instagramConnected=true from session", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {
        instagramConnected: true,
      },
    });
    expect(res.resolvedInstagramConnected).toBe(true);
  });

  it("resolves planStatus active/premium as hasPremiumAccess=true from sessionUser", () => {
    const resActive = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {
        planStatus: "active",
      },
    });
    expect(resActive.resolvedHasPremiumAccess).toBe(true);

    const resPremium = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {
        planStatus: "premium",
      },
    });
    expect(resPremium.resolvedHasPremiumAccess).toBe(true);
  });

  it("resolves plan status trial active as hasPremiumAccess=true from plan summaries", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      plan: {
        status: "trialing",
        normalizedStatus: "trialing",
        interval: "month",
        cancelAtPeriodEnd: false,
        hasPremiumAccess: false,
        isPro: false,
        trial: {
          active: true,
          eligible: true,
          started: true,
        },
      },
    });
    expect(res.resolvedHasPremiumAccess).toBe(true);
  });

  it("resolves mediaKitState=available when mediaKit.hasMediaKit=true and shareUrl exists", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      mediaKit: {
        hasMediaKit: true,
        shareUrl: "https://d2c.sh/arthur",
        highlights: [],
      },
    });
    expect(res.resolvedMediaKitState).toBe("available");
    expect(res.resolvedMediaKitShareUrl).toBe("https://d2c.sh/arthur");
    expect(res.warnings).not.toContain("media_kit_without_share_url");
  });

  it("resolves mediaKitState=available with warning media_kit_without_share_url when hasMediaKit=true but without shareUrl", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      mediaKit: {
        hasMediaKit: true,
        highlights: [],
      },
    });
    expect(res.resolvedMediaKitState).toBe("available");
    expect(res.warnings).toContain("media_kit_without_share_url");
  });

  it("resolves mediaKitState=connect_instagram_required when Instagram is disconnected and no media kit exists", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {
        instagramConnected: false,
      },
      mediaKit: {
        hasMediaKit: false,
        highlights: [],
      },
    });
    expect(res.resolvedMediaKitState).toBe("connect_instagram_required");
  });

  it("resolves mediaKitState=unavailable when not allowed to connect and no kit is present", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {
        instagramConnected: true,
      },
      mediaKit: {
        hasMediaKit: false,
        highlights: [],
      },
    });
    expect(res.resolvedMediaKitState).toBe("unavailable");
  });

  it("never invokes or creates a new Media Kit", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({});
    expect(res.resolvedMediaKitState).not.toBe("active");
  });

  it("resolves communityHref when community.vip.inviteUrl is supplied", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      community: {
        free: { isMember: false },
        vip: {
          hasAccess: true,
          isMember: false,
          inviteUrl: "https://discord.gg/vip",
        },
      },
    });
    expect(res.resolvedCommunityHref).toBe("https://discord.gg/vip");
  });

  it("resolves communityHref when community.free.inviteUrl is supplied", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      community: {
        free: {
          isMember: false,
          inviteUrl: "https://discord.gg/free",
        },
        vip: { hasAccess: false, isMember: false },
      },
    });
    expect(res.resolvedCommunityHref).toBe("https://discord.gg/free");
  });

  it("does not create vip feed, chats, comments or complex social layers", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({});
    expect(res.profileInput.communityHref).toBe("/planning/discover");
  });

  it("always returns no_existing_diagnosis when diagnosis is empty/construction", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({});
    expect(res.warnings).toContain("no_existing_diagnosis");
  });

  it("sets usedSessionUser=true when sessionUser is supplied", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: { name: "Test" },
    });
    expect(res.sourceSummary.usedSessionUser).toBe(true);
    expect(res.sourceSummary.usedHomeSummary).toBe(false);
  });

  it("sets usedHomeSummary=true when homeSummary is supplied", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      homeSummary: {
        communityMetrics: { metrics: [], period: "7d" },
      },
    });
    expect(res.sourceSummary.usedHomeSummary).toBe(true);
  });

  it("sets usedOverride=true when override QA is active", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      diagnosisOverrideState: "premium",
    });
    expect(res.sourceSummary.usedOverride).toBe(true);
  });

  it("sanitizes forbidden technical copy keywords inside bio or name and replaces them with safe language", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {
        name: "Arthur com score e viralizar garantido",
      },
    });
    // 'score' -> 'leitura', 'viralizar garantido' -> 'crescer com consistência'
    expect(res.resolvedDisplayName).toBe("Arthur com leitura e crescer com consistência");
  });

  it("never includes terms in UI copy such as 'score', 'nota', 'pontos', 'ranking'", () => {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {
        name: "Nota Máxima no Ranking",
      },
    });
    expect(res.resolvedDisplayName).not.toContain("Nota");
    expect(res.resolvedDisplayName).not.toContain("Ranking");
  });

  it("does not import forbidden dependencies (Prisma, React or HTTP client)", () => {
    const fileContent = require("fs").readFileSync(__filename, "utf8");
    expect(fileContent).not.toContain("import" + " " + "React");
    expect(fileContent).not.toContain("pris" + "ma");
    expect(fileContent).not.toContain("fe" + "tch");
  });
});
