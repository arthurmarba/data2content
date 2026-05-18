import fs from "fs";
import path from "path";
import { buildVideoNarrativeAppPreviewScenario } from "./buildVideoNarrativeAppPreviewScenario";

describe("buildVideoNarrativeAppPreviewScenario", () => {
  it("builds the default skincare scenario", () => {
    const preview = buildVideoNarrativeAppPreviewScenario();

    expect(preview.scenario.id).toBe("skincare");
    expect(preview.scenario.creatorQuestion).toBe("Quero saber se vale postar");
    expect(preview.analysis.id).toContain("skincare");
    expect(preview.seed.analysisId).toBe(preview.analysis.id);
  });

  it("builds the brand scenario with brand question", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ scenario: "brand" });

    expect(preview.scenario.id).toBe("brand");
    expect(preview.scenario.creatorQuestion).toContain("marcas");
    expect(preview.diagnosis.brandPotential.enabled).toBe(true);
  });

  it("builds the weak hook scenario with hook question", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ scenario: "weak-hook" });

    expect(preview.scenario.creatorQuestion).toContain("gancho");
    expect(preview.analysis.hook.strength).toBe("weak");
  });

  it("uses free access by default", () => {
    expect(buildVideoNarrativeAppPreviewScenario().accessLevel).toBe("free");
  });

  it("uses disconnected Instagram by default", () => {
    expect(buildVideoNarrativeAppPreviewScenario().instagramConnected).toBe(false);
  });

  it("respects premium access", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ access: "premium" });

    expect(preview.accessLevel).toBe("premium");
    expect(preview.flowState.context.accessLevel).toBe("premium");
  });

  it("respects instagram_optimized access", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ access: "instagram_optimized" });

    expect(preview.accessLevel).toBe("instagram_optimized");
    expect(preview.flowState.context.accessLevel).toBe("instagram_optimized");
  });

  it("respects connected Instagram", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ instagram: "connected" });

    expect(preview.instagramConnected).toBe(true);
    expect(preview.flowState.context.instagramConnected).toBe(true);
  });

  it("welcome stage has no video or diagnosis context", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ stage: "welcome" });

    expect(preview.flowState.context.hasVideo).toBe(false);
    expect(preview.flowState.context.hasDiagnosis).toBe(false);
  });

  it("upload_video stage shows upload CTA", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ stage: "upload_video" });

    expect(preview.flowState.copy.ctas.some((cta) => cta.label === "Subir vídeo")).toBe(true);
  });

  it("analyzing_video stage has loading messages", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ stage: "analyzing_video" });

    expect(preview.flowState.copy.loadingMessages).toContain("Identificando gancho");
  });

  it("asking_creator_goal stage has central question", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ stage: "asking_creator_goal" });

    expect(preview.flowState.copy.title).toBe("O que você quer entender sobre esse vídeo?");
  });

  it("adaptive_quiz stage includes 3 to 5 questions", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ stage: "adaptive_quiz" });

    expect(preview.quiz.questions.length).toBeGreaterThanOrEqual(3);
    expect(preview.quiz.questions.length).toBeLessThanOrEqual(5);
  });

  it("diagnosis_ready stage includes useful diagnosis", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ stage: "diagnosis_ready" });

    expect(preview.flowState.context.hasDiagnosis).toBe(true);
    expect(preview.flowState.context.hasUsefulDiagnosis).toBe(true);
    expect(preview.diagnosis.mainNarrative || preview.diagnosis.strategicReading).toBeTruthy();
  });

  it("diagnosis_ready free has locked sections", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ stage: "diagnosis_ready", access: "free" });

    expect(preview.diagnosis.lockedSections.length).toBeGreaterThan(0);
    expect(preview.flowState.context.lockedSectionsCount).toBe(preview.diagnosis.lockedSections.length);
  });

  it("instagram_optimized connected unlocks Instagram comparison when possible", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({
      stage: "diagnosis_ready",
      access: "instagram_optimized",
      instagram: "connected",
      scenario: "brand",
    });

    expect(preview.diagnosis.instagramComparison.connected).toBe(true);
    expect(preview.diagnosis.instagramComparison.locked).toBe(false);
  });

  it("creates creator profile from diagnosis creatorSignals", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ stage: "diagnosis_ready", scenario: "brand" });

    expect(preview.diagnosis.creatorSignals.length).toBeGreaterThan(0);
    expect(preview.creatorProfile.signals.length).toBeGreaterThan(0);
  });

  it("unclear scenario generates missing context quiz or context question", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ scenario: "unclear", stage: "adaptive_quiz" });
    const keys = preview.quiz.questions.map((question) => question.key);

    expect(keys.some((key) => key === "missing_context" || key === "narrative_preference")).toBe(true);
  });

  it("does not import forbidden integrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "buildVideoNarrativeAppPreviewScenario.ts"), "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    for (const forbidden of [
      "OpenAI",
      "fetch",
      "Prisma",
      "banco",
      "endpoint",
      "storage",
      "analytics",
      "ffmpeg",
      "Stripe",
      "billing",
      "GoogleGenAI",
      "BoardShell",
      "PostCreationFunnelState",
    ]) {
      expect(importLines).not.toContain(forbidden);
    }
  });
});
