import fs from "fs";
import path from "path";
import {
  buildMobileStrategicProfilePreviewFixture,
  MOBILE_STRATEGIC_PROFILE_PREVIEW_STATES,
} from "./buildMobileStrategicProfilePreviewFixture";

const SOURCE_PATH = path.join(__dirname, "buildMobileStrategicProfilePreviewFixture.ts");

describe("buildMobileStrategicProfilePreviewFixture", () => {
  it("generates anonymous_view_profile", () => {
    const result = buildMobileStrategicProfilePreviewFixture({ state: "anonymous_view_profile" });

    expect(result.id).toBe("anonymous_view_profile");
    expect(result.profile.authGate.visible).toBe(true);
    expect(result.profile.authGate.description).toBe("Entre com Google para criar seu Perfil Estratégico.");
  });

  it("generates anonymous_analyze_video", () => {
    const result = buildMobileStrategicProfilePreviewFixture({ state: "anonymous_analyze_video" });

    expect(result.id).toBe("anonymous_analyze_video");
    expect(result.profile.authGate.visible).toBe(true);
    expect(result.profile.authGate.description).toBe("Entre com Google para analisar seu primeiro vídeo.");
  });

  it("generates account_only", () => {
    const result = buildMobileStrategicProfilePreviewFixture({ state: "account_only" });

    expect(result.id).toBe("account_only");
    expect(result.profile.state.profileAvailability).toBe("construction");
    expect(result.profile.constructionState.visible).toBe(true);
  });

  it("generates first_reading_free", () => {
    const result = buildMobileStrategicProfilePreviewFixture({ state: "first_reading_free" });

    expect(result.id).toBe("first_reading_free");
    expect(result.profile.state.diagnosisState).toBe("first_reading");
    expect(result.profile.sections.map((section) => section.id)).toContain("diagnosis");
  });

  it("generates premium_without_instagram", () => {
    const result = buildMobileStrategicProfilePreviewFixture({ state: "premium_without_instagram" });

    expect(result.id).toBe("premium_without_instagram");
    expect(result.profile.state.diagnosisState).toBe("complete");
    expect(result.profile.state.instagramState).toBe("disconnected");
  });

  it("generates instagram_optimized", () => {
    const result = buildMobileStrategicProfilePreviewFixture({ state: "instagram_optimized" });

    expect(result.id).toBe("instagram_optimized");
    expect(result.profile.state.diagnosisState).toBe("instagram_optimized");
    expect(result.profile.state.instagramState).toBe("connected");
  });

  it("generates media_kit_available", () => {
    const result = buildMobileStrategicProfilePreviewFixture({ state: "media_kit_available" });

    expect(result.id).toBe("media_kit_available");
    expect(result.profile.mediaKitBridge.state).toBe("available");
    expect(result.profile.mediaKitBridge.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining(["Copiar link", "Ver como marca", "Abrir Mídia Kit"]),
    );
  });

  it("lists all required states", () => {
    expect(MOBILE_STRATEGIC_PROFILE_PREVIEW_STATES).toEqual([
      "anonymous_view_profile",
      "anonymous_analyze_video",
      "account_only",
      "first_reading_free",
      "premium_without_instagram",
      "instagram_optimized",
      "media_kit_available",
    ]);
  });

  it("does not import forbidden integrations", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    for (const forbidden of ["LoginClient", "NextAuth", "MediaKitView", "fetch", "Prisma", "Gemini", "OpenAI", "Stripe", "SDK"]) {
      expect(importLines).not.toContain(forbidden);
    }
  });
});
