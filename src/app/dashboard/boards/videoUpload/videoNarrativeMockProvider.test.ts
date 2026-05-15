import fs from "fs";
import path from "path";

import {
  buildPostCreationVideoSeedFromAnalysis,
  hasUsefulPostCreationVideoSeed,
} from "./videoNarrativePostCreationSeed";
import {
  getVideoNarrativeSuggestedNextStep,
  hasUsefulVideoNarrativeAnalysis,
} from "./videoNarrativeAnalysisTypes";
import {
  VideoNarrativeMockProviderScenario,
  runVideoNarrativeMockProvider,
  runVideoNarrativeMockProviderBatch,
} from "./videoNarrativeMockProvider";

const forbiddenTerms = [
  "garantido",
  "certeza",
  "comprovado",
  "viralizar garantido",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "resposta correta",
  "venceu",
  "perdeu",
];

function run(scenario: VideoNarrativeMockProviderScenario, id = "analysis-1") {
  return runVideoNarrativeMockProvider({
    input: { id, creatorQuestion: "Quero entender esse vídeo.", createdAt: "2026-05-15T10:00:00.000Z" },
    options: { scenario },
  });
}

describe("videoNarrativeMockProvider", () => {
  it("returns useful skincare routine analysis", () => {
    const result = run("skincare_routine");

    expect(hasUsefulVideoNarrativeAnalysis(result)).toBe(true);
    expect(result.summary).toContain("skincare");
    expect(result.spokenTopics).toEqual(expect.arrayContaining(["skincare", "autocuidado"]));
    expect(result.visualElements).toContain("produtos de skincare");
    expect(result.onScreenText).toContain("Rotina da manhã");
    expect(result.d2cClassification).toMatchObject({
      format: "reel",
      proposal: "tips",
      context: "autocuidado",
      tone: "educational",
    });
  });

  it("fills brand match and evidence for skincare routine", () => {
    const result = run("skincare_routine");

    expect(result.brandMatch.enabled).toBe(true);
    expect(result.brandMatch.territories).toEqual(expect.arrayContaining(["autocuidado", "skincare"]));
    expect(result.evidence.transcript).toContain("rotina de skincare");
    expect(result.evidence.ocr).toContain("Rotina da manhã");
    expect(result.evidence.frames.length).toBeGreaterThan(0);
  });

  it("returns backstage process proposal and process signal", () => {
    const result = run("backstage_process");

    expect(result.d2cClassification.proposal).toBe("behind_the_scenes");
    expect(result.d2cClassification.narrative).toContain("bastidor");
    expect(result.profileSignals).toContainEqual(
      expect.objectContaining({ type: "content_strength", value: "bastidor e processo" }),
    );
  });

  it("returns brand potential with organic ad blueprint", () => {
    const result = run("brand_potential");

    expect(result.brandMatch.enabled).toBe(true);
    expect(result.brandMatch.territories).toEqual(expect.arrayContaining(["beleza", "autocuidado"]));
    expect(result.blueprintSuggestion.whatToPost).toContain("publi orgânica");
  });

  it("returns weak hook with recommendations", () => {
    const result = run("weak_hook");

    expect(result.hook.strength).toBe("weak");
    expect(result.diagnosis.weaknesses.join(" ")).toContain("abertura");
    expect(result.diagnosis.recommendedAdjustments.join(" ")).toContain("Abrir com");
  });

  it("suggests strengthening hook for weak hook scenario", () => {
    expect(getVideoNarrativeSuggestedNextStep(run("weak_hook"))).toBe(
      "Reforçar o gancho antes de transformar o vídeo em roteiro.",
    );
  });

  it("returns collab proposal and blueprint", () => {
    const result = run("collab_potential");

    expect(result.d2cClassification.proposal).toBe("collab_narrative");
    expect(result.d2cClassification.narrative).toContain("troca entre comunidades");
    expect(result.blueprintSuggestion.whatToPost).toContain("collab");
  });

  it("returns low-confidence unclear content that can generate seed follow-ups", () => {
    const result = run("unclear_content");
    const seed = buildPostCreationVideoSeedFromAnalysis({ id: "seed-1", analysis: result });

    expect(result.confidence).toBe("low");
    expect(result.hook.strength).toBe("unknown");
    expect(result.blueprintSuggestion.whatToPost).toBeNull();
    expect(seed.followUpQuestions.length).toBeGreaterThan(0);
  });

  it("returns ad adaptation and seed brand hints", () => {
    const result = run("ad_adaptation");
    const seed = buildPostCreationVideoSeedFromAnalysis({ id: "seed-1", analysis: result });

    expect(result.d2cClassification.proposal).toBe("ad_adaptation");
    expect(result.brandMatch.enabled).toBe(true);
    expect(seed.brandMatchHints.length).toBeGreaterThan(0);
  });

  it("uses safe fallback id for empty input id", () => {
    expect(run("skincare_routine", "").id).toBe("mock-video-narrative-analysis");
  });

  it("preserves createdAt from input", () => {
    expect(run("skincare_routine").createdAt).toBe("2026-05-15T10:00:00.000Z");
  });

  it("lets confidence option override default", () => {
    expect(
      runVideoNarrativeMockProvider({
        input: { id: "analysis-1", creatorQuestion: null },
        options: { scenario: "skincare_routine", confidence: "high" },
      }).confidence,
    ).toBe("high");
  });

  it("preserves input order in batch", () => {
    const results = runVideoNarrativeMockProviderBatch({
      inputs: [
        { id: "analysis-a", creatorQuestion: null },
        { id: "analysis-b", creatorQuestion: null },
      ],
      options: { scenario: "backstage_process" },
    });

    expect(results.map((result) => result.id)).toEqual(["analysis-a", "analysis-b"]);
  });

  it("builds a useful seed from mock analysis", () => {
    const seed = buildPostCreationVideoSeedFromAnalysis({ id: "seed-1", analysis: run("skincare_routine") });

    expect(hasUsefulPostCreationVideoSeed(seed)).toBe(true);
    expect(seed.initialIdea || seed.followUpQuestions.length > 0).toBeTruthy();
  });

  it("keeps scenario language conservative", () => {
    const text = JSON.stringify(
      [
        "skincare_routine",
        "backstage_process",
        "brand_potential",
        "weak_hook",
        "collab_potential",
        "unclear_content",
        "ad_adaptation",
      ].map((scenario) => run(scenario as VideoNarrativeMockProviderScenario)),
    ).toLowerCase();

    for (const term of forbiddenTerms) {
      expect(text).not.toContain(term);
    }
    expect(text).not.toContain("erro");
  });

  it("does not import UI, providers, storage, or product integrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "videoNarrativeMockProvider.ts"), "utf8");

    expect(source).toContain("./videoNarrativeAnalysisTypes");
    expect(source).not.toContain("BoardShell");
    expect(source).not.toContain("PostCreationFunnelBoardShell");
    expect(source).not.toContain("OpenAI");
    expect(source).not.toContain("Gemini");
    expect(source).not.toContain("fetch");
    expect(source).not.toContain("Prisma");
    expect(source).not.toContain("storage");
    expect(source).not.toContain("ffmpeg");
  });
});
