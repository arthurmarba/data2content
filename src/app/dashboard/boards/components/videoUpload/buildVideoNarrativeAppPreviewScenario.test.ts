import fs from "fs";
import path from "path";
import { buildVideoNarrativeAppPreviewScenario } from "./buildVideoNarrativeAppPreviewScenario";

describe("buildVideoNarrativeAppPreviewScenario", () => {
  function stringify(value: unknown): string {
    return JSON.stringify(value).toLowerCase();
  }

  it("builds the default skincare scenario", () => {
    const preview = buildVideoNarrativeAppPreviewScenario();

    expect(preview.scenario.id).toBe("skincare");
    expect(preview.scenario.creatorQuestion).toBe("Quero saber se vale postar");
    expect(preview.analysis.id).toContain("skincare");
    expect(preview.seed.analysisId).toBe(preview.analysis.id);
  });

  it("returns evolvingDiagnosis", () => {
    const preview = buildVideoNarrativeAppPreviewScenario();

    expect(preview.evolvingDiagnosis.videoDiagnosisId).toBe(preview.diagnosis.id);
    expect(preview.evolvingDiagnosis.unlockedSignals.length).toBeGreaterThan(0);
  });

  it("returns accessRules", () => {
    const preview = buildVideoNarrativeAppPreviewScenario();

    expect(preview.accessRules.accessLevel).toBe(preview.accessLevel);
    expect(preview.accessRules.visibleSections.length).toBeGreaterThan(0);
  });

  it("returns diagnosisPresentation", () => {
    const preview = buildVideoNarrativeAppPreviewScenario();

    expect(preview.diagnosisPresentation.accessLevel).toBe(preview.accessLevel);
    expect(preview.diagnosisPresentation.priorityCards.length).toBeGreaterThan(0);
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

  it("free scenario generates first_reading value layer", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ access: "free" });

    expect(preview.evolvingDiagnosis.accessLevel).toBe("free");
    expect(preview.accessRules.valueLayer).toBe("first_reading");
  });

  it("free scenario generates first reading presentation hero", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ access: "free" });

    expect(preview.diagnosisPresentation.hero.title).toBe("Primeira leitura do seu vídeo");
    expect(preview.diagnosisPresentation.hero.badge.label).toBe("Primeira leitura gratuita");
  });

  it("free scenario generates locked presentation previews", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ access: "free" });

    expect(preview.diagnosisPresentation.lockedPreviews.length).toBeGreaterThan(0);
  });

  it("uses disconnected Instagram by default", () => {
    expect(buildVideoNarrativeAppPreviewScenario().instagramConnected).toBe(false);
  });

  it("respects premium access", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ access: "premium" });

    expect(preview.accessLevel).toBe("premium");
    expect(preview.flowState.context.accessLevel).toBe("premium");
  });

  it("premium scenario generates strategic_map value layer", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ access: "premium" });

    expect(preview.evolvingDiagnosis.accessLevel).toBe("premium");
    expect(preview.accessRules.valueLayer).toBe("strategic_map");
  });

  it("premium scenario generates complete diagnosis presentation hero", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ access: "premium" });

    expect(preview.diagnosisPresentation.hero.title).toBe("Seu mapa estratégico foi atualizado");
    expect(preview.diagnosisPresentation.hero.badge.label).toBe("Diagnóstico completo");
  });

  it("premium disconnected scenario keeps instagram_precision locked", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({
      access: "premium",
      instagram: "disconnected",
    });

    expect(preview.diagnosisPresentation.sections.map((section) => section.id)).not.toContain("instagram_precision");
    expect(preview.diagnosisPresentation.lockedPreviews.map((previewItem) => previewItem.id)).toContain(
      "locked-instagram_precision",
    );
  });

  it("respects instagram_optimized access", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ access: "instagram_optimized" });

    expect(preview.accessLevel).toBe("instagram_optimized");
    expect(preview.flowState.context.accessLevel).toBe("instagram_optimized");
  });

  it("instagram_optimized connected scenario generates instagram_precision value layer", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({
      access: "instagram_optimized",
      instagram: "connected",
    });

    expect(preview.evolvingDiagnosis.accessLevel).toBe("instagram_optimized");
    expect(preview.accessRules.valueLayer).toBe("instagram_precision");
  });

  it("instagram_optimized connected scenario includes instagram_precision presentation section", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({
      access: "instagram_optimized",
      instagram: "connected",
    });

    expect(preview.diagnosisPresentation.hero.badge.label).toBe("Leitura mais precisa");
    expect(preview.diagnosisPresentation.sections.map((section) => section.id)).toContain("instagram_precision");
    expect(stringify(preview.diagnosisPresentation)).not.toContain("dados reais");
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

    expect(preview.flowState.copy.loadingMessages).toContain("Lendo a abertura");
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

  it("brand scenario generates future brand opportunity without real match", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({
      scenario: "brand",
      access: "premium",
    });
    const text = stringify(preview.diagnosisPresentation);

    expect(preview.diagnosisPresentation.sections.map((section) => section.id)).toContain("brand_opportunities");
    expect(text).toContain("oportunidade futura");
    expect(text).not.toContain("match real");
    expect(text).not.toContain("garantido");
    expect(text).not.toContain("comprovado");
    expect(text).not.toContain("certeza");
  });

  it("collab scenario generates future collab opportunity without real creator names", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({
      scenario: "collab",
      access: "premium",
    });
    const text = stringify(preview.diagnosisPresentation);

    expect(preview.diagnosisPresentation.sections.map((section) => section.id)).toContain("collab_opportunities");
    expect(text).toContain("tipo de collab");
    expect(text).not.toContain("creator famoso");
    expect(text).not.toContain("match real");
  });

  it("unclear scenario generates missing context quiz or context question", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({ scenario: "unclear", stage: "adaptive_quiz" });
    const keys = preview.quiz.questions.map((question) => question.key);

    expect(keys.some((key) => key === "missing_context" || key === "narrative_preference")).toBe(true);
  });

  it("keeps existing scenarios resolving by query params", () => {
    [
      "skincare",
      "backstage",
      "brand",
      "weak-hook",
      "collab",
      "ad-adaptation",
      "unclear",
    ].forEach((scenario) => {
      expect(buildVideoNarrativeAppPreviewScenario({ scenario }).scenario.id).toBe(scenario);
    });
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

  it("does not alter endpoint or visual UI", () => {
    const source = fs.readFileSync(path.join(__dirname, "buildVideoNarrativeAppPreviewScenario.ts"), "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    [
      "route.ts",
      "app/api",
      "VideoNarrativeDiagnosisBlocks",
      "VideoNarrativeAppPreview",
      "VideoNarrativeInteractiveAppPreview",
      "React",
      "tsx",
    ].forEach((forbidden) => {
      expect(importLines).not.toContain(forbidden);
    });
  });
});
