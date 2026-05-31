import fs from "fs";
import path from "path";
import {
  ANALYZE_VIDEO_LOGIN_INTENT_COPY,
  DEFAULT_LOGIN_INTENT_COPY,
  resolveIntentCopy,
  STRATEGIC_PROFILE_LOGIN_INTENT_COPY,
} from "./loginIntentCopy";

const SOURCE_PATH = path.join(__dirname, "loginIntentCopy.ts");

function textOf(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe("loginIntentCopy", () => {
  it("keeps default copy when callbackUrl is missing", () => {
    expect(resolveIntentCopy(null)).toEqual(DEFAULT_LOGIN_INTENT_COPY);
  });

  it("keeps existing calculator copy", () => {
    expect(resolveIntentCopy("/calculator")).toMatchObject({
      badge: "Calculadora Pro",
      title: "Entre para continuar na calculadora",
    });
  });

  it("keeps existing media-kit copy", () => {
    expect(resolveIntentCopy("/dashboard/media-kit")).toMatchObject({
      badge: "Mídia Kit",
      title: "Entre para continuar no Mídia Kit",
    });
  });

  it("keeps existing planning/calendar copy", () => {
    expect(resolveIntentCopy("/planning/calendar")).toMatchObject({
      badge: "Planejamento",
      title: "Entre para continuar no board",
    });
  });

  it("keeps existing campaigns/publis/proposals copy", () => {
    expect(resolveIntentCopy("/campaigns/new")).toMatchObject({
      badge: "Campanhas e CRM",
      title: "Entre para continuar nas campanhas",
    });
    expect(resolveIntentCopy("/dashboard/publis")).toMatchObject({ badge: "Campanhas e CRM" });
    expect(resolveIntentCopy("/dashboard/proposals")).toMatchObject({ badge: "Campanhas e CRM" });
  });

  it("keeps existing discover/community copy", () => {
    expect(resolveIntentCopy("/discover")).toMatchObject({
      badge: "Comunidade",
      title: "Entre para continuar na comunidade",
    });
    expect(resolveIntentCopy("/community")).toMatchObject({ badge: "Comunidade" });
  });

  it("mobile strategic profile preview path uses strategic profile copy", () => {
    expect(resolveIntentCopy("/dashboard/boards/mobile-strategic-profile-preview")).toEqual(
      STRATEGIC_PROFILE_LOGIN_INTENT_COPY,
    );
  });

  it("mobile strategic profile path uses strategic profile copy", () => {
    expect(resolveIntentCopy("/dashboard/boards/mobile-strategic-profile")).toEqual(
      STRATEGIC_PROFILE_LOGIN_INTENT_COPY,
    );
  });

  it("strategic-profile path uses strategic profile copy", () => {
    expect(resolveIntentCopy("/strategic-profile")).toEqual(STRATEGIC_PROFILE_LOGIN_INTENT_COPY);
  });

  it("mobile-profile path uses strategic profile copy", () => {
    expect(resolveIntentCopy("/mobile-profile")).toEqual(STRATEGIC_PROFILE_LOGIN_INTENT_COPY);
  });

  it("profile path uses strategic profile copy", () => {
    expect(resolveIntentCopy("/profile")).toEqual(STRATEGIC_PROFILE_LOGIN_INTENT_COPY);
  });

  it("video-narrative path uses analyze video copy", () => {
    expect(resolveIntentCopy("/dashboard/boards/video-narrative-app-preview")).toEqual(
      ANALYZE_VIDEO_LOGIN_INTENT_COPY,
    );
  });

  it("analyze-video path uses analyze video copy", () => {
    expect(resolveIntentCopy("/analyze-video")).toEqual(ANALYZE_VIDEO_LOGIN_INTENT_COPY);
  });

  it("analisar-video path uses analyze video copy", () => {
    expect(resolveIntentCopy("/analisar-video")).toEqual(ANALYZE_VIDEO_LOGIN_INTENT_COPY);
  });

  it("intent=strategic_profile uses strategic profile copy", () => {
    expect(resolveIntentCopy("/dashboard?intent=strategic_profile")).toEqual(STRATEGIC_PROFILE_LOGIN_INTENT_COPY);
  });

  it("login intent=strategic_profile uses strategic profile copy", () => {
    expect(resolveIntentCopy("/dashboard/boards/mobile-strategic-profile", "strategic_profile")).toEqual(
      STRATEGIC_PROFILE_LOGIN_INTENT_COPY,
    );
  });

  it("strategic profile login copy explains the first diagnostic action", () => {
    expect(STRATEGIC_PROFILE_LOGIN_INTENT_COPY).toMatchObject({
      badge: "Data2Content",
      title: "Comece seu mapa narrativo",
      buttonLabel: "Continuar com Google",
    });
    expect(STRATEGIC_PROFILE_LOGIN_INTENT_COPY.description).toContain("revela sobre sua narrativa");
    expect(STRATEGIC_PROFILE_LOGIN_INTENT_COPY.description).not.toContain("crédito");
    expect(STRATEGIC_PROFILE_LOGIN_INTENT_COPY.footer).toContain("volta direto para o mapa narrativo");
  });

  it("intent=analyze_video uses analyze video copy", () => {
    expect(resolveIntentCopy("/dashboard?intent=analyze_video")).toEqual(ANALYZE_VIDEO_LOGIN_INTENT_COPY);
  });

  it("intent=analyze_video takes priority over generic profile path", () => {
    expect(resolveIntentCopy("/profile?intent=analyze_video")).toEqual(ANALYZE_VIDEO_LOGIN_INTENT_COPY);
  });

  it("absolute URLs are normalized without breaking", () => {
    expect(resolveIntentCopy("https://data2content.com/profile?utm=1")).toEqual(STRATEGIC_PROFILE_LOGIN_INTENT_COPY);
    expect(resolveIntentCopy("https://data2content.com/analyze-video")).toEqual(ANALYZE_VIDEO_LOGIN_INTENT_COPY);
  });

  it("invalid URLs fall back to default copy", () => {
    expect(resolveIntentCopy("not a url")).toEqual(DEFAULT_LOGIN_INTENT_COPY);
    expect(resolveIntentCopy("https://")).toEqual(DEFAULT_LOGIN_INTENT_COPY);
  });

  it("does not use forbidden terms", () => {
    const text = textOf([
      DEFAULT_LOGIN_INTENT_COPY,
      STRATEGIC_PROFILE_LOGIN_INTENT_COPY,
      ANALYZE_VIDEO_LOGIN_INTENT_COPY,
      resolveIntentCopy("/calculator"),
      resolveIntentCopy("/media-kit"),
      resolveIntentCopy("/planning"),
      resolveIntentCopy("/campaigns"),
      resolveIntentCopy("/discover"),
    ]);

    for (const forbidden of [
      "score",
      "nota",
      "pontos",
      "ranking",
      "gabarito",
      "garantido",
      "certeza",
      "comprovado",
      "viralizar garantido",
      "match real",
      "marca garantida",
      "patrocínio garantido",
      "vídeos salvos",
      "histórico de vídeos",
      "novo mídia kit",
      "mídia kit mobile",
      "18 sinais",
      "3 narrativas",
      "percentual de perfil",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("does not import forbidden integrations", () => {
    const importLines = fs.readFileSync(SOURCE_PATH, "utf8")
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    for (const forbidden of ["NextAuth", "fetch", "Prisma", "banco", "Gemini", "OpenAI", "Stripe", "SDK"]) {
      expect(importLines).not.toContain(forbidden);
    }
  });
});
