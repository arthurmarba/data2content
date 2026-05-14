import {
  SUPPORTED_NARRATIVE_SOURCE_INTENTS,
  SUPPORTED_NARRATIVE_SOURCE_TYPES,
  createEmptyNarrativeSource,
  isSupportedNarrativeSourceIntent,
  isSupportedNarrativeSourceType,
} from "./narrativeSourceTypes";

const forbiddenLanguage = [
  "garantido",
  "certeza",
  "comprovado",
  "viralizar",
  "score",
  "nota",
  "pontuação",
];

describe("narrativeSourceTypes", () => {
  it("recognizes valid source types", () => {
    for (const sourceType of SUPPORTED_NARRATIVE_SOURCE_TYPES) {
      expect(isSupportedNarrativeSourceType(sourceType)).toBe(true);
    }
  });

  it("rejects invalid source types", () => {
    expect(isSupportedNarrativeSourceType("video_upload")).toBe(false);
    expect(isSupportedNarrativeSourceType("instagram_reel")).toBe(false);
    expect(isSupportedNarrativeSourceType("")).toBe(false);
  });

  it("recognizes valid intents", () => {
    for (const intent of SUPPORTED_NARRATIVE_SOURCE_INTENTS) {
      expect(isSupportedNarrativeSourceIntent(intent)).toBe(true);
    }
  });

  it("rejects invalid intents", () => {
    expect(isSupportedNarrativeSourceIntent("make_it_viral")).toBe(false);
    expect(isSupportedNarrativeSourceIntent("score_content")).toBe(false);
    expect(isSupportedNarrativeSourceIntent("")).toBe(false);
  });

  it("creates an empty narrative source with safe defaults", () => {
    const source = createEmptyNarrativeSource({
      id: "source-1",
      sourceType: "video_simulated",
    });

    expect(source).toEqual({
      id: "source-1",
      sourceType: "video_simulated",
      rawText: null,
      creatorQuestion: null,
      transcript: null,
      visualDescription: null,
      metadata: {},
      createdAt: null,
    });
  });

  it("does not use absolute-promise or score language in defaults", () => {
    const source = createEmptyNarrativeSource({
      id: "source-language",
      sourceType: "text_prompt",
    });
    const text = JSON.stringify({
      source,
      sourceTypes: SUPPORTED_NARRATIVE_SOURCE_TYPES,
      intents: SUPPORTED_NARRATIVE_SOURCE_INTENTS,
    }).toLowerCase();

    for (const term of forbiddenLanguage) {
      expect(text).not.toContain(term);
    }
  });
});
